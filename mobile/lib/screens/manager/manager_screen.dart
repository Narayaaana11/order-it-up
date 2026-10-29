import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_theme.dart';
import '../../core/constants/app_constants.dart';
import '../../core/responsive/responsive_layout.dart';
import '../../providers/manager_provider.dart';
import '../../providers/menu_provider.dart';
import '../../widgets/kpi_metric_card.dart';

class ManagerScreen extends StatefulWidget {
  const ManagerScreen({Key? key}) : super(key: key);

  @override
  State<ManagerScreen> createState() => _ManagerScreenState();
}

class _ManagerScreenState extends State<ManagerScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<ManagerProvider>(context, listen: false).refreshMetrics();
    });
  }

  @override
  Widget build(BuildContext context) {
    final manager = Provider.of<ManagerProvider>(context);
    final menuProv = Provider.of<MenuProvider>(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Manager Operations Dashboard'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              manager.refreshMetrics();
              menuProv.loadMenu();
            },
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // KPI Grid
            LayoutBuilder(
              builder: (context, constraints) {
                final cols = ResponsiveBreakpoints.getGridColumnCount(constraints.maxWidth, itemMinWidth: 180);
                return GridView.count(
                  crossAxisCount: cols < 2 ? 2 : (cols > 4 ? 4 : cols),
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  crossAxisSpacing: 10,
                  mainAxisSpacing: 10,
                  childAspectRatio: 1.5,
                  children: [
                    KpiMetricCard(
                      title: "Today's Gross Sales",
                      value: '${AppConstants.defaultCurrency}${manager.totalRevenueToday.toStringAsFixed(0)}',
                      subtitle: '+14.2% vs yesterday',
                      icon: Icons.currency_rupee,
                      color: AppTheme.success,
                    ),
                    KpiMetricCard(
                      title: 'Total Orders',
                      value: '${manager.ordersToday}',
                      subtitle: 'Dine-In & Takeaway',
                      icon: Icons.receipt_long,
                      color: AppTheme.info,
                    ),
                    KpiMetricCard(
                      title: 'Average Ticket (AOV)',
                      value: '${AppConstants.defaultCurrency}${manager.averageTicketSize.toStringAsFixed(0)}',
                      subtitle: 'Target: ₹900',
                      icon: Icons.trending_up,
                      color: AppTheme.primary,
                    ),
                    KpiMetricCard(
                      title: 'Table Occupancy',
                      value: '${manager.occupancyPercent.toStringAsFixed(0)}%',
                      subtitle: '${manager.occupiedTables}/${manager.totalTables} Tables Seated',
                      icon: Icons.table_restaurant,
                      color: AppTheme.warning,
                    ),
                  ],
                );
              },
            ),

            const SizedBox(height: 24),

            // Kitchen Bottlenecks Banner
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: isDark ? AppTheme.surfaceDark : Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: isDark ? AppTheme.borderDark : AppTheme.borderLight),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Kitchen Speed & SLA Telemetry',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: AppTheme.success.withOpacity(0.12),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Text('HEALTHY', style: TextStyle(color: AppTheme.success, fontSize: 11, fontWeight: FontWeight.w800)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Average Kitchen Prep Time',
                              style: TextStyle(fontSize: 12, color: isDark ? AppTheme.textMutedDark : AppTheme.textMutedLight),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '${manager.averagePrepMinutes} Minutes',
                              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
                            ),
                          ],
                        ),
                      ),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Fastest Station',
                              style: TextStyle(fontSize: 12, color: isDark ? AppTheme.textMutedDark : AppTheme.textMutedLight),
                            ),
                            const SizedBox(height: 4),
                            const Text(
                              'Grill (8.2 min)',
                              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppTheme.success),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // Live 86'd Stock Management
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: isDark ? AppTheme.surfaceDark : Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: isDark ? AppTheme.borderDark : AppTheme.borderLight),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Live Item Availability (86 Stock Control)',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                      ),
                      Text(
                        '${menuProv.products.where((p) => !p.isActive).length} Unavailable',
                        style: const TextStyle(fontSize: 12, color: AppTheme.danger, fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Toggle switches to immediately 86 items across all Waiter handhelds and QR digital menus.',
                    style: TextStyle(fontSize: 12, color: isDark ? AppTheme.textMutedDark : AppTheme.textMutedLight),
                  ),
                  const Divider(height: 20),
                  ListView.separated(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: menuProv.products.length,
                    separatorBuilder: (_, __) => const Divider(height: 1),
                    itemBuilder: (context, index) {
                      final prod = menuProv.products[index];
                      return ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text(
                          prod.name,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            decoration: prod.isActive ? null : TextDecoration.lineThrough,
                          ),
                        ),
                        subtitle: Text(
                          '${AppConstants.defaultCurrency}${prod.price.toStringAsFixed(0)} • ${prod.station}',
                          style: const TextStyle(fontSize: 12),
                        ),
                        trailing: Switch(
                          value: prod.isActive,
                          activeColor: AppTheme.success,
                          onChanged: (_) => menuProv.toggleProductAvailability(prod.id),
                        ),
                      );
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
