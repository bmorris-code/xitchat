import 'package:flutter/material.dart';

/// XitChat Terminal Theme - matches the web app's cyberpunk aesthetic
class AppTheme {
  // Primary colors
  static const Color primaryGreen = Color(0xFF00FF41);
  static const Color darkGreen = Color(0xFF004400);
  static const Color mediumGreen = Color(0xFF006600);
  static const Color dimGreen = Color(0xFF00AA22);

  // Theme colors (can be switched)
  static const Color amberAccent = Color(0xFFFFB300);
  static const Color cyanAccent = Color(0xFF00BCD4);
  static const Color redAccent = Color(0xFFFF4444);

  // Background colors
  static const Color background = Color(0xFF000000);
  static const Color surface = Color(0xFF050505);
  static const Color cardBg = Color(0xFF0A0A0A);

  // Text colors
  static const Color textPrimary = Colors.white;
  static const Color textSecondary = Color(0xFFB0B0B0);
  static const Color textMuted = Color(0xFF666666);
  static const Color handleOrange = Color(0xFFFB923C);
  static const Color botCyan = Color(0xFF22D3EE);

  // Glow shadow for terminal effect
  static List<BoxShadow> glowShadow(Color color) => [
        BoxShadow(
          color: color.withOpacity(0.5),
          blurRadius: 10,
          spreadRadius: 1,
        ),
      ];

  static ThemeData get darkTheme => ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: background,
        primaryColor: primaryGreen,
        colorScheme: const ColorScheme.dark(
          primary: primaryGreen,
          secondary: primaryGreen,
          surface: surface,
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: background,
          elevation: 0,
          titleTextStyle: TextStyle(
            color: primaryGreen,
            fontWeight: FontWeight.bold,
            fontSize: 18,
            fontFamily: 'monospace',
          ),
          iconTheme: IconThemeData(color: primaryGreen),
        ),
        textTheme: const TextTheme(
          headlineLarge: TextStyle(
            color: primaryGreen,
            fontWeight: FontWeight.w900,
            fontSize: 24,
            letterSpacing: -1,
            fontFamily: 'monospace',
          ),
          headlineMedium: TextStyle(
            color: textPrimary,
            fontWeight: FontWeight.bold,
            fontSize: 18,
            fontFamily: 'monospace',
          ),
          bodyLarge: TextStyle(
            color: textPrimary,
            fontSize: 14,
            fontFamily: 'monospace',
          ),
          bodyMedium: TextStyle(
            color: textSecondary,
            fontSize: 12,
            fontFamily: 'monospace',
          ),
          bodySmall: TextStyle(
            color: textMuted,
            fontSize: 10,
            letterSpacing: 1.5,
            fontFamily: 'monospace',
          ),
        ),
        iconTheme: const IconThemeData(color: primaryGreen),
        dividerColor: darkGreen,
        cardTheme: CardThemeData(
          color: surface,
          elevation: 0,
          shape: RoundedRectangleBorder(
            side: BorderSide(color: darkGreen.withValues(alpha: 0.5)),
            borderRadius: BorderRadius.zero,
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: background,
          border: const OutlineInputBorder(
            borderSide: BorderSide(color: darkGreen),
            borderRadius: BorderRadius.zero,
          ),
          enabledBorder: const OutlineInputBorder(
            borderSide: BorderSide(color: darkGreen),
            borderRadius: BorderRadius.zero,
          ),
          focusedBorder: const OutlineInputBorder(
            borderSide: BorderSide(color: primaryGreen),
            borderRadius: BorderRadius.zero,
          ),
          hintStyle: TextStyle(color: textMuted.withOpacity(0.5)),
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: primaryGreen,
            foregroundColor: background,
            shape:
                const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
            textStyle: const TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 10,
              letterSpacing: 2,
              fontFamily: 'monospace',
            ),
          ),
        ),
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            foregroundColor: primaryGreen,
            side: const BorderSide(color: primaryGreen),
            shape:
                const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
            textStyle: const TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 10,
              letterSpacing: 2,
              fontFamily: 'monospace',
            ),
          ),
        ),
      );
}
