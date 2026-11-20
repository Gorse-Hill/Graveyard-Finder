# Graveyard Locator, mobile first slice

This slice covers Save a Grave (photo, name, GPS, offline save), the Grave Saved screen, and the Family Card QR code.

**Status: not compiled or run.** Flutter is not installed in the environment where this code was written, and package installs were blocked. Build and test it on your machine before you rely on it.

## Set up

1. Install Flutter (stable channel) and an Android emulator or phone.
2. From this `mobile` folder, generate the platform folders without overwriting `lib`:
   `flutter create --platforms=android,ios --project-name graveyard_locator .`
3. Run `flutter pub get`.
4. Add the permissions below.
5. Run `flutter analyze`, then `flutter test`, then `flutter run`.

### Android: `android/app/src/main/AndroidManifest.xml`

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

### iOS: `ios/Runner/Info.plist`

```xml
<key>NSCameraUsageDescription</key>
<string>The camera takes a photo of the grave.</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>Location records where the grave is.</string>
```

See the root README for the overall project status and next steps.
