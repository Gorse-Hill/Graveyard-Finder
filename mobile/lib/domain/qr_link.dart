/// Reads the grave token from a scanned QR value such as https://gl.app/g/ABCDEFGHIJKLMNOPQRSTUVWXYZ.
/// Returns null when the value is not a Graveyard Locator link.
String? parseGraveToken(String raw) {
  final match = RegExp(r'^https://gl\.app/g/([A-Z2-7]{26})/?$').firstMatch(raw.trim());
  return match?.group(1);
}

/// True for a phone number in international format, such as +252637389999.
bool isValidPhone(String value) => RegExp(r'^\+[1-9]\d{7,14}$').hasMatch(value.trim());

/// The Supabase Auth address that goes with the functions address.
/// SYNC_URL looks like https://<project>.supabase.co/functions/v1.
String authBaseUrl(String functionsUrl) =>
    functionsUrl.replaceFirst(RegExp(r'/functions/v1/?$'), '/auth/v1');
