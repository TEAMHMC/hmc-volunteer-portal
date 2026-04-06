/**
 * Generates HMC Volunteer Portal PWA icons (192x192 and 512x512)
 * Uses sharp (already in node_modules) with an SVG source
 * Run: node generate-icons.mjs
 */
import sharp from './node_modules/sharp/lib/index.js';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// HMC Volunteer Portal icon — blue badge with white HMC logo mark
// Matches the existing HMC visual identity (#233dff brand blue)
const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <!-- Blue rounded-square background (iOS-style) -->
  <rect width="512" height="512" rx="112" ry="112" fill="#233dff"/>

  <!-- Outer white circle ring -->
  <circle cx="256" cy="256" r="190" fill="none" stroke="white" stroke-width="10"/>

  <!-- Inner white circle (badge body) -->
  <circle cx="256" cy="256" r="175" fill="white" fill-opacity="0.12"/>

  <!-- "HEALTH MATTERS CLINIC" text arc around circle -->
  <defs>
    <path id="topArc" d="M 96,256 A 160,160 0 0,1 416,256"/>
    <path id="bottomArc" d="M 116,290 A 155,155 0 0,0 396,290"/>
  </defs>
  <text font-family="Arial,Helvetica,sans-serif" font-size="28" font-weight="700" fill="white" letter-spacing="4">
    <textPath href="#topArc" startOffset="12%">HEALTH MATTERS CLINIC</textPath>
  </text>

  <!-- ECG / heartbeat line -->
  <polyline
    points="120,256 160,256 178,210 196,302 214,232 232,280 248,256 264,256 280,220 296,292 312,256 392,256"
    fill="none" stroke="white" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"
  />

  <!-- HMC text below line -->
  <text x="256" y="330" font-family="Arial,Helvetica,sans-serif" font-size="44" font-weight="900"
        fill="white" text-anchor="middle" letter-spacing="6">HMC</text>
</svg>`;

const svgBuffer = Buffer.from(svgIcon);

async function generate() {
  const sizes = [192, 512];
  for (const size of sizes) {
    const out = resolve(__dirname, `public/icon-${size}.png`);
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(out);
    console.log(`Generated: public/icon-${size}.png (${size}x${size})`);

    // Also update dist/client if it exists
    const distOut = resolve(__dirname, `dist/client/icon-${size}.png`);
    try {
      await sharp(svgBuffer).resize(size, size).png().toFile(distOut);
      console.log(`Updated: dist/client/icon-${size}.png`);
    } catch {
      // dist may not exist yet
    }
  }
  console.log('Done! Deploy public/icon-192.png and public/icon-512.png to your server.');
}

generate().catch(console.error);
