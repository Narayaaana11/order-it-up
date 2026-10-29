import 'package:flutter/material.dart';
import '../core/theme/app_theme.dart';
import '../core/constants/app_constants.dart';
import '../models/product_model.dart';

class ProductGridCard extends StatelessWidget {
  final ProductModel product;
  final VoidCallback onAdd;
  final VoidCallback? onLongPress;

  const ProductGridCard({
    Key? key,
    required this.product,
    required this.onAdd,
    this.onLongPress,
  }) : super(key: key);

  Widget _buildDietaryIndicator() {
    final isVeg = product.isVeg;
    final color = isVeg ? AppTheme.success : AppTheme.danger;

    return Container(
      width: 14,
      height: 14,
      padding: const EdgeInsets.all(2),
      decoration: BoxDecoration(
        border: Border.all(color: color, width: 1.5),
        borderRadius: BorderRadius.circular(3),
      ),
      child: Center(
        child: Container(
          width: 6,
          height: 6,
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: product.isActive ? onAdd : null,
        onLongPress: onLongPress,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: isDark ? AppTheme.surfaceDark : Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isDark ? AppTheme.borderDark : AppTheme.borderLight,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      _buildDietaryIndicator(),
                      if (!product.isActive)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                          decoration: BoxDecoration(
                            color: AppTheme.danger.withOpacity(0.15),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: const Text(
                            '86\'d',
                            style: TextStyle(
                              color: AppTheme.danger,
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    product.name,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: product.isActive
                          ? (isDark ? AppTheme.textDark : AppTheme.textLight)
                          : (isDark ? AppTheme.textMutedDark : AppTheme.textMutedLight),
                      decoration: product.isActive ? null : TextDecoration.lineThrough,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Text(
                    '${AppConstants.defaultCurrency}${product.price.toStringAsFixed(0)}',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: product.isActive ? AppTheme.primaryDark : AppTheme.neutral,
                    ),
                  ),
                  Container(
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      color: product.isActive
                          ? AppTheme.primaryLight
                          : (isDark ? AppTheme.cardDark : AppTheme.borderLight),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      Icons.add,
                      size: 18,
                      color: product.isActive ? AppTheme.primaryDark : AppTheme.neutral,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
