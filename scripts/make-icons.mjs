// Generates every app icon and splash screen from one banknote drawing.
import fs from 'node:fs/promises';
import sharp from 'sharp';

const note = (scale = 1) => `
  <g transform="translate(256 256) scale(${scale}) rotate(-8) translate(-256 -256)">
    <rect x="56" y="146" width="400" height="220" rx="22" fill="#f4fbf6"/>
    <rect x="74" y="164" width="364" height="184" rx="12" fill="none" stroke="#0b5d3f" stroke-width="7"/>
    <circle cx="256" cy="256" r="70" fill="#0b5d3f"/>
    <path d="M285 228c-6-11-17-16-30-16-17 0-30 9-30 23 0 31 62 17 62 47 0 14-14 23-32 23-15 0-27-6-33-18M256 197v118" fill="none" stroke="#f4fbf6" stroke-width="13" stroke-linecap="round"/>
    <circle cx="122" cy="256" r="19" fill="#12a06f"/>
    <circle cx="390" cy="256" r="19" fill="#12a06f"/>
    <path d="M86 190a24 24 0 0 0 0 0M100 176h34M412 336h-34" stroke="#12a06f" stroke-width="7" stroke-linecap="round"/>
  </g>`;

const background = (radius) => `
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#0f7a55"/><stop offset="1" stop-color="#07432d"/>
  </linearGradient></defs>
  <rect width="512" height="512" rx="${radius}" fill="url(#g)"/>`;

const icon = ({ radius = 112, scale = 1 } = {}) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${background(radius)}${note(scale)}</svg>`;

await fs.mkdir('public/icons', { recursive: true });
const render = (svg, size, out) => sharp(Buffer.from(svg), { density: 300 }).resize(size, size).png().toFile(out);

await fs.writeFile('public/icons/logo.svg', icon());
await render(icon(), 192, 'public/icons/icon-192.png');
await render(icon(), 512, 'public/icons/icon-512.png');
// Maskable icons are cropped by the phone, so the art sits inside the safe zone on a full square.
await render(icon({ radius: 0, scale: 0.72 }), 192, 'public/icons/maskable-192.png');
await render(icon({ radius: 0, scale: 0.72 }), 512, 'public/icons/maskable-512.png');
await render(icon({ radius: 0 }), 180, 'public/icons/apple-touch-icon.png');
await render(icon(), 48, 'app/icon.png');

// iOS only shows a launch screen when a matching image is supplied.
for (const [w, h] of [[1170, 2532], [1290, 2796], [750, 1334], [1668, 2388]]) {
  const size = Math.round(w * 0.32);
  const logo = await sharp(Buffer.from(icon()), { density: 300 }).resize(size, size).png().toBuffer();
  await sharp({ create: { width: w, height: h, channels: 3, background: '#07432d' } })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(`public/icons/splash-${w}x${h}.png`);
}
console.log('icons written');
