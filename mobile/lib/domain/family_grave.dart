/// What a family sees about one grave. Built from the family-grave function response.
class FamilyGrave {
  final String name;
  final String status;
  final String? section;
  final String? block;
  final String? plot;
  final double? latitude;
  final double? longitude;
  final List<FamilyPhoto> photos;
  final List<FamilyReport> reports;

  const FamilyGrave({
    required this.name,
    required this.status,
    required this.section,
    required this.block,
    required this.plot,
    required this.photos,
    required this.reports,
    this.latitude,
    this.longitude,
  });
}

/// One ready photo. The ID keys the phone's cache. The URL is a signed link that expires.
class FamilyPhoto {
  final String id;
  final String url;

  const FamilyPhoto({required this.id, required this.url});
}

class FamilyReport {
  final String condition;
  final String? note;
  final String visitDate;

  const FamilyReport({
    required this.condition,
    required this.note,
    required this.visitDate,
  });
}

/// Reads the family-grave response. Missing location parts stay null.
FamilyGrave parseFamilyGrave(Map<String, dynamic> json) {
  final location = (json['location'] as Map?)?.cast<String, dynamic>() ?? const <String, dynamic>{};
  final coordinates = (json['coordinates'] as Map?)?.cast<String, dynamic>() ?? const <String, dynamic>{};
  final photos = (json['photos'] as List<dynamic>? ?? const []).map((raw) {
    final m = raw as Map<String, dynamic>;
    return FamilyPhoto(id: m['id'] as String, url: m['url'] as String);
  }).toList();
  final reports = (json['reports'] as List<dynamic>? ?? const []).map((raw) {
    final m = raw as Map<String, dynamic>;
    return FamilyReport(
      condition: m['condition'] as String,
      note: m['note'] as String?,
      visitDate: m['visit_date'] as String,
    );
  }).toList();

  return FamilyGrave(
    name: json['name'] as String,
    status: json['status'] as String,
    section: location['section'] as String?,
    block: location['block'] as String?,
    plot: location['plot'] as String?,
    latitude: (coordinates['lat'] as num?)?.toDouble(),
    longitude: (coordinates['lng'] as num?)?.toDouble(),
    photos: photos,
    reports: reports,
  );
}

/// The map link for a grave. Opens in Google Maps or Apple Maps, whichever the phone uses.
/// Returns null when the grave has no coordinates.
Uri? mapsUriFor(FamilyGrave grave) {
  final lat = grave.latitude;
  final lng = grave.longitude;
  if (lat == null || lng == null) return null;
  return Uri.parse('https://www.google.com/maps/search/?api=1&query=$lat,$lng');
}

/// The location in plain words, such as "Section B, Block 2, Plot 14". Empty parts are left out.
String locationInWords(FamilyGrave grave) {
  final parts = <String>[
    if (grave.section != null && grave.section!.isNotEmpty) 'Section ${grave.section}',
    if (grave.block != null && grave.block!.isNotEmpty) 'Block ${grave.block}',
    if (grave.plot != null && grave.plot!.isNotEmpty) 'Plot ${grave.plot}',
  ];
  return parts.join(', ');
}
