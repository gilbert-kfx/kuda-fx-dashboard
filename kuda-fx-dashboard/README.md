# CBC Kuda FX · Facility Risk Dashboard

A production-grade, Azure-hosted web dashboard for CBC Kuda Foreign Exchange (Pty) Ltd that reads the daily FXFlow trade export and renders the full facility risk picture for the team.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Azure Static Web App                                       │
│  ┌─────────────────────┐   ┌──────────────────────────────┐ │
│  │   React Frontend    │──▶│  Azure Functions (Python)    │ │
│  │   (Vite + Tailwind) │   │  POST /api/process           │ │
│  └─────────────────────┘   └──────────────────────────────┘ │
│  Auth: Azure AD (Entra ID)                                  │
└─────────────────────────────────────────────────────────────┘
         ▲
         │  Daily upload via browser (manual)
         │  or Power Automate flow (future)
```

## Dashboard Sections

| # | Section | Description |
|---|---------|-------------|
| 1 | Facility Limits | Dealing cap ($24M), PFE ($35M ZAR), settlement limit ($5M), tenor (12mo) |
| 2 | CSA Threshold Monitor | Live MTM gauge, buffer to −R15M trigger, trigger rate, sensitivity |
| 3 | Day-on-Day MTM Bridge | Rate move vs theta vs settled trade attribution |
| 4 | Scenario Analysis | Book MTM at USD/ZAR rates 13–20 with area chart |
| 5 | Top 10 Client Scenarios | MTM at each rate per client, proportional to nominal share |
| 6 | Maturity Profile | MTM by bucket (0–3m/3–6m/6–12m/>12m) and by currency |
| 7 | Settled Today | Trades maturing on today's MTM date |

---

## Local Development

### Prerequisites
- Node ≥ 20
- Python ≥ 3.10
- Azure Functions Core Tools v4 (`npm install -g azure-functions-core-tools@4`)
- Azure Static Web Apps CLI (`npm install -g @azure/static-web-apps-cli`)

### Run locally

```bash
# 1. Install frontend dependencies
npm install

# 2. Install Python API dependencies
cd api
pip install -r requirements.txt
cd ..

# 3. Start the full stack (SWA CLI proxies API requests to local Functions)
swa start --app-location . --api-location api --run "npm run dev"
```

The dashboard will be available at **http://localhost:4280**.

To run the API separately for testing:
```bash
cd api
func start
```

---

## Deployment to Azure

### One-time setup

1. **Create an Azure Static Web App** in the Azure Portal (Free or Standard tier).
2. **Link to your GitHub repo** — Azure will auto-create the Actions workflow.
3. Copy the **deployment token** from the SWA resource → Settings → Manage deployment token.
4. Add it as a GitHub Actions secret: `AZURE_STATIC_WEB_APPS_API_TOKEN`.

### Azure AD Authentication (recommended)

1. Register an App in **Azure Entra ID** (App registrations).
2. Set redirect URI to `https://<your-swa>.azurestaticapps.net/.auth/login/aad/callback`.
3. Add these secrets to the SWA Application Settings:
   - `AZURE_CLIENT_ID`  → your App registration client ID
   - `AZURE_CLIENT_SECRET` → client secret value
4. Replace `__TENANT_ID__` in `staticwebapp.config.json` with your Azure AD tenant ID.

> Without these steps, authentication is disabled — anyone with the URL can access the dashboard. For an internal tool on a private network, you may skip this.

### Push to deploy

```bash
git add -A
git commit -m "Deploy Kuda FX dashboard"
git push origin main
```

GitHub Actions builds the Vite frontend and deploys it with the Azure Functions API automatically.

---

## Data Sources

### Primary (recommended)
**FXFlow Open Trades Excel report** — export daily from FXFlow via:
> Reports → Facility Reports → Open Facility Trades → Kuda Foreign Exchange → Export Excel

This file (`Open Facility Trades Kuda Foreign Exchange YYYY-MM-DD.xlsx`) contains all trade data plus client names.

### Fallback
**FXFlow Facility Upload CSV** — the `FXFlow_FacilityUpload_KudaForeignExchange_YYYYMMDD.csv` file. Client names will not be available (OPTIONAL_KEY is shown instead).

---

## Calculation Notes

| Metric | Formula |
|--------|---------|
| Kuda MTM | `sum(MTM (ZAR))` from Excel — already Kuda perspective |
| Dealing cap utilisation | `sum(NOMINAL_USD where NOMINAL_USD > 0)` ÷ $24M |
| CSA buffer | `Kuda MTM − (−R15M)` |
| Trigger rate | `spot + (−R15M − MTM) ÷ (−sensitivity)` |
| Sensitivity | `sum(NOMINAL_USD)` — net USD-equivalent FCY notional (options delta excluded) |
| Scenario MTM | `MTM_today + (−sensitivity) × (scenario_rate − spot)` — linear approx |
| Client MTM | `Book_MTM_at_rate × (client_gross_nominal ÷ total_gross_nominal)` |

> **Sensitivity note:** The linear sensitivity from FECs is ~R7.1M/point. The PDF shows R8.92M/point; the ~R1.85M difference is the delta contribution from 46 vanilla options in the book. The scenario table is a conservative linear approximation.

---

## Power Automate — Daily Automation (optional)

To have the dashboard automatically refresh each morning:

1. Create a **Scheduled cloud flow** (trigger: every weekday at 07:30 SAST).
2. Add a **SharePoint — Get file content** action pointing to the FXFlow export folder.
3. Add an **HTTP** action:
   - Method: `POST`
   - URL: `https://<your-swa>.azurestaticapps.net/api/process`
   - Body: multipart with the file as `trades_file`
4. Store the JSON response in a SharePoint list or send via Teams.

---

## Facility Reference

| Parameter | Value |
|-----------|-------|
| Facility | FYN005836 |
| Counterparty | Investec Bank Ltd |
| Dealing cap | USD 24,000,000 nominal |
| PFE limit | ZAR 35,000,000 |
| Settlement limit | USD 5,000,000 per date |
| Max tenor | 12 months |
| CSA threshold | −R 15,000,000 (Kuda perspective) |
| Min transfer | R 500,000 |
| EOD threshold | Zero |
| Notification | By 12h00 SAST |
| Collateral contact | Janine Clarence — collateral@investec.co.za |
