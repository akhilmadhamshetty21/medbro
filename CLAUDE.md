# Medbro — Claude Code Instructions

## Project Overview
Medbro is an AI-powered medicine companion mobile app built with **React Native + Expo**.

Three core features:
1. **Prescription** — Scan or manually enter prescriptions; auto-generate medicine schedule
2. **Know Your Medicine** — Scan/search medicine for side effects, price, ingredients, alternatives, nearby pharmacies
3. **Talk to AI** — Chat with AI for health/medicine queries; escalate to doctor when needed

## Tech Stack
- **Framework:** Expo SDK 54 (React Native)
- **Routing:** expo-router (file-based, lives in `app/`)
- **Language:** TypeScript (strict)
- **Styling:** React Native `StyleSheet` with design tokens from `constants/Colors.ts`
- **Camera/Gallery:** expo-image-picker, expo-camera

## Project Structure
```
app/
  _layout.tsx          # Root layout — bottom tab navigator
  index.tsx            # Home screen
  prescription/        # Feature: Prescription scanner + scheduler
  medicine/            # Feature: Know Your Medicine
  chat/                # Feature: Talk to AI
constants/
  Colors.ts            # All color tokens — always use these, never hardcode colors
services/
  ai.ts                # AI service stubs — all AI API calls go here
assets/                # App icons, splash screen
```

## Key Conventions
- **Colors:** Always import from `constants/Colors.ts`. Never hardcode hex values in components.
- **AI logic:** All AI/API calls must go through `services/ai.ts`. Components call service functions, not APIs directly.
- **Navigation:** Use `expo-router` `useRouter` and `<Link>` — do not use `@react-navigation` directly.
- **Safe area:** Wrap screens in `<SafeAreaView>` from `react-native-safe-area-context`.
- **No NativeWind/Tailwind active** — use `StyleSheet.create` for all styling.

## AI Integration (TODO)
Service stubs are in `services/ai.ts`. Wire these to real APIs:
- **Prescription OCR:** Claude claude-sonnet-4-6 vision API
- **Medicine identification:** Claude vision + OpenFDA (`https://api.fda.gov/drug/label.json`)
- **AI Chat:** Claude API (`claude-sonnet-4-6`) with a medical guidance system prompt
- **API keys:** Use `EXPO_PUBLIC_` prefix in `.env` for Expo to expose them to the client

## Medical Disclaimer
Always display the disclaimer that Medbro is informational only and not a substitute for professional medical advice. This is shown on the Home screen and Chat screen.

## Running the App
```bash
npm run android    # Android
npm run ios        # iOS (macOS only)
npm start          # Expo dev server (scan QR with Expo Go)
```
