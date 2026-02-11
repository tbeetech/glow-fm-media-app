# GLOW 99.1 FM - New Age Radio App

An outstanding New Age / ambient radio experience for GLOW 99.1 FM with curated Glow channels.

## Features
- Four curated Glow channels (Live, Focus, Afterlight, Earth)
- Play/Pause controls with branded UI
- Streaming via `expo-av` (works in Expo Go)

## Setup

1) Install dependencies  
```bash
npm install
```

2) Run with Expo Go  
```bash
npx expo start
```

Then scan the QR code in Expo Go (Android) or the Camera app (iOS).

## Testing
```bash
npm test
```

## Customizing Streams
Edit the `RADIO_STATIONS` array in `App.tsx` to swap stream URLs, vibes, and tag lines. Each station supports `name`, `url`, `vibe`, `description`, and `tags`.
