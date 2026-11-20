import 'package:flutter_test/flutter_test.dart';
import 'package:graveyard_locator/domain/photo_rules.dart';

void main() {
  test('PNG paths get the PNG content type', () {
    expect(photoContentType('/data/photos/grave.png'), 'image/png');
    expect(photoContentType('/data/photos/GRAVE.PNG'), 'image/png');
  });

  test('other paths, including JPEG, get the JPEG content type', () {
    expect(photoContentType('/data/photos/grave.jpg'), 'image/jpeg');
    expect(photoContentType('/data/photos/grave.jpeg'), 'image/jpeg');
    expect(photoContentType('/data/photos/grave'), 'image/jpeg');
  });
}
