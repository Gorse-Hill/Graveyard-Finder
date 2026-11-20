import 'package:flutter/material.dart';

import '../../core/strings.dart';
import '../../data/caretaker_api.dart';
import '../../data/family_api.dart';
import '../../data/grave_repository.dart';
import '../../data/sync_client.dart';
import '../caretaker/report_screen.dart';
import '../caretaker/sign_in_screen.dart';
import '../family_view/family_grave_screen.dart';
import '../grave_save/save_grave_screen.dart';
import '../scan/scan_screen.dart';

class HomeScreen extends StatefulWidget {
  final GraveRepository repo;
  final SyncClient sync;

  HomeScreen({super.key, required this.repo, SyncClient? sync})
      : sync = sync ?? SyncClient.fromBuildConfig();

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _queued = 0;

  @override
  void initState() {
    super.initState();
    _syncAndRefresh();
  }

  /// Sends what is due, then updates the waiting count. Runs on open and after each save.
  Future<void> _syncAndRefresh() async {
    await widget.sync.syncNow();
    await _refreshQueue();
  }

  Future<void> _refreshQueue() async {
    final count = await widget.repo.queuedCount();
    if (mounted) setState(() => _queued = count);
  }

  Future<void> _openSave() async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => SaveGraveScreen(repo: widget.repo)),
    );
    _syncAndRefresh();
  }

  Future<String?> _scan() => Navigator.of(context).push<String>(
        MaterialPageRoute(builder: (_) => const ScanScreen()),
      );

  Future<void> _openFamily() async {
    final token = await _scan();
    if (token == null || !mounted) return;
    await Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => FamilyGraveScreen(token: token, api: FamilyApi.fromBuildConfig()),
    ));
  }

  Future<void> _openVisit() async {
    if (!await widget.repo.isCaretakerLinked()) {
      if (!mounted) return;
      final linked = await Navigator.of(context).push<bool>(MaterialPageRoute(
        builder: (_) => SignInScreen(api: CaretakerApi(sync: widget.sync, repo: widget.repo)),
      ));
      if (linked != true) return;
    }
    final token = await _scan();
    if (token == null || !mounted) return;
    await Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => ReportScreen(graveToken: token, repo: widget.repo, sync: widget.sync),
    ));
    _syncAndRefresh();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text(Strings.appTitle)),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Image.asset('assets/logo.png', height: 220, fit: BoxFit.contain),
            const SizedBox(height: 12),
            const Text(
              'This app is Designed and Developed by AHMED GORSE May Almighty Allah reward him generously',
              style: TextStyle(fontSize: 18),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _openSave,
              child: const Text(Strings.saveGrave),
            ),
            const SizedBox(height: 16),
            OutlinedButton(
              onPressed: _openFamily,
              child: const Text(Strings.findMemorial),
            ),
            const SizedBox(height: 16),
            OutlinedButton(
              onPressed: _openVisit,
              child: const Text('Caretaker visit'),
            ),
            const Spacer(),
            if (_queued > 0)
              Text(
                '${Strings.waitingForConnection} ($_queued)',
                style: const TextStyle(fontSize: 18),
                textAlign: TextAlign.center,
              ),
          ],
        ),
      ),
    );
  }
}
