/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
        teal: {
          50: '#f0fdfa',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
        },
        navy: {
          950: '#0B1220',
          900: '#0D1626',
          800: '#111C2D',
          700: '#162438',
        },
        darkteal: {
          950: '#0F2A33',
          900: '#133642',
        },
        surface: {
          DEFAULT: 'var(--bg-surface)',
          elevated: 'var(--bg-surface-elevated)',
          muted: 'var(--bg-surface-muted)',
        }
      },
      backgroundImage: {
        'app-gradient': 'var(--bg-gradient)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
