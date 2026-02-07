import localFont from 'next/font/local';

export const inter = localFont({
  src: '../../public/fonts/InterVariable.woff2',
  variable: '--font-inter',
  display: 'swap',
  preload: true,
  weight: '100 900',
});
