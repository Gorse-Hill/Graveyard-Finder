import 'dart:convert';

import 'package:http/http.dart' as http;

import '../domain/family_grave.dart';

class FamilyApiException implements Exception {
  final String message;
  const FamilyApiException(this.message);

  @override
  String toString() => 'FamilyApiException: $message';
}

/// Reads the public family view for a grave by its QR token.
/// Build-time settings are the same as for sync: SYNC_URL and SYNC_ANON_KEY.
class FamilyApi {
  final String baseUrl;
  final String anonKey;
  final http.Client _http;

  FamilyApi({required this.baseUrl, required this.anonKey, http.Client? client})
      : _http = client ?? http.Client();

  factory FamilyApi.fromBuildConfig() => FamilyApi(
        baseUrl: const String.fromEnvironment('SYNC_URL'),
        anonKey: const String.fromEnvironment('SYNC_ANON_KEY'),
      );

  /// Returns null when no grave has that token.
  Future<FamilyGrave?> fetchGrave(String token) async {
    if (baseUrl.isEmpty) throw const FamilyApiException('not_configured');

    final res = await _http.get(
      Uri.parse('$baseUrl/family-grave?token=$token'),
      headers: {'apikey': anonKey, 'authorization': 'Bearer $anonKey'},
    );
    if (res.statusCode == 404) return null;
    if (res.statusCode != 200) {
      throw FamilyApiException('http_${res.statusCode}');
    }
    return parseFamilyGrave(jsonDecode(res.body) as Map<String, dynamic>);
  }
}
