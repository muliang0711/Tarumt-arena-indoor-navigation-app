import 'package:flutter/material.dart';
import 'package:indoor_navigation/domain/reroute/reroute_models.dart';

final class WrongWayWarningBanner extends StatelessWidget {
  const WrongWayWarningBanner({required this.result, super.key});

  static const bannerKey = ValueKey<String>('wrong-way-warning.banner');
  static const titleKey = ValueKey<String>('wrong-way-warning.title');
  static const detailKey = ValueKey<String>('wrong-way-warning.detail');

  final WrongWayRerouteResult result;

  @override
  Widget build(BuildContext context) {
    if (!result.shouldSuggestReroute &&
        !shouldShowWrongWayCheckingState(result)) {
      return const SizedBox.shrink();
    }
    final isWarning = result.shouldSuggestReroute;
    final title = isWarning ? 'Wrong way detected' : 'Checking direction';
    final detail = createWrongWayMessage(result);
    return Positioned(
      bottom: 88,
      left: 14,
      right: 14,
      child: IgnorePointer(
        child: Semantics(
          container: true,
          excludeSemantics: true,
          label: '$title, $detail',
          liveRegion: true,
          child: Container(
            key: bannerKey,
            constraints: const BoxConstraints(minHeight: 58),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: isWarning
                  ? const Color(0xFF991B1B)
                  : const Color(0xFF92400E),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  title,
                  key: titleKey,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 17,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  detail,
                  key: detailKey,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Color(0xFFFEE2E2),
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

bool shouldShowWrongWayCheckingState(WrongWayRerouteResult result) {
  return result.isHeadingOpposite &&
      result.reason == WrongWayRerouteReason.insufficientOppositeDuration;
}

String createWrongWayMessage(WrongWayRerouteResult result) {
  final reason = result.reason.wireValue;
  final duration = result.oppositeHeadingDurationMs.round();
  if (result.shouldSuggestReroute) {
    return '$reason at ${result.currentNode?.nodeId ?? 'route'} for ${duration}ms';
  }
  return '$reason | opposite ${duration}ms';
}
