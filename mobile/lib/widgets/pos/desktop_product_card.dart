import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../core/theme/app_theme.dart';
import '../../models/product_model.dart';

class DesktopProductCard extends StatelessWidget {
  final ProductModel product;
  final VoidCallback onTap;
  final int cartQuantity;

  const DesktopProductCard({
    super.key,
    required this.product,
    required this.onTap,
    this.cartQuantity = 0,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final currencyFmt = NumberFormat.currency(symbol: '₹', decimalDigits: 2);
    final isVeg = product.isVeg;
    final isAvailable = product.isAvailable;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: isAvailable ? onTap : null,
        borderRadius: BorderRadius.circular(12),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          decoration: BoxDecoration(
            color: isDark ? AppTheme.surfaceDark : AppTheme.surfaceLight,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: cartQuantity > 0
                  ? AppTheme.primary
                  : (isDark ? AppTheme.borderDark : AppTheme.borderLight),
              width: cartQuantity > 0 ? 1.5 : 1.0,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.03),
                blurRadius: 4,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.all(10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                // Top Row: Dietary Badge + Quantity Indicator
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    // Desktop-authentic dietary symbol
                    _buildDietaryIndicator(isVeg),
                    if (cartQuantity > 0)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppTheme.primary,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          '$cartQuantity in cart',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                  ],
                ),

                const SizedBox(height: 6),

                // Center: Product Name & Category
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        product.name,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w700,
                          color: isAvailable
                              ? (isDark ? AppTheme.textDark : AppTheme.textLight)
                              : (isDark ? AppTheme.textMutedDark : AppTheme.textMutedLight),
                        ),
                      ),
                      if (product.categoryName != null && product.categoryName!.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(
                          product.categoryName!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 11,
                            color: isDark ? AppTheme.textMutedDark : AppTheme.textMutedLight,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),

                const SizedBox(height: 6),

                // Bottom Row: Price + Add Button
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Text(
                      currencyFmt.format(product.price),
                      style: TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w800,
                        color: isAvailable
                            ? AppTheme.primary
                            : (isDark ? AppTheme.textMutedDark : AppTheme.textMutedLight),
                      ),
                    ),
                    if (!isAvailable)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.red.shade100,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          "86'd",
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: Colors.red.shade800,
                          ),
                        ),
                      )
                    else
                      Container(
                        width: 28,
                        height: 28,
                        decoration: BoxDecoration(
                          color: cartQuantity > 0 ? AppTheme.primary : AppTheme.primaryLight,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Icon(
                          Icons.add,
                          size: 18,
                          color: cartQuantity > 0 ? Colors.white : AppTheme.primaryDark,
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildDietaryIndicator(bool isVeg) {
    final borderColor = isVeg ? const Color(0xFF16A34A) : const Color(0xFFDC2626);
    return Container(
      width: 14,
      height: 14,
      padding: const EdgeInsets.all(2),
      decoration: BoxDecoration(
        color: Colors.transparent,
        border: Border.all(color: borderColor, width: 1.5),
        borderRadius: BorderRadius.circular(3),
      ),
      child: Center(
        child: Container(
          width: 6,
          height: 6,
          decoration: BoxDecoration(
            color: borderColor,
            shape: BoxShape.circle,
          ),
        ),
      ),
    );
  }
}
