import 'dart:io';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/strings.dart';
import '../../data/grave_repository.dart';
import 'grave_saved_screen.dart';

/// Save a Grave: one photo, one name, automatic GPS, then Save.
class SaveGraveScreen extends StatefulWidget {
  final GraveRepository repo;

  const SaveGraveScreen({super.key, required this.repo});

  @override
  State<SaveGraveScreen> createState() => _SaveGraveScreenState();
}

class _SaveGraveScreenState extends State<SaveGraveScreen> {
  final _nameCtrl = TextEditingController();
  String? _photoPath;
  Position? _position;
  String _locationNote = Strings.locating;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _loadLocation();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadLocation() async {
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      if (mounted) setState(() => _locationNote = Strings.locationOff);
      return;
    }

    final pos = await Geolocator.getCurrentPosition(
      desiredAccuracy: LocationAccuracy.high,
    );
    if (mounted) setState(() => _position = pos);
  }

  Future<void> _takePhoto() async {
    final shot = await ImagePicker().pickImage(
      source: ImageSource.camera,
      maxWidth: 1600,
      imageQuality: 80,
    );
    if (shot != null && mounted) setState(() => _photoPath = shot.path);
  }

  bool get _canSave =>
      !_saving &&
      _photoPath != null &&
      _position != null &&
      _nameCtrl.text.trim().isNotEmpty;

  Future<void> _save() async {
    setState(() => _saving = true);
    final pos = _position!;
    final saved = await widget.repo.saveGrave(
      name: _nameCtrl.text.trim(),
      photoPath: _photoPath!,
      lat: pos.latitude,
      lng: pos.longitude,
      accuracyM: pos.accuracy,
    );
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (_) => GraveSavedScreen(grave: saved, repo: widget.repo),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final hasLocation = _position != null;

    return Scaffold(
      appBar: AppBar(title: const Text(Strings.saveGrave)),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          if (_photoPath != null)
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Image.file(File(_photoPath!), height: 240, fit: BoxFit.cover),
            ),
          const SizedBox(height: 12),
          ElevatedButton(
            onPressed: _takePhoto,
            child: const Text(Strings.takePhoto),
          ),
          const SizedBox(height: 24),
          TextField(
            controller: _nameCtrl,
            style: const TextStyle(fontSize: 22),
            decoration: const InputDecoration(
              labelText: Strings.nameLabel,
              border: OutlineInputBorder(),
            ),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 16),
          Text(
            hasLocation ? 'Location recorded.' : _locationNote,
            style: const TextStyle(fontSize: 18),
          ),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: _canSave ? _save : null,
            child: const Text(Strings.save),
          ),
        ],
      ),
    );
  }
}
