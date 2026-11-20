import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:sqflite/sqflite.dart';

import 'local_db.dart';

/// Events sent per request. The server accepts up to 50.
const int maxBatchSize = 50;

/// Wait before the next try after failed attempt number [attempts]: 1, 2, 4, 8, then 15 minutes.
Duration backoffFor(int attempts) {
  const cap = Duration(minutes: 15);
  if (attempts <= 0) return Duration.zero;
  final exponent = attempts - 1 > 10 ? 10 : attempts - 1;
  final wait = Duration(minutes: 1 << exponent);
  return wait > cap ? cap : wait;
}

/// Maps the server result for one event to a local queue state.
String queueStateFor(String result, {String? originalResult}) {
  switch (result) {
    case 'applied':
      return 'sent';
    case 'conflict':
      return 'conflict';
    case 'duplicate':
      return queueStateFor(originalResult ?? 'rejected');
    default:
      return 'rejected';
  }
}

/// The index of the event the server refused, read from an error such as "events[3]_unsupported_op".
int? rejectedEventIndex(String error) {
  final match = RegExp(r'^events\[(\d+)\]').firstMatch(error);
  return match == null ? null : int.parse(match.group(1)!);
}

/// Turns a queue row into the event shape the sync-batch function expects.
Map<String, Object?> eventFromRow(Map<String, Object?> row) => {
      'client_event_id': row['client_event_id'],
      'entity': row['entity'],
      'entity_id': row['entity_id'],
      'op': row['op'],
      'entity_version': row['entity_version'],
      'created_at': row['created_at'],
      'payload': jsonDecode(row['payload'] as String),
    };

/// Sends queued events to the server in batches. Nothing here runs on the save path.
///
/// Build-time settings: --dart-define=SYNC_URL=https://<project>.supabase.co/functions/v1
///                      --dart-define=SYNC_ANON_KEY=<anon key>
/// With no SYNC_URL the client does nothing, so local saves still work.
class SyncClient {
  final String baseUrl;
  final String anonKey;
  final http.Client _http;
  final DateTime Function() _now;
  bool _running = false;

  SyncClient({
    required this.baseUrl,
    required this.anonKey,
    http.Client? client,
    DateTime Function()? now,
  })  : _http = client ?? http.Client(),
        _now = now ?? DateTime.now;

  factory SyncClient.fromBuildConfig() => SyncClient(
        baseUrl: const String.fromEnvironment('SYNC_URL'),
        anonKey: const String.fromEnvironment('SYNC_ANON_KEY'),
      );

  bool get configured => baseUrl.isNotEmpty && anonKey.isNotEmpty;

  /// Sends one batch of due events. A second call while one is running returns at once.
  /// Network and storage errors leave the queue in a retry state. They are not shown to the user.
  Future<void> syncNow() async {
    if (!configured || _running) return;
    _running = true;
    try {
      final db = await LocalDb.open();
      final deviceId = await _setting(db, 'device_id');
      if (deviceId == null) return;

      final token = await _ensureToken(db, deviceId);
      if (token == null) return;

      final rows = await db.query(
        'sync_queue',
        where: "state IN ('queued', 'retry') "
            'AND (next_attempt_at IS NULL OR next_attempt_at <= ?)',
        whereArgs: [_now().toUtc().toIso8601String()],
        orderBy: 'created_at',
        limit: maxBatchSize,
      );
      if (rows.isNotEmpty) await _sendBatch(db, deviceId, token, rows);
      await _uploadPhotos(db, deviceId, token);
    } catch (_) {
      // Left in the queue on purpose. The next run sends the same events again.
    } finally {
      _running = false;
    }
  }

  /// Uploads queued photos. A photo whose grave is not on the server yet waits for the next run.
  Future<void> _uploadPhotos(Database db, String deviceId, String token) async {
    final now = _now().toUtc();
    final rows = await db.query(
      'photo_queue',
      where: "state IN ('queued', 'retry') "
          'AND (next_attempt_at IS NULL OR next_attempt_at <= ?)',
      whereArgs: [now.toIso8601String()],
      orderBy: 'created_at',
      limit: 5,
    );
    for (final row in rows) {
      try {
        await _uploadOnePhoto(db, deviceId, token, row, now);
      } catch (_) {
        await _retryPhoto(db, row, now, 'network_error');
      }
    }
  }

  /// Three steps: reserve a slot, PUT the bytes to the signed link, then confirm.
  Future<void> _uploadOnePhoto(
    Database db,
    String deviceId,
    String token,
    Map<String, Object?> row,
    DateTime now,
  ) async {
    final photoId = row['photo_id'] as String;
    final file = File(row['local_path'] as String);
    if (!await file.exists()) {
      return _setPhoto(db, photoId, 'rejected', 'photo_file_missing');
    }

    final slot = await _http.post(
      Uri.parse('$baseUrl/photo-upload-url'),
      headers: _headers(token),
      body: jsonEncode({
        'device_id': deviceId,
        'grave_id': row['grave_id'],
        'photo_id': photoId,
        'content_type': row['content_type'],
        'byte_size': row['byte_size'],
        'sha256': row['sha256'],
      }),
    );
    if (slot.statusCode == 409) {
      return _retryPhoto(db, row, now, 'grave_not_synced_yet');
    }
    if (slot.statusCode == 400 || slot.statusCode == 403) {
      return _setPhoto(db, photoId, 'rejected', _errorOf(slot.body));
    }
    if (slot.statusCode != 200) {
      return _retryPhoto(db, row, now, 'http_${slot.statusCode}');
    }

    final slotBody = _bodyOf(slot.body);
    if (slotBody['status'] == 'ready') {
      return _setPhoto(db, photoId, 'sent', null);
    }

    final put = await _http.put(
      Uri.parse(slotBody['upload_url'] as String),
      headers: {'content-type': row['content_type'] as String},
      body: await file.readAsBytes(),
    );
    if (put.statusCode != 200) {
      return _retryPhoto(db, row, now, 'upload_${put.statusCode}');
    }

    final confirm = await _http.post(
      Uri.parse('$baseUrl/photo-confirm'),
      headers: _headers(token),
      body: jsonEncode({'device_id': deviceId, 'photo_id': photoId}),
    );
    if (confirm.statusCode == 200) {
      return _setPhoto(db, photoId, 'sent', null);
    }
    if (confirm.statusCode == 422) {
      return _setPhoto(db, photoId, 'rejected', _errorOf(confirm.body));
    }
    return _retryPhoto(db, row, now, 'confirm_${confirm.statusCode}');
  }

