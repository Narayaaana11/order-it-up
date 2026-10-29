import 'package:flutter/material.dart';
import '../core/theme/app_theme.dart';
import '../core/constants/app_constants.dart';
import '../models/product_model.dart';

class ItemModifierDialog extends StatefulWidget {
  final ProductModel product;
  final Function(int quantity, String note) onConfirm;

  const ItemModifierDialog({
    Key? key,
    required this.product,
    required this.onConfirm,
  }) : super(key: key);

  @override
  State<ItemModifierDialog> createState() => _ItemModifierDialogState();
}

class _ItemModifierDialogState extends State<ItemModifierDialog> {
  int _quantity = 1;
  final TextEditingController _noteController = TextEditingController();

  final List<String> _quickTags = [
    'Less Spicy',
    'Extra Spicy',
    'No Onion / Garlic',
    'Well Done',
    'Extra Chutney',
    'Separate Packing',
  ];

  @override
  void dispose() {
    _noteController.dispose();
    super.dispose();
  }

  void _addTag(String tag) {
    if (_noteController.text.contains(tag)) return;
    if (_noteController.text.isEmpty) {
      _noteController.text = tag;
    } else {
      _noteController.text = '${_noteController.text}, $tag';
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
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
                Expanded(
                  child: Text(
                    widget.product.name,
                    style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
                  ),
                ),
                Text(
                  '${AppConstants.defaultCurrency}${widget.product.price.toStringAsFixed(0)}',
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.primaryDark,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            const Text(
              'Kitchen Instructions',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: _quickTags.map((tag) {
                return ActionChip(
                  label: Text(tag, style: const TextStyle(fontSize: 12)),
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  onPressed: () => _addTag(tag),
                );
              }).toList(),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _noteController,
              decoration: const InputDecoration(
                hintText: 'Custom notes for the chef...',
              ),
              maxLines: 2,
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Quantity', style: TextStyle(fontWeight: FontWeight.w600)),
                Row(
                  children: [
                    IconButton(
                      onPressed: _quantity > 1 ? () => setState(() => _quantity--) : null,
                      icon: const Icon(Icons.remove_circle_outline),
                    ),
                    Text(
                      '$_quantity',
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                    ),
                    IconButton(
                      onPressed: () => setState(() => _quantity++),
                      icon: const Icon(Icons.add_circle_outline),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: () {
                widget.onConfirm(_quantity, _noteController.text.trim());
                Navigator.pop(context);
              },
              child: Text(
                'Add Item (${AppConstants.defaultCurrency}${(widget.product.price * _quantity).toStringAsFixed(0)})',
              ),
            ),
          ],
        ),
      ),
    );
  }
}
