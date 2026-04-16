"""
CBC Kuda Foreign Exchange — FX Facility Risk Dashboard
Azure Functions v2 API
Processes the daily FXFlow Excel/CSV export and returns all dashboard data as JSON.
"""

import azure.functions as func
import json
import logging
import io
import os
from datetime import datetime, date
import pandas as pd
import numpy as np

# Azure Blob Storage — only imported when connection string is available
try:
    from azure.storage.blob import BlobServiceClient
    BLOB_AVAILABLE = True
except ImportError:
    BLOB_AVAILABLE = False

STORAGE_CONN_STR   = os.environ.get("AZURE_STORAGE_CONNECTION_STRING", "")
HISTORY_CONTAINER  = "fx-history"

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

# ─── Constants ────────────────────────────────────────────────────────────────
FACILITY_DEALING_CAP_USD   = 24_000_000
FACILITY_PFE_LIMIT_ZAR     = 35_000_000
FACILITY_SETTLEMENT_LIMIT  = 5_000_000   # USD per settlement date
FACILITY_MAX_TENOR_DAYS    = 366
CSA_THRESHOLD_ZAR          = -15_000_000  # Kuda threshold (negative = Investec calls collateral)
CSA_MIN_TRANSFER_ZAR       = 500_000
SCENARIO_RATES             = [13, 14, 15, 16, 17, 17.5, 18, 18.5, 18.65, 19, 19.5, 20]


# ─── HTTP Trigger ──────────────────────────────────────────────────────────────
@app.route(route="process", methods=["POST"])
def process(req: func.HttpRequest) -> func.HttpResponse:
    """
    Accepts a multipart/form-data POST with:
      - trades_file  : The FXFlow Excel (.xlsx) Open Trades report (required)
      - spot_usd_zar : Current USD/ZAR spot rate (optional, default derived from data)
      - gbp_usd      : GBP/USD cross rate (optional, default derived from data)
      - eur_usd      : EUR/USD cross rate (optional, default derived from data)
      - prev_mtm_zar : Previous day Kuda MTM in ZAR (optional, for bridge section)
      - prev_rate    : Previous day USD/ZAR rate (optional, for bridge section)
    Returns JSON with all dashboard sections.
    """
    logging.info("process() called")

    try:
        # ── Parse inputs ──────────────────────────────────────────────────────
        trades_file = req.files.get("trades_file")
        if not trades_file:
            return _error("trades_file is required (FXFlow Open Trades Excel export)")

        spot_usd_zar = float(req.form.get("spot_usd_zar", 0) or 0)
        gbp_usd      = float(req.form.get("gbp_usd",      0) or 0)
        eur_usd      = float(req.form.get("eur_usd",      0) or 0)
        # prev_mtm_zar / prev_rate: accept manual override but auto-load from history if not provided
        prev_mtm_zar = float(req.form.get("prev_mtm_zar", 0) or 0)
        prev_rate    = float(req.form.get("prev_rate",    0) or 0)

        file_bytes = trades_file.read()
        filename   = trades_file.filename.lower()

        # ── Parse optional Facility Summary file ──────────────────────────────
        summary_file    = req.files.get("facility_summary_file")
        facility_summary = {}
        if summary_file:
            try:
                facility_summary = _parse_facility_summary(summary_file.read())
                logging.info(f"Facility Summary parsed: {facility_summary}")
            except Exception as e:
                logging.warning(f"Could not parse facility summary: {e}")

        # ── Load data ─────────────────────────────────────────────────────────
        df = _load_trades(file_bytes, filename)

        # ── Resolve spot rate ─────────────────────────────────────────────────
        # Priority: user-supplied > Facility Summary (authoritative FXFlow) > live API > book avg
        if spot_usd_zar > 0:
            spot_source = "user"
            # Still fill missing cross-rates via live API / book
            _, gbp_usd, eur_usd, _ = _derive_rates(df, 0, gbp_usd, eur_usd)
        elif facility_summary.get("market_rate_usd_zar", 0) > 0:
            spot_usd_zar = facility_summary["market_rate_usd_zar"]
            spot_source  = "fxflow"
            _, gbp_usd, eur_usd, _ = _derive_rates(df, 0, gbp_usd, eur_usd)
        else:
            spot_usd_zar, gbp_usd, eur_usd, spot_source = _derive_rates(df, 0, gbp_usd, eur_usd)

        # ── Auto-load previous day from history (powers the bridge section) ───
        mtm_date = df["MTM_DATE"].iloc[0].strftime("%Y-%m-%d") if not df["MTM_DATE"].isna().all() else "unknown"

        if not prev_mtm_zar or not prev_rate:
            prev_snap = _load_previous_snapshot(mtm_date)
            if prev_snap:
                prev_mtm_zar = prev_mtm_zar or prev_snap.get("mtm_zar",     0)
                prev_rate    = prev_rate    or prev_snap.get("spot_usd_zar", 0)
                logging.info(f"Auto-loaded prev day from history: MTM={prev_mtm_zar}, rate={prev_rate}")

        # ── Run all calculations ───────────────────────────────────────────────
        result = {
            "meta": {
                "mtm_date":        mtm_date,
                "spot_usd_zar":    round(spot_usd_zar, 4),
                "spot_source":     spot_source,   # "user" | "fxflow" | "live" | "book"
                "gbp_usd":         round(gbp_usd, 4),
                "eur_usd":         round(eur_usd, 4),
                "total_trades":    len(df),
                "has_summary":     bool(facility_summary),
                "generated_at":    datetime.utcnow().isoformat() + "Z",
            },
            "facility_limits":   _calc_facility_limits(df, spot_usd_zar, gbp_usd, eur_usd, facility_summary),
            "csa_monitor":       _calc_csa_monitor(df, spot_usd_zar, gbp_usd, eur_usd),
            "mtm_bridge":        _calc_mtm_bridge(df, prev_mtm_zar, prev_rate, spot_usd_zar, gbp_usd, eur_usd),
            "scenario_analysis": _calc_scenario_analysis(df, spot_usd_zar, gbp_usd, eur_usd),
            "top_clients":       _calc_top_clients(df, spot_usd_zar, gbp_usd, eur_usd),
            "maturity_profile":  _calc_maturity_profile(df),
            "settled_today":     _calc_settled_today(df),
        }

        # ── Save snapshot to blob storage (if configured) ─────────────────────
        _save_snapshot(mtm_date, result)

        return func.HttpResponse(
            json.dumps(result, default=_json_serial),
            mimetype="application/json",
            headers={"Access-Control-Allow-Origin": "*"},
        )

    except Exception as e:
        logging.exception("Unhandled error in process()")
        return _error(str(e), status_code=500)


