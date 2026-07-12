/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Mode colors
        findings: '#16a34a',
        suggestions: '#7c3aed',
        baseline: '#6b7280',
      },
    },
  },
  plugins: [],
}
