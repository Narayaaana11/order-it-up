import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_theme.dart';
import '../../core/constants/app_constants.dart';
import '../../core/responsive/responsive_layout.dart';
import '../../providers/auth_provider.dart';
import '../../providers/table_provider.dart';
import '../../providers/cashier_provider.dart';
import '../../providers/held_order_provider.dart';
import '../../providers/kds_provider.dart';
import '../../providers/customer_provider.dart';
import '../../providers/inventory_provider.dart';
import '../../providers/closure_provider.dart';
import '../../providers/reservation_provider.dart';
import '../../providers/manager_provider.dart';
import '../waiter/waiter_screen.dart';
import '../pos/quick_pos_screen.dart';
import '../cashier/cashier_screen.dart';
import '../held_orders/held_orders_screen.dart';
import '../kds/kds_screen.dart';
import '../customers/customer_crm_screen.dart';
import '../inventory/inventory_screen.dart';
import '../closures/shift_closure_screen.dart';
import '../reservations/reservations_screen.dart';

class OperationsHomeScreen extends StatelessWidget {
  const OperationsHomeScreen({Key? key}) : super(key: key);

  Widget _buildOperationCard({
    required BuildContext context,
    required String title,
    required String subtitle,
    required IconData icon,
    required Color color,
    String? badgeText,
    Color? badgeColor,
    required VoidCallback onTap,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: isDark ? AppTheme.surfaceDark : Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: isDark ? AppTheme.borderDark : AppTheme.borderLight,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.03),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: color.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(icon, color: color, size: 24),
                  ),
                  if (badgeText != null)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: (badgeColor ?? color).withOpacity(0.15),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        badgeText,
                        style: TextStyle(
                          color: badgeColor ?? color,
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark ? AppTheme.textMutedDark : AppTheme.textMutedLight,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final tableProv = Provider.of<TableProvider>(context);
    final cashierProv = Provider.of<CashierProvider>(context);
    final heldProv = Provider.of<HeldOrderProvider>(context);
    final kdsProv = Provider.of<KdsProvider>(context);
    final custProv = Provider.of<CustomerProvider>(context);
    final invProv = Provider.of<InventoryProvider>(context);
    final resProv = Provider.of<ReservationProvider>(context);
    final mgrProv = Provider.of<ManagerProvider>(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            // Restaurant App Bar with Logo
            SliverToBoxAdapter(
              child: Container(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
                decoration: BoxDecoration(
                  color: isDark ? AppTheme.surfaceDark : Colors.white,
                  border: Border(
                    bottom: BorderSide(
                      color: isDark ? AppTheme.borderDark : AppTheme.borderLight,
                    ),
                  ),
                ),
                child: Row(
                  children: [
                    Image.asset(
                      'assets/images/logo.png',
                      width: 38,
                      height: 38,
                      errorBuilder: (_, __, ___) => Container(
                        width: 38,
                        height: 38,
                        decoration: BoxDecoration(
                          color: AppTheme.primary,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Icon(Icons.restaurant, color: Colors.white, size: 20),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            AppConstants.appName,
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 0.5,
                            ),
                          ),
                          Text(
                            'Active: ${auth.currentUser?.name ?? "Staff"} (${auth.currentUser?.roleDisplayName ?? "Server"})',
                            style: const TextStyle(fontSize: 12, color: AppTheme.primaryDark, fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppTheme.success.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.circle, size: 8, color: AppTheme.success),
                          SizedBox(width: 5),
                          Text(
                            'POS ONLINE',
                            style: TextStyle(
                              color: AppTheme.success,
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Live Sales Ticker
            SliverToBoxAdapter(
              child: Container(
                margin: const EdgeInsets.fromLTRB(16, 14, 16, 8),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFFF07928), Color(0xFFD96A1A)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(14),
                  boxShadow: [
                    BoxShadow(
                      color: AppTheme.primary.withOpacity(0.25),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'TODAY\'S SALES',
                          style: TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${AppConstants.defaultCurrency}${mgrProv.totalRevenueToday.toStringAsFixed(0)}',
                          style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w900),
                        ),
                      ],
                    ),
                    Container(width: 1, height: 32, color: Colors.white24),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'TABLES SEATED',
                          style: TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${tableProv.occupiedCount} / ${tableProv.tables.length}',
                          style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w900),
                        ),
                      ],
                    ),
                    Container(width: 1, height: 32, color: Colors.white24),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'KDS QUEUE',
                          style: TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${kdsProv.waitingCount} Orders',
                          style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w900),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),

            // Section Label
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(18, 12, 18, 8),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Restaurant Operations Hub',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
                    ),
                    Text(
                      'All 9 Desktop Modules',
                      style: TextStyle(
                        fontSize: 12,
                        color: isDark ? AppTheme.textMutedDark : AppTheme.textMutedLight,
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // 3x3 Operations Grid
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
              sliver: SliverLayoutBuilder(
                builder: (context, constraints) {
                  final cols = ResponsiveBreakpoints.getGridColumnCount(constraints.crossAxisExtent, itemMinWidth: 160);
                  final columnCount = cols < 2 ? 2 : (cols > 4 ? 4 : cols);

                  return SliverGrid.count(
                    crossAxisCount: columnCount,
                    crossAxisSpacing: 10,
                    mainAxisSpacing: 10,
                    childAspectRatio: 1.15,
                    children: [
                      // 1. Tables & Floor Map
                      _buildOperationCard(
                        context: context,
                        title: 'Tables & Floor',
                        subtitle: 'Dine-in tableside ordering',
                        icon: Icons.table_restaurant,
                        color: AppTheme.primary,
                        badgeText: '${tableProv.occupiedCount} Seated',
                        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const WaiterScreen())),
                      ),

                      // 2. Counter Quick POS
                      _buildOperationCard(
                        context: context,
                        title: 'Counter Quick POS',
                        subtitle: 'Direct sale & takeaway',
                        icon: Icons.flash_on,
                        color: AppTheme.warning,
                        badgeText: 'Instant',
                        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const QuickPosScreen())),
                      ),

                      // 3. Cashier Billing
                      _buildOperationCard(
                        context: context,
                        title: 'Cashier & Billing',
                        subtitle: 'Settle bills & receipts',
                        icon: Icons.point_of_sale,
                        color: AppTheme.success,
                        badgeText: '${cashierProv.activeOrders.length} Pending',
                        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const CashierScreen())),
                      ),

                      // 4. Held Orders
                      _buildOperationCard(
                        context: context,
                        title: 'Held Orders',
                        subtitle: 'Parked carts & recall',
                        icon: Icons.pause_circle_outline,
                        color: AppTheme.info,
                        badgeText: '${heldProv.heldCount} Held',
                        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const HeldOrdersScreen())),
                      ),

