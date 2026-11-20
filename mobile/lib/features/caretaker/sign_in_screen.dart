import 'package:flutter/material.dart';

import '../../data/caretaker_api.dart';
import '../../domain/qr_link.dart';

/// Caretaker sign-in: phone number, then the code sent by SMS. Pops true when the device is linked.
class SignInScreen extends StatefulWidget {
  final CaretakerApi api;

  const SignInScreen({super.key, required this.api});

  @override
  State<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends State<SignInScreen> {
  final _phone = TextEditingController();
  final _code = TextEditingController();
  bool _codeSent = false;
  bool _busy = false;
  String? _message;

  @override
  void dispose() {
    _phone.dispose();
    _code.dispose();
    super.dispose();
  }

  Future<void> _sendCode() async {
    if (!isValidPhone(_phone.text)) {
      setState(() => _message = 'Enter the number with the country code, such as +252637389999.');
      return;
    }
    setState(() {
      _busy = true;
      _message = null;
    });
    try {
      await widget.api.requestCode(_phone.text);
      if (mounted) setState(() => _codeSent = true);
    } catch (_) {
      if (mounted) setState(() => _message = 'The code could not be sent. Check the connection and try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _verify() async {
    setState(() {
      _busy = true;
      _message = null;
    });
    try {
      await widget.api.verifyAndLink(_phone.text, _code.text);
      if (mounted) Navigator.of(context).pop(true);
    } on CaretakerApiException catch (e) {
      if (mounted) {
        setState(() => _message = e.message == 'device_linked_to_other_account'
            ? 'This phone is already linked to another caretaker.'
            : 'The code did not work. Check it and try again.');
      }
    } catch (_) {
      if (mounted) setState(() => _message = 'Sign-in could not finish. Check the connection and try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Caretaker sign-in')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: _phone,
              enabled: !_codeSent && !_busy,
              keyboardType: TextInputType.phone,
              style: const TextStyle(fontSize: 22),
              decoration: const InputDecoration(labelText: 'Phone number'),
            ),
            const SizedBox(height: 16),
            if (_codeSent) ...[
              TextField(
                controller: _code,
                enabled: !_busy,
                keyboardType: TextInputType.number,
                style: const TextStyle(fontSize: 22),
                decoration: const InputDecoration(labelText: 'Code from the SMS'),
              ),
              const SizedBox(height: 16),
            ],
            ElevatedButton(
              onPressed: _busy ? null : (_codeSent ? _verify : _sendCode),
              child: Text(_codeSent ? 'Sign in' : 'Send code'),
            ),
            if (_message != null) ...[
              const SizedBox(height: 16),
              Text(_message!, style: const TextStyle(fontSize: 18), textAlign: TextAlign.center),
            ],
          ],
        ),
      ),
    );
  }
}
