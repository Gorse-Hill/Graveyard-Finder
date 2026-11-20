import 'dart:math';

import 'package:flutter_test/flutter_test.dart';
import 'package:graveyard_locator/domain/grave_token.dart';

void main() {
  test('token is 26 characters from the base32 alphabet', () {
    final token = newGraveToken();
    expect(token.length, 26);
    expect(RegExp(r'^[A-Z2-7]{26}$').hasMatch(token), isTrue);
  });

  test('two tokens from a secure source differ', () {
    expect(newGraveToken(random: Random.secure()),
        isNot(equals(newGraveToken(random: Random.secure()))));
  });
}
