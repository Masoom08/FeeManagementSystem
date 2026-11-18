# ICCMRT Fee Portal mobile app

This is a separate Expo / React Native app in the repository root, outside `frontend`.

## Source layout

```text
App.tsx                              App entry and sign-in/dashboard switch
src/
  components/                        Shared buttons, student, fee, and summary UI
  features/auth/LoginScreen.tsx      Backend phone and OTP sign-in
  features/dashboard/                Student fee dashboard
  services/                          Student API and receipt PDF adapters
  theme/                              Shared visual tokens
  types/                              Student, fee, and payment types
  utils/                              Shared formatting helpers
```

## Run it

```sh
npm install
npx expo install --fix
npm start
```

Use the Expo Go app to scan the QR code, or run `npm run android` / `npm run ios` with a simulator configured.

To run the same app in a desktop browser, install Expo's SDK-matched web packages and start the web target:

```sh
npx expo install react-dom react-native-web @expo/metro-runtime
npm run web
```

Expo will serve the app locally and open it in your browser. Its web setup uses React Native Web to render the shared React Native screens in the browser ([Expo web guide](https://docs.expo.dev/workflow/web/)).

## Backend connection and demo sign-in

The app reads `EXPO_PUBLIC_API_URL` from `.env`. The workspace `.env` defaults
to `http://localhost:3000` for web and local simulators. For a physical phone,
replace `localhost` with the computer's LAN IP so the phone can reach the API.

Seeded accounts can sign in with a student's roster phone number. The demo OTP
is returned by the backend and shown on the verification screen; OTP delivery
is not connected to SMS.

## Fee receipts

Fee balances and paid receipt history come from the backend. Receipts download
as branded PDF files with the institute logo and name, receipt number, student
and course details, payment date, semesters, method, and total. The app saves
directly to Downloads on web, to a selected folder on Android (choose Downloads),
and to the app's Receipts folder in Files on iOS. It does not open a print dialog.

## Mock payment simulator

Each payment begins as a pending database order. The app then offers simulator
actions that call the backend mock-success or mock-failure endpoint. Success
posts the payment to the fee ledger and creates a downloadable receipt; failure
persists a failed attempt without changing the fee balance.
