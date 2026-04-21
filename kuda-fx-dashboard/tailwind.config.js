/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        kuda: {
          // Dark screen backgrounds
          navy:    '#0D1B2A',
          navylt:  '#162436',
          navymid: '#1E3248',
          // Brand greens — primary accent (Kuda Green P 7737 C)
          teal:    '#6BA439',
          teallt:  '#7BBF47',
          // Kuda Teal brand blue (P 7700 C) — headers, structure
          blue:    '#195A7D',
          bluelt:  '#1E6E97',
          // Kuda secondary palette
          olive:   '#49762E',
          skyblue: '#BADCE6',
          navy2:   '#243746',   // exact Kuda Navy brand colour
          // Utility
          amber:   '#F59E0B',
          red:     '#EF4444',
          slate:   '#1E293B',
          border:  '#1E3A5F',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
}
