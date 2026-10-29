import 'package:flutter/material.dart';
import '../core/theme/app_theme.dart';
import '../models/kds_ticket_model.dart';

class KdsTicketCard extends StatelessWidget {
  final KdsTicketModel ticket;
  final VoidCallback onBump;

  const KdsTicketCard({
    Key? key,
    required this.ticket,
    required this.onBump,
  }) : super(key: key);

  Color _getTimerColor() {
    if (ticket.isOverdue) return AppTheme.danger;
    if (ticket.isWarning) return AppTheme.warning;
    return AppTheme.success;
  }

  Color _getStatusColor() {
    if (ticket.isReady) return AppTheme.success;
    if (ticket.isPreparing) return AppTheme.warning;
    return AppTheme.neutral;
  }

  String _getButtonLabel() {
    if (ticket.isWaiting) return 'Start Cooking';
    if (ticket.isPreparing) return 'Mark Ready';
    return 'Served (Bump)';
  }

  @override
  Widget build(BuildContext context) {
    final timerColor = _getTimerColor();
    final statusColor = _getStatusColor();
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      decoration: BoxDecoration(
        color: isDark ? AppTheme.surfaceDark : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: ticket.isOverdue ? AppTheme.danger : (isDark ? AppTheme.borderDark : AppTheme.borderLight),
          width: ticket.isOverdue ? 2 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Card Header with Timer
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: statusColor.withOpacity(0.08),
              borderRadius: const BorderRadius.vertical(top: Radius.circular(11)),
              border: Border(
                bottom: BorderSide(
                  color: isDark ? AppTheme.borderDark : AppTheme.borderLight,
                ),
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      ticket.tableNumber,
                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
                    ),
                    Text(
                      '${ticket.orderNumber} • ${ticket.serverName}',
                      style: TextStyle(
                        fontSize: 11,
                        color: isDark ? AppTheme.textMutedDark : AppTheme.textMutedLight,
                      ),
                    ),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: timerColor.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: timerColor.withOpacity(0.3)),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.timer_outlined, size: 14, color: timerColor),
                      const SizedBox(width: 4),
                      Text(
                        '${ticket.elapsedMinutes}m',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          color: timerColor,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Items List
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.all(12),
              itemCount: ticket.items.length,
              separatorBuilder: (_, __) => const Divider(height: 12),
              itemBuilder: (context, index) {
                final item = ticket.items[index];
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppTheme.primaryLight,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            '${item.quantity}x',
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w800,
                              color: AppTheme.primaryDark,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            item.productName,
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                    if (item.notes != null && item.notes!.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(left: 32, top: 4),
                        child: Text(
                          'Note: ${item.notes}',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: AppTheme.danger,
                          ),
                        ),
                      ),
                  ],
                );
              },
            ),
          ),

          // Bump action button
          Padding(
            padding: const EdgeInsets.all(12),
            child: SizedBox(
              height: 44,
              child: ElevatedButton(
                onPressed: onBump,
                style: ElevatedButton.styleFrom(
                  backgroundColor: ticket.isWaiting
                      ? AppTheme.warning
                      : (ticket.isPreparing ? AppTheme.success : AppTheme.info),
                ),
                child: Text(_getButtonLabel()),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
