import 'package:flutter/material.dart';
import '../core/theme/app_theme.dart';
import '../core/constants/app_constants.dart';

class UpiQrDialog extends StatelessWidget {
  final double amount;
  final String orderNumber;
  final VoidCallback onPaymentConfirmed;

  const UpiQrDialog({
    Key? key,
    required this.amount,
    required this.orderNumber,
    required this.onPaymentConfirmed,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Container(
        width: 340,
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Scan UPI QR to Pay',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                ),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              orderNumber,
              style: TextStyle(
                fontSize: 13,
                color: isDark ? AppTheme.textMutedDark : AppTheme.textMutedLight,
              ),
            ),
            const SizedBox(height: 16),

            // High contrast QR Container
            Container(
              width: 200,
              height: 200,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey.shade300, width: 2),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.05),
                    blurRadius: 10,
                  ),
                ],
              ),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  // Stylized QR code representation using custom grid
                  GridView.builder(
                    physics: const NeverScrollableScrollPhysics(),
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 7,
                      mainAxisSpacing: 4,
                      crossAxisSpacing: 4,
                    ),
                    itemCount: 49,
                    itemBuilder: (context, index) {
                      final isCorner = (index < 3 || (index >= 7 && index < 10) || (index >= 14 && index < 17)) ||
                          (index >= 42 && index < 45 || index >= 49 - 14 && index < 49 - 11) ||
                          (index % 7 >= 4 && index < 21);
                      final isCenter = index == 24;
                      final isBlack = (index * 7 + 13) % 3 != 0 || isCorner || isCenter;

                      return Container(
                        decoration: BoxDecoration(
                          color: isBlack ? Colors.black : Colors.white,
                          borderRadius: BorderRadius.circular(isCorner ? 3 : 1),
                        ),
                      );
                    },
                  ),
                  Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.1),
                          blurRadius: 4,
                        ),
                      ],
                    ),
                    child: const Icon(
                      Icons.qr_code_2,
                      color: AppTheme.primary,
                      size: 26,
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),
            Text(
              '${AppConstants.defaultCurrency}${amount.toStringAsFixed(2)}',
              style: const TextStyle(
                fontSize: 26,
                fontWeight: FontWeight.w800,
                color: AppTheme.primaryDark,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Accepts Google Pay, PhonePe, Paytm, BHIM',
              style: TextStyle(fontSize: 11, color: AppTheme.neutral),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton.icon(
                onPressed: () {
                  Navigator.pop(context);
                  onPaymentConfirmed();
                },
                icon: const Icon(Icons.check_circle_outline, size: 20),
                label: const Text('Confirm Payment Received'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.success,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
