# GroupBase Extension Icons

## Overview

Professional icons for the GroupBase Chrome extension featuring a stylized "G" with a blue-to-indigo gradient background.

### Icon Details

- **Design**: Rounded rectangle background with white "G" letter
- **Color Gradient**: #4F46E5 (Indigo) to #7C3AED (Deep Indigo)
- **Sizes**: 16x16, 48x48, 128x128 pixels
- **Format**: PNG (primary) and SVG (backup/scalable)

### Files Generated

```
icons/
├── icon16.png      (16x16 pixels)
├── icon16.svg      (SVG scalable format)
├── icon48.png      (48x48 pixels)
├── icon48.svg      (SVG scalable format)
├── icon128.png     (128x128 pixels)
└── icon128.svg     (SVG scalable format)
```

## Chrome Extension Integration

The `manifest.json` is already configured to use these icons:

```json
"icons": {
  "16": "icons/icon16.png",
  "48": "icons/icon48.png",
  "128": "icons/icon128.png"
}
```

The extension will display these icons in:
- Chrome extension list (48x48)
- Extension menu (16x16)
- Chrome Web Store (128x128)
- Toolbar (16x16 and 48x48)

## Regenerating Icons

To regenerate the icons, run:

```bash
node generate-icons.js
```

### Requirements

The script will attempt to generate PNGs using:
1. **Canvas Module** (if compiled) - requires `npm install canvas`
2. **ImageMagick** - requires `apt-get install imagemagick` on Linux

If neither is available, only SVG files will be generated, which can still be used as scalable alternatives.

## Design Specifications

- **Font**: Bold Arial/sans-serif
- **Letter**: Capital "G"
- **Letter Size**: ~65% of icon size
- **Background**: Rounded corners at ~15% of icon size
- **Color**: Pure white (#FFFFFF) on gradient background

## Testing the Icons

To preview the icons in Chrome:
1. Go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the GroupBase extension directory

The icons should display properly at all sizes in the Chrome UI.
