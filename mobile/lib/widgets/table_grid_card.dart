import 'package:flutter/material.dart';
import '../core/theme/app_theme.dart';
import '../core/constants/app_constants.dart';
import '../models/table_model.dart';

class TableGridCard extends StatelessWidget {
  final TableModel table;
  final bool isSelected;
  final VoidCallback onTap;

  const TableGridCard({
    Key? key,
    required this.table,
    required this.isSelected,
    required this.onTap,
  }) : super(key: key);

  Color _getStatusColor() {
    if (table.isAvailable) return AppTheme.success;
    if (table.isBilled) return AppTheme.info;
    return AppTheme.warning;
  }

  String _getStatusText() {
    if (table.isAvailable) return 'Available';
    if (table.isBilled) return 'Billed';
    return 'Occupied';
  }

  @override
  Widget build(BuildContext context) {
    final statusColor = _getStatusColor();
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: isSelected
                ? AppTheme.primaryLight.withOpacity(isDark ? 0.2 : 0.6)
                : (isDark ? AppTheme.surfaceDark : Colors.white),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isSelected
                  ? AppTheme.primary
                  : (isDark ? AppTheme.borderDark : AppTheme.borderLight),
              width: isSelected ? 2.0 : 1.0,
            ),
            boxShadow: [
              if (isSelected)
                BoxShadow(
                  color: AppTheme.primary.withOpacity(0.15),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      table.number,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: statusColor.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      _getStatusText(),
                      style: TextStyle(
                        color: statusColor,
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Icon(
                        Icons.people_alt_outlined,
                        size: 14,
                        color: isDark ? AppTheme.textMutedDark : AppTheme.textMutedLight,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        '${table.capacity}',
                        style: TextStyle(
                          fontSize: 12,
                          color: isDark ? AppTheme.textMutedDark : AppTheme.textMutedLight,
                        ),
                      ),
                    ],
                  ),
                  if (table.activeOrderTotal != null && table.activeOrderTotal! > 0)
                    Text(
                      '${AppConstants.defaultCurrency}${table.activeOrderTotal!.toStringAsFixed(0)}',
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.primaryDark,
                      ),
                    )
                  else if (table.seatedAt != null)
                    Text(
                      table.seatedAt!,
                      style: TextStyle(
                        fontSize: 11,
                        color: isDark ? AppTheme.textMutedDark : AppTheme.textMutedLight,
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
