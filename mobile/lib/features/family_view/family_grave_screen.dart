import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import 'dart:io';

import '../../core/strings.dart';
import '../../data/family_api.dart';
import '../../data/photo_cache.dart';
import '../../domain/condition_report.dart';
import '../../domain/family_grave.dart';

/// The family view: name, location in words, photos, and published condition reports.
class FamilyGraveScreen extends StatelessWidget {
  final String token;
  final FamilyApi api;

  const FamilyGraveScreen({super.key, required this.token, required this.api});

  @override
  Widget build(BuildContext context) {
    final cache = PhotoCache();
    return Scaffold(
      appBar: AppBar(title: const Text(Strings.appTitle)),
      body: FutureBuilder<FamilyGrave?>(
        future: api.fetchGrave(token),
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Text(
                  'This grave could not be loaded. Check the connection and try again.',
                  style: TextStyle(fontSize: 20),
                  textAlign: TextAlign.center,
                ),
              ),
            );
          }
          final grave = snapshot.data;
          if (grave == null) {
            return const Center(
              child: Text('No grave was found for this code.', style: TextStyle(fontSize: 20)),
            );
          }
          return _GraveBody(grave: grave, cache: cache);
        },
      ),
    );
  }
}

/// Shows a photo from the phone's cache. The first open downloads it.
class _CachedPhoto extends StatelessWidget {
  final FamilyPhoto photo;
  final PhotoCache cache;

  const _CachedPhoto({required this.photo, required this.cache});

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<File?>(
      future: cache.fileFor(photo),
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const SizedBox(
            height: 260,
            child: Center(child: CircularProgressIndicator()),
          );
        }
        final file = snapshot.data;
        if (file == null) {
          return const SizedBox(
            height: 120,
            child: Center(
              child: Text(
                'This photo needs a connection to load.',
                style: TextStyle(fontSize: 18),
                textAlign: TextAlign.center,
              ),
            ),
          );
        }
        return ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: Image.file(file, height: 260, fit: BoxFit.cover),
        );
      },
    );
  }
}

class _GraveBody extends StatelessWidget {
  final FamilyGrave grave;
  final PhotoCache cache;

  const _GraveBody({required this.grave, required this.cache});

  @override
  Widget build(BuildContext context) {
    final location = locationInWords(grave);
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        Text(
          grave.name,
          style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
        ),
        if (location.isNotEmpty) ...[
          const SizedBox(height: 8),
          Text(location, style: const TextStyle(fontSize: 20)),
        ],
        if (mapsUriFor(grave) != null) ...[
          const SizedBox(height: 12),
          ElevatedButton.icon(
            onPressed: () => launchUrl(
              mapsUriFor(grave)!,
              mode: LaunchMode.externalApplication,
            ),
            icon: const Icon(Icons.map),
            label: const Text('Show on map', style: TextStyle(fontSize: 20)),
            style: ElevatedButton.styleFrom(minimumSize: const Size.fromHeight(64)),
          ),
        ],
        const SizedBox(height: 16),
        for (final photo in grave.photos)
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: _CachedPhoto(photo: photo, cache: cache),
          ),
        const SizedBox(height: 8),
        const Text(
          'Condition reports',
          style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 8),
        if (grave.reports.isEmpty)
          const Text('No condition reports yet.', style: TextStyle(fontSize: 18)),
        for (final report in grave.reports)
          Card(
            child: ListTile(
              title: Text(
                conditionLabel(report.condition),
                style: const TextStyle(fontSize: 20),
              ),
              subtitle: Text(
                [
                  report.visitDate.split('T').first,
                  if (report.note != null) report.note!,
                ].join('\n'),
                style: const TextStyle(fontSize: 16),
              ),
            ),
          ),
      ],
    );
  }
}
