import 'package:flutter/material.dart';
import '../../core/responsive/responsive_layout.dart';
import '../../core/theme/app_theme.dart';
import '../../widgets/layout/app_sidebar_drawer.dart';
import '../../widgets/layout/desktop_bottom_nav.dart';
import '../pos/pos_page_screen.dart';
import '../orders/orders_page_screen.dart';
import '../tables/tables_page_screen.dart';
import '../dashboard/dashboard_page_screen.dart';
import '../kds/kds_screen.dart';
import '../reservations/reservations_screen.dart';
import '../inventory/inventory_screen.dart';
import '../customers/customer_crm_screen.dart';
import '../settings/settings_screen.dart';
import '../cloud_hq/cloud_hq_screen.dart';
import '../reports/reports_screen.dart';
import '../expenses/expenses_screen.dart';
import '../online_orders/online_orders_screen.dart';
import '../products/products_screen.dart';
import '../ai_insights/ai_insights_screen.dart';
import '../staff/staff_screen.dart';
import '../whatsapp/whatsapp_screen.dart';

class DesktopPosShell extends StatefulWidget {
  const DesktopPosShell({super.key});

  @override
  State<DesktopPosShell> createState() => _DesktopPosShellState();
}

class _DesktopPosShellState extends State<DesktopPosShell> {
  String _activeDestination = 'pos';
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();

  Widget _buildActiveBody() {
    switch (_activeDestination) {
      case 'pos':
        return PosPageScreen(onOpenDrawer: () => _scaffoldKey.currentState?.openDrawer());
      case 'orders':
        return const OrdersPageScreen();
      case 'tables':
        return const TablesPageScreen();
      case 'dashboard':
        return const DashboardPageScreen();
      case 'kds':
        return const KdsScreen();
      case 'reservations':
        return const ReservationsScreen();
      case 'inventory':
        return const InventoryScreen();
      case 'customers':
        return const CustomerCrmScreen();
      case 'online_orders':
        return const OnlineOrdersScreen();
      case 'reports':
        return const ReportsScreen();
      case 'cloud_hq':
        return const CloudHqScreen();
      case 'expenses':
        return const ExpensesScreen();
      case 'whatsapp':
        return const WhatsAppScreen();
      case 'products':
        return const ProductsScreen();
      case 'ai_insights':
        return const AiInsightsScreen();
      case 'staff':
        return const StaffScreen();
      case 'settings':
        return const SettingsScreen();
      default:
        return PosPageScreen(onOpenDrawer: () => _scaffoldKey.currentState?.openDrawer());
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isTablet = ResponsiveBreakpoints.isTablet(context) ||
        ResponsiveBreakpoints.isDesktop(context);

    return Scaffold(
      key: _scaffoldKey,
      drawer: !isTablet
          ? Drawer(
              child: AppSidebarDrawer(
                activeDestination: _activeDestination,
                onSelectDestination: (dest) {
                  setState(() => _activeDestination = dest);
                  Navigator.pop(context); // Close drawer
                },
                isExpanded: true,
              ),
            )
          : null,
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(44),
        child: Container(
          decoration: BoxDecoration(
            color: isDark ? AppTheme.surfaceDark : AppTheme.surfaceLight,
            border: Border(
              bottom: BorderSide(
                color: isDark ? AppTheme.borderDark : AppTheme.borderLight,
                width: 1,
              ),
            ),
          ),
          child: SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Row(
                children: [
                  // Drawer Hamburger on Phone
                  if (!isTablet) ...[
                    IconButton(
                      icon: const Icon(Icons.menu, size: 20),
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                      onPressed: () => _scaffoldKey.currentState?.openDrawer(),
                    ),
                    const SizedBox(width: 8),
                  ],

                  // Store Brand Logo + Name
                  Image.asset(
                    'assets/images/logo.png',
                    width: 22,
                    height: 22,
                    fit: BoxFit.contain,
                    errorBuilder: (_, __, ___) => const Icon(Icons.storefront, size: 20, color: AppTheme.primary),
                  ),
                  const SizedBox(width: 8),
                  const Text(
                    'Order It Up',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.3,
                    ),
                  ),

                  const Spacer(),

                  // Server Connection Status Badge (:3001)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: Colors.green.shade50,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.green.shade200),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 6,
                          height: 6,
                          decoration: const BoxDecoration(
                            color: Colors.green,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 5),
                        Text(
                          ':3001 Live',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: Colors.green.shade800,
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(width: 8),

                  // Staff Profile Chip
                  CircleAvatar(
                    radius: 13,
                    backgroundColor: AppTheme.primaryLight,
                    child: const Text(
                      'OI',
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppTheme.primaryDark),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
      body: Row(
        children: [
          // Tablet Pinned Left Sidebar matching desktop
          if (isTablet)
            AppSidebarDrawer(
              activeDestination: _activeDestination,
              onSelectDestination: (dest) => setState(() => _activeDestination = dest),
              isExpanded: true,
            ),

          // Main View Content
          Expanded(
            child: _buildActiveBody(),
          ),
        ],
      ),
      // Smartphone BottomNav matching desktop BottomNav.tsx
      bottomNavigationBar: !isTablet
          ? DesktopBottomNav(
              activeTab: _activeDestination,
              onSelectTab: (tab) => setState(() => _activeDestination = tab),
              onOpenMoreDrawer: () => _scaffoldKey.currentState?.openDrawer(),
            )
          : null,
    );
  }
}
