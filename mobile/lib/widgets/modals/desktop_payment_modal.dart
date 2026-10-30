import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../core/theme/app_theme.dart';
import '../../models/order_model.dart';
import '../../models/bill_model.dart';
import '../receipt_preview_dialog.dart';
import '../upi_qr_dialog.dart';

class DesktopPaymentModal extends StatefulWidget {
  final double grandTotal;
  final double subtotal;
  final double discount;
  final double tax;
  final String orderType;
  final String? tableName;
  final String? customerName;
  final String? customerPhone;
  final List<DraftLineModel> items;
  final Function(String paymentMethod, double amountTendered, double change)
      onPaymentComplete;

  const DesktopPaymentModal({
    super.key,
    required this.grandTotal,
    required this.subtotal,
    required this.discount,
    required this.tax,
    required this.orderType,
    this.tableName,
    this.customerName,
    this.customerPhone,
    required this.items,
    required this.onPaymentComplete,
  });

  @override
  State<DesktopPaymentModal> createState() => _DesktopPaymentModalState();
}

class _DesktopPaymentModalState extends State<DesktopPaymentModal> {
  String _selectedMethod = 'cash'; // 'cash', 'card', 'upi'
  late TextEditingController _tenderedController;
  final TextEditingController _cardRefController = TextEditingController();
  double _tenderedAmount = 0.0;

  @override
  void initState() {
    super.initState();
    _tenderedAmount = widget.grandTotal;
    _tenderedController =
        TextEditingController(text: widget.grandTotal.toStringAsFixed(2));
  }

  @override
  void dispose() {
    _tenderedController.dispose();
    _cardRefController.dispose();
    super.dispose();
  }

  double get _changeAmount {
    if (_selectedMethod != 'cash') return 0.0;
    final diff = _tenderedAmount - widget.grandTotal;
    return diff > 0 ? diff : 0.0;
  }

  void _setTendered(double val) {
    setState(() {
      _tenderedAmount = val;
      _tenderedController.text = val.toStringAsFixed(2);
    });
  }

