// Génère public/og.png (1200×630), l'image affichée quand on partage le site
// sur LinkedIn, Slack, X… Usage : node scripts/og-image.mjs
import sharp from 'sharp';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b3a57"/>
      <stop offset="1" stop-color="#0b5c8c"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <g transform="translate(860 140)">
    <rect x="0" y="0" width="230" height="300" rx="18" fill="#ffffff"/>
    <rect x="28" y="40" width="120" height="14" rx="7" fill="#0b5c8c"/>
    <rect x="28" y="80" width="174" height="10" rx="5" fill="#c9d6e0"/>
    <rect x="28" y="104" width="174" height="10" rx="5" fill="#c9d6e0"/>
    <rect x="28" y="128" width="130" height="10" rx="5" fill="#c9d6e0"/>
    <rect x="28" y="176" width="174" height="1" fill="#c9d6e0"/>
    <rect x="110" y="196" width="92" height="14" rx="7" fill="#0b3a57"/>
    <rect x="-34" y="230" width="150" height="56" rx="12" fill="#0f1720"/>
    <text x="-12" y="266" font-family="Consolas, monospace" font-size="22" fill="#7fd1ff">.xlsx</text>
    <circle cx="210" cy="280" r="46" fill="#1a7f4b" stroke="#ffffff" stroke-width="6"/>
    <path d="M190 280l14 14 24-26" stroke="#fff" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  <text x="80" y="200" font-family="Segoe UI, Arial, sans-serif" font-size="76" font-weight="700" fill="#ffffff">CFONB &amp; camt Tools</text>
  <text x="80" y="275" font-family="Segoe UI, Arial, sans-serif" font-size="38" fill="#d5e7f3">Convertir un relevé bancaire</text>
  <text x="80" y="325" font-family="Segoe UI, Arial, sans-serif" font-size="38" fill="#d5e7f3">CFONB 120 ou camt.053 en Excel</text>
  <g font-family="Segoe UI, Arial, sans-serif" font-size="26" font-weight="600">
    <rect x="80" y="400" width="300" height="52" rx="26" fill="#ffffff" fill-opacity="0.14"/>
    <text x="104" y="435" fill="#ffffff">100 % navigateur</text>
    <rect x="400" y="400" width="200" height="52" rx="26" fill="#ffffff" fill-opacity="0.14"/>
    <text x="424" y="435" fill="#ffffff">Gratuit</text>
    <rect x="620" y="400" width="200" height="52" rx="26" fill="#ffffff" fill-opacity="0.14"/>
    <text x="644" y="435" fill="#ffffff">Open source</text>
  </g>
  <text x="80" y="560" font-family="Segoe UI, Arial, sans-serif" font-size="24" fill="#9fc3da">CFONB 120 · camt.053 · camt.052 · camt.054 · Excel · CSV · OFX</text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile('public/og.png');
console.log('public/og.png généré');
