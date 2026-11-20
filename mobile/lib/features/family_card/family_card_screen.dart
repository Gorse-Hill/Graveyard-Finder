import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../core/strings.dart';
import '../../data/grave_repository.dart';

/// Family Card: a QR code that opens the grave's memorial page.
class FamilyCardScreen extends StatelessWidget {
  final SavedGrave grave;

  const FamilyCardScreen({super.key, required this.grave});

  String get _link => 'https://gl.app/g/${grave.token}';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('${grave.name} - ${Strings.familyCard}')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                grave.name,
                style: Theme.of(context).textTheme.titleLarge,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              QrImageView(data: _link, size: 260),
              const SizedBox(height: 16),
              SelectableText(_link, style: const TextStyle(fontSize: 16)),
            ],
          ),
        ),
      ),
    );
  }
}
