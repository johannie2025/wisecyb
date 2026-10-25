// Thème « Wise Design » clair : l'échelle slate est inversée (les classes sombres existantes deviennent claires) ; cyan → bleu métallique ; teintes d'état assombries pour fond blanc.
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: {
    fontFamily: { sans: ['Plus Jakarta Sans', 'Segoe UI', 'system-ui', 'sans-serif'] },
    colors: {
      slate: { 50: '#0f172a', 100: '#1e293b', 200: '#334155', 300: '#475569', 400: '#64748b', 500: '#94a3b8', 600: '#cbd5e1', 700: '#e2e8f0', 800: '#f1f5f9', 900: '#ffffff', 950: '#ffffff' },
      cyan: { 200: '#1e3a8a', 300: '#1d4ed8', 400: '#2563eb', 500: '#2563eb', 600: '#1d4ed8', 700: '#1e40af' },
      emerald: { 200: '#065f46', 300: '#047857', 400: '#059669', 500: '#10b981', 950: '#ecfdf5' },
      red: { 200: '#991b1b', 300: '#b91c1c', 400: '#dc2626', 500: '#ef4444', 600: '#dc2626', 950: '#fef2f2' },
      amber: { 200: '#92400e', 300: '#b45309', 400: '#d97706', 500: '#f59e0b', 950: '#fffbeb' },
      brand: { 50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 400: '#60a5fa', 500: '#2563eb', 600: '#1d4ed8', 700: '#1e40af', 800: '#1e3a8a', 900: '#0f172a' },
    },
    boxShadow: { soft: '0 10px 30px -5px rgba(30,96,200,.10)', card: '0 2px 8px -1px rgba(15,23,42,.06), 0 1px 3px rgba(0,0,0,.04)', 'glow-blue': '0 0 30px -5px rgba(30,96,200,.35)' },
  } }, plugins: [],
};
