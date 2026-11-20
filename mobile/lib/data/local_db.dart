import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';

/// Local SQLite store. Every save writes the record and its queue entry in one transaction.
///
/// Schema version 2 adds retry timing and the last error to sync_queue.
/// Schema version 3 adds photo_queue for photo uploads.
class LocalDb {
  static Database? _db;
  static const int schemaVersion = 3;

  static Future<Database> open() async {
    final existing = _db;
    if (existing != null) return existing;

    final path = p.join(await getDatabasesPath(), 'graveyard.db');
    final db = await openDatabase(
      path,
      version: schemaVersion,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE graves (
            id TEXT PRIMARY KEY,
            qr_token TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            gps_lat REAL NOT NULL,
            gps_lng REAL NOT NULL,
            gps_accuracy_m REAL,
            photo_path TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'active',
            entity_version INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          )''');
        await db.execute('''
          CREATE TABLE sync_queue (
            client_event_id TEXT PRIMARY KEY,
            device_id TEXT NOT NULL,
            entity TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            op TEXT NOT NULL,
            entity_version INTEGER NOT NULL,
            payload TEXT NOT NULL,
            state TEXT NOT NULL DEFAULT 'queued',
            attempts INTEGER NOT NULL DEFAULT 0,
            next_attempt_at TEXT,
            last_error TEXT,
            created_at TEXT NOT NULL
          )''');
        await db.execute('''
          CREATE TABLE settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
          )''');
        await _createPhotoQueue(db);
      },
      onUpgrade: (db, oldVersion, newVersion) async {
        if (oldVersion < 2) {
          await db.execute('ALTER TABLE sync_queue ADD COLUMN next_attempt_at TEXT');
          await db.execute('ALTER TABLE sync_queue ADD COLUMN last_error TEXT');
        }
        if (oldVersion < 3) {
          await _createPhotoQueue(db);
        }
      },
    );
    _db = db;
    return db;
  }

  static Future<void> _createPhotoQueue(Database db) async {
    await db.execute('''
      CREATE TABLE IF NOT EXISTS photo_queue (
        photo_id TEXT PRIMARY KEY,
        grave_id TEXT NOT NULL,
        local_path TEXT NOT NULL,
        content_type TEXT NOT NULL,
        byte_size INTEGER NOT NULL,
        sha256 TEXT NOT NULL,
        state TEXT NOT NULL DEFAULT 'queued',
        attempts INTEGER NOT NULL DEFAULT 0,
        next_attempt_at TEXT,
        last_error TEXT,
        created_at TEXT NOT NULL
      )''');
  }
}
