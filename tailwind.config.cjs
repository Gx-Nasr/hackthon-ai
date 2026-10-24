module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#FF6A00', deep: '#E65700' },
        ink: '#191C16',
        canvas: '#FAFBF7',
      },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      boxShadow: { soft: '0 8px 32px rgba(21, 28, 12, 0.06)' },
    },
  },
  plugins: [],
};
