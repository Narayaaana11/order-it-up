import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/theme/app_theme.dart';
import '../core/constants/app_constants.dart';
import '../models/order_model.dart';
import '../providers/order_provider.dart';
import '../providers/table_provider.dart';
import '../providers/held_order_provider.dart';

class OrderCartSheet extends StatefulWidget {
  final bool isBottomSheet;

  const OrderCartSheet({
    Key? key,
    this.isBottomSheet = false,
  }) : super(key: key);

  @override
  State<OrderCartSheet> createState() => _OrderCartSheetState();
}

class _OrderCartSheetState extends State<OrderCartSheet> {
  late TextEditingController _nameController;
  late TextEditingController _phoneController;

  @override
  void initState() {
    super.initState();
    final orderProv = Provider.of<OrderProvider>(context, listen: false);
    _nameController = TextEditingController(text: orderProv.customerName);
    _phoneController = TextEditingController(text: orderProv.customerPhone);
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  Widget _buildItemStatusIcon(String status) {
    switch (status.toLowerCase()) {
      case 'preparing':
        return const Icon(Icons.local_fire_department, size: 16, color: AppTheme.warning);
      case 'ready':
        return const Icon(Icons.notifications_active, size: 16, color: AppTheme.success);
      case 'served':
        return const Icon(Icons.check_circle, size: 16, color: AppTheme.info);
      default:
        return const Icon(Icons.radio_button_unchecked, size: 16, color: AppTheme.neutral);
    }
  }

  @override
  Widget build(BuildContext context) {
    final orderProv = Provider.of<OrderProvider>(context);
    final tableProv = Provider.of<TableProvider>(context);
    final selectedTable = tableProv.selectedTable;
    final currentOrder = orderProv.currentTableOrder;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final tableTitle = selectedTable?.number ?? 'Select a Table';

    return Container(
      decoration: BoxDecoration(
        color: isDark ? AppTheme.surfaceDark : Colors.white,
        borderRadius: widget.isBottomSheet
            ? const BorderRadius.vertical(top: Radius.circular(20))
            : BorderRadius.circular(12),
        border: widget.isBottomSheet
            ? null
            : Border.all(color: isDark ? AppTheme.borderDark : AppTheme.borderLight),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
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
                      tableTitle,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      selectedTable?.section ?? 'Dine-In',
                      style: TextStyle(
                        fontSize: 12,
                        color: isDark ? AppTheme.textMutedDark : AppTheme.textMutedLight,
                      ),
                    ),
                  ],
                ),
                if (orderProv.draftLines.isNotEmpty)
                  Row(
                    children: [
                      TextButton(
                        onPressed: () async {
                          if (selectedTable != null) {
                            await Provider.of<HeldOrderProvider>(context, listen: false).holdDraft(
                              tableId: selectedTable.id,
                              tableName: selectedTable.number,
                              items: orderProv.draftLines,
                              customerName: orderProv.customerName.isNotEmpty ? orderProv.customerName : null,
                              customerPhone: orderProv.customerPhone.isNotEmpty ? orderProv.customerPhone : null,
                              orderNotes: 'Tableside hold',
                            );
                            orderProv.clearDraft();
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Order parked in Held Orders!'), backgroundColor: AppTheme.info),
                              );
                              if (widget.isBottomSheet) Navigator.pop(context);
                            }
                          }
                        },
                        style: TextButton.styleFrom(
                          foregroundColor: AppTheme.info,
                          padding: EdgeInsets.zero,
                          minimumSize: const Size(44, 30),
                        ),
                        child: const Text('Hold', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                      ),
                      const SizedBox(width: 8),
                      TextButton(
                        onPressed: orderProv.clearDraft,
                        style: TextButton.styleFrom(
                          foregroundColor: AppTheme.danger,
                          padding: EdgeInsets.zero,
                          minimumSize: const Size(44, 30),
                        ),
                        child: const Text('Clear', style: TextStyle(fontSize: 13)),
                      ),
                    ],
                  ),
              ],
            ),
          ),

          // Customer details input
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _nameController,
                    onChanged: (val) => orderProv.setCustomer(val, _phoneController.text),
                    style: const TextStyle(fontSize: 13),
                    decoration: const InputDecoration(
                      hintText: 'Customer Name',
                      isDense: true,
                      prefixIcon: Icon(Icons.person_outline, size: 18),
                      contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: TextField(
                    controller: _phoneController,
                    keyboardType: TextInputType.phone,
                    onChanged: (val) => orderProv.setCustomer(_nameController.text, val),
                    style: const TextStyle(fontSize: 13),
                    decoration: const InputDecoration(
                      hintText: 'Phone number',
                      isDense: true,
                      prefixIcon: Icon(Icons.phone_outlined, size: 18),
                      contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    ),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 8),

          // Scrollable items area
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              children: [
                // Already in kitchen
                if (currentOrder != null && currentOrder.items.isNotEmpty) ...[
                  Row(
                    children: [
                      const Icon(Icons.restaurant, size: 14, color: AppTheme.neutral),
                      const SizedBox(width: 6),
                      Text(
                        'KITCHEN ORDER (${currentOrder.items.length})',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.5,
                          color: isDark ? AppTheme.textMutedDark : AppTheme.textMutedLight,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  ...currentOrder.items.map((item) => Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Row(
                          children: [
                            _buildItemStatusIcon(item.status),
                            const SizedBox(width: 8),
                            Text(
                              '${item.quantity}x',
                              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                item.productName,
                                style: const TextStyle(fontSize: 13),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            Text(
                              '${AppConstants.defaultCurrency}${(item.unitPrice * item.quantity).toStringAsFixed(0)}',
                              style: TextStyle(
                                fontSize: 13,
                                color: isDark ? AppTheme.textMutedDark : AppTheme.textMutedLight,
                              ),
                            ),
                          ],
                        ),
                      )),
                  const Divider(height: 24),
                ],

                // New Draft Items
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'NEW ITEMS (${orderProv.totalItemCount})',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.5,
                        color: isDark ? AppTheme.textMutedDark : AppTheme.textMutedLight,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),

                if (orderProv.draftLines.isEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 36),
                    child: Center(
                      child: Column(
                        children: [
                          Icon(
                            Icons.receipt_long_outlined,
                            size: 40,
                            color: isDark ? AppTheme.borderDark : AppTheme.borderLight,
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'No items added yet',
                            style: TextStyle(
                              color: isDark ? AppTheme.textMutedDark : AppTheme.textMutedLight,
                              fontSize: 14,
                            ),
                          ),
                        ],
                      ),
                    ),
                  )
                else
                  ...orderProv.draftLines.map((line) => Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: isDark ? AppTheme.cardDark : AppTheme.backgroundLight,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: isDark ? AppTheme.borderDark : AppTheme.borderLight,
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Expanded(
                                  child: Text(
                                    line.product.name,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w600,
                                      fontSize: 14,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Row(
                                  children: [
                                    IconButton(
                                      onPressed: () => orderProv.changeQuantity(line.product.id, -1),
                                      icon: const Icon(Icons.remove, size: 16),
                                      constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                                      padding: EdgeInsets.zero,
                                    ),
                                    Text(
                                      '${line.quantity}',
                                      style: const TextStyle(
                                        fontSize: 14,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                    IconButton(
                                      onPressed: () => orderProv.changeQuantity(line.product.id, 1),
                                      icon: const Icon(Icons.add, size: 16),
                                      constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                                      padding: EdgeInsets.zero,
                                    ),
                                  ],
                                ),
                              ],
                            ),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Expanded(
                                  child: TextFormField(
                                    initialValue: line.note,
                                    onChanged: (val) => orderProv.updateLineNote(line.product.id, val),
                                    style: const TextStyle(fontSize: 12),
                                    decoration: InputDecoration(
                                      hintText: 'Add note (e.g. less spicy)...',
                                      isDense: true,
                                      contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                                      border: OutlineInputBorder(
                                        borderRadius: BorderRadius.circular(6),
                                        borderSide: BorderSide(
                                          color: isDark ? AppTheme.borderDark : AppTheme.borderLight,
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Text(
                                  '${AppConstants.defaultCurrency}${line.lineTotal.toStringAsFixed(0)}',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 14,
                                    color: AppTheme.primaryDark,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      )),
              ],
            ),
          ),

          // Bottom Bar & Send button
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: isDark ? AppTheme.surfaceDark : Colors.white,
              border: Border(
                top: BorderSide(
                  color: isDark ? AppTheme.borderDark : AppTheme.borderLight,
                ),
              ),
            ),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Draft Total', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
                    Text(
                      '${AppConstants.defaultCurrency}${orderProv.draftTotal.toStringAsFixed(0)}',
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                        color: AppTheme.primaryDark,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton(
                    onPressed: (selectedTable != null &&
                            orderProv.draftLines.isNotEmpty &&
                            !orderProv.isSubmitting)
                        ? () async {
                            final success = await orderProv.sendDraftOrder(selectedTable.id);
                            if (success && context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('Order dispatched to Kitchen KDS!'),
                                  backgroundColor: AppTheme.success,
                                ),
                              );
                              if (widget.isBottomSheet) {
                                Navigator.pop(context);
                              }
                            }
                          }
                        : null,
                    child: orderProv.isSubmitting
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                          )
                        : Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.send_rounded, size: 18),
                              const SizedBox(width: 8),
                              Text(currentOrder != null ? 'Add to Order' : 'Send to Kitchen (KOT)'),
                            ],
                          ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
