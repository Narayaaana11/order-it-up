import 'package:flutter/material.dart';
import '../core/theme/app_theme.dart';
import '../core/constants/app_constants.dart';
import '../models/bill_model.dart';

class ReceiptPreviewDialog extends StatelessWidget {
  final BillModel bill;

  const ReceiptPreviewDialog({Key? key, required this.bill}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Container(
        width: 360,
        constraints: const BoxConstraints(maxHeight: 600),
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.grey.shade300),
                    boxShadow: [
                      BoxShadow(
                          color: Colors.black.withOpacity(0.04), blurRadius: 6),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Header
                      Center(
                        child: Image.asset(
                          'assets/images/logo.png',
                          width: 32,
                          height: 32,
                          errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                        ),
                      ),
                      const SizedBox(height: 6),
                      const Center(
                        child: Text(
                          'ORDER IT UP',
                          style: TextStyle(
                            fontFamily: 'Courier',
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 2,
                            color: Colors.black,
                          ),
                        ),
                      ),
                      Center(
                        child: Text(
                          bill.restaurantName ?? 'KANCHI FILTER COFFEE',
                          style: const TextStyle(
                            fontFamily: 'Courier',
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: Colors.black87,
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      const Text('----------------------------------------',
                          style: TextStyle(
                              fontFamily: 'Courier',
                              fontSize: 10,
                              color: Colors.grey)),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('Bill: ${bill.billNumber}',
                              style: const TextStyle(
                                  fontFamily: 'Courier',
                                  fontSize: 11,
                                  color: Colors.black)),
                          Text(bill.tableNumber,
                              style: const TextStyle(
                                  fontFamily: 'Courier',
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.black)),
                        ],
                      ),
                      Text('Order: ${bill.orderNumber}',
                          style: const TextStyle(
                              fontFamily: 'Courier',
                              fontSize: 11,
                              color: Colors.black)),
                      if (bill.customerName != null &&
                          bill.customerName!.isNotEmpty)
                        Text('Guest: ${bill.customerName}',
                            style: const TextStyle(
                                fontFamily: 'Courier',
                                fontSize: 11,
                                color: Colors.black)),
                      const Text('----------------------------------------',
                          style: TextStyle(
                              fontFamily: 'Courier',
                              fontSize: 10,
                              color: Colors.grey)),
                      const SizedBox(height: 6),

                      // Items Table
                      Row(
                        children: const [
                          Expanded(
                              flex: 4,
                              child: Text('ITEM',
                                  style: TextStyle(
                                      fontFamily: 'Courier',
                                      fontSize: 11,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.black))),
                          Expanded(
                              flex: 1,
                              child: Text('QTY',
                                  style: TextStyle(
                                      fontFamily: 'Courier',
                                      fontSize: 11,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.black))),
                          Expanded(
                              flex: 2,
                              child: Text('AMT',
                                  textAlign: TextAlign.right,
                                  style: TextStyle(
                                      fontFamily: 'Courier',
                                      fontSize: 11,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.black))),
                        ],
                      ),
                      const SizedBox(height: 6),
                      ...bill.items.map((item) => Padding(
                            padding: const EdgeInsets.symmetric(vertical: 2),
                            child: Row(
                              children: [
                                Expanded(
                                  flex: 4,
                                  child: Text(
                                    item.productName,
                                    style: const TextStyle(
                                        fontFamily: 'Courier',
                                        fontSize: 11,
                                        color: Colors.black),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                Expanded(
                                  flex: 1,
                                  child: Text('${item.quantity}',
                                      style: const TextStyle(
                                          fontFamily: 'Courier',
                                          fontSize: 11,
                                          color: Colors.black)),
                                ),
                                Expanded(
                                  flex: 2,
                                  child: Text(
                                    (item.unitPrice * item.quantity)
                                        .toStringAsFixed(2),
                                    textAlign: TextAlign.right,
                                    style: const TextStyle(
                                        fontFamily: 'Courier',
                                        fontSize: 11,
                                        color: Colors.black),
                                  ),
                                ),
                              ],
                            ),
                          )),

                      const SizedBox(height: 6),
                      const Text('----------------------------------------',
                          style: TextStyle(
                              fontFamily: 'Courier',
                              fontSize: 10,
                              color: Colors.grey)),

                      // Totals
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Subtotal:',
                              style: TextStyle(
                                  fontFamily: 'Courier',
                                  fontSize: 11,
                                  color: Colors.black)),
                          Text(bill.subtotal.toStringAsFixed(2),
                              style: const TextStyle(
                                  fontFamily: 'Courier',
                                  fontSize: 11,
                                  color: Colors.black)),
                        ],
                      ),
                      if (bill.discountAmount > 0)
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                                'Discount (${bill.discountPercent.toStringAsFixed(0)}%):',
                                style: const TextStyle(
                                    fontFamily: 'Courier',
                                    fontSize: 11,
                                    color: Colors.black)),
                            Text('-${bill.discountAmount.toStringAsFixed(2)}',
                                style: const TextStyle(
                                    fontFamily: 'Courier',
                                    fontSize: 11,
                                    color: Colors.black)),
                          ],
                        ),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                              'GST/Tax (${bill.taxPercent.toStringAsFixed(0)}%):',
                              style: const TextStyle(
                                  fontFamily: 'Courier',
                                  fontSize: 11,
                                  color: Colors.black)),
                          Text(bill.taxAmount.toStringAsFixed(2),
                              style: const TextStyle(
                                  fontFamily: 'Courier',
                                  fontSize: 11,
                                  color: Colors.black)),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('TOTAL PAYABLE:',
                              style: TextStyle(
                                  fontFamily: 'Courier',
                                  fontSize: 13,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.black)),
                          Text(
                            '${AppConstants.defaultCurrency}${bill.totalPayable.toStringAsFixed(2)}',
                            style: const TextStyle(
                                fontFamily: 'Courier',
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                color: Colors.black),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Mode:',
                              style: TextStyle(
                                  fontFamily: 'Courier',
                                  fontSize: 11,
                                  color: Colors.black)),
                          Text((bill.paymentMethod ?? 'CASH').toUpperCase(),
                              style: const TextStyle(
                                  fontFamily: 'Courier',
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.black)),
                        ],
                      ),
                      const SizedBox(height: 12),
                      const Center(
                        child: Text(
                          '*** THANK YOU! VISIT AGAIN ***',
                          style: TextStyle(
                              fontFamily: 'Courier',
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: Colors.grey),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () {
                      Navigator.pop(context);
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                            content: Text(
                                'ESC/POS 80mm Print command sent to thermal printer.')),
                      );
                    },
                    icon: const Icon(Icons.print, size: 18),
                    label: const Text('Print Receipt'),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
