export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        sap: {
          blue: '#0a6ed1',
          dark: '#0b1f33',
          soft: '#eaf3ff',
          green: '#107e3e',
          amber: '#e9730c'
        }
      },
      boxShadow: {
        fiori: '0 1px 3px rgba(9, 30, 66, 0.12), 0 8px 24px rgba(9, 30, 66, 0.08)'
      }
    }
  },
  plugins: []
};
