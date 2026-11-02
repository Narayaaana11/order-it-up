# Order It Up Android Tablet POS

The Android tablet app packages the existing Next.js/React renderer from `frontend/` with Capacitor. It shares the desktop POS components instead of maintaining a second visual implementation.

## Build the Android debug app

From the repository root, run:

```powershell
npm ci --prefix frontend
npm ci --prefix tablet-android
npm run build:web
npm --prefix tablet-android run android:sync
Push-Location tablet-android/android
./gradlew.bat assembleDebug
Pop-Location
```

Open `tablet-android/android` in Android Studio to install the debug build on a tablet or emulator.

## Runtime boundary

The packaged React app authenticates through the Cloud API. Its static assets are bundled, but operational data and order writes require a reachable API. The Capacitor container does not turn the Cloud API into an offline local server and does not automatically provide SQLite, receipt printing, cash-drawer control, or barcode hardware access. Those capabilities must be implemented and verified separately before describing the tablet as feature-parity or offline-first.

Cloud order and payment endpoints remain server-authoritative. The client must never claim that a non-cash payment is provider-verified without a real terminal or gateway confirmation.
