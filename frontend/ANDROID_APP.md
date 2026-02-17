# 墨阵 Android App (Capacitor)

This repo's "墨流" is a React SPA. The Android app ("墨阵") is a Capacitor wrapper that:

- Bundles `dist/` (including `/data/*` and `/steles/*`) for offline use.
- Supports deep links like `inkgrid://inkflow?page=characters&index=12`.
- Shows an ongoing "InkFlow" notification with shortcuts (to surface in OriginOS/atomic notifications).

## Prerequisites

- Node.js + npm
- Android Studio + Android SDK
- JDK 17 (Android Studio bundled JBR is OK)
- A physical Android device (e.g. vivo X100) with USB debugging enabled

## Build & Run

From repo root:

```bash
cd frontend
npm install
npm run android:open
```

Android Studio will open `frontend/android/`.

Then:

1. Select your connected device
2. Run the `app` configuration

## Notifications

- The app requests notification permission on first use (Android 13+).
- When "墨流" is open, the app updates a persistent notification with:
  - current mode (characters/steles/posters)
  - progress
  - a "Next" action for quick paging

## Deep link testing (adb)

```bash
adb shell am start \
  -a android.intent.action.VIEW \
  -d "inkgrid://inkflow?page=characters&index=0" \
  com.inkgrid.app
```

## Key files

- Web deep link handling: `frontend/src/App.tsx`
- InkFlow launch + notification updates: `frontend/src/components/InkFlow.tsx`
- Capacitor config: `frontend/capacitor.config.ts`
- Android deep link + notification plugin:
  - `frontend/android/app/src/main/AndroidManifest.xml`
  - `frontend/android/app/src/main/java/com/inkgrid/app/InkgridNotificationsPlugin.java`
  - `frontend/android/app/src/main/java/com/inkgrid/app/InkgridNotificationReceiver.java`

## App icon

- Source: `logo/mo_ink.png`
- Generated launcher assets live in: `frontend/android/app/src/main/res/mipmap-*/ic_launcher*.png`