@app.route(route="process", methods=["OPTIONS"])
def process_options(req: func.HttpRequest) -> func.HttpResponse:
    """CORS preflight."""
    return func.HttpResponse(
        "",
        status_code=204,
        headers={
            "Access-Control-Allow-Origin":  "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        },
    )


@app.route(route="history", methods=["GET"])
def history(req: func.HttpRequest) -> func.HttpResponse:
    """
    Returns the last N days of daily snapshots from blob storage.
    Query params:
      - days : number of days to return (default 90)
    """
    try:
        days = int(req.params.get("days", 90))
        snapshots = _load_snapshots(days)
        return func.HttpResponse(
            json.dumps({"snapshots": snapshots}, default=_json_serial),
            mimetype="application/json",
            headers={"Access-Control-Allow-Origin": "*"},
        )
    except Exception as e:
        logging.exception("Error in history()")
        return _error(str(e), status_code=500)


@app.route(route="history", methods=["OPTIONS"])
def history_options(req: func.HttpRequest) -> func.HttpResponse:
    return func.HttpResponse(
        "",
        status_code=204,
        headers={
            "Access-Control-Allow-Origin":  "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        },
    )


@app.route(route="today", methods=["GET"])
def today(req: func.HttpRequest) -> func.HttpResponse:
    """
    Returns today's full dashboard JSON if it has been uploaded, or 404 if not yet uploaded.
    The frontend calls this on page load — if data exists, skip the upload screen entirely.
    Optionally accepts ?date=YYYY-MM-DD to fetch a specific day (for debugging).
    """
    try:
        target_date = req.params.get("date") or date.today().isoformat()
        client = _get_blob_client()
        if not client:
            return func.HttpResponse(
                json.dumps({"error": "storage_not_configured"}),
                status_code=503,
                mimetype="application/json",
                headers={"Access-Control-Allow-Origin": "*"},
            )
        container  = client.get_container_client(HISTORY_CONTAINER)
        blob_name  = f"full/{target_date}.json"
        try:
            data = container.download_blob(blob_name).readall()
            return func.HttpResponse(
                data,
                mimetype="application/json",
                headers={"Access-Control-Allow-Origin": "*"},
            )
        except Exception:
            # Blob doesn't exist — no upload yet today
            return func.HttpResponse(
                json.dumps({"error": "not_uploaded", "date": target_date}),
                status_code=404,
                mimetype="application/json",
                headers={"Access-Control-Allow-Origin": "*"},
            )
    except Exception as e:
        logging.exception("Error in today()")
        return _error(str(e), status_code=500)


@app.route(route="today", methods=["OPTIONS"])
def today_options(req: func.HttpRequest) -> func.HttpResponse:
    return func.HttpResponse(
        "",
        status_code=204,
        headers={
            "Access-Control-Allow-Origin":  "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        },
    )


@app.route(route="health", methods=["GET"])
def health(req: func.HttpRequest) -> func.HttpResponse:
    """Diagnostic endpoint — confirms API is alive and storage config status."""
    storage_configured = bool(STORAGE_CONN_STR)
    storage_reachable  = False
    snapshot_count     = 0

    if storage_configured and BLOB_AVAILABLE:
        try:
            client    = BlobServiceClient.from_connection_string(STORAGE_CONN_STR)
            container = client.get_container_client(HISTORY_CONTAINER)
            try:
                container.create_container()
            except Exception:
                pass
            blobs          = list(container.list_blobs())
            snapshot_count = len(blobs)
            storage_reachable = True
        except Exception as e:
            logging.warning(f"Health check storage error: {e}")

    # Test live rate fetch so we can diagnose which source works from Azure
    live_rate, live_rate_source = 0.0, "failed"
    try:
        zar, _, _ = _fetch_live_spot()
        if zar > 0:
            live_rate        = round(zar, 4)
            live_rate_source = "ok"
    except Exception:
        pass

    return func.HttpResponse(
        json.dumps({
            "status":              "ok",
            "blob_sdk_available":  BLOB_AVAILABLE,
            "storage_configured":  storage_configured,
            "storage_reachable":   storage_reachable,
            "snapshot_count":      snapshot_count,
            "conn_str_prefix":     STORAGE_CONN_STR[:30] + "..." if STORAGE_CONN_STR else "NOT SET",
            "live_rate_usd_zar":   live_rate,
            "live_rate_source":    live_rate_source,
        }),
        mimetype="application/json",
        headers={"Access-Control-Allow-Origin": "*"},
    )


# ─── Blob Storage Helpers ─────────────────────────────────────────────────────

def _get_blob_client():
    """Return a BlobServiceClient or None if not configured."""
    if not BLOB_AVAILABLE or not STORAGE_CONN_STR:
        return None
    try:
        return BlobServiceClient.from_connection_string(STORAGE_CONN_STR)
    except Exception:
        logging.warning("Could not connect to blob storage — history disabled")
        return None


def _save_snapshot(mtm_date: str, result: dict):
    """
    Save two blobs to Azure Blob Storage on each upload:
      1. full/{date}.json  — complete dashboard JSON so any browser can load today's data
      2. {date}.json       — compact history snapshot for the trend chart
    """
    client = _get_blob_client()
    if not client:
        logging.warning("_save_snapshot: no blob client — storage not configured")
        return
    try:
        container = client.get_container_client(HISTORY_CONTAINER)
        try:
            container.create_container()
        except Exception:
            pass  # Already exists

        # ── 1. Full dashboard blob (any team member loads this on visit) ──────
        full_blob_name = f"full/{mtm_date}.json"
        full_blob_data = json.dumps(result, default=_json_serial)
        container.get_blob_client(full_blob_name).upload_blob(full_blob_data, overwrite=True)
        logging.info(f"Full dashboard saved: {full_blob_name} ({len(full_blob_data)} bytes)")

        # ── 2. Compact history snapshot (for the 90-day trend chart) ─────────
        snapshot = {
            "date":             mtm_date,
            "mtm_zar":          result["csa_monitor"]["current_mtm_kuda_zar"],
            "status":           result["csa_monitor"]["status"],
            "buffer_zar":       result["csa_monitor"]["buffer_zar"],
            "trigger_rate":     result["csa_monitor"]["trigger_rate"],
            "spot_usd_zar":     result["meta"]["spot_usd_zar"],
            "total_trades":     result["meta"]["total_trades"],
            "net_nominal_usd":  result["facility_limits"]["net_nominal_usd"],
            "long_nominal_usd": result["facility_limits"]["long_nominal_usd"],
            "nominal_util_pct": result["facility_limits"]["nominal_utilisation_pct"],
            "settled_count":    result["settled_today"]["count"],
            "settled_mtm":      result["settled_today"]["total_mtm"],
        }
        compact_blob_data = json.dumps(snapshot, default=_json_serial)
        container.get_blob_client(f"{mtm_date}.json").upload_blob(compact_blob_data, overwrite=True)
        logging.info(f"History snapshot saved: {mtm_date}.json")

    except Exception as e:
        logging.warning(f"Failed to save snapshot: {e}")


def _load_snapshots(days: int = 90) -> list:
    """Load the last N daily compact snapshots (YYYY-MM-DD.json) from blob storage.
    Excludes full/ blobs which have a different structure."""
    client = _get_blob_client()
    if not client:
        return []
    try:
        container = client.get_container_client(HISTORY_CONTAINER)
        blobs = list(container.list_blobs())

        # Only compact snapshots — name matches YYYY-MM-DD.json exactly (no slash)
        compact = [b for b in blobs if not b.name.startswith("full/") and b.name.endswith(".json")]
        compact.sort(key=lambda b: b.name, reverse=True)
        compact = compact[:days]

        snapshots = []
        for blob in compact:
            try:
                data = container.download_blob(blob.name).readall()
                snap = json.loads(data)
                snapshots.append(snap)
            except Exception as e:
                logging.warning(f"Could not load snapshot {blob.name}: {e}")

        return snapshots
    except Exception as e:
        logging.warning(f"Failed to load snapshots: {e}")
        return []


def _load_previous_snapshot(today_date: str) -> dict | None:
    """
    Load the most recent snapshot that is BEFORE today_date.
    Used to auto-populate the day-on-day MTM bridge.
    Returns a dict with at least 'mtm_zar' and 'spot_usd_zar', or None.
    """
    client = _get_blob_client()
    if not client:
        return None
    try:
        container = client.get_container_client(HISTORY_CONTAINER)
        blobs = list(container.list_blobs())
        # Filter to blobs strictly before today, sort descending, take most recent
        prior = sorted(
            [b for b in blobs if b.name.replace(".json", "") < today_date],
            key=lambda b: b.name,
            reverse=True,
        )
        if not prior:
            return None
        data = container.download_blob(prior[0].name).readall()
        return json.loads(data)
    except Exception as e:
        logging.warning(f"Could not load previous snapshot: {e}")
        return None


# ─── Data Loading ──────────────────────────────────────────────────────────────

def _load_trades(file_bytes: bytes, filename: str) -> pd.DataFrame:
    """
    Load trades from either:
    - FXFlow Open Trades Excel (.xlsx) — preferred, has CLIENT_NAME
    - FXFlow Facility Upload CSV (.csv) — fallback, no client names
    Returns a normalised DataFrame with a canonical column set.
    """
    if filename.endswith(".xlsx") or filename.endswith(".xls"):
        return _load_excel(file_bytes)
    else:
        return _load_csv(file_bytes)


def _load_excel(file_bytes: bytes) -> pd.DataFrame:
    """Load FXFlow Open Trades Excel report (header is on row 8, 0-indexed row 7)."""
    raw = pd.read_excel(io.BytesIO(file_bytes), sheet_name=0, header=None)

    # Locate header row: first row with ≥10 non-null values and 'Client Name' in it
    header_row = None
    for i, row in raw.iterrows():
        non_null = [str(v) for v in row if pd.notna(v)]
        if any("client" in v.lower() for v in non_null) and len(non_null) >= 8:
            header_row = i
            break

    if header_row is None:
        raise ValueError(
            "Could not find header row in Excel. "
            "Expected a row containing 'Client Name' in the FXFlow Open Trades report."
        )

    df = pd.read_excel(io.BytesIO(file_bytes), sheet_name=0, header=header_row)

    # Normalise column names
    col_map = {
        "Import/Export":    "IMPORT_EXPORT",
        "Client Name":      "CLIENT_NAME",
        "External Reference": "EXT_REF",
        "Product":          "PRODUCT",
        "Product Type":     "PRODUCT_TYPE",
        "Option Type":      "OPTION_TYPE",
        "Direction":        "DIRECTION_CLIENT",  # client direction (opposite to Kuda)
        "Currency Pair":    "CCY_PAIR",
        "Notional":         "NOTIONAL_FCY",
        "Quote (ZAR)":      "NOTIONAL_ZAR",
        "Nominal (USD)":    "NOMINAL_USD",
        "Nominal (ZAR)":    "NOMINAL_ZAR2",
        "Deal Rate":        "DEAL_RATE",
        "Trade Date":       "TRADE_DATE",
        "Maturity Date":    "MATURITY_DATE",
        "MTM Date":         "MTM_DATE",
        "MTM (ZAR)":        "MTM_ZAR",     # already Kuda perspective (+ = gain)
        "MTM (USD)":        "MTM_USD",
    }
    df = df.rename(columns=col_map)

    # Drop rows without a valid CLIENT_NAME (totals, blanks)
    df = df[df["CLIENT_NAME"].notna()].copy()
    df = df[df["CLIENT_NAME"].astype(str).str.strip() != ""].copy()
    df["CLIENT_NAME"] = df["CLIENT_NAME"].astype(str).str.strip()

    # Parse dates
    for col in ["TRADE_DATE", "MATURITY_DATE", "MTM_DATE"]:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce")

    # Numeric coercion
    for col in ["NOTIONAL_FCY", "NOTIONAL_ZAR", "NOMINAL_USD", "DEAL_RATE", "MTM_ZAR", "MTM_USD"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    # Derive Kuda direction from client direction
    # Client "Sell" FCY → Kuda "Buy" FCY (and vice versa)
    # Excel Direction is the CLIENT's direction
    df["DIRECTION_KUDA"] = df["DIRECTION_CLIENT"].map({"Sell": "Buy", "Buy": "Sell"})

    # Add TRADE_CURR from CCY_PAIR (e.g. 'USD/ZAR' → 'USD')
    df["TRADE_CURR"] = df["CCY_PAIR"].str.split("/").str[0]

    # NOMINAL_USD sign: Sell (client) = Kuda long FCY = positive; Buy (client) = Kuda short = negative
    # The Excel already encodes this in sign of NOMINAL_USD
    # (verified: Sell trades have positive NOMINAL_USD, Buy trades have negative)

    return df


def _load_csv(file_bytes: bytes) -> pd.DataFrame:
    """
    Load FXFlow Facility Upload CSV as fallback.
    No CLIENT_NAME available — uses OPTIONAL_KEY as client identifier.
    """
    df = pd.read_csv(io.BytesIO(file_bytes))

    col_map = {
        "TRADE_ID":       "TRADE_ID",
        "OPTIONAL_KEY":   "EXT_REF",
        "DIRECTION":      "DIRECTION_KUDA",
        "PRODUCT_CLASS":  "PRODUCT",
        "NOTIONAL":       "NOTIONAL_FCY",
        "NOTIONAL2":      "NOTIONAL_ZAR",
        "TRADE_CURR":     "TRADE_CURR",
        "END_DATE":       "MATURITY_DATE",
        "MTM_VALUE":      "MTM_ZAR_INVESTEC",  # Investec perspective
        "MTM_VALUE_USD":  "MTM_USD",
        "PRICE":          "DEAL_RATE",
        "OPTION_TYPE":    "OPTION_TYPE",
        "STRIKE_PRICE":   "STRIKE_PRICE",
        "TRADE_DATE":     "TRADE_DATE",
        "MTM_DATE":       "MTM_DATE",
    }
    df = df.rename(columns={k: v for k, v in col_map.items() if k in df.columns})

    for col in ["TRADE_DATE", "MATURITY_DATE", "MTM_DATE"]:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce")

    for col in ["NOTIONAL_FCY", "NOTIONAL_ZAR", "DEAL_RATE", "MTM_ZAR_INVESTEC"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    # Flip MTM sign: CSV is from Investec, we need Kuda perspective
    df["MTM_ZAR"] = -df.get("MTM_ZAR_INVESTEC", pd.Series(0, index=df.index))

    # CSV NOTIONAL is signed (Buy = positive, Sell = negative)
    # Derive NOMINAL_USD: abs(NOTIONAL_FCY) with sign from Kuda direction
    df["NOMINAL_USD"] = df["NOTIONAL_FCY"]  # will be refined per-currency with cross rates later

    # No client names in CSV
    df["CLIENT_NAME"] = df["EXT_REF"]
    df["IMPORT_EXPORT"] = "Unknown"
    df["DIRECTION_CLIENT"] = df["DIRECTION_KUDA"].map({"Buy": "Sell", "Sell": "Buy"})
    df["CCY_PAIR"] = df["TRADE_CURR"] + "/ZAR"
    df["PRODUCT_TYPE"] = df["PRODUCT"]

    return df


# ─── Facility Summary Parser ──────────────────────────────────────────────────

def _parse_facility_summary(file_bytes: bytes) -> dict:
    """
    Parse the FXFlow 'Facility Summary' Excel report and extract authoritative figures.
    Expected layout (rows vary by FXFlow version):
      Row with label 'USD/ZAR'  → col[1]=closing rate, col[2]=market rate
      Row with label 'Nominal'  → col[2]=nominal_usd (market), col[5]=facility_cap_usd
      Row with label 'PFE'      → col[4]=pfe_zar (market), col[5]=pfe_limit_zar
      Row with label 'MTM Value'→ col[3]=mtm_zar (Kuda perspective, positive=in the money)
      Row with label 'Threshold'→ col[5]=csa_threshold_zar
    Returns a dict with extracted values (only keys present when values were found).
    """
    try:
        import openpyxl
        wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
        ws = wb.active
        result = {}
        for row in ws.iter_rows(values_only=True):
            if not row or row[0] is None:
                continue
            label = str(row[0]).strip().lower()
            cols  = list(row)  # 0-indexed

            def _f(idx):
                """Safe float extraction."""
                try:
                    v = cols[idx]
                    return float(v) if v is not None else None
                except (IndexError, TypeError, ValueError):
                    return None

            if label == "usd/zar":
                closing = _f(1)
                market  = _f(2)
                if closing: result["closing_rate_usd_zar"] = closing
                if market:  result["market_rate_usd_zar"]  = market

            elif label == "nominal":
                nom_market = _f(2)
                cap        = _f(5)
                if nom_market: result["nominal_usd_market"]  = nom_market
                if cap:        result["facility_cap_usd"]     = cap

            elif label == "pfe":
                pfe_market = _f(4)
                pfe_limit  = _f(5)
                if pfe_market is not None: result["pfe_zar_market"] = pfe_market
                if pfe_limit  is not None: result["pfe_limit_zar"]  = pfe_limit

            elif label == "mtm value":
                mtm_zar = _f(3)
                if mtm_zar is not None: result["mtm_zar"] = mtm_zar

            elif label == "threshold":
                threshold = _f(5)
                if threshold: result["csa_threshold_zar"] = threshold

            elif label == "csa (credit support amount)":
                csa = _f(3)
                if csa is not None: result["csa_buffer_zar"] = csa

        logging.info(f"Facility Summary parsed OK: {result}")
        return result
    except Exception as e:
        logging.warning(f"_parse_facility_summary failed: {e}")
        return {}


# ─── Rate Derivation ──────────────────────────────────────────────────────────

def _fetch_live_spot() -> tuple[float, float, float]:
    """
    Fetch live USD/ZAR, GBP/USD, EUR/USD rates.
    Tries multiple free public sources in order — returns first successful result.
    Returns (spot_usd_zar, gbp_usd, eur_usd) or (0, 0, 0) if all fail.
    """
    import urllib.request

    def _get(url, parse_fn, label):
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "Mozilla/5.0 (compatible; kuda-fx-dashboard/1.0)"},
            )
            with urllib.request.urlopen(req, timeout=6) as resp:
                data = json.loads(resp.read().decode())
            result = parse_fn(data)
            if result[0] > 0:
                logging.info(f"Live rates from {label}: USD/ZAR={result[0]:.4f}")
                return result
        except Exception as e:
            logging.warning(f"Rate source {label} failed: {e}")
        return None

    # ── Source 1: jsDelivr CDN-hosted currency data (no auth, CDN-cached) ──
    def parse_jsdelivr(d):
        usd = d.get("usd", {})
        zar = float(usd.get("zar", 0))
        gbp_inv = float(usd.get("gbp", 0))
        eur_inv = float(usd.get("eur", 0))
        return zar, (1/gbp_inv if gbp_inv > 0 else 0), (1/eur_inv if eur_inv > 0 else 0)

    r = _get(
        "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json",
        parse_jsdelivr, "jsdelivr"
    )
    if r: return r

    # ── Source 2: ExchangeRate-API (free tier, no key needed for latest) ──
    def parse_er_api(d):
        rates = d.get("rates", {})
        zar = float(rates.get("ZAR", 0))
        gbp = float(rates.get("GBP", 0))
        eur = float(rates.get("EUR", 0))
        return zar, (1/gbp if gbp > 0 else 0), (1/eur if eur > 0 else 0)

    r = _get("https://open.er-api.com/v6/latest/USD", parse_er_api, "open.er-api.com")
    if r: return r

    # ── Source 3: Coinbase public API (no key, includes ZAR) ──
    def parse_coinbase(d):
        rates = d.get("data", {}).get("rates", {})
        zar = float(rates.get("ZAR", 0))
        gbp = float(rates.get("GBP", 0))
        eur = float(rates.get("EUR", 0))
        return zar, (1/float(gbp) if float(gbp) > 0 else 0), (1/float(eur) if float(eur) > 0 else 0)

    r = _get("https://api.coinbase.com/v2/exchange-rates?currency=USD", parse_coinbase, "coinbase")
    if r: return r

    logging.warning("All live rate sources failed — falling back to book rate")
    return 0.0, 0.0, 0.0


def _derive_rates(df: pd.DataFrame, spot: float, gbp_usd: float, eur_usd: float):
    """
    Derive spot rates with the following priority:
      1. User-supplied value (passed in the form)
      2. Live market rate from open.er-api.com
      3. Book rate: median DEAL_RATE from forward trades (least accurate — labelled accordingly)
    Returns (spot, gbp_usd, eur_usd, spot_source).
    spot_source: "user" | "live" | "book"
    """
    spot_source = "user" if spot > 0 else None

    # Try to fill missing rates from live API in one call
    live_spot, live_gbp, live_eur = (0.0, 0.0, 0.0)
    if spot <= 0 or gbp_usd <= 0 or eur_usd <= 0:
        live_spot, live_gbp, live_eur = _fetch_live_spot()

    if spot <= 0:
        if live_spot > 0:
            spot = live_spot
            spot_source = "live"
        else:
            usd_trades = df[df["TRADE_CURR"] == "USD"]
            spot = float(usd_trades["DEAL_RATE"].median()) if not usd_trades.empty else 18.50
            spot_source = "book"
            logging.warning(f"Using book-derived spot rate: {spot:.4f} — user should enter today's market rate")

    if gbp_usd <= 0:
        if live_gbp > 0:
            gbp_usd = live_gbp
        else:
            gbp_trades = df[df["TRADE_CURR"] == "GBP"]
            if not gbp_trades.empty:
                gbp_usd = float(gbp_trades["DEAL_RATE"].median()) / spot
            else:
                gbp_usd = 1.27

    if eur_usd <= 0:
        if live_eur > 0:
            eur_usd = live_eur
        else:
            eur_trades = df[df["TRADE_CURR"] == "EUR"]
            if not eur_trades.empty:
                eur_usd = float(eur_trades["DEAL_RATE"].median()) / spot
            else:
                eur_usd = 1.09

    return spot, gbp_usd, eur_usd, spot_source


# ─── Sensitivity & Scenario MTM ───────────────────────────────────────────────

def _compute_sensitivity(df: pd.DataFrame, spot_usd_zar: float, gbp_usd: float, eur_usd: float) -> float:
    """
    Compute dMTM_kuda/d(USD_ZAR_spot) in ZAR per 1 USD/ZAR point.
    For USD/ZAR forwards: sensitivity_i = NOMINAL_USD_i (signed, Kuda perspective)
    For GBP/ZAR and EUR/ZAR forwards: sensitivity converted via cross rates.
    Sign: negative means MTM worsens as USD/ZAR rises (net long FCY book).
    """
    # NOMINAL_USD is already signed from Kuda's perspective in the Excel file:
    # positive = Kuda long FCY, negative = Kuda short FCY
    # Sum = net USD-equivalent FCY exposure
    # dMTM_ZAR/d(USD_ZAR) = net_FCY_notional_USD (in USD)
    # (1 USD × 1 ZAR/USD = 1 ZAR P&L per unit rate move per unit notional)

    fec_df = df[df.get("PRODUCT_TYPE", df.get("PRODUCT", "")).isin(
        ["FORWARD", "DRAWDOWN", "EXTENSION", "Currency", "CANCELLATION"]
    )] if "PRODUCT_TYPE" in df.columns else df

    sensitivity = float(fec_df["NOMINAL_USD"].sum())
    return sensitivity


def _scenario_mtm(current_mtm_kuda: float, sensitivity: float, current_rate: float, scenario_rate: float) -> float:
    """
    Linear MTM approximation: MTM_scenario = MTM_today + sensitivity × (scenario_rate - current_rate)
    sensitivity is the sum of signed NOMINAL_USD (positive = long FCY).
    As rate rises and Kuda is net long FCY (sensitivity > 0), MTM improves...

    However, the PDF shows MTM worsens as rate rises for this book.
    This is because the sensitivity from the Kuda forward perspective is:
      dMTM/dSpot = -(net_FCY_notional)
    The exporters sold FCY forward at FIXED rates; as spot rises, those fixed rates
    (now below spot) reduce the in-the-money value of Kuda's buy positions.

    We therefore negate the sensitivity for the scenario calculation:
    """
    return current_mtm_kuda + (-sensitivity) * (scenario_rate - current_rate)


# ─── Dashboard Sections ───────────────────────────────────────────────────────

def _calc_facility_limits(df: pd.DataFrame, spot: float, gbp_usd: float, eur_usd: float,
                          facility_summary: dict = None) -> dict:
    """Section 1: Facility utilisation — nominal, PFE, settlement, tenor.

    If facility_summary is provided (parsed from the FXFlow Facility Summary Excel),
    its figures take precedence over derived values for nominal and PFE, since
    FXFlow computes these using its own proprietary risk model.
    """
    if facility_summary is None:
        facility_summary = {}

    today = pd.Timestamp.today().normalize()

    # ── Nominal ───────────────────────────────────────────────────────────────
    if facility_summary.get("nominal_usd_market"):
        # Facility Summary uploaded — use FXFlow's authoritative figure directly
        long_nominal_usd  = facility_summary["nominal_usd_market"]
        gross_nominal_usd = long_nominal_usd
        net_nominal_usd   = long_nominal_usd
    else:
        # Derived from trades — matches FXFlow within ~0.7% (rate conversion diff for GBP/EUR)
        # FXFlow Nominal = long-side NOMINAL_USD for FECs + Options, excluding CANCELLATIONs
        # CANCELLATION product types offset existing trades and must NOT be counted as new exposure.
        pt = df["PRODUCT_TYPE"].str.strip() if "PRODUCT_TYPE" in df.columns else df["PRODUCT"].str.strip()
        FEC_TYPES = ["FORWARD", "DRAWDOWN", "EXTENSION"]
        OPT_TYPES = ["Vanilla", "Forward Enhancer"]

        fec_mask  = pt.isin(FEC_TYPES)
        opt_mask  = pt.isin(OPT_TYPES)

        # Long = positive NOMINAL_USD; these are Kuda's buying-side risk positions
        long_nominal_fec = float(df.loc[fec_mask & (df["NOMINAL_USD"] > 0), "NOMINAL_USD"].sum())
        long_nominal_opt = float(df.loc[opt_mask & (df["NOMINAL_USD"] > 0), "NOMINAL_USD"].sum())
        long_nominal_usd  = long_nominal_fec + long_nominal_opt
        gross_nominal_usd = float(df["NOMINAL_USD"].abs().sum())
        net_nominal_usd   = float(df["NOMINAL_USD"].sum())

    # Facility cap — prefer from summary, else use constant
    facility_cap_usd = facility_summary.get("facility_cap_usd") or FACILITY_DEALING_CAP_USD
    nominal_for_cap  = long_nominal_usd

    # ── PFE ───────────────────────────────────────────────────────────────────
    if facility_summary.get("pfe_zar_market") is not None:
        pfe_zar = facility_summary["pfe_zar_market"]
    else:
        current_mtm_kuda  = float(df["MTM_ZAR"].sum())
        sensitivity        = _compute_sensitivity(df, spot, gbp_usd, eur_usd)
        pfe_scenario_rate  = spot * 1.10
        pfe_stress_mtm     = _scenario_mtm(current_mtm_kuda, sensitivity, spot, pfe_scenario_rate)
        pfe_zar            = abs(min(pfe_stress_mtm, 0))

    pfe_limit_zar = facility_summary.get("pfe_limit_zar") or FACILITY_PFE_LIMIT_ZAR

    # Settlement limit: max single-date gross FCY notional in USD equiv
    settle_by_date = (
        df.groupby(df["MATURITY_DATE"].dt.date)["NOMINAL_USD"]
        .apply(lambda x: x.abs().sum())
    )
    max_settle_usd  = float(settle_by_date.max()) if not settle_by_date.empty else 0
    max_settle_date = str(settle_by_date.idxmax()) if not settle_by_date.empty else "N/A"
    settle_breaches = int((settle_by_date > FACILITY_SETTLEMENT_LIMIT).sum())

    # Tenor: max days to maturity
    df_valid = df[df["MATURITY_DATE"].notna()]
    if not df_valid.empty:
        max_maturity = df_valid["MATURITY_DATE"].max()
        max_tenor_days = int((max_maturity - today).days)
    else:
        max_maturity = None
        max_tenor_days = 0
    tenor_breach = max_tenor_days > FACILITY_MAX_TENOR_DAYS

    # Utilisation — use the actual cap/limit from facility summary if available
    nominal_util_pct = round(nominal_for_cap / facility_cap_usd * 100, 1)
    pfe_util_pct     = round(pfe_zar / pfe_limit_zar * 100, 1) if pfe_limit_zar > 0 else 0

    # Trade type breakdown by PRODUCT_TYPE
    pt_col  = "PRODUCT_TYPE" if "PRODUCT_TYPE" in df.columns else "PRODUCT"
    pt_vals = df[pt_col].str.strip()
    FEC_PRODUCT_TYPES = ["FORWARD", "DRAWDOWN", "EXTENSION", "CANCELLATION"]
    OPT_PRODUCT_TYPES = ["Vanilla", "Forward Enhancer"]
    fec_df = df[pt_vals.isin(FEC_PRODUCT_TYPES)]
    opt_df = df[pt_vals.isin(OPT_PRODUCT_TYPES)]

    return {
        "dealing_cap_usd":         round(facility_cap_usd),
        "long_nominal_usd":        round(long_nominal_usd),
        "net_nominal_usd":         round(net_nominal_usd),
        "gross_nominal_usd":       round(gross_nominal_usd),
        "nominal_headroom_usd":    round(facility_cap_usd - long_nominal_usd),
        "nominal_utilisation_pct": nominal_util_pct,
        "pfe_limit_zar":           round(pfe_limit_zar),
        "pfe_exposure_zar":        round(pfe_zar),
        "pfe_utilisation_pct":     pfe_util_pct,
        "settlement_limit_usd":    FACILITY_SETTLEMENT_LIMIT,
        "max_settlement_usd":      round(max_settle_usd),
        "max_settlement_date":     max_settle_date,
        "settlement_breaches":     settle_breaches,
        "max_tenor_days":          max_tenor_days,
        "max_tenor_limit_days":    FACILITY_MAX_TENOR_DAYS,
        "tenor_breach":            tenor_breach,
        "total_open_trades":       len(df),
        "fec_count":               len(fec_df),
        "option_count":            len(opt_df),
        "fec_gross_notional_usd":  round(float(fec_df["NOMINAL_USD"].abs().sum())),
        "fec_net_notional_usd":    round(float(fec_df["NOMINAL_USD"].sum())),
        "opt_gross_notional_usd":  round(float(opt_df["NOMINAL_USD"].abs().sum())),
        "opt_net_notional_usd":    round(float(opt_df["NOMINAL_USD"].sum())),
    }


def _calc_csa_monitor(df: pd.DataFrame, spot: float, gbp_usd: float, eur_usd: float) -> dict:
    """Section 2: CSA threshold monitor."""
    current_mtm_kuda = float(df["MTM_ZAR"].sum())
    buffer_zar = current_mtm_kuda - CSA_THRESHOLD_ZAR   # distance from -15M
    # e.g. MTM=+3.87M: buffer = 3.87M - (-15M) = 18.87M ✓

    sensitivity = _compute_sensitivity(df, spot, gbp_usd, eur_usd)

    # Trigger rate: at what USD/ZAR does Kuda MTM hit -R15M?
    # current_mtm + sensitivity_effective × (trigger - spot) = -15M
    # sensitivity_effective = -sensitivity (see _scenario_mtm)
    eff_sens = -sensitivity
    if abs(eff_sens) > 0:
        trigger_rate = spot + (CSA_THRESHOLD_ZAR - current_mtm_kuda) / eff_sens
    else:
        trigger_rate = None

    pct_threshold_remaining = round((buffer_zar / abs(CSA_THRESHOLD_ZAR)) * 100, 1)

    # Rate move % to trigger
    if trigger_rate:
        rate_move_to_trigger_pct = round((trigger_rate - spot) / spot * 100, 1)
    else:
        rate_move_to_trigger_pct = None

    return {
        "current_mtm_kuda_zar":    round(current_mtm_kuda),
        "csa_threshold_zar":       CSA_THRESHOLD_ZAR,
        "buffer_zar":              round(buffer_zar),
        "pct_threshold_remaining": pct_threshold_remaining,
        "trigger_rate":            round(trigger_rate, 2) if trigger_rate else None,
        "rate_move_to_trigger_pct": rate_move_to_trigger_pct,
        "sensitivity_zar_per_pt":  round(-sensitivity),   # positive number = R per 1 pt move
        "status":                  _csa_status(current_mtm_kuda),
        "min_transfer_zar":        CSA_MIN_TRANSFER_ZAR,
        "collateral_contact":      "Janine Clarence · collateral@investec.co.za · (011) 286 8412",
        "notification_time":       "12h00 SAST",
    }


def _csa_status(mtm: float) -> str:
    if mtm >= 0:
        return "safe"
    elif mtm > CSA_THRESHOLD_ZAR * 0.5:
        return "watch"
    elif mtm > CSA_THRESHOLD_ZAR:
        return "warning"
    else:
        return "breach"


def _calc_mtm_bridge(
    df: pd.DataFrame,
    prev_mtm_zar: float,
    prev_rate: float,
    spot: float,
    gbp_usd: float,
    eur_usd: float,
) -> dict:
    """
    Section 3: Day-on-day MTM bridge.
    Decomposes today's MTM vs yesterday into:
      1. Rate move contribution
      2. Time decay (theta) — estimated residual
      3. Settled trades (trades that matured and dropped off)
    """
    current_mtm_kuda = float(df["MTM_ZAR"].sum())

    if not prev_mtm_zar or not prev_rate:
        return {
            "current_mtm_kuda_zar":   round(current_mtm_kuda),
            "prev_mtm_kuda_zar":      None,
            "total_change_zar":       None,
            "rate_move_contribution": None,
            "settled_contribution":   None,
            "theta_contribution":     None,
            "prev_rate":              None,
            "current_rate":           round(spot, 4),
            "note": "Provide prev_mtm_zar and prev_rate for day-on-day bridge.",
        }

    total_change = current_mtm_kuda - prev_mtm_zar
    sensitivity  = _compute_sensitivity(df, spot, gbp_usd, eur_usd)
    rate_move    = -(spot - prev_rate) * sensitivity  # P&L from rate move

    # Settled trades contribution: trades that matured today
    today  = pd.Timestamp.today().normalize()
    settled = df[df["MATURITY_DATE"].dt.normalize() == today]
    settled_contribution = float(settled["MTM_ZAR"].sum())

    # Residual is time decay / theta
    theta = total_change - rate_move - settled_contribution

    return {
        "current_mtm_kuda_zar":    round(current_mtm_kuda),
        "prev_mtm_kuda_zar":       round(prev_mtm_zar),
        "total_change_zar":        round(total_change),
        "rate_move_contribution":  round(rate_move),
        "settled_contribution":    round(settled_contribution),
        "theta_contribution":      round(theta),
        "prev_rate":               round(prev_rate, 4),
        "current_rate":            round(spot, 4),
        "settled_trade_count":     len(settled),
    }


def _calc_scenario_analysis(
    df: pd.DataFrame,
    spot: float,
    gbp_usd: float,
    eur_usd: float,
) -> dict:
    """Section 4: Total book MTM at scenario USD/ZAR rates."""
    current_mtm_kuda = float(df["MTM_ZAR"].sum())
    sensitivity      = _compute_sensitivity(df, spot, gbp_usd, eur_usd)

    scenarios = []
    for rate in SCENARIO_RATES:
        est_mtm  = _scenario_mtm(current_mtm_kuda, sensitivity, spot, rate)
        buffer   = est_mtm - CSA_THRESHOLD_ZAR
        move_pct = round((rate - spot) / spot * 100, 1)

        if rate == round(spot, 2):
            label = "Today"
        elif est_mtm <= CSA_THRESHOLD_ZAR:
            label = "BREACH"
        elif est_mtm <= CSA_THRESHOLD_ZAR * 0.9:
            label = "TRIGGER"
        else:
            label = "Safe"

        scenarios.append({
            "rate":       rate,
            "move_pct":   move_pct,
            "est_mtm":    round(est_mtm),
            "buffer":     round(buffer),
            "status":     label,
            "is_today":   abs(rate - spot) < 0.01,
        })

    return {
        "current_rate":           round(spot, 4),
        "current_mtm_kuda_zar":   round(current_mtm_kuda),
        "sensitivity_zar_per_pt": round(-sensitivity),
        "scenarios":              scenarios,
    }


def _calc_top_clients(
    df: pd.DataFrame,
    spot: float,
    gbp_usd: float,
    eur_usd: float,
    top_n: int = 10,
) -> dict:
    """
    Section 5: Top N clients by gross nominal, with MTM at each scenario rate.
    Client MTM is proportional to their share of facility NOMINAL_USD.
    """
    current_mtm_kuda = float(df["MTM_ZAR"].sum())
    sensitivity      = _compute_sensitivity(df, spot, gbp_usd, eur_usd)

    # Aggregate per client
    client_summary = (
        df.groupby("CLIENT_NAME")
        .agg(
            gross_nominal_usd=("NOMINAL_USD", lambda x: x.abs().sum()),
            net_nominal_usd  =("NOMINAL_USD", "sum"),
            current_mtm_zar  =("MTM_ZAR",    "sum"),
            trade_count      =("MTM_ZAR",    "count"),
        )
        .reset_index()
    )
    client_summary = client_summary.nlargest(top_n, "gross_nominal_usd")
    total_gross = float(df["NOMINAL_USD"].abs().sum())

    display_rates = [15, 16, round(spot, 2), 17, 17.5, 18, 18.5, 19, 19.5]

    rows = []
    for _, row in client_summary.iterrows():
        share = row["gross_nominal_usd"] / total_gross if total_gross > 0 else 0
        mtm_at_rates = {}
        for rate in display_rates:
            book_mtm_at_rate = _scenario_mtm(current_mtm_kuda, sensitivity, spot, rate)
            mtm_at_rates[str(rate)] = round(book_mtm_at_rate * share / 1000)  # ZAR thousands

        rows.append({
            "client":             row["CLIENT_NAME"],
            "trade_count":        int(row["trade_count"]),
            "gross_nominal_usd":  round(row["gross_nominal_usd"]),
            "net_nominal_usd":    round(row["net_nominal_usd"]),
            "current_mtm_zar":    round(row["current_mtm_zar"]),
            "share_pct":          round(share * 100, 1),
            "mtm_at_rates":       mtm_at_rates,
        })

    return {
        "display_rates": [str(r) for r in display_rates],
        "clients":       rows,
        "current_rate":  round(spot, 4),
    }


def _calc_maturity_profile(df: pd.DataFrame) -> dict:
    """Section 6: MTM by maturity bucket and currency."""
    today = pd.Timestamp.today().normalize()

    df2 = df.copy()
    df2["days_to_maturity"] = (df2["MATURITY_DATE"] - today).dt.days

    def bucket(days):
        if pd.isna(days) or days < 0:
            return "Settled/Unknown"
        elif days <= 90:
            return "0–3 months"
        elif days <= 180:
            return "3–6 months"
        elif days <= 366:
            return "6–12 months"
        else:
            return ">12 months"

    df2["BUCKET"] = df2["days_to_maturity"].apply(bucket)

    by_bucket = (
        df2.groupby("BUCKET")
        .agg(
            trade_count=("MTM_ZAR", "count"),
            mtm_zar    =("MTM_ZAR", "sum"),
            nominal_usd=("NOMINAL_USD", "sum"),
        )
        .reset_index()
    )

    by_ccy = (
        df2.groupby("TRADE_CURR")
        .agg(
            trade_count=("MTM_ZAR", "count"),
            mtm_zar    =("MTM_ZAR", "sum"),
            nominal_usd=("NOMINAL_USD", "sum"),
        )
        .reset_index()
    )

    total_mtm = float(df["MTM_ZAR"].sum())
    bucket_order = ["0–3 months", "3–6 months", "6–12 months", ">12 months", "Settled/Unknown"]
    by_bucket["BUCKET"] = pd.Categorical(by_bucket["BUCKET"], categories=bucket_order, ordered=True)
    by_bucket = by_bucket.sort_values("BUCKET")

    buckets_out = []
    for _, r in by_bucket.iterrows():
        pct = round(r["mtm_zar"] / total_mtm * 100, 1) if total_mtm != 0 else 0
        buckets_out.append({
            "bucket":      str(r["BUCKET"]),
            "trade_count": int(r["trade_count"]),
            "mtm_zar":     round(r["mtm_zar"]),
            "nominal_usd": round(r["nominal_usd"]),
            "pct_of_book": pct,
        })

    ccy_out = []
    for _, r in by_ccy.sort_values("mtm_zar", ascending=False).iterrows():
        ccy_out.append({
            "currency":    str(r["TRADE_CURR"]),
            "trade_count": int(r["trade_count"]),
            "mtm_zar":     round(r["mtm_zar"]),
            "nominal_usd": round(r["nominal_usd"]),
        })

    return {
        "total_mtm_kuda_zar": round(total_mtm),
        "by_bucket":          buckets_out,
        "by_currency":        ccy_out,
    }


def _calc_settled_today(df: pd.DataFrame) -> dict:
    """Section 7: Trades settling today."""
    today   = pd.Timestamp.today().normalize()
    settled = df[df["MATURITY_DATE"].dt.normalize() == today].copy()

    rows = []
    for _, r in settled.iterrows():
        rows.append({
            "client":      str(r.get("CLIENT_NAME", r.get("EXT_REF", ""))),
            "ext_ref":     str(r.get("EXT_REF", "")),
            "ccy_pair":    str(r.get("CCY_PAIR", r.get("TRADE_CURR", "") + "/ZAR")),
            "notional_fcy":round(float(r.get("NOTIONAL_FCY", 0))),
            "deal_rate":   round(float(r.get("DEAL_RATE", 0)), 4),
            "mtm_zar":     round(float(r.get("MTM_ZAR", 0))),
            "maturity":    r["MATURITY_DATE"].strftime("%Y-%m-%d") if pd.notna(r["MATURITY_DATE"]) else "",
            "direction":   str(r.get("DIRECTION_CLIENT", r.get("DIRECTION_KUDA", ""))),
        })

    return {
        "count":      len(rows),
        "total_mtm":  round(sum(r["mtm_zar"] for r in rows)),
        "trades":     rows,
    }


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _error(msg: str, status_code: int = 400) -> func.HttpResponse:
    return func.HttpResponse(
        json.dumps({"error": msg}),
        status_code=status_code,
        mimetype="application/json",
        headers={"Access-Control-Allow-Origin": "*"},
    )


def _json_serial(obj):
    """JSON serialiser for objects not serialisable by default json encoder."""
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return float(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    raise TypeError(f"Type {type(obj)} not serialisable")
