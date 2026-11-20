import 'package:flutter/material.dart';

import 'core/theme.dart';
import 'data/grave_repository.dart';
import 'features/home/home_screen.dart';

void main() {
  runApp(const GraveyardApp());
}

class GraveyardApp extends StatelessWidget {
  const GraveyardApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Graveyard Locator',
      theme: buildTheme(),
      debugShowCheckedModeBanner: false,
      home: HomeScreen(repo: GraveRepository()),
    );
  }
}
