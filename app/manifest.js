export default function manifest() {
  return {
    id: '/',
    name: 'PaisaBachao',
    short_name: 'PaisaBachao',
    description: 'Your Money. Your Control. Your Savings.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#07432d',
    theme_color: '#0b5d3f',
    categories: ['finance', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Scan a receipt', url: '/scan', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Cash Book', url: '/cashbook', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
  };
}