  void _addTendered(double delta) {
    setState(() {
      _tenderedAmount += delta;
      _tenderedController.text = _tenderedAmount.toStringAsFixed(2);
    });
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final currencyFmt = NumberFormat.currency(symbol: '₹', decimalDigits: 2);

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      backgroundColor: isDark ? AppTheme.surfaceDark : AppTheme.surfaceLight,
      child: Container(
        width: 480,
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Modal Header
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: AppTheme.primaryLight,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(Icons.payments_outlined,
                          color: AppTheme.primary, size: 20),
                    ),
                    const SizedBox(width: 10),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Checkout & Payment',
                          style: TextStyle(
                              fontSize: 17, fontWeight: FontWeight.bold),
                        ),
                        Text(
                          widget.tableName != null
                              ? 'Table: ${widget.tableName}'
                              : 'Order Type: ${widget.orderType.toUpperCase()}',
                          style: TextStyle(
                            fontSize: 12,
                            color: isDark
                                ? AppTheme.textMutedDark
                                : AppTheme.textMutedLight,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                IconButton(
                  icon: const Icon(Icons.close, size: 20),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),

            const SizedBox(height: 16),

            // Summary Card
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: isDark ? AppTheme.cardDark : Colors.grey.shade50,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: isDark ? AppTheme.borderDark : AppTheme.borderLight,
                ),
              ),
              child: Column(
                children: [
                  _buildSummaryLine(
                      'Subtotal', currencyFmt.format(widget.subtotal), isDark),
                  if (widget.discount > 0) ...[
                    const SizedBox(height: 4),
                    _buildSummaryLine(
                      'Discount',
                      '- ${currencyFmt.format(widget.discount)}',
                      isDark,
                      color: Colors.green,
                    ),
                  ],
                  const SizedBox(height: 4),
                  _buildSummaryLine(
                      'GST (5%)', currencyFmt.format(widget.tax), isDark),
                  const Divider(height: 14),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Total Payable',
                        style: TextStyle(
                            fontSize: 15, fontWeight: FontWeight.bold),
                      ),
                      Text(
                        currencyFmt.format(widget.grandTotal),
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w900,
                          color: AppTheme.primary,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // Payment Tender Tabs (Cash, Card, UPI)
            Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: isDark ? AppTheme.cardDark : Colors.grey.shade100,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: [
                  _buildTenderTab('cash', 'Cash', Icons.money),
                  _buildTenderTab('card', 'Card', Icons.credit_card),
                  _buildTenderTab('upi', 'UPI QR', Icons.qr_code_2),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // Active Tab Content
            if (_selectedMethod == 'cash') ...[
              // Amount Tendered Field
              TextField(
                controller: _tenderedController,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                onChanged: (val) {
                  setState(() {
                    _tenderedAmount = double.tryParse(val) ?? 0.0;
                  });
                },
                decoration: const InputDecoration(
                  labelText: 'Amount Tendered (Cash)',
                  prefixText: '₹ ',
                ),
              ),
              const SizedBox(height: 10),

              // Quick Cash Chips
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  _buildCashChip(
                      'Exact', () => _setTendered(widget.grandTotal)),
                  _buildCashChip('+₹100', () => _addTendered(100)),
                  _buildCashChip('+₹200', () => _addTendered(200)),
                  _buildCashChip('+₹500', () => _addTendered(500)),
                  _buildCashChip('+₹2000', () => _addTendered(2000)),
                ],
              ),

              const SizedBox(height: 12),

              // Change to return
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: Colors.green.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.green.shade200),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Change to Return:',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: Colors.green.shade900,
                      ),
                    ),
                    Text(
                      currencyFmt.format(_changeAmount),
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                        color: Colors.green.shade800,
                      ),
                    ),
                  ],
                ),
              ),
            ] else if (_selectedMethod == 'card') ...[
              TextField(
                controller: _cardRefController,
                decoration: const InputDecoration(
                  labelText: 'Card Reference / Authorization Code',
                  hintText: 'e.g. TXN-948271',
                  prefixIcon: Icon(Icons.tag),
                ),
              ),
            ] else if (_selectedMethod == 'upi') ...[
              OutlinedButton.icon(
                onPressed: () {
                  showDialog(
                    context: context,
                    builder: (_) => UpiQrDialog(
                      orderNumber:
                          'INV-${DateTime.now().millisecondsSinceEpoch.toString().substring(7)}',
                      amount: widget.grandTotal,
                      onPaymentConfirmed: (utr) {
                        _cardRefController.text = utr;
                        Navigator.pop(context);
                        _completePayment();
                      },
                    ),
                  );
                },
                icon: const Icon(Icons.qr_code),
                label: const Text('Show Customer Dynamic UPI QR Code'),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
              ),
            ],

            const SizedBox(height: 20),

            // Bottom Actions: Preview Receipt & Settle
            Row(
              children: [
                OutlinedButton.icon(
                  onPressed: () {
                    showDialog(
                      context: context,
                      builder: (_) => ReceiptPreviewDialog(
                        bill: BillModel(
                          orderId: 0,
                          orderNumber:
                              'INV-${DateTime.now().millisecondsSinceEpoch.toString().substring(7)}',
                          tableNumber: widget.tableName ??
                              widget.orderType.toUpperCase(),
                          items: widget.items
                              .map((line) => OrderItemModel(
                                    id: 0,
                                    productId: line.product.id,
                                    productName: line.product.name,
                                    quantity: line.quantity,
                                    unitPrice: line.product.price,
                                    notes: line.note,
                                  ))
                              .toList(),
                          subtotal: widget.subtotal,
                          taxPercent: 5.0,
                          taxAmount: widget.tax,
                          discountAmount: widget.discount,
                          totalPayable: widget.grandTotal,
                          paymentMethod: _selectedMethod.toUpperCase(),
                        ),
                      ),
                    );
                  },
                  icon: const Icon(Icons.receipt, size: 16),
                  label: const Text('Preview'),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 12),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: _completePayment,
                    icon: const Icon(Icons.check_circle_outline, size: 18),
                    label: const Text(
                      'Complete Payment & Settle',
                      style:
                          TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                    ),
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      backgroundColor: AppTheme.primary,
                      foregroundColor: Colors.white,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTenderTab(String id, String label, IconData icon) {
    final isSelected = _selectedMethod == id;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Expanded(
      child: InkWell(
        onTap: () => setState(() => _selectedMethod = id),
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: isSelected
                ? (isDark ? AppTheme.surfaceDark : Colors.white)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
            boxShadow: isSelected
                ? [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.05),
                      blurRadius: 2,
                    )
                  ]
                : null,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                size: 16,
                color: isSelected ? AppTheme.primary : Colors.grey,
              ),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                  color: isSelected ? AppTheme.primary : Colors.grey,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCashChip(String label, VoidCallback onTap) {
    return ActionChip(
      label: Text(label,
          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
      onPressed: onTap,
      backgroundColor: AppTheme.primaryLight,
      labelStyle: const TextStyle(color: AppTheme.primaryDark),
      padding: const EdgeInsets.symmetric(horizontal: 4),
    );
  }

  Widget _buildSummaryLine(String label, String value, bool isDark,
      {Color? color}) {
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

  void _completePayment() {
    widget.onPaymentComplete(
      _selectedMethod,
      _tenderedAmount,
      _changeAmount,
    );
    Navigator.pop(context);
  }
}
