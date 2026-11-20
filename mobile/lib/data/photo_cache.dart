import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';

import '../domain/family_grave.dart';

/// The file path for one cached photo. The name comes from the photo ID, so one photo maps to one file.
String cachePathFor(String folder, String photoId) {
  final safe = photoId.replaceAll(RegExp(r'[^A-Za-z0-9-]'), '');
  return '$folder/$safe.jpg';
}

/// Keeps family photo bytes on the phone, keyed by photo ID.
/// Signed links expire after an hour. The cached files do not.
class PhotoCache {
  final http.Client _http;
  final Future<Directory> Function() _directory;

  PhotoCache({http.Client? client, Future<Directory> Function()? directory})
      : _http = client ?? http.Client(),
        _directory = directory ?? getApplicationDocumentsDirectory;

  /// The cached file for this photo. Downloads and stores it on the first open.
  /// Returns null when the photo is not cached and cannot be downloaded.
  Future<File?> fileFor(FamilyPhoto photo) async {
    final dir = await _directory();
    final folder = Directory('${dir.path}/family_photos');
    if (!await folder.exists()) await folder.create(recursive: true);

    final file = File(cachePathFor(folder.path, photo.id));
    if (await file.exists()) return file;

    try {
      final res = await _http.get(Uri.parse(photo.url));
      if (res.statusCode != 200) return null;
      // Write to a temporary file first, so an interrupted write never leaves a partial photo under the final name.
      final partial = File('${file.path}.tmp');
      try {
        await partial.writeAsBytes(res.bodyBytes, flush: true);
        await partial.rename(file.path);
      } finally {
        // After a successful rename the temporary file is gone. After a failure it is removed here.
        if (await partial.exists()) await partial.delete();
      }
      return file;
    } catch (_) {
      return null;
    }
  }
}
