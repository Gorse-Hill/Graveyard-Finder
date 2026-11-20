import 'dart:convert';

import 'package:http/http.dart' as http;

import '../domain/qr_link.dart';
import 'grave_repository.dart';
import 'sync_client.dart';

class CaretakerApiException implements Exception {
  final String message;
  const CaretakerApiException(this.message);

  @override
  String toString() => 'CaretakerApiException: $message';
}

/// Caretaker sign-in: a phone code from Supabase Auth, then the link between the account and this device.
/// Uses the same build settings as sync: SYNC_URL and SYNC_ANON_KEY.
class CaretakerApi {
  final SyncClient sync;
  final GraveRepository repo;
  final http.Client _http;

  CaretakerApi({required this.sync, required this.repo, http.Client? client})
      : _http = client ?? http.Client();

  Map<String, String> get _anonHeaders => {
        'content-type': 'application/json',
        'apikey': sync.anonKey,
      };

  Future<void> requestCode(String phone) async {
    final res = await _http.post(
      Uri.parse('${authBaseUrl(sync.baseUrl)}/otp'),
      headers: _anonHeaders,
      body: jsonEncode({'phone': phone.trim()}),
    );
    if (res.statusCode != 200) throw CaretakerApiException('otp_${res.statusCode}');
  }

  /// Checks the code and links the account to this device. Returns when the link is in place.
  Future<void> verifyAndLink(String phone, String code) async {
    final verify = await _http.post(
      Uri.parse('${authBaseUrl(sync.baseUrl)}/verify'),
      headers: _anonHeaders,
      body: jsonEncode({'type': 'sms', 'phone': phone.trim(), 'token': code.trim()}),
    );
    if (verify.statusCode != 200) throw CaretakerApiException('verify_${verify.statusCode}');

    final accessToken = (jsonDecode(verify.body) as Map<String, dynamic>)['access_token'] as String?;
    if (accessToken == null) throw const CaretakerApiException('no_access_token');

    final deviceId = await repo.deviceIdentity();
    final deviceToken = await sync.deviceToken(deviceId);
    if (deviceToken == null) throw const CaretakerApiException('device_not_registered');

    final link = await _http.post(
      Uri.parse('${sync.baseUrl}/device-link'),
      headers: {
        'content-type': 'application/json',
        'apikey': sync.anonKey,
        'authorization': 'Bearer $accessToken',
        'x-device-token': deviceToken,
      },
      body: jsonEncode({'device_id': deviceId}),
    );
    if (link.statusCode == 409) throw const CaretakerApiException('device_linked_to_other_account');
    if (link.statusCode != 200) throw CaretakerApiException('link_${link.statusCode}');

    await repo.setSetting('caretaker_linked', '1');
  }
}
