import 'package:flutter_test/flutter_test.dart';
import 'package:graveyard_locator/data/sync_client.dart';

void main() {
  test('backoff goes 1, 2, 4, 8, then stops at 15 minutes', () {
    expect(backoffFor(0), Duration.zero);
    expect(backoffFor(1), const Duration(minutes: 1));
    expect(backoffFor(2), const Duration(minutes: 2));
    expect(backoffFor(3), const Duration(minutes: 4));
    expect(backoffFor(4), const Duration(minutes: 8));
    expect(backoffFor(5), const Duration(minutes: 15));
    expect(backoffFor(50), const Duration(minutes: 15));
  });

  test('server results map to queue states', () {
    expect(queueStateFor('applied'), 'sent');
    expect(queueStateFor('conflict'), 'conflict');
    expect(queueStateFor('rejected'), 'rejected');
    expect(queueStateFor('duplicate', originalResult: 'applied'), 'sent');
    expect(queueStateFor('duplicate', originalResult: 'conflict'), 'conflict');
    expect(queueStateFor('duplicate'), 'rejected');
  });

  test('the refused event index is read from the server error', () {
    expect(rejectedEventIndex('events[3]_unsupported_op'), 3);
    expect(rejectedEventIndex('events[0]_invalid_entity_id'), 0);
    expect(rejectedEventIndex('batch_size_out_of_range'), isNull);
  });

  test('a queue row becomes an event with a decoded payload', () {
    final event = eventFromRow({
      'client_event_id': 'e0000000-0000-4000-8000-000000000001',
      'entity': 'graves',
      'entity_id': 'a0000000-0000-4000-8000-000000000001',
      'op': 'create',
      'entity_version': 1,
      'created_at': '2026-11-20T10:00:00.000Z',
      'payload': '{"qr_token":"ABC","name":"Test","gps_lat":9.5,"gps_lng":44.0}',
    });
    expect(event['entity'], 'graves');
    expect(event['entity_version'], 1);
    expect((event['payload'] as Map)['qr_token'], 'ABC');
    expect((event['payload'] as Map)['gps_lat'], 9.5);
  });
}
