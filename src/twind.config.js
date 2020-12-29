// import { strict } from 'twind'

export default {
  // mode: strict, // Throw errors for invalid rules instead of logging
  theme: {
    extend: {
      // zIndex: {
      //   '-10': '-10',
      // },
      boxShadow: {
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        DEFAULT:
          '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        md:
          '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
        lg:
          '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.03)',
        xl:
          '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.02)',
        '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.2)',
        '3xl': '0 35px 60px -15px rgba(0, 0, 0, 0.25)',
        inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.04)',
        none: 'none',
      },
      colors: {
        red: {
          default: '#FF4255',
          100: '#FFE5E8',
          200: '#FFBDC3',
          300: '#FF949F',
          400: '#FF6B7A',
          500: '#FF4255',
          600: '#FF001A',
          700: '#BD0013',
          800: '#7A000C',
          900: '#380006',
        },
        blue: {
          default: '#0068B3',
          100: '#D1ECFF',
          200: '#8ACEFF',
          300: '#42B0FF',
          400: '#0092FA',
          500: '#0068B3',
          600: '#00508A',
          700: '#003961',
          800: '#002138',
          900: '#00090F',
        },
        yellow: {
          default: '#FFD84D',
          100: '#FFFCF0',
          200: '#FFF3C7',
          300: '#FFEA9E',
          400: '#FFE175',
          500: '#FFD84D',
          600: '#FFC800',
          700: '#B38C00',
          800: '#665000',
          900: '#1A1400',
        },
        orange: {
          default: '#FF9238',
          100: '#FFF7F0',
          200: '#FFDDC2',
          300: '#FFC494',
          400: '#FFAB66',
          500: '#FF9238',
          600: '#F56E00',
          700: '#B35000',
          800: '#703200',
          900: '#2E1500',
        },
      },
    },
  },
}
