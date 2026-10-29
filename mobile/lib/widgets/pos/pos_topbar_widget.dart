import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';

class PosTopbarWidget extends StatelessWidget {
  final String orderType;
  final ValueChanged<String> onOrderTypeChanged;
  final String? selectedTableName;
  final VoidCallback onSelectTable;
  final String searchQuery;
  final ValueChanged<String> onSearchChanged;
  final VoidCallback? onClearSearch;
  final String? customerName;
  final String? customerPhone;
  final double? loyaltyPoints;
  final VoidCallback onCustomerTap;
  final int heldOrdersCount;
  final VoidCallback onHeldOrdersTap;

  const PosTopbarWidget({
    super.key,
    required this.orderType,
    required this.onOrderTypeChanged,
    required this.selectedTableName,
    required this.onSelectTable,
    required this.searchQuery,
    required this.onSearchChanged,
    this.onClearSearch,
    this.customerName,
    this.customerPhone,
    this.loyaltyPoints,
    required this.onCustomerTap,
    required this.heldOrdersCount,
    required this.onHeldOrdersTap,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isDineIn = orderType == 'dine_in';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: isDark ? AppTheme.surfaceDark : AppTheme.surfaceLight,
        border: Border(
          bottom: BorderSide(
            color: isDark ? AppTheme.borderDark : AppTheme.borderLight,
            width: 1,
          ),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Row 1: Order Types + Table Selector + Held Badge
          Row(
            children: [
              // Order Type Selector
              Container(
                padding: const EdgeInsets.all(3),
                decoration: BoxDecoration(
                  color: isDark ? AppTheme.cardDark : Colors.grey.shade100,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _buildTypeButton(
                      context,
                      type: 'dine_in',
                      label: 'Dine-In',
                      icon: Icons.restaurant,
                      isActive: orderType == 'dine_in',
                    ),
                    _buildTypeButton(
                      context,
                      type: 'takeaway',
                      label: 'Takeaway',
                      icon: Icons.shopping_bag_outlined,
                      isActive: orderType == 'takeaway',
                    ),
                    _buildTypeButton(
                      context,
                      type: 'delivery',
                      label: 'Delivery',
                      icon: Icons.delivery_dining,
                      isActive: orderType == 'delivery',
                    ),
                  ],
                ),
              ),

              const SizedBox(width: 8),

              // Table Selector (visible in dine-in mode)
              if (isDineIn)
                Expanded(
                  child: InkWell(
                    onTap: onSelectTable,
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      height: 38,
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                      decoration: BoxDecoration(
                        color: selectedTableName != null
                            ? AppTheme.primary
                            : Colors.amber.shade100.withOpacity(0.6),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: selectedTableName != null
                              ? AppTheme.primary
                              : Colors.amber.shade300,
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.table_restaurant,
                            size: 16,
                            color: selectedTableName != null
                                ? Colors.white
                                : Colors.amber.shade900,
                          ),
                          const SizedBox(width: 6),
                          Flexible(
                            child: Text(
                              selectedTableName ?? 'Select Table',
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                color: selectedTableName != null
                                    ? Colors.white
                                    : Colors.amber.shade900,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                )
              else
                const Spacer(),

              const SizedBox(width: 8),

              // Held Orders button with badge
              InkWell(
                onTap: onHeldOrdersTap,
                borderRadius: BorderRadius.circular(10),
                child: Container(
                  height: 38,
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  decoration: BoxDecoration(
                    color: heldOrdersCount > 0
                        ? AppTheme.heldOrder.withOpacity(0.12)
                        : (isDark ? AppTheme.cardDark : Colors.grey.shade100),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: heldOrdersCount > 0
                          ? AppTheme.heldOrder.withOpacity(0.5)
                          : (isDark ? AppTheme.borderDark : AppTheme.borderLight),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.pause_circle_outline,
                        size: 17,
                        color: heldOrdersCount > 0
                            ? AppTheme.heldOrder
                            : (isDark ? AppTheme.textMutedDark : AppTheme.textMutedLight),
                      ),
                      if (heldOrdersCount > 0) ...[
                        const SizedBox(width: 5),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                          decoration: BoxDecoration(
                            color: AppTheme.heldOrder,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            '$heldOrdersCount',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 8),

          // Row 2: Search Input + Customer Search Chip
          Row(
            children: [
              // Search Field
              Expanded(
                child: SizedBox(
                  height: 38,
                  child: TextField(
                    onChanged: onSearchChanged,
                    decoration: InputDecoration(
                      hintText: 'Search products by name or code...',
                      hintStyle: TextStyle(
                        fontSize: 13,
                        color: isDark ? AppTheme.textMutedDark : AppTheme.textMutedLight,
                      ),
                      prefixIcon: const Icon(Icons.search, size: 18),
                      suffixIcon: searchQuery.isNotEmpty
                          ? IconButton(
                              icon: const Icon(Icons.close, size: 16),
                              onPressed: onClearSearch,
                            )
                          : null,
                      contentPadding: EdgeInsets.zero,
                      filled: true,
                      fillColor: isDark ? AppTheme.cardDark : Colors.grey.shade100,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: BorderSide.none,
                      ),
                    ),
                  ),
                ),
              ),

              const SizedBox(width: 8),

              // Customer Chip
              InkWell(
                onTap: onCustomerTap,
                borderRadius: BorderRadius.circular(10),
                child: Container(
                  height: 38,
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  decoration: BoxDecoration(
                    color: customerName != null && customerName!.isNotEmpty
                        ? AppTheme.primaryLight
                        : (isDark ? AppTheme.cardDark : Colors.grey.shade100),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: customerName != null && customerName!.isNotEmpty
                          ? AppTheme.primary.withOpacity(0.5)
                          : (isDark ? AppTheme.borderDark : AppTheme.borderLight),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.person_outline,
                        size: 17,
                        color: customerName != null && customerName!.isNotEmpty
                            ? AppTheme.primary
                            : (isDark ? AppTheme.textMutedDark : AppTheme.textMutedLight),
                      ),
                      const SizedBox(width: 5),
                      Text(
                        customerName != null && customerName!.isNotEmpty
                            ? customerName!
                            : 'Customer',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: customerName != null && customerName!.isNotEmpty
                              ? AppTheme.primaryDark
                              : (isDark ? AppTheme.textDark : AppTheme.textLight),
                        ),
                      ),
                      if (loyaltyPoints != null && loyaltyPoints! > 0) ...[
                        const SizedBox(width: 4),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                          decoration: BoxDecoration(
                            color: Colors.amber.shade100,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            '${loyaltyPoints!.toInt()} pts',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: Colors.amber.shade900,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTypeButton(
    BuildContext context, {
    required String type,
    required String label,
    required IconData icon,
    required bool isActive,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return InkWell(
      onTap: () => onOrderTypeChanged(type),
      borderRadius: BorderRadius.circular(8),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        decoration: BoxDecoration(
          color: isActive
              ? (isDark ? AppTheme.surfaceDark : Colors.white)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
          boxShadow: isActive
              ? [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.05),
                    blurRadius: 2,
                    offset: const Offset(0, 1),
                  )
                ]
              : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 15,
              color: isActive
                  ? AppTheme.primary
                  : (isDark ? AppTheme.textMutedDark : AppTheme.textMutedLight),
            ),
            const SizedBox(width: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: isActive ? FontWeight.bold : FontWeight.w500,
                color: isActive
                    ? AppTheme.primary
                    : (isDark ? AppTheme.textMutedDark : AppTheme.textMutedLight),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
