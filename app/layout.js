import { Bricolage_Grotesque, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import ServiceWorker from '@/components/ServiceWorker';

const body = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-body' });
const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display-face' });

const splash = (w, h, dw, dh, ratio) => ({
  url: `/icons/splash-${w}x${h}.png`,
  media: `(device-width: ${dw}px) and (device-height: ${dh}px) and (-webkit-device-pixel-ratio: ${ratio})`,
});

export const metadata = {
  title: { default: 'PaisaBachao', template: '%s | PaisaBachao' },
  description: 'Your Money. Your Control. Your Savings. Premium money tools, free for everyone.',
  applicationName: 'PaisaBachao',
  manifest: '/manifest.webmanifest',
  icons: { apple: '/icons/apple-touch-icon.png' },
  appleWebApp: {
    capable: true,
    title: 'PaisaBachao',
    statusBarStyle: 'black-translucent',
    startupImage: [splash(750, 1334, 375, 667, 2), splash(1170, 2532, 390, 844, 3), splash(1290, 2796, 430, 932, 3), splash(1668, 2388, 834, 1194, 2)],
  },
};

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0b5d3f' },
    { media: '(prefers-color-scheme: dark)', color: '#0d1311' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

// Runs before first paint so a dark-mode user never sees a white flash.
const themeScript = `try{var t=localStorage.getItem('pb-theme');if(t==='dark'||(!t||t==='system')&&matchMedia('(prefers-color-scheme: dark)').matches)document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${body.variable} ${display.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh antialiased">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
