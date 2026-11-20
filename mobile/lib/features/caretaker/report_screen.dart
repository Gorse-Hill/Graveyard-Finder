import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

import '../../data/grave_repository.dart';
import '../../data/sync_client.dart';
import '../../domain/condition_report.dart';

/// The visit report: pick a condition, add an optional note, save. The report is queued on the phone
/// and sent when there is a connection. The server accepts it only from a linked caretaker device
/// assigned to the grave's section.
class ReportScreen extends StatefulWidget {
  final String graveToken;
  final GraveRepository repo;
  final SyncClient sync;

  const ReportScreen({
    super.key,
    required this.graveToken,
    required this.repo,
    required this.sync,
  });

  @override
  State<ReportScreen> createState() => _ReportScreenState();
}

class _ReportScreenState extends State<ReportScreen> {
  final _note = TextEditingController();
  String? _condition;
  bool _saving = false;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  /// The caretaker's position at the visit. Null when location is off or slow, so the report still saves.
  Future<Position?> _currentPosition() async {
    try {
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        return null;
      }
      return await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      ).timeout(const Duration(seconds: 15));
    } catch (_) {
      return null;
    }
  }

  Future<void> _save() async {
    if (_condition == null) return;
    setState(() => _saving = true);
    final position = await _currentPosition();
    await widget.repo.queueConditionReport(
      graveQrToken: widget.graveToken,
      condition: _condition!,
      note: _note.text,
      lat: position?.latitude,
      lng: position?.longitude,
      accuracyM: position?.accuracy,
    );
    widget.sync.syncNow();
    if (mounted) Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Visit report')),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          const Text('What is the condition of the grave?', style: TextStyle(fontSize: 22)),
          const SizedBox(height: 12),
          for (final level in conditionLevels)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: ChoiceChip(
                label: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
                  child: Text(conditionLabel(level), style: const TextStyle(fontSize: 22)),
                ),
                selected: _condition == level,
                onSelected: (_) => setState(() => _condition = level),
              ),
            ),
          const SizedBox(height: 12),
          TextField(
            controller: _note,
            maxLength: maxNoteLength,
            maxLines: 3,
            style: const TextStyle(fontSize: 20),
            decoration: const InputDecoration(labelText: 'Note (optional)'),
          ),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: (_condition == null || _saving) ? null : _save,
            child: const Text('Save report'),
          ),
        ],
      ),
    );
  }
}
