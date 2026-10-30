import 'package:flutter/material.dart';
import '../core/theme/app_theme.dart';
import '../core/constants/app_constants.dart';

class UpiQrDialog extends StatefulWidget {
  final double amount;
  final String orderNumber;
  final Function(String utr) onPaymentConfirmed;

  const UpiQrDialog({
    Key? key,
    required this.amount,
    required this.orderNumber,
    required this.onPaymentConfirmed,
  }) : super(key: key);

  @override
  State<UpiQrDialog> createState() => _UpiQrDialogState();
}

class _UpiQrDialogState extends State<UpiQrDialog> {
  final TextEditingController _utrController = TextEditingController();
  String? _errorText;

  @override
  void dispose() {
    _utrController.dispose();
    super.dispose();
  }

  void _handleConfirm() {
    final utr = _utrController.text.trim();
    if (utr.length < 4) {
      setState(() {
        _errorText = 'Enter valid bank UTR / Ref (min 4 characters)';
      });
      return;
    }
    Navigator.pop(context);
    widget.onPaymentConfirmed(utr);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Container(
        width: 340,
        padding: const EdgeInsets.all(24),
        child: SingleChildScrollView(
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
                widget.orderNumber,
                style: TextStyle(
                  fontSize: 13,
                  color:
                      isDark ? AppTheme.textMutedDark : AppTheme.textMutedLight,
                ),
              ),
              const SizedBox(height: 16),

              // High contrast QR Container
              Container(
                width: 180,
                height: 180,
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
                    GridView.builder(
                      physics: const NeverScrollableScrollPhysics(),
                      gridDelegate:
                          const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 7,
                        mainAxisSpacing: 4,
                        crossAxisSpacing: 4,
                      ),
                      itemCount: 49,
                      itemBuilder: (context, index) {
                        final isCorner = (index < 3 ||
                                (index >= 7 && index < 10) ||
                                (index >= 14 && index < 17)) ||
                            (index >= 42 && index < 45 ||
                                index >= 49 - 14 && index < 49 - 11) ||
                            (index % 7 >= 4 && index < 21);
                        final isCenter = index == 24;
                        final isBlack =
                            (index * 7 + 13) % 3 != 0 || isCorner || isCenter;

                        return Container(
                          decoration: BoxDecoration(
                            color: isBlack ? Colors.black : Colors.white,
                            borderRadius:
                                BorderRadius.circular(isCorner ? 3 : 1),
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

              const SizedBox(height: 12),
              Text(
                '${AppConstants.defaultCurrency}${widget.amount.toStringAsFixed(2)}',
                style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                  color: AppTheme.primaryDark,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                'Accepts Google Pay, PhonePe, Paytm, BHIM',
                style: TextStyle(fontSize: 11, color: AppTheme.neutral),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),

              // Genuine bank UTR entry field
              TextField(
                controller: _utrController,
                decoration: InputDecoration(
                  labelText: 'Bank UTR / Ref (12 digits)',
                  hintText: 'e.g. 430123456789',
                  errorText: _errorText,
                  border: const OutlineInputBorder(),
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                ),
                onChanged: (_) {
                  if (_errorText != null) {
                    setState(() {
                      _errorText = null;
                    });
                  }
                },
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                height: 46,
                child: ElevatedButton.icon(
                  onPressed: _handleConfirm,
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
      ),
    );
  }
}
