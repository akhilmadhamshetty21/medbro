# Medbro 💊

AI-powered medicine companion app — scan prescriptions, identify medicines, and chat with AI for health guidance. Built with React Native & Expo.

🌐 **Live Demo:** [medbro-dun.vercel.app](https://medbro-dun.vercel.app)

## Features

- **💊 Prescription Scanner** — Scan or manually enter prescriptions; AI auto-generates your medicine schedule
- **🔍 Know Your Medicine** — Scan a medicine to get side effects, price, ingredients, alternatives & nearby pharmacies
- **🤖 Talk to AI** — Ask any health or medicine question; AI flags when you should see a doctor

## Tech Stack

- React Native + Expo SDK 54
- expo-router (file-based navigation)
- Claude claude-sonnet-4-6 (vision) + Claude Haiku (chat)
- OpenFDA drug label API
- TypeScript

## Run Locally

```bash
npm install
npm start        # Expo dev server — scan QR with Expo Go
npm run android
npm run ios
```

Add your API key to `.env`:
```
EXPO_PUBLIC_ANTHROPIC_API_KEY=your_key_here
```

## Disclaimer

Medbro is informational only and not a substitute for professional medical advice. Always consult a qualified healthcare professional.
