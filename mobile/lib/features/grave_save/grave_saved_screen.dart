import 'dart:io';

import 'package:flutter/material.dart';

import '../../core/strings.dart';
import '../../data/grave_repository.dart';
import '../family_card/family_card_screen.dart';

class GraveSavedScreen extends StatelessWidget {
  final SavedGrave grave;
  final GraveRepository repo;

  const GraveSavedScreen({super.key, required this.grave, required this.repo});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(automaticallyImplyLeading: false),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Image.file(File(grave.photoPath), height: 260, fit: BoxFit.cover),
            ),
            const SizedBox(height: 24),
            Text(
              Strings.graveSaved(grave.name),
              style: Theme.of(context).textTheme.titleLarge,
              textAlign: TextAlign.center,
            ),
            const Spacer(),
            ElevatedButton(
              onPressed: () => Navigator.of(context).popUntil((r) => r.isFirst),
              child: const Text(Strings.done),
            ),
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => FamilyCardScreen(grave: grave)),
              ),
              child: const Text(Strings.showFamilyCard),
            ),
          ],
        ),
      ),
    );
  }
}
