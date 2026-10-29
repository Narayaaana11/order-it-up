import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../core/theme/app_theme.dart';
import '../../models/order_model.dart';

class DesktopCartPanel extends StatelessWidget {
  final List<DraftLineModel> items;
  final String orderType;
  final int guestCount;
  final ValueChanged<int> onGuestCountChanged;
  final String deliveryAddress;
  final ValueChanged<String> onDeliveryAddressChanged;
  final Function(String productId, int delta) onQuantityChanged;
  final Function(String productId) onRemoveItem;
  final Function(String productId, String note) onUpdateNote;
  final double subtotal;
  final double discount;
  final double tax;
  final double grandTotal;
  final double appliedLoyaltyPoints;
  final VoidCallback onAddDiscount;
  final VoidCallback onHoldOrder;
  final VoidCallback onSendKot;
  final VoidCallback onCheckout;
  final VoidCallback onClearCart;
  final bool isSubmitting;
  final bool isDrawer;

  const DesktopCartPanel({
    super.key,
    required this.items,
    required this.orderType,
    required this.guestCount,
    required this.onGuestCountChanged,
    required this.deliveryAddress,
    required this.onDeliveryAddressChanged,
    required this.onQuantityChanged,
    required this.onRemoveItem,
    required this.onUpdateNote,
    required this.subtotal,
    required this.discount,
    required this.tax,
    required this.grandTotal,
    required this.appliedLoyaltyPoints,
    required this.onAddDiscount,
    required this.onHoldOrder,
    required this.onSendKot,
    required this.onCheckout,
    required this.onClearCart,
    this.isSubmitting = false,
    this.isDrawer = false,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final currencyFmt = NumberFormat.currency(symbol: '₹', decimalDigits: 2);

    return Container(
      decoration: BoxDecoration(
        color: isDark ? AppTheme.surfaceDark : AppTheme.surfaceLight,
        borderRadius: isDrawer ? null : BorderRadius.circular(12),
        border: isDrawer
            ? null
            : Border.all(
                color: isDark ? AppTheme.borderDark : AppTheme.borderLight,
                width: 1,
              ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header / Specifics (Pax for Dine-in, Address for Delivery)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: isDark ? AppTheme.cardDark : Colors.grey.shade50,
              border: Border(
                bottom: BorderSide(
                  color: isDark ? AppTheme.borderDark : AppTheme.borderLight,
                ),
              ),
            ),
            child: Column(
              children: [
                if (orderType == 'dine_in')
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Icon(
                            Icons.people_outline,
                            size: 17,
                            color: isDark ? AppTheme.textMutedDark : AppTheme.textMutedLight,
                          ),
                          const SizedBox(width: 6),
                          Text(
                            'Guests (Pax)',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: isDark ? AppTheme.textDark : AppTheme.textLight,
                            ),
                          ),
                        ],
                      ),
                      Row(
                        children: [
                          _buildStepperButton(
                            icon: Icons.remove,
                            onTap: () => onGuestCountChanged(guestCount - 1),
                          ),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 10),
                            child: Text(
                              '$guestCount',
                              style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                          _buildStepperButton(
                            icon: Icons.add,
                            onTap: () => onGuestCountChanged(guestCount + 1),
                          ),
                        ],
                      ),
                    ],
                  ),
                if (orderType == 'delivery')
                  TextField(
                    onChanged: onDeliveryAddressChanged,
                    controller: TextEditingController(text: deliveryAddress)
                      ..selection = TextSelection.collapsed(offset: deliveryAddress.length),
                    decoration: InputDecoration(
                      hintText: 'Enter customer delivery address...',
                      prefixIcon: const Icon(Icons.location_on_outlined, size: 16),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    style: const TextStyle(fontSize: 12),
                  ),
              ],
            ),
          ),

          // Items List
          Expanded(
            child: items.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.shopping_cart_outlined,
                          size: 40,
                          color: (isDark ? AppTheme.textMutedDark : AppTheme.textMutedLight)
                              .withOpacity(0.5),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Your cart is empty',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: isDark ? AppTheme.textMutedDark : AppTheme.textMutedLight,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Tap products from menu to add',
                          style: TextStyle(
                            fontSize: 12,
                            color: (isDark ? AppTheme.textMutedDark : AppTheme.textMutedLight)
                                .withOpacity(0.8),
                          ),
                        ),
                      ],
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.all(12),
                    itemCount: items.length,
                    separatorBuilder: (_, __) => Divider(
                      height: 16,
                      color: isDark ? AppTheme.borderDark : AppTheme.borderLight,
                    ),
                    itemBuilder: (context, index) {
                      final item = items[index];
                      return _buildCartItemRow(context, item, currencyFmt, isDark);
                    },
                  ),
          ),

          // Summary & Totals Block
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: isDark ? AppTheme.cardDark : Colors.grey.shade50,
              border: Border(
                top: BorderSide(
                  color: isDark ? AppTheme.borderDark : AppTheme.borderLight,
                ),
              ),
            ),
            child: Column(
              children: [
                _buildSummaryRow('Subtotal', currencyFmt.format(subtotal), isDark),
                const SizedBox(height: 6),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    InkWell(
                      onTap: onAddDiscount,
                      child: Row(
                        children: [
                          Icon(Icons.discount_outlined, size: 14, color: AppTheme.primary),
                          const SizedBox(width: 4),
                          Text(
                            discount > 0 ? 'Discount Applied' : 'Add Discount',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: AppTheme.primary,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Text(
                      discount > 0 ? '- ${currencyFmt.format(discount)}' : '₹0.00',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: discount > 0 ? Colors.green : (isDark ? AppTheme.textMutedDark : AppTheme.textMutedLight),
                      ),
                    ),
                  ],
                ),
                if (appliedLoyaltyPoints > 0) ...[
                  const SizedBox(height: 6),
                  _buildSummaryRow(
                    'Loyalty Points',
                    '- ${currencyFmt.format(appliedLoyaltyPoints)}',
                    isDark,
                    color: Colors.green,
                  ),
                ],
                const SizedBox(height: 6),
                _buildSummaryRow('GST (2.5% CGST + 2.5% SGST)', currencyFmt.format(tax), isDark),
                const SizedBox(height: 10),
                Divider(height: 1, color: isDark ? AppTheme.borderDark : AppTheme.borderLight),
                const SizedBox(height: 10),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Total Payable',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: isDark ? AppTheme.textDark : AppTheme.textLight,
                      ),
                    ),
                    Text(
                      currencyFmt.format(grandTotal),
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                        color: AppTheme.primary,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                // Action Buttons matching desktop
                Row(
                  children: [
                    // Hold Order Button
                    OutlinedButton(
                      onPressed: items.isNotEmpty ? onHoldOrder : null,
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
                        side: BorderSide(
                          color: items.isNotEmpty ? AppTheme.heldOrder : Colors.grey.shade300,
                        ),
                        foregroundColor: AppTheme.heldOrder,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      child: const Icon(Icons.pause, size: 20),
                    ),
                    const SizedBox(width: 8),

                    // Send KOT (if Dine-In)
                    if (orderType == 'dine_in') ...[
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: items.isNotEmpty && !isSubmitting ? onSendKot : null,
                          icon: const Icon(Icons.soup_kitchen_outlined, size: 16),
                          label: const Text('Send KOT', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                          style: OutlinedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            side: const BorderSide(color: AppTheme.primary, width: 1.5),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                    ],

                    // Pay & Bill / Checkout Button
                    Expanded(
                      flex: orderType == 'dine_in' ? 1 : 2,
                      child: ElevatedButton.icon(
                        onPressed: items.isNotEmpty ? onCheckout : null,
                        icon: const Icon(Icons.receipt_long, size: 16),
                        label: Text(
                          orderType == 'dine_in' ? 'Pay Bill' : 'Charge & Print',
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                        ),
                        style: ElevatedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          backgroundColor: AppTheme.primary,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSummaryRow(String label, String value, bool isDark, {Color? color}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            color: isDark ? AppTheme.textMutedDark : AppTheme.textMutedLight,
          ),
        ),
        Text(
          value,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: color ?? (isDark ? AppTheme.textDark : AppTheme.textLight),
          ),
        ),
      ],
    );
  }

  Widget _buildCartItemRow(
    BuildContext context,
    DraftLineModel item,
    NumberFormat currencyFmt,
    bool isDark,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.product.name,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: isDark ? AppTheme.textDark : AppTheme.textLight,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    currencyFmt.format(item.product.price),
                    style: TextStyle(
                      fontSize: 11,
                      color: isDark ? AppTheme.textMutedDark : AppTheme.textMutedLight,
                    ),
                  ),
                ],
              ),
            ),
            Text(
              currencyFmt.format(item.lineTotal),
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.bold,
                color: isDark ? AppTheme.textDark : AppTheme.textLight,
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            // Notes action
            InkWell(
              onTap: () => _showNoteDialog(context, item),
              child: Row(
                children: [
                  Icon(
                    Icons.edit_note,
                    size: 15,
                    color: item.note.isNotEmpty ? AppTheme.primary : Colors.grey,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    item.note.isNotEmpty ? item.note : 'Add kitchen note',
                    style: TextStyle(
                      fontSize: 11,
                      fontStyle: item.note.isEmpty ? FontStyle.italic : FontStyle.normal,
                      color: item.note.isNotEmpty ? AppTheme.primaryDark : Colors.grey,
                    ),
                  ),
                ],
              ),
            ),

            // Stepper + Trash
            Row(
              children: [
                _buildStepperButton(
                  icon: Icons.remove,
                  onTap: () => onQuantityChanged(item.product.id, -1),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: Text(
                    '${item.quantity}',
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                  ),
                ),
                _buildStepperButton(
                  icon: Icons.add,
                  onTap: () => onQuantityChanged(item.product.id, 1),
                ),
                const SizedBox(width: 6),
                InkWell(
                  onTap: () => onRemoveItem(item.product.id),
                  child: Padding(
                    padding: const EdgeInsets.all(4),
                    child: Icon(Icons.delete_outline, size: 16, color: Colors.red.shade400),
                  ),
                ),
              ],
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildStepperButton({required IconData icon, required VoidCallback onTap}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(6),
      child: Container(
        width: 26,
        height: 26,
        decoration: BoxDecoration(
          color: Colors.grey.withOpacity(0.15),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Icon(icon, size: 14),
      ),
    );
  }

  void _showNoteDialog(BuildContext context, DraftLineModel item) {
    final controller = TextEditingController(text: item.note);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Kitchen Note for ${item.product.name}', style: const TextStyle(fontSize: 15)),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: const InputDecoration(
            hintText: 'e.g. Less spicy, No onion, Extra cheese...',
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              onUpdateNote(item.product.id, controller.text.trim());
              Navigator.pop(ctx);
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }
}
