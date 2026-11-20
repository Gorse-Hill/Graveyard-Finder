/// The three condition levels the server accepts.
const List<String> conditionLevels = ['good', 'needs_attention', 'serious_damage'];

/// Longest note the server accepts, in characters.
const int maxNoteLength = 300;

String conditionLabel(String level) => switch (level) {
      'good' => 'Good',
      'needs_attention' => 'Needs attention',
      'serious_damage' => 'Serious damage',
      _ => level,
    };

/// The payload the sync queue sends for a condition report. Throws ArgumentError for bad input.
Map<String, Object?> conditionReportPayload({
  required String reportId,
  required String graveQrToken,
  required String condition,
  String? note,
  double? lat,
  double? lng,
  double? accuracyM,
  required DateTime visitDate,
}) {
  if (!conditionLevels.contains(condition)) {
    throw ArgumentError.value(condition, 'condition', 'unknown condition level');
  }
  final trimmed = note?.trim();
  if (trimmed != null && trimmed.length > maxNoteLength) {
    throw ArgumentError.value(note, 'note', 'longer than $maxNoteLength characters');
  }
  return {
    'client_report_id': reportId,
    'grave_qr_token': graveQrToken,
    'condition': condition,
    'note': (trimmed == null || trimmed.isEmpty) ? null : trimmed,
    'gps_lat': lat,
    'gps_lng': lng,
    'gps_accuracy_m': accuracyM,
    'visit_date': visitDate.toUtc().toIso8601String(),
  };
}
