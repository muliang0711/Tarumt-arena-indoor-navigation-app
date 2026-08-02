import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:indoor_navigation/domain/presence/display_name.dart';
import 'package:indoor_navigation/ui/theme/indoor_navigation_theme.dart';

abstract final class UsernameOnboardingDialogKeys {
  static const overlay = ValueKey<String>('username-onboarding.overlay');
  static const field = ValueKey<String>('username-onboarding.field');
  static const continueButton = ValueKey<String>(
    'username-onboarding.continue',
  );
}

final class UsernameOnboardingDialog extends StatefulWidget {
  const UsernameOnboardingDialog({required this.onSubmitted, super.key});

  final Future<void> Function(String displayName) onSubmitted;

  @override
  State<UsernameOnboardingDialog> createState() =>
      _UsernameOnboardingDialogState();
}

final class _UsernameOnboardingDialogState
    extends State<UsernameOnboardingDialog> {
  final TextEditingController _controller = TextEditingController();
  final FocusNode _focusNode = FocusNode();
  String? _errorText;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _focusNode.requestFocus();
    });
  }

  Future<void> _submit() async {
    if (_saving) return;
    final error = validatePresenceDisplayName(_controller.text);
    if (error != null) {
      setState(() => _errorText = error);
      return;
    }
    setState(() {
      _errorText = null;
      _saving = true;
    });
    try {
      await widget.onSubmitted(normalizePresenceDisplayName(_controller.text));
    } catch (_) {
      if (mounted) {
        setState(() {
          _errorText = 'Could not save your username. Please try again.';
          _saving = false;
        });
      }
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: UsernameOnboardingDialogKeys.overlay,
      body: SafeArea(
        child: Stack(
          fit: StackFit.expand,
          children: [
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Color(0xFFFFF8ED), CampusNavigatorColors.background],
                ),
              ),
            ),
            Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 380),
                  child: Material(
                    color: CampusNavigatorColors.card,
                    elevation: 8,
                    shadowColor: CampusNavigatorColors.shadow,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(24),
                      side: const BorderSide(
                        color: CampusNavigatorColors.border,
                        width: 2,
                      ),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(24, 28, 24, 24),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            height: 76,
                            width: 76,
                            decoration: BoxDecoration(
                              color: const Color(0xFFFFE9D6),
                              border: Border.all(
                                color: CampusNavigatorColors.accentBright,
                                width: 2,
                              ),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                              Icons.person_pin_circle_rounded,
                              color: CampusNavigatorColors.accentBright,
                              size: 43,
                            ),
                          ),
                          const SizedBox(height: 20),
                          const Text(
                            'Welcome to TAR UMT Navigator',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: CampusNavigatorColors.text,
                              fontSize: 23,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            'Choose the name shown below your character on the '
                            'Live Map and while navigating.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: CampusNavigatorColors.textMuted,
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                              height: 1.4,
                            ),
                          ),
                          const SizedBox(height: 22),
                          TextField(
                            key: UsernameOnboardingDialogKeys.field,
                            controller: _controller,
                            enabled: !_saving,
                            focusNode: _focusNode,
                            inputFormatters: [
                              LengthLimitingTextInputFormatter(
                                maxPresenceDisplayNameLength,
                              ),
                            ],
                            maxLength: maxPresenceDisplayNameLength,
                            onChanged: (_) {
                              if (_errorText != null) {
                                setState(() => _errorText = null);
                              }
                            },
                            onSubmitted: (_) => unawaited(_submit()),
                            textCapitalization: TextCapitalization.words,
                            textInputAction: TextInputAction.done,
                            decoration: InputDecoration(
                              errorText: _errorText,
                              hintText: 'e.g. IShowSpeed',
                              labelText: 'Username',
                              prefixIcon: const Icon(Icons.badge_outlined),
                              filled: true,
                              fillColor: const Color(0xFFFFFBF5),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(14),
                              ),
                              enabledBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(14),
                                borderSide: const BorderSide(
                                  color: CampusNavigatorColors.border,
                                  width: 1.5,
                                ),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(14),
                                borderSide: const BorderSide(
                                  color: CampusNavigatorColors.accentBright,
                                  width: 2,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 10),
                          SizedBox(
                            width: double.infinity,
                            height: 54,
                            child: FilledButton.icon(
                              key: UsernameOnboardingDialogKeys.continueButton,
                              onPressed: _saving ? null : _submit,
                              style: FilledButton.styleFrom(
                                backgroundColor:
                                    CampusNavigatorColors.accentBright,
                                foregroundColor: Colors.white,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(14),
                                ),
                              ),
                              icon: _saving
                                  ? const SizedBox.square(
                                      dimension: 20,
                                      child: CircularProgressIndicator(
                                        color: Colors.white,
                                        strokeWidth: 2.5,
                                      ),
                                    )
                                  : const Icon(Icons.arrow_forward_rounded),
                              label: Text(
                                _saving ? 'Saving...' : 'Continue',
                                style: const TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