  Future<void> _setPhoto(Database db, String photoId, String state, String? error) async {
    await db.update(
      'photo_queue',
      {'state': state, 'last_error': error, 'next_attempt_at': null},
      where: 'photo_id = ?',
      whereArgs: [photoId],
    );
  }

  Future<void> _retryPhoto(
    Database db,
    Map<String, Object?> row,
    DateTime now,
    String reason,
  ) async {
    final attempts = (row['attempts'] as int) + 1;
    await db.update(
      'photo_queue',
      {
        'attempts': attempts,
        'state': 'retry',
        'last_error': reason,
        'next_attempt_at': now.add(backoffFor(attempts)).toIso8601String(),
      },
      where: 'photo_id = ?',
      whereArgs: [row['photo_id']],
    );
  }

  Map<String, dynamic> _bodyOf(String body) {
    try {
      final decoded = jsonDecode(body);
      if (decoded is Map<String, dynamic>) return decoded;
    } catch (_) {}
    return const {};
  }

  /// The device token, registering the device first when needed. Null when the server is unreachable.
  Future<String?> deviceToken(String deviceId) async {
    if (!configured) return null;
    try {
      return await _ensureToken(await LocalDb.open(), deviceId);
    } catch (_) {
      return null;
    }
  }

  Future<String?> _ensureToken(Database db, String deviceId) async {
    final existing = await _setting(db, 'device_token');
    if (existing != null) return existing;

    final res = await _http.post(
      Uri.parse('$baseUrl/device-register'),
      headers: _headers(null),
      body: jsonEncode({'device_id': deviceId}),
    );
    if (res.statusCode != 201) return null;

    final token = (jsonDecode(res.body) as Map<String, dynamic>)['token'] as String;
    await db.insert(
      'settings',
      {'key': 'device_token', 'value': token},
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
    return token;
  }

  Future<void> _sendBatch(
    Database db,
    String deviceId,
    String token,
    List<Map<String, Object?>> rows,
  ) async {
    final now = _now().toUtc();
    final body = jsonEncode({
      'device_id': deviceId,
      'events': rows.map(eventFromRow).toList(),
    });

    http.Response res;
    try {
      res = await _http
          .post(
            Uri.parse('$baseUrl/sync-batch'),
            headers: _headers(token),
            body: body,
          )
          .timeout(const Duration(seconds: 30));
    } catch (_) {
      await _scheduleRetry(db, rows, now, 'network_error');
      return;
    }

    if (res.statusCode == 200) {
      final decoded = jsonDecode(res.body) as Map<String, dynamic>;
      for (final raw in decoded['results'] as List<dynamic>) {
        final r = raw as Map<String, dynamic>;
        await db.update(
          'sync_queue',
          {
            'state': queueStateFor(
              r['result'] as String,
              originalResult: r['original_result'] as String?,
            ),
            'last_error': r['reason'] as String?,
            'next_attempt_at': null,
          },
          where: 'client_event_id = ?',
          whereArgs: [r['client_event_id']],
        );
      }
      return;
    }

    if (res.statusCode == 400) {
      // A bad event is set aside alone. The rest of the batch goes out next run.
      final error = _errorOf(res.body);
      final index = rejectedEventIndex(error);
      final refused = index != null && index < rows.length ? [rows[index]] : rows;
      for (final row in refused) {
        await db.update(
          'sync_queue',
          {'state': 'rejected', 'last_error': error},
          where: 'client_event_id = ?',
          whereArgs: [row['client_event_id']],
        );
      }
      return;
    }

    await _scheduleRetry(db, rows, now, 'http_${res.statusCode}');
  }

  Future<void> _scheduleRetry(
    Database db,
    List<Map<String, Object?>> rows,
    DateTime now,
    String reason,
  ) async {
    for (final row in rows) {
      final attempts = (row['attempts'] as int) + 1;
      await db.update(
        'sync_queue',
        {
          'attempts': attempts,
          'state': 'retry',
          'last_error': reason,
          'next_attempt_at': now.add(backoffFor(attempts)).toIso8601String(),
        },
        where: 'client_event_id = ?',
        whereArgs: [row['client_event_id']],
      );
    }
  }

  Map<String, String> _headers(String? token) => {
        'content-type': 'application/json',
        'apikey': anonKey,
        'authorization': 'Bearer $anonKey',
        if (token != null) 'x-device-token': token,
      };

  String _errorOf(String body) {
    try {
      final decoded = jsonDecode(body);
      if (decoded is Map && decoded['error'] is String) {
        return decoded['error'] as String;
      }
    } catch (_) {}
    return 'bad_response';
  }

  Future<String?> _setting(Database db, String key) async {
    final rows = await db.query('settings', where: 'key = ?', whereArgs: [key]);
    return rows.isEmpty ? null : rows.first['value'] as String;
  }
}
