/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace']
      },
      colors: {
        brand: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          500: '#2563EB',
          600: '#1D4ED8',
          700: '#1E40AF',
          900: '#1E3A8A'
        },
        metro: {
          purple: '#7C3AED',
          green: '#16A34A',
          yellow: '#CA8A04'
        }
      },
      boxShadow: {
        card: '0 4px 20px -2px rgba(15, 23, 42, 0.07), 0 1px 3px 0 rgba(15, 23, 42, 0.04)',
        elevated: '0 12px 32px -6px rgba(15, 23, 42, 0.11), 0 4px 10px -2px rgba(37, 99, 235, 0.05)',
        floating: '0 20px 44px -10px rgba(15, 23, 42, 0.20), 0 4px 12px -2px rgba(15, 23, 42, 0.08)',
        'glow-blue': '0 8px 22px -4px rgba(37, 99, 235, 0.38)'
      }
    }
  },
  plugins: []
};