/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        kuda: {
          navy:    '#0B1E3D',
          navylt:  '#112347',
          navymid: '#1A3260',
          teal:    '#00C896',
          teallt:  '#00E5AD',
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
