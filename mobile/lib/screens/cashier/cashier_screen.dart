import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_theme.dart';
import '../../core/constants/app_constants.dart';
import '../../core/responsive/responsive_layout.dart';
import '../../models/order_model.dart';
import '../../providers/cashier_provider.dart';
import '../../widgets/upi_qr_dialog.dart';
import '../../widgets/receipt_preview_dialog.dart';

class CashierScreen extends StatefulWidget {
  const CashierScreen({Key? key}) : super(key: key);

  @override
  State<CashierScreen> createState() => _CashierScreenState();
}

class _CashierScreenState extends State<CashierScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<CashierProvider>(context, listen: false).loadOrders();
    });
  }

  void _showUpiModal(double amount, String orderNumber) {
    final cashier = Provider.of<CashierProvider>(context, listen: false);
    showDialog(
      context: context,
      builder: (_) => UpiQrDialog(
        amount: amount,
        orderNumber: orderNumber,
        onPaymentConfirmed: () async {
          final success = await cashier.settleBill();
          if (success && mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Payment recorded & bill settled successfully!'),
                backgroundColor: AppTheme.success,
              ),
            );
          }
        },
      ),
    );
  }

  void _showReceiptModal() {
    final cashier = Provider.of<CashierProvider>(context, listen: false);
    if (cashier.activeBill != null) {
      showDialog(
        context: context,
        builder: (_) => ReceiptPreviewDialog(bill: cashier.activeBill!),
      );
    }
  }

  Widget _buildBillDetailsPane(CashierProvider cashier, bool isTablet) {
    final bill = cashier.activeBill;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (bill == null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.point_of_sale_outlined,
                size: 48,
                color: isDark ? AppTheme.borderDark : AppTheme.borderLight),
            const SizedBox(height: 12),
            Text(
              'Select an active table order to settle bill',
              style: TextStyle(
                  color: isDark
                      ? AppTheme.textMutedDark
                      : AppTheme.textMutedLight),
            ),
          ],
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    bill.tableNumber,
                    style: const TextStyle(
                        fontSize: 18, fontWeight: FontWeight.w800),
                  ),
                  Text(
                    bill.orderNumber,
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark
                          ? AppTheme.textMutedDark
                          : AppTheme.textMutedLight,
                    ),
                  ),
                ],
              ),
              OutlinedButton.icon(
                onPressed: _showReceiptModal,
                icon: const Icon(Icons.receipt_outlined, size: 16),
                label: const Text('Receipt'),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size(80, 36),
                ),
              ),
            ],
          ),
          const Divider(height: 24),

          // Items Summary List
          Expanded(
            child: ListView.separated(
              itemCount: bill.items.length,
              separatorBuilder: (_, __) => const Divider(height: 12),
              itemBuilder: (context, index) {
                final item = bill.items[index];
                return Row(
                  children: [
                    Text('${item.quantity}x',
                        style: const TextStyle(fontWeight: FontWeight.w700)),
                    const SizedBox(width: 8),
                    Expanded(
                        child: Text(item.productName,
                            style: const TextStyle(fontSize: 14))),
                    Text(
                      '${AppConstants.defaultCurrency}${(item.unitPrice * item.quantity).toStringAsFixed(2)}',
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                  ],
                );
              },
            ),
          ),

          const Divider(height: 16),

          // Discount Chips
          Row(
            children: [
              const Text('Discount:',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
              const SizedBox(width: 8),
              ...[0.0, 5.0, 10.0, 15.0].map((d) {
                return Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: ChoiceChip(
                    label: Text('${d.toInt()}%'),
                    selected: cashier.discountPercent == d,
                    onSelected: (_) => cashier.setDiscount(d),
                  ),
                );
              }),
            ],
          ),
          const SizedBox(height: 12),

          // Subtotal & Tax Breakdowns
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Subtotal'),
              Text(
                  '${AppConstants.defaultCurrency}${bill.subtotal.toStringAsFixed(2)}'),
            ],
          ),
          if (bill.discountAmount > 0)
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Discount (${bill.discountPercent.toInt()}%)'),
                Text(
                    '-${AppConstants.defaultCurrency}${bill.discountAmount.toStringAsFixed(2)}',
                    style: const TextStyle(color: AppTheme.danger)),
              ],
            ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('GST / VAT (${bill.taxPercent.toInt()}%)'),
              Text(
                  '+${AppConstants.defaultCurrency}${bill.taxAmount.toStringAsFixed(2)}'),
            ],
          ),
          const Divider(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Total Payable',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
              Text(
                '${AppConstants.defaultCurrency}${bill.totalPayable.toStringAsFixed(2)}',
                style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: AppTheme.primaryDark),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Payment Mode Selector
          Row(
            children: [
              Expanded(
                child: ChoiceChip(
                  avatar: const Icon(Icons.money, size: 16),
                  label: const Text('Cash'),
                  selected: cashier.paymentMethod == 'cash',
                  onSelected: (_) => cashier.setPaymentMethod('cash'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: ChoiceChip(
                  avatar: const Icon(Icons.qr_code, size: 16),
                  label: const Text('UPI QR'),
                  selected: cashier.paymentMethod == 'upi',
                  onSelected: (_) => cashier.setPaymentMethod('upi'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: ChoiceChip(
                  avatar: const Icon(Icons.credit_card, size: 16),
                  label: const Text('Card'),
                  selected: cashier.paymentMethod == 'card',
                  onSelected: (_) => cashier.setPaymentMethod('card'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Pay / Settle Button
          SizedBox(
            height: 48,
            child: ElevatedButton(
              onPressed: cashier.isSettling
                  ? null
                  : () async {
                      if (cashier.paymentMethod == 'upi') {
                        _showUpiModal(bill.totalPayable, bill.orderNumber);
                      } else {
                        final ok = await cashier.settleBill();
                        if (ok && mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Payment settled & order closed!'),
                              backgroundColor: AppTheme.success,
                            ),
                          );
                        }
                      }
                    },
              child: cashier.isSettling
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          color: Colors.white, strokeWidth: 2),
                    )
                  : Text(
                      'Collect ${AppConstants.defaultCurrency}${bill.totalPayable.toStringAsFixed(2)}'),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final cashier = Provider.of<CashierProvider>(context);
    final isTablet = ResponsiveBreakpoints.isTabletOrLarger(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (isTablet) {
      // Tablet: 2-Column Split View (Left Active Orders, Right Bill & Settle)
      return Scaffold(
        appBar: AppBar(
          title: const Text('Cashier Billing Terminal'),
          actions: [
            IconButton(
              icon: const Icon(Icons.refresh),
              onPressed: cashier.loadOrders,
            ),
          ],
        ),
        body: Row(
          children: [
            // Left Pane: Active Orders
            SizedBox(
              width: 320,
              child: ListView.separated(
                padding: const EdgeInsets.all(12),
                itemCount: cashier.activeOrders.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (context, index) {
                  final order = cashier.activeOrders[index];
                  final isSelected = order.id == cashier.selectedOrder?.id;

                  return InkWell(
                    onTap: () => cashier.selectOrder(order),
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: isSelected
                            ? AppTheme.primaryLight
                                .withOpacity(isDark ? 0.2 : 0.6)
                            : (isDark ? AppTheme.surfaceDark : Colors.white),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: isSelected
                              ? AppTheme.primary
                              : (isDark
                                  ? AppTheme.borderDark
                                  : AppTheme.borderLight),
                          width: isSelected ? 2 : 1,
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                order.tableName ?? 'Dine-In',
                                style: const TextStyle(
                                    fontWeight: FontWeight.w700, fontSize: 15),
                              ),
                              Text(
                                '${AppConstants.defaultCurrency}${order.total.toStringAsFixed(0)}',
                                style: const TextStyle(
                                    fontWeight: FontWeight.w800,
                                    color: AppTheme.primaryDark),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${order.orderNumber} • ${order.items.length} items',
                            style: TextStyle(
                              fontSize: 12,
                              color: isDark
                                  ? AppTheme.textMutedDark
                                  : AppTheme.textMutedLight,
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
            const VerticalDivider(thickness: 1, width: 1),

            // Right Pane: Bill Calculation
            Expanded(child: _buildBillDetailsPane(cashier, true)),
          ],
        ),
      );
    }

    // Phone Layout: Active orders list, tapping opens checkout bottom sheet
    return Scaffold(
      appBar: AppBar(
        title: const Text('Cashier Checkout'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: cashier.loadOrders,
          ),
        ],
      ),
      body: cashier.activeOrders.isEmpty
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.check_circle_outline,
                      size: 48,
                      color:
                          isDark ? AppTheme.borderDark : AppTheme.borderLight),
                  const SizedBox(height: 12),
                  const Text('No pending bills! All orders settled.'),
                ],
              ),
            )
          : ListView.separated(
              padding: const EdgeInsets.all(12),
              itemCount: cashier.activeOrders.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, index) {
                final order = cashier.activeOrders[index];

                return InkWell(
                  onTap: () {
                    cashier.selectOrder(order);
                    showModalBottomSheet(
                      context: context,
                      isScrollControlled: true,
                      backgroundColor:
                          isDark ? AppTheme.surfaceDark : Colors.white,
                      shape: const RoundedRectangleBorder(
                          borderRadius:
                              BorderRadius.vertical(top: Radius.circular(20))),
                      builder: (_) => SizedBox(
                        height: 580,
                        child: _buildBillDetailsPane(cashier, false),
                      ),
                    );
                  },
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: isDark ? AppTheme.surfaceDark : Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                          color: isDark
                              ? AppTheme.borderDark
                              : AppTheme.borderLight),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(order.tableName ?? 'Dine-In',
                                style: const TextStyle(
                                    fontWeight: FontWeight.w700, fontSize: 16)),
                            const SizedBox(height: 4),
                            Text(
                                '${order.orderNumber} • ${order.items.length} items',
                                style: TextStyle(
                                    fontSize: 12,
                                    color: isDark
                                        ? AppTheme.textMutedDark
                                        : AppTheme.textMutedLight)),
                          ],
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                                '${AppConstants.defaultCurrency}${order.total.toStringAsFixed(0)}',
                                style: const TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w800,
                                    color: AppTheme.primaryDark)),
                            const SizedBox(height: 4),
                            const Text('Tap to settle >',
                                style: TextStyle(
                                    fontSize: 12, color: AppTheme.info)),
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
    );
  }
}
