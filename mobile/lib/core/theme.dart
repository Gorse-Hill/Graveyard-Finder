import 'package:flutter/material.dart';

/// Brand colours from the logo spec sheet (IMG_7893).
class BrandColors {
  static const green = Color(0xFF1B4332);
  static const gold = Color(0xFFD4A574);
  static const cream = Color(0xFFF8F5EE);
  static const ink = Color(0xFF1F1F1F);
}

/// Large type and large touch targets for older users (spec section 5 of the MVP plan).
ThemeData buildTheme() {
  return ThemeData(
    useMaterial3: true,
    scaffoldBackgroundColor: BrandColors.cream,
    colorScheme: ColorScheme.fromSeed(
      seedColor: BrandColors.green,
      primary: BrandColors.green,
      surface: BrandColors.cream,
    ),
    textTheme: const TextTheme(
      bodyLarge: TextStyle(fontSize: 18, color: BrandColors.ink),
      bodyMedium: TextStyle(fontSize: 16, color: BrandColors.ink),
      titleLarge: TextStyle(fontSize: 24, fontWeight: FontWeight.w600, color: BrandColors.ink),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        minimumSize: const Size.fromHeight(64),
        textStyle: const TextStyle(fontSize: 22),
        backgroundColor: BrandColors.green,
        foregroundColor: Colors.white,
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size.fromHeight(64),
        textStyle: const TextStyle(fontSize: 22),
        foregroundColor: BrandColors.green,
        side: const BorderSide(color: BrandColors.green, width: 2),
      ),
    ),
  );
}
