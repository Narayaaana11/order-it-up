import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';

class DiscountModal extends StatefulWidget {
  final double subtotal;
  final Function(double amount, double percent, bool isPercent) onApplyDiscount;
  final VoidCallback onClearDiscount;

  const DiscountModal({
    super.key,
    required this.subtotal,
    required this.onApplyDiscount,
    required this.onClearDiscount,
  });

  @override
  State<DiscountModal> createState() => _DiscountModalState();
}

class _DiscountModalState extends State<DiscountModal> {
  bool _isPercent = true;
  final TextEditingController _valController = TextEditingController();

  @override
  void dispose() {
    _valController.dispose();
    super.dispose();
  }

  void _apply(double val, bool isPercent) {
    if (isPercent) {
      widget.onApplyDiscount(0.0, val, true);
    } else {
      widget.onApplyDiscount(val, 0.0, false);
    }
    Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      backgroundColor: isDark ? AppTheme.surfaceDark : AppTheme.surfaceLight,
      child: Container(
        width: 380,
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Apply Order Discount',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                IconButton(
                  icon: const Icon(Icons.close, size: 18),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Toggle Percent vs Flat
            Row(
              children: [
                Expanded(
                  child: ChoiceChip(
                    label: const Center(child: Text('Percentage (%)')),
                    selected: _isPercent,
                    selectedColor: AppTheme.primary,
                    labelStyle: TextStyle(
                      color: _isPercent ? Colors.white : null,
                      fontWeight: FontWeight.bold,
                    ),
                    onSelected: (val) => setState(() => _isPercent = true),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: ChoiceChip(
                    label: const Center(child: Text('Flat Amount (₹)')),
                    selected: !_isPercent,
                    selectedColor: AppTheme.primary,
                    labelStyle: TextStyle(
                      color: !_isPercent ? Colors.white : null,
                      fontWeight: FontWeight.bold,
                    ),
                    onSelected: (val) => setState(() => _isPercent = false),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 14),

            // Value Input
            TextField(
              controller: _valController,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              autofocus: true,
              decoration: InputDecoration(
                labelText: _isPercent ? 'Discount Percentage (%)' : 'Discount Amount (₹)',
                prefixText: _isPercent ? '% ' : '₹ ',
              ),
            ),

            const SizedBox(height: 12),

            // Quick Preset Chips
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: _isPercent
                  ? [
                      ActionChip(label: const Text('5%'), onPressed: () => _apply(5, true)),
                      ActionChip(label: const Text('10%'), onPressed: () => _apply(10, true)),
                      ActionChip(label: const Text('15%'), onPressed: () => _apply(15, true)),
                      ActionChip(label: const Text('20%'), onPressed: () => _apply(20, true)),
                    ]
                  : [
                      ActionChip(label: const Text('₹50'), onPressed: () => _apply(50, false)),
                      ActionChip(label: const Text('₹100'), onPressed: () => _apply(100, false)),
                      ActionChip(label: const Text('₹200'), onPressed: () => _apply(200, false)),
                    ],
            ),

            const SizedBox(height: 20),

            // Actions
            Row(
              children: [
                OutlinedButton(
                  onPressed: () {
                    widget.onClearDiscount();
                    Navigator.pop(context);
                  },
                  style: OutlinedButton.styleFrom(foregroundColor: Colors.red),
                  child: const Text('Remove'),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () {
                      final val = double.tryParse(_valController.text) ?? 0.0;
                      if (val > 0) {
                        _apply(val, _isPercent);
                      }
                    },
                    style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primary),
                    child: const Text('Apply Discount', style: TextStyle(color: Colors.white)),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
