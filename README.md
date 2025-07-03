# AR Hotel Visualization for Meta Quest 3

A WebXR AR application that allows users to place and interact with a 3D hotel model using hand tracking on Meta Quest 3.

## Features

- WebXR AR support for Meta Quest 3
- Hand tracking with pinch gestures
- Model placement using hit testing
- Interactive model manipulation (move, rotate, scale)
- Hosted on Netlify

## Usage

### Meta Quest 3 (AR Mode)
1. Open the site on your Meta Quest 3 browser
2. Click "Start AR" button
3. Look for a flat surface and tap to place the model
4. Use pinch gestures to interact with the model:
   - Single hand pinch: Move and rotate the model
   - Two hands pinch: Pull apart to scale up, push together to scale down

### Desktop Preview
1. Open the site on your desktop browser
2. Click "Preview Model" button
3. Use mouse controls to interact:
   - Click and drag to rotate
   - Scroll wheel to zoom in/out

## Technologies

- Three.js for 3D rendering
- WebXR API for AR capabilities
- WebXR Hand Tracking API
- GLTFLoader for model loading

## Deployment

Deployed on Netlify with proper CORS headers for WebXR support.