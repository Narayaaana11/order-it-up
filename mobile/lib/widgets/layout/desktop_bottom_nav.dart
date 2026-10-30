import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';

class DesktopBottomNav extends StatelessWidget {
  final String activeTab;
  final ValueChanged<String> onSelectTab;
  final VoidCallback onOpenMoreDrawer;

  const DesktopBottomNav({
    super.key,
    required this.activeTab,
    required this.onSelectTab,
    required this.onOpenMoreDrawer,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      height: 60,
      decoration: BoxDecoration(
        color: (isDark ? AppTheme.surfaceDark : AppTheme.surfaceLight)
            .withOpacity(0.96),
        border: Border(
          top: BorderSide(
            color: isDark ? AppTheme.borderDark : AppTheme.borderLight,
            width: 1,
          ),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _buildNavItem('pos', 'POS', Icons.shopping_cart_outlined),
          _buildNavItem('orders', 'Orders', Icons.receipt_long_outlined),
          _buildNavItem('tables', 'Tables', Icons.table_restaurant_outlined),
          _buildNavItem('dashboard', 'Dashboard', Icons.dashboard_outlined),
          InkWell(
            onTap: onOpenMoreDrawer,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.menu,
                    size: 20,
                    color: isDark
                        ? AppTheme.textMutedDark
                        : AppTheme.textMutedLight,
                  ),
                  const SizedBox(height: 3),
                  Text(
                    'More',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      color: isDark
                          ? AppTheme.textMutedDark
                          : AppTheme.textMutedLight,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNavItem(String id, String label, IconData icon) {
    final isActive = activeTab == id;

    return InkWell(
      onTap: () => onSelectTab(id),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 3),
              decoration: BoxDecoration(
                color: isActive ? AppTheme.primaryLight : Colors.transparent,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                icon,
                size: 20,
                color: isActive ? AppTheme.primary : Colors.grey,
              ),
            ),
            const SizedBox(height: 3),
            Text(
              label,
              style: TextStyle(
                fontSize: 10.5,
                fontWeight: isActive ? FontWeight.bold : FontWeight.w500,
                color: isActive ? AppTheme.primary : Colors.grey,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
