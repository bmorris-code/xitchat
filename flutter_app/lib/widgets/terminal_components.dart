import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

/// Terminal-style button matching web app's terminal-btn class
class TerminalButton extends StatelessWidget {
  final String text;
  final VoidCallback onPressed;
  final bool isActive;
  final bool isFullWidth;
  final EdgeInsetsGeometry? padding;
  
  final Color? textColor;
  final Color? backgroundColor;

  const TerminalButton({
    super.key,
    required this.text,
    required this.onPressed,
    this.isActive = false,
    this.isFullWidth = false,
    this.padding,
    this.backgroundColor = AppTheme.surface,
    this.textColor,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: isFullWidth ? double.infinity : null,
      child: OutlinedButton(
        onPressed: onPressed,
        style: OutlinedButton.styleFrom(
          backgroundColor: backgroundColor ?? (isActive ? AppTheme.primaryGreen.withAlpha((0.1 * 255).round()) : Colors.transparent),
          foregroundColor: textColor ?? (isActive ? AppTheme.primaryGreen : AppTheme.darkGreen),
          side: BorderSide(
            color: isActive ? AppTheme.primaryGreen : AppTheme.darkGreen,
            width: isActive ? 2 : 1,
          ),
          padding: padding ?? const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
        ),
        child: Text(
          text.toUpperCase(),
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.bold,
            letterSpacing: 2,
            color: isActive ? AppTheme.primaryGreen : AppTheme.darkGreen,
            fontFamily: 'monospace',
          ),
        ),
      ),
    );
  }
}

/// Glowing text effect for headers
class GlowText extends StatelessWidget {
  final String text;
  final double fontSize;
  final Color? color;
  final FontWeight fontWeight;

  const GlowText({
    super.key,
    required this.text,
    this.fontSize = 18,
    this.color,
    this.fontWeight = FontWeight.w900,
  });

  @override
  Widget build(BuildContext context) {
    final textColor = color ?? AppTheme.primaryGreen;
    return Text(
      text,
      style: TextStyle(
        color: textColor,
        fontSize: fontSize,
        fontWeight: fontWeight,
        letterSpacing: -0.5,
        fontFamily: 'monospace',
        shadows: [
          Shadow(
            color: textColor.withOpacity(0.8),
            blurRadius: 10,
          ),
          Shadow(
            color: textColor.withOpacity(0.5),
            blurRadius: 20,
          ),
        ],
      ),
    );
  }
}

/// Terminal-style card with border
class TerminalCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final VoidCallback? onTap;
  final bool isHighlighted;

  const TerminalCard({
    super.key,
    required this.child,
    this.padding,
    this.onTap,
    this.isHighlighted = false,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: padding ?? const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppTheme.surface,
          border: Border.all(
            color: isHighlighted ? AppTheme.primaryGreen.withOpacity(0.4) : AppTheme.darkGreen.withOpacity(0.3),
            width: isHighlighted ? 2 : 1,
          ),
        ),
        child: child,
      ),
    );
  }
}

/// Status indicator dot (like peer online status)
class StatusDot extends StatelessWidget {
  final bool isOnline;
  final double size;

  const StatusDot({
    super.key,
    required this.isOnline,
    this.size = 12,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: isOnline ? AppTheme.primaryGreen : AppTheme.darkGreen,
        borderRadius: BorderRadius.circular(2),
        boxShadow: isOnline ? AppTheme.glowShadow(AppTheme.primaryGreen) : null,
      ),
    );
  }
}

/// Handle text with orange color like web app
class HandleText extends StatelessWidget {
  final String handle;
  final bool isBot;
  final double fontSize;

  const HandleText({
    super.key,
    required this.handle,
    this.isBot = false,
    this.fontSize = 14,
  });

  @override
  Widget build(BuildContext context) {
    return Text(
      '<$handle>',
      style: TextStyle(
        color: isBot ? AppTheme.botCyan : AppTheme.handleOrange,
        fontWeight: FontWeight.bold,
        fontSize: fontSize,
        fontFamily: 'monospace',
      ),
    );
  }
}

