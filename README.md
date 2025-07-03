# AR Model Viewer

A web-based AR experience that displays 3D models with surface detection on iOS and Android devices.

## Setup Instructions

1. **Add your 3D model**
   - Place your `.glb` file in this directory
   - Rename it to `model.glb`
   - (Optional) For better iOS support, also provide a `.usdz` version named `model.usdz`

2. **Test locally**
   - Use a local server (required for AR features):
     ```bash
     python3 -m http.server 8000
     # or
     npx http-server -p 8000
     ```
   - Open `http://localhost:8000` on your computer
   - Use your phone/iPad to access via your computer's IP: `http://[YOUR-IP]:8000`

3. **Deploy online**
   - Upload to any web hosting service
   - Ensure HTTPS is enabled (required for AR)
   - Popular free options: GitHub Pages, Netlify, Vercel

## How to Use

- **Desktop**: Click and drag to rotate, scroll to zoom
- **Mobile**: 
  - Touch and drag to rotate
  - Pinch to zoom
  - Tap "View in AR" to place model in your space
  - Move device to find a flat surface
  - Tap to place the model

## Features

- ✅ Surface detection (floors, tables)
- ✅ Full touch controls (rotate, scale, move)
- ✅ Works on iOS Safari & Android Chrome
- ✅ Automatic fallback for unsupported devices
- ✅ Responsive design
- ✅ No backend required

## Customization

Edit `index.html` to:
- Change model scale: `ar-scale="fixed"` and add `scale="0.5 0.5 0.5"`
- Adjust lighting: `exposure="0.5"` (0-2)
- Change camera angle: `camera-orbit="45deg 55deg 1.5m"`
- Disable auto-rotate: Remove `auto-rotate`

## Browser Support

- iOS: Safari 12+ (AR requires iOS 12+)
- Android: Chrome 79+ (AR requires ARCore)
- Desktop: All modern browsers (3D only, no AR)