import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const fontsDir = path.join(rootDir, 'public', 'fonts');

if (!fs.existsSync(fontsDir)) {
  fs.mkdirSync(fontsDir, { recursive: true });
}

const fontQueries = [
  'family=Cairo:wght@400;600;700',
  'family=Tajawal:wght@400;500;700',
  'family=IBM+Plex+Sans+Arabic:wght@400;500;600;700',
  'family=Almarai:wght@400;700',
  'family=Readex+Pro:wght@400;500;600;700',
  'family=Inter:wght@400;600;700',
];

const googleFontsUrl = `https://fonts.googleapis.com/css2?${fontQueries.join('&')}&display=swap`;

console.log('Fetching CSS from Google Fonts...');
const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const response = await fetch(googleFontsUrl, {
  headers: { 'User-Agent': userAgent }
});

if (!response.ok) {
  throw new Error(`Failed to fetch font CSS: ${response.status} ${response.statusText}`);
}

const css = await response.text();

// Parse all font URLs from the CSS
const urlRegex = /url\((https:\/\/fonts\.gstatic\.com\/[^\)]+)\)/g;
const urls = new Set();
let match;
while ((match = urlRegex.exec(css)) !== null) {
  urls.add(match[1]);
}

console.log(`Found ${urls.size} unique font files to download.`);

const urlToLocalMap = new Map();
let counter = 0;

for (const fontUrl of urls) {
  counter++;
  // Extract filename or create clean name
  const parsedUrl = new URL(fontUrl);
  const baseName = path.basename(parsedUrl.pathname);
  const localFileName = `${counter}-${baseName}`;
  const localFilePath = path.join(fontsDir, localFileName);
  const relativeWebPath = `/fonts/${localFileName}`;

  console.log(`[${counter}/${urls.size}] Downloading ${baseName}...`);
  const fontRes = await fetch(fontUrl);
  if (!fontRes.ok) {
    throw new Error(`Failed to download ${fontUrl}: ${fontRes.status}`);
  }
  const buffer = Buffer.from(await fontRes.arrayBuffer());
  fs.writeFileSync(localFilePath, buffer);
  urlToLocalMap.set(fontUrl, relativeWebPath);
}

// Replace Google Fonts URLs with local paths
let localCss = css;
for (const [remoteUrl, localPath] of urlToLocalMap.entries()) {
  localCss = localCss.split(remoteUrl).join(localPath);
}

// Write fonts.css to src/fonts.css
const fontsCssPath = path.join(rootDir, 'src', 'fonts.css');
fs.writeFileSync(fontsCssPath, localCss, 'utf-8');

console.log(`Successfully downloaded all fonts and created ${fontsCssPath}`);
