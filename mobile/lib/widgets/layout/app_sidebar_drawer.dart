import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';

class NavDestinationItem {
  final String id;
  final String label;
  final IconData icon;

  const NavDestinationItem({
    required this.id,
    required this.label,
    required this.icon,
  });
}

const List<NavDestinationItem> desktopNavItems = [
  NavDestinationItem(
      id: 'pos', label: 'POS Terminal', icon: Icons.shopping_cart_outlined),
  NavDestinationItem(
      id: 'dashboard', label: 'Dashboard', icon: Icons.dashboard_outlined),
  NavDestinationItem(
      id: 'orders',
      label: 'Orders & History',
      icon: Icons.receipt_long_outlined),
  NavDestinationItem(
      id: 'tables',
      label: 'Tables & Floor',
      icon: Icons.table_restaurant_outlined),
  NavDestinationItem(
      id: 'kds', label: 'Kitchen KDS', icon: Icons.soup_kitchen_outlined),
  NavDestinationItem(
      id: 'reservations',
      label: 'Reservations',
      icon: Icons.calendar_month_outlined),
  NavDestinationItem(
      id: 'inventory',
      label: 'Raw Inventory',
      icon: Icons.inventory_2_outlined),
  NavDestinationItem(
      id: 'customers', label: 'Customers CRM', icon: Icons.people_alt_outlined),
  NavDestinationItem(
      id: 'online_orders',
      label: 'Online Orders',
      icon: Icons.delivery_dining_outlined),
  NavDestinationItem(
      id: 'reports', label: 'Reports & Sales', icon: Icons.bar_chart_outlined),
  NavDestinationItem(
      id: 'cloud_hq',
      label: 'Cloud Franchise HQ',
      icon: Icons.corporate_fare_outlined),
  NavDestinationItem(
      id: 'expenses', label: 'Expenses', icon: Icons.receipt_outlined),
  NavDestinationItem(
      id: 'whatsapp', label: 'WhatsApp', icon: Icons.chat_outlined),
  NavDestinationItem(
      id: 'products', label: 'Products & Menu', icon: Icons.category_outlined),
  NavDestinationItem(
      id: 'ai_insights',
      label: 'AI Insights',
      icon: Icons.auto_awesome_outlined),
  NavDestinationItem(
      id: 'staff',
      label: 'Staff Management',
      icon: Icons.manage_accounts_outlined),
  NavDestinationItem(
      id: 'settings', label: 'Settings', icon: Icons.settings_outlined),
];

class AppSidebarDrawer extends StatelessWidget {
  final String activeDestination;
  final ValueChanged<String> onSelectDestination;
  final bool isCollapsible;
  final bool isExpanded;
  final VoidCallback? onToggleCollapse;

  const AppSidebarDrawer({
    super.key,
    required this.activeDestination,
    required this.onSelectDestination,
    this.isCollapsible = false,
    this.isExpanded = true,
    this.onToggleCollapse,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      width: isExpanded ? 250 : 70,
      decoration: BoxDecoration(
        color: isDark ? AppTheme.surfaceDark : AppTheme.surfaceLight,
        border: Border(
          right: BorderSide(
            color: isDark ? AppTheme.borderDark : AppTheme.borderLight,
            width: 1,
          ),
        ),
      ),
      child: Column(
        children: [
          // Header: Brand Logo & Title
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
            decoration: BoxDecoration(
              border: Border(
                bottom: BorderSide(
                  color: isDark ? AppTheme.borderDark : AppTheme.borderLight,
                ),
              ),
            ),
            child: Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: Image.asset(
                    'assets/images/logo.png',
                    width: 32,
                    height: 32,
                    fit: BoxFit.contain,
                    errorBuilder: (_, __, ___) => Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        color: AppTheme.primary,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(Icons.storefront,
                          color: Colors.white, size: 20),
                    ),
                  ),
                ),
                if (isExpanded) ...[
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Order It Up',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.2,
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 1),
                          decoration: BoxDecoration(
                            color: AppTheme.primaryLight,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: const Text(
                            'POS Terminal',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: AppTheme.primaryDark,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),

          // 16 Navigation Entries
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
              itemCount: desktopNavItems.length,
              separatorBuilder: (_, __) => const SizedBox(height: 2),
              itemBuilder: (context, index) {
                final item = desktopNavItems[index];
                final isActive = activeDestination == item.id;

                return InkWell(
                  onTap: () => onSelectDestination(item.id),
                  borderRadius: BorderRadius.circular(10),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    padding: EdgeInsets.symmetric(
                      horizontal: isExpanded ? 12 : 8,
                      vertical: 9,
                    ),
                    decoration: BoxDecoration(
                      color:
                          isActive ? AppTheme.primaryLight : Colors.transparent,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Row(
                      mainAxisAlignment: isExpanded
                          ? MainAxisAlignment.start
                          : MainAxisAlignment.center,
                      children: [
                        Icon(
                          item.icon,
                          size: 19,
                          color: isActive
                              ? AppTheme.primary
                              : (isDark
                                  ? AppTheme.textMutedDark
                                  : AppTheme.textMutedLight),
                        ),
                        if (isExpanded) ...[
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              item.label,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: isActive
                                    ? FontWeight.w700
                                    : FontWeight.w500,
                                color: isActive
                                    ? AppTheme.primaryDark
                                    : (isDark
                                        ? AppTheme.textDark
                                        : AppTheme.textLight),
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                );
              },
            ),
          ),

          // Footer: Staff & Status
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              border: Border(
                top: BorderSide(
                  color: isDark ? AppTheme.borderDark : AppTheme.borderLight,
                ),
              ),
            ),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 14,
                  backgroundColor: AppTheme.primaryLight,
                  child: const Text(
                    'OI',
                    style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: AppTheme.primaryDark),
                  ),
                ),
                if (isExpanded) ...[
                  const SizedBox(width: 10),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Staff Cashier',
                          style: TextStyle(
                              fontSize: 12, fontWeight: FontWeight.bold),
                        ),
                        Text(
                          'Shift Open',
                          style: TextStyle(fontSize: 10, color: Colors.green),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
