# RedeeMERP

RedeeMERP is a voice-first web navigation app for RCCG Camp, Nigeria.

Tagline: **Put your phone away. We'll guide the way.**

## Stack

- React + Vite + TypeScript
- Tailwind CSS
- OpenRouteService for walking route generation
- Web Speech API for voice input
- Web Speech Synthesis API for spoken guidance
- Gemini via `@google/generative-ai`
- Firebase Firestore for optional navigation event logging
- `nosleep.js` to keep mobile Chrome awake during navigation

## Setup

Install dependencies:

```bash
npm install
```

Create `.env` from `.env.example` and fill in:

```bash
VITE_ORS_API_KEY=
VITE_GEMINI_API_KEY=
VITE_FIREBASE_CONFIG=
```

The OpenRouteService key is used for walking route generation through:

```text
https://api.openrouteservice.org/v2/directions/foot-walking/geojson
```

Run the app:

```bash
npm run dev
```

Open the shown local URL in Chrome. For phone testing, use the LAN URL from Vite on the same Wi-Fi network.

Build production files:

```bash
npm run build
```

## Demo Mode

Tap the RCCG logo three times. Demo mode simulates movement from Main Gate to Youth Centre and starts voice guidance automatically.

## Browser Notes

Voice input requires Chrome or another browser that supports `window.SpeechRecognition` or `window.webkitSpeechRecognition`. Location requires HTTPS in production or `localhost` during development.
