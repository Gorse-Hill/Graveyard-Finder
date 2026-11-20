import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:graveyard_locator/data/photo_cache.dart';
import 'package:graveyard_locator/domain/family_grave.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  test('the cache file name comes from the photo ID', () {
    expect(
      cachePathFor('/docs/family_photos', 'f0000000-0000-4000-8000-000000000001'),
      '/docs/family_photos/f0000000-0000-4000-8000-000000000001.jpg',
    );
  });

  test('the cache file name strips anything that is not a letter, digit, or dash', () {
    expect(cachePathFor('/d', '../../etc/passwd'), '/d/etcpasswd.jpg');
  });

  test('the first open downloads the photo and the second open reads the file', () async {
    final tmp = await Directory.systemTemp.createTemp('photo_cache_test');
    addTearDown(() => tmp.delete(recursive: true));

    var requests = 0;
    final client = MockClient((request) async {
      requests++;
      return http.Response.bytes([1, 2, 3], 200);
    });
    final cache = PhotoCache(client: client, directory: () async => tmp);
    const photo = FamilyPhoto(
      id: 'f0000000-0000-4000-8000-000000000009',
      url: 'https://example.test/p.jpg',
    );

    final first = await cache.fileFor(photo);
    final second = await cache.fileFor(photo);

    expect(first, isNotNull);
    expect(second!.path, first!.path);
    expect(requests, 1);
    expect(await second.readAsBytes(), [1, 2, 3]);
  });

  test('a failed download returns null and stores nothing', () async {
    final tmp = await Directory.systemTemp.createTemp('photo_cache_test');
    addTearDown(() => tmp.delete(recursive: true));

    final client = MockClient((request) async => http.Response('', 404));
    final cache = PhotoCache(client: client, directory: () async => tmp);
    const photo = FamilyPhoto(
      id: 'f0000000-0000-4000-8000-00000000000a',
      url: 'https://example.test/missing.jpg',
    );

    expect(await cache.fileFor(photo), isNull);
    final stored = File(cachePathFor('${tmp.path}/family_photos', photo.id));
    expect(await stored.exists(), isFalse);
  });
}
