import 'package:flutter_test/flutter_test.dart';
import 'package:graveyard_locator/domain/qr_link.dart';

void main() {
  test('a family card link gives its token', () {
    expect(parseGraveToken('https://gl.app/g/ABCDEFGHIJKLMNOPQRSTUVWXYZ'), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    expect(parseGraveToken(' https://gl.app/g/ABCDEFGHIJKLMNOPQRSTUVWXYZ/ '), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  });

  test('other values give null', () {
    expect(parseGraveToken('https://example.com/g/ABCDEFGHIJKLMNOPQRSTUVWXYZ'), isNull);
    expect(parseGraveToken('https://gl.app/g/SHORT'), isNull);
    expect(parseGraveToken('https://gl.app/g/ABCDEFGHIJKLMNOPQRSTUVWXY1'), isNull);
    expect(parseGraveToken('hello'), isNull);
  });

  test('phone numbers need the country code and 8 to 15 digits', () {
    expect(isValidPhone('+252637389999'), isTrue);
    expect(isValidPhone('0637389999'), isFalse);
    expect(isValidPhone('+25263'), isFalse);
    expect(isValidPhone('+252 637 389 999'), isFalse);
  });

  test('the auth address comes from the functions address', () {
    expect(authBaseUrl('https://abc.supabase.co/functions/v1'), 'https://abc.supabase.co/auth/v1');
    expect(authBaseUrl('https://abc.supabase.co/functions/v1/'), 'https://abc.supabase.co/auth/v1');
  });
}
