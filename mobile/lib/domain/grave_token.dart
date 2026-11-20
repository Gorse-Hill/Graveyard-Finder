import 'dart:math';

const _base32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/// Random 130-bit token, base32 encoded (26 characters).
///
/// The device generates it so the grave can be saved offline. The server stores
/// it unchanged. Spec section 8 says the server generates this token. That
/// wording must change to "device generates, server stores" when the spec is updated.
String newGraveToken({Random? random}) {
  final rng = random ?? Random.secure();
  return List.generate(26, (_) => _base32[rng.nextInt(32)]).join();
}
