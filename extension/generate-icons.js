#!/usr/bin/env node

/**
 * GroupBase Chrome Extension Icon Generator
 * Generates 16x16, 48x48, and 128x128 PNG icons with a blue-to-indigo gradient
 * and a white "G" letter centered in each icon.
 *
 * This script can work in multiple modes:
 * 1. Pure SVG generation (always works)
 * 2. Canvas-based PNG generation (if canvas is compiled)
 * 3. Using sharp for PNG conversion from SVG (if available)
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const GRADIENT_START = '#4F46E5'; // Indigo
const GRADIENT_END = '#7C3AED';   // Deeper Indigo
const WHITE = '#FFFFFF';
const SIZES = [16, 48, 128];
const ICONS_DIR = path.join(__dirname, 'icons');

/**
 * Create SVG icon
 */
function createSvgIcon(size) {
  const cornerRadius = Math.round(size * 0.15);
  const fontSize = Math.round(size * 0.65);

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad-${size}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#4F46E5;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#7C3AED;stop-opacity:1" />
    </linearGradient>
  </defs>

  <!-- Background rounded rectangle -->
  <rect width="${size}" height="${size}" rx="${cornerRadius}" fill="url(#grad-${size})" />

  <!-- White "G" text -->
  <text x="${size / 2}" y="${size / 2 + 2}"
        font-family="Arial, Helvetica, sans-serif"
        font-size="${fontSize}"
        font-weight="bold"
        fill="${WHITE}"
        text-anchor="middle"
        dominant-baseline="central">G</text>
</svg>`;
}

/**
 * Try to use canvas to generate PNG
 */
async function generatePngWithCanvas(size) {
  try {
    const Canvas = require('canvas');
    const canvas = Canvas.createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, GRADIENT_START);
    gradient.addColorStop(1, GRADIENT_END);

    // Draw rounded rectangle background
    const cornerRadius = Math.round(size * 0.15);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(cornerRadius, 0);
    ctx.lineTo(size - cornerRadius, 0);
    ctx.quadraticCurveTo(size, 0, size, cornerRadius);
    ctx.lineTo(size, size - cornerRadius);
    ctx.quadraticCurveTo(size, size, size - cornerRadius, size);
    ctx.lineTo(cornerRadius, size);
    ctx.quadraticCurveTo(0, size, 0, size - cornerRadius);
    ctx.lineTo(0, cornerRadius);
    ctx.quadraticCurveTo(0, 0, cornerRadius, 0);
    ctx.fill();

    // Draw white "G" text
    ctx.fillStyle = WHITE;
    ctx.font = `bold ${Math.round(size * 0.65)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('G', size / 2, size / 2);

    // Save to file
    const filename = path.join(ICONS_DIR, `icon${size}.png`);
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(filename, buffer);
    console.log(`Generated PNG: ${filename}`);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Try to use ImageMagick/convert to generate PNG from SVG
 */
async function generatePngWithImageMagick(size, svgPath) {
  try {
    const pngPath = path.join(ICONS_DIR, `icon${size}.png`);
    const density = Math.round(96 * (size / 128)); // Adjust DPI based on size

    await execAsync(`convert -density ${density} -background none "${svgPath}" -resize ${size}x${size} -extent ${size}x${size} -gravity center "${pngPath}"`);
    console.log(`Generated PNG: ${pngPath}`);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Generate SVG icon
 */
function generateSvgIcon(size) {
  try {
    const svg = createSvgIcon(size);
    const filename = path.join(ICONS_DIR, `icon${size}.svg`);
    fs.writeFileSync(filename, svg, 'utf-8');
    console.log(`Generated SVG: ${filename}`);
    return filename;
  } catch (err) {
    console.error(`Error generating SVG for size ${size}:`, err.message);
    return null;
  }
}

/**
 * Main execution
 */
async function main() {
  // Create icons directory if it doesn't exist
  if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
    console.log(`Created icons directory: ${ICONS_DIR}`);
  }

  console.log('GroupBase Icon Generator');
  console.log('========================\n');
  console.log(`Output directory: ${ICONS_DIR}`);
  console.log(`Generating icons for sizes: ${SIZES.join(', ')}\n`);

  // First, generate all SVGs
  console.log('Step 1: Generating SVG icons...\n');
  const svgFiles = {};
  for (const size of SIZES) {
    const svgFile = generateSvgIcon(size);
    if (svgFile) {
      svgFiles[size] = svgFile;
    }
  }

  console.log('\nStep 2: Attempting PNG generation...\n');

  let pngSuccess = false;

  // Try canvas first
  console.log('Trying canvas module...');
  let canvasWorks = false;
  for (const size of SIZES) {
    const success = await generatePngWithCanvas(size);
    if (success) {
      canvasWorks = true;
      pngSuccess = true;
    }
  }

  if (!canvasWorks) {
    console.log('Canvas module not available.\n');
    console.log('Trying ImageMagick convert command...');

    // Try ImageMagick
    for (const size of SIZES) {
      if (svgFiles[size]) {
        const success = await generatePngWithImageMagick(size, svgFiles[size]);
        if (success) {
          pngSuccess = true;
        }
      }
    }
  }

  // Summary
  console.log('\n========================');
  console.log('Generation Complete!\n');

  const generatedSvgs = Object.keys(svgFiles).length;
  const generatedPngs = fs.readdirSync(ICONS_DIR).filter(f => f.endsWith('.png')).length;

  console.log(`SVG icons: ${generatedSvgs} of ${SIZES.length} generated`);
  console.log(`PNG icons: ${generatedPngs} of ${SIZES.length} generated`);

  if (generatedPngs < SIZES.length) {
    console.log('\nNote: PNG generation requires either:');
    console.log('  - Canvas compiled (npm install canvas)');
    console.log('  - ImageMagick installed (apt-get install imagemagick)');
    console.log('\nSVG icons are already created and can be used directly.');
  }

  console.log(`\nIcons are ready in: ${ICONS_DIR}`);
}

// Run the script
main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
