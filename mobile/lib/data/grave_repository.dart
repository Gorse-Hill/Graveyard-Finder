import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:sqflite/sqflite.dart';
import 'package:uuid/uuid.dart';

import '../domain/condition_report.dart';
import '../domain/grave_token.dart';
import '../domain/photo_rules.dart';
import 'local_db.dart';

class SavedGrave {
  final String id;
  final String token;
  final String name;
  final String photoPath;

  const SavedGrave({
    required this.id,
    required this.token,
    required this.name,
    required this.photoPath,
  });
}

class GraveRepository {
  static const _uuid = Uuid();

  /// Writes the grave and its queue entry in one transaction. Nothing waits on the network.
  ///
  /// The queue payload leaves out photo_path. The photo is local until photo upload
  /// arrives in sprint 4, and a device path means nothing on the server.
  Future<SavedGrave> saveGrave({
    required String name,
    required String photoPath,
    required double lat,
    required double lng,
    double? accuracyM,
  }) async {
    final db = await LocalDb.open();
    final deviceId = await deviceIdentity();
    final photoBytes = await File(photoPath).readAsBytes();
    final photoId = _uuid.v4();
    final photoSha = sha256.convert(photoBytes).toString();
    final id = _uuid.v4();
    final token = newGraveToken();
    final now = DateTime.now().toUtc().toIso8601String();

    final payload = {
      'qr_token': token,
      'name': name,
      'gps_lat': lat,
      'gps_lng': lng,
      'gps_accuracy_m': accuracyM,
      'created_at': now,
    };

    await db.transaction((txn) async {
      await txn.insert('graves', {
        'id': id,
        'qr_token': token,
        'name': name,
        'gps_lat': lat,
        'gps_lng': lng,
        'gps_accuracy_m': accuracyM,
        'photo_path': photoPath,
        'status': 'active',
        'entity_version': 1,
        'created_at': now,
        'updated_at': now,
      });
      await txn.insert('photo_queue', {
        'photo_id': photoId,
        'grave_id': id,
        'local_path': photoPath,
        'content_type': photoContentType(photoPath),
        'byte_size': photoBytes.length,
        'sha256': photoSha,
        'state': 'queued',
        'attempts': 0,
        'created_at': now,
      });
      await txn.insert('sync_queue', {
        'client_event_id': _uuid.v4(),
        'device_id': deviceId,
        'entity': 'graves',
        'entity_id': id,
        'op': 'create',
        'entity_version': 1,
        'payload': jsonEncode(payload),
        'state': 'queued',
        'attempts': 0,
        'created_at': now,
      });
    });

    return SavedGrave(id: id, token: token, name: name, photoPath: photoPath);
  }

  /// Queues a condition report for a grave. Only a caretaker device is accepted by the server.
  Future<String> queueConditionReport({
    required String graveQrToken,
    required String condition,
    String? note,
    double? lat,
    double? lng,
    double? accuracyM,
  }) async {
    final db = await LocalDb.open();
    final deviceId = await deviceIdentity();
    final reportId = _uuid.v4();
    final now = DateTime.now().toUtc();

    final payload = conditionReportPayload(
      reportId: reportId,
      graveQrToken: graveQrToken,
      condition: condition,
      note: note,
      lat: lat,
      lng: lng,
      accuracyM: accuracyM,
      visitDate: now,
    );

    await db.insert('sync_queue', {
      'client_event_id': _uuid.v4(),
      'device_id': deviceId,
      'entity': 'condition_reports',
      'entity_id': reportId,
      'op': 'create',
      'entity_version': 1,
      'payload': jsonEncode(payload),
      'state': 'queued',
      'attempts': 0,
      'created_at': now.toIso8601String(),
    });
    return reportId;
  }

  /// Events still waiting to reach the server. Drives the "waiting for connection" text.
  Future<int> queuedCount() async {
    final db = await LocalDb.open();
    final rows = await db.rawQuery(
      "SELECT COUNT(*) AS c FROM sync_queue WHERE state IN ('queued', 'retry')",
    );
    return Sqflite.firstIntValue(rows) ?? 0;
  }

  Future<void> setSetting(String key, String value) async {
    final db = await LocalDb.open();
    await db.insert(
      'settings',
      {'key': key, 'value': value},
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<bool> isCaretakerLinked() async {
    final db = await LocalDb.open();
    final rows = await db.query('settings', where: 'key = ?', whereArgs: ['caretaker_linked']);
    return rows.isNotEmpty;
  }

  /// The install's device ID. Created once and kept in the settings table.
  Future<String> deviceIdentity() async {
    final db = await LocalDb.open();
    final rows = await db.query(
      'settings',
      where: 'key = ?',
      whereArgs: ['device_id'],
    );
    if (rows.isNotEmpty) return rows.first['value'] as String;

    final id = _uuid.v4();
    await db.insert('settings', {'key': 'device_id', 'value': id});
    return id;
  }
}