                      // 5. Kitchen Display KDS
                      _buildOperationCard(
                        context: context,
                        title: 'Kitchen KDS',
                        subtitle: 'Live ticket SLA queue',
                        icon: Icons.soup_kitchen,
                        color: const Color(0xFFE11D48),
                        badgeText: '${kdsProv.filteredTickets.length} Tickets',
                        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const KdsScreen())),
                      ),

                      // 6. Customer CRM & Loyalty
                      _buildOperationCard(
                        context: context,
                        title: 'Customer CRM',
                        subtitle: 'Phone search & wallet',
                        icon: Icons.people_alt,
                        color: const Color(0xFF8B5CF6),
                        badgeText: '${custProv.customers.length} Guests',
                        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const CustomerCrmScreen())),
                      ),

                      // 7. Inventory & Raw Stock
                      _buildOperationCard(
                        context: context,
                        title: 'Inventory & Stock',
                        subtitle: 'Recipe ingredients & BOM',
                        icon: Icons.inventory_2_outlined,
                        color: const Color(0xFF0EA5E9),
                        badgeText: invProv.lowStockCount > 0 ? '${invProv.lowStockCount} Low Stock' : 'Good',
                        badgeColor: invProv.lowStockCount > 0 ? AppTheme.danger : AppTheme.success,
                        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const InventoryScreen())),
                      ),

                      // 8. Table Reservations
                      _buildOperationCard(
                        context: context,
                        title: 'Reservations',
                        subtitle: 'Booking calendar & party',
                        icon: Icons.event_available,
                        color: const Color(0xFF14B8A6),
                        badgeText: '${resProv.confirmedCount} Bookings',
                        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ReservationsScreen())),
                      ),

                      // 9. Shift Cash Closure
                      _buildOperationCard(
                        context: context,
                        title: 'Shift Closure',
                        subtitle: 'Z-Report & drawer audit',
                        icon: Icons.lock_clock,
                        color: const Color(0xFF64748B),
                        badgeText: 'Z-Report',
                        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ShiftClosureScreen())),
                      ),
                    ],
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
