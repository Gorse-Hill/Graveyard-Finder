import 'package:flutter_test/flutter_test.dart';
import 'package:graveyard_locator/domain/condition_report.dart';
import 'package:graveyard_locator/domain/family_grave.dart';

void main() {
  test('family response parses, and missing location parts stay null', () {
    final grave = parseFamilyGrave({
      'name': 'Test Person',
      'status': 'active',
      'location': {'section': 'B', 'block': null, 'plot': '14'},
      'photos': [
        {'id': 'f0000000-0000-4000-8000-000000000001', 'url': 'https://example.test/a.jpg'},
      ],
      'reports': [
        {'condition': 'good', 'note': 'Tidy', 'visit_date': '2026-11-20T09:00:00Z'},
      ],
    });
    expect(grave.name, 'Test Person');
    expect(grave.block, isNull);
    expect(grave.photos.single.id, 'f0000000-0000-4000-8000-000000000001');
    expect(grave.photos.single.url, 'https://example.test/a.jpg');
    expect(grave.reports.single.condition, 'good');
  });

  test('location is written in words and skips empty parts', () {
    const grave = FamilyGrave(
      name: 'x',
      status: 'active',
      section: 'B',
      block: null,
      plot: '14',
      photos: [],
      reports: [],
    );
    expect(locationInWords(grave), 'Section B, Plot 14');
  });

  test('coordinates parse and give a map link', () {
    final grave = parseFamilyGrave({
      'name': 'Test Person',
      'status': 'active',
      'location': {'section': 'B', 'block': '2', 'plot': '14'},
      'coordinates': {'lat': 9.56, 'lng': 44.065},
      'photos': [],
      'reports': [],
    });
    expect(grave.latitude, 9.56);
    expect(grave.longitude, 44.065);
    expect(mapsUriFor(grave).toString(),
        'https://www.google.com/maps/search/?api=1&query=9.56,44.065');
  });

  test('a grave without coordinates has no map link', () {
    final grave = parseFamilyGrave({
      'name': 'x',
      'status': 'active',
      'location': {},
      'coordinates': {'lat': null, 'lng': null},
      'photos': [],
      'reports': [],
    });
    expect(mapsUriFor(grave), isNull);
  });

  test('condition labels are readable', () {
    expect(conditionLabel('needs_attention'), 'Needs attention');
    expect(conditionLabel('serious_damage'), 'Serious damage');
  });

  test('a condition report payload has the fields the server reads', () {
    final payload = conditionReportPayload(
      reportId: 'r1',
      graveQrToken: 'TOKEN1',
      condition: 'good',
      note: '  Tidy  ',
      lat: 9.5,
      lng: 44.0,
      accuracyM: 6.5,
      visitDate: DateTime.utc(2026, 11, 20, 9),
    );
    expect(payload['client_report_id'], 'r1');
    expect(payload['grave_qr_token'], 'TOKEN1');
    expect(payload['note'], 'Tidy');
    expect(payload['gps_accuracy_m'], 6.5);
    expect(payload['visit_date'], '2026-11-20T09:00:00.000Z');
  });

  test('an empty note becomes null', () {
    final payload = conditionReportPayload(
      reportId: 'r1',
      graveQrToken: 'TOKEN1',
      condition: 'good',
      note: '   ',
      visitDate: DateTime.utc(2026, 11, 20),
    );
    expect(payload['note'], isNull);
  });

  test('an unknown condition or an overlong note is refused', () {
    expect(
      () => conditionReportPayload(
        reportId: 'r1',
        graveQrToken: 'TOKEN1',
        condition: 'broken',
        visitDate: DateTime.utc(2026, 11, 20),
      ),
      throwsArgumentError,
    );
    expect(
      () => conditionReportPayload(
        reportId: 'r1',
        graveQrToken: 'TOKEN1',
        condition: 'good',
        note: 'x' * 301,
        visitDate: DateTime.utc(2026, 11, 20),
      ),
      throwsArgumentError,
    );
  });
}
