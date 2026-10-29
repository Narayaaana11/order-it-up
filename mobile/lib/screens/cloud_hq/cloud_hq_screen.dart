import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../core/theme/app_theme.dart';
import '../../core/responsive/responsive_layout.dart';
import '../../providers/cloud_hq_provider.dart';
import '../../models/branch_model.dart';

class CloudHqScreen extends StatefulWidget {
  const CloudHqScreen({Key? key}) : super(key: key);

  @override
  State<CloudHqScreen> createState() => _CloudHqScreenState();
}

class _CloudHqScreenState extends State<CloudHqScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final hq = Provider.of<CloudHqProvider>(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final currencyFmt = NumberFormat.currency(symbol: '₹', decimalDigits: 2);
    final isTablet = ResponsiveBreakpoints.isTabletOrLarger(context);
    final kpiCols = isTablet ? 4 : 2;
    final kpiRatio = isTablet ? 2.1 : 1.45;

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: AppTheme.primary.withOpacity(0.15),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.corporate_fare, color: AppTheme.primary, size: 20),
            ),
            const SizedBox(width: 10),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Franchise Cloud HQ', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold), overflow: TextOverflow.ellipsis),
                  Text('Multi-Branch Edge Realtime', style: TextStyle(fontSize: 11, color: Colors.grey), overflow: TextOverflow.ellipsis),
                ],
              ),
            ),
          ],
        ),
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          labelColor: AppTheme.primary,
          unselectedLabelColor: isDark ? AppTheme.textMutedDark : AppTheme.textMutedLight,
          indicatorColor: AppTheme.primary,
          tabs: const [
            Tab(icon: Icon(Icons.trending_up, size: 18), text: 'Overview'),
            Tab(icon: Icon(Icons.receipt_long, size: 18), text: 'Closures & Tax'),
            Tab(icon: Icon(Icons.restaurant_menu, size: 18), text: 'Catalog Overrides'),
            Tab(icon: Icon(Icons.compare_arrows, size: 18), text: 'Stock Transfers'),
          ],
        ),
      ),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1200),
          child: TabBarView(
            controller: _tabController,
            children: [
              // ── TAB 1: EXECUTIVE OVERVIEW ──
              RefreshIndicator(
                onRefresh: () => hq.loadData(),
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Branch Filter Chips
                      SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: Row(
                          children: [
                            FilterChip(
                              label: const Text('All Outlets'),
                              selected: hq.selectedBranchFilter == 'all',
                              onSelected: (_) => hq.setBranchFilter('all'),
                              selectedColor: AppTheme.primary.withOpacity(0.2),
                              checkmarkColor: AppTheme.primary,
                            ),
                            const SizedBox(width: 8),
                            ...hq.branches.map((b) => Padding(
                              padding: const EdgeInsets.only(right: 8),
                              child: FilterChip(
                                label: Text(b.name.split(' ')[0]),
                                selected: hq.selectedBranchFilter == b.id,
                                onSelected: (_) => hq.setBranchFilter(b.id),
                                selectedColor: AppTheme.primary.withOpacity(0.2),
                                checkmarkColor: AppTheme.primary,
                              ),
                            )),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Adaptive KPI Cards Grid (4 cols on tablet, 2 cols on phone)
                      GridView.count(
                        crossAxisCount: kpiCols,
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        crossAxisSpacing: 10,
                        mainAxisSpacing: 10,
                        childAspectRatio: kpiRatio,
                        children: [
                          _buildKpiCard(
                            title: 'Group Revenue',
                            value: currencyFmt.format(hq.totalGroupRevenue),
                            icon: Icons.payments_outlined,
                            color: Colors.green,
                            isDark: isDark,
                          ),
                          _buildKpiCard(
                            title: 'Total Orders',
                            value: '${hq.totalGroupOrders}',
                            icon: Icons.receipt,
                            color: AppTheme.primary,
                            isDark: isDark,
                          ),
                          _buildKpiCard(
                            title: 'Average Ticket',
                            value: currencyFmt.format(hq.avgGroupTicket),
                            icon: Icons.tune,
                            color: Colors.cyan,
                            isDark: isDark,
                          ),
                          _buildKpiCard(
                            title: 'Digital / UPI Share',
                            value: '72.6%',
                            icon: Icons.qr_code,
                            color: Colors.purple,
                            isDark: isDark,
                          ),
                        ],
                      ),
                      const SizedBox(height: 24),

                      // Branch Leaderboard
                      const Text('Branch Sales Leaderboard', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 12),
                      ...hq.displayedBranches.map((b) => Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: isDark ? AppTheme.surfaceDark : AppTheme.surfaceLight,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: isDark ? AppTheme.borderDark : AppTheme.borderLight),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Expanded(
                                  child: Row(
                                    children: [
                                      Flexible(
                                        child: Text(
                                          b.name,
                                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                      if (b.isMain) ...[
                                        const SizedBox(width: 6),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: AppTheme.primary.withOpacity(0.15),
                                            borderRadius: BorderRadius.circular(4),
                                          ),
                                          child: const Text('HQ', style: TextStyle(fontSize: 10, color: AppTheme.primary, fontWeight: FontWeight.bold)),
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Text(currencyFmt.format(b.revenue), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                              ],
                            ),
                            const SizedBox(height: 8),
                            ClipRRect(
                              borderRadius: BorderRadius.circular(4),
                              child: LinearProgressIndicator(
                                value: (b.sharePercent / 100.0).clamp(0.05, 1.0),
                                minHeight: 6,
                                backgroundColor: Colors.grey.withOpacity(0.2),
                                valueColor: const AlwaysStoppedAnimation(AppTheme.primary),
                              ),
                            ),
                            const SizedBox(height: 6),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Expanded(
                                  child: Text(
                                    '${b.orders} orders • Avg: ₹${b.avgTicket.toStringAsFixed(0)}',
                                    style: const TextStyle(fontSize: 11, color: Colors.grey),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                const SizedBox(width: 6),
                                Text('${b.sharePercent}% share', style: const TextStyle(fontSize: 11, color: Colors.grey)),
                              ],
                            ),
                          ],
                        ),
                      )),
                      const SizedBox(height: 16),

                      // Item Velocity Matrix
                      const Text('Top-Selling Item Velocity', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 12),
                      ...hq.topItems.map((item) => Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: isDark ? AppTheme.surfaceDark : AppTheme.surfaceLight,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: isDark ? AppTheme.borderDark : AppTheme.borderLight),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    item.name,
                                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  Text(
                                    '${item.category} • Top in ${item.topBranch}',
                                    style: const TextStyle(fontSize: 11, color: Colors.grey),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 8),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text('${item.totalQty} sold', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                                Text(currencyFmt.format(item.totalRev), style: const TextStyle(fontSize: 11, color: Colors.green, fontWeight: FontWeight.w600)),
                              ],
                            ),
                          ],
                        ),
                      )),
                    ],
                  ),
                ),
              ),

              // ── TAB 2: CLOSURES & TAX AUDITS ──
              SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text('Daily Shift Closures & Variances', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 12),
                    _buildClosureCard(
                      date: '2026-10-12',
                      branch: 'Connaught Place (Main Outlet)',
                      opening: 5000,
                      cashSales: 28400,
                      digitalSales: 62100,
                      actual: 33400,
                      variance: 0,
                      closedBy: 'Rajesh Kumar (Manager)',
                      isDark: isDark,
                      currencyFmt: currencyFmt,
                    ),
                    _buildClosureCard(
                      date: '2026-10-11',
                      branch: 'Gurugram CyberHub (Franchise)',
                      opening: 5000,
                      cashSales: 18200,
                      digitalSales: 51200,
                      actual: 23050,
                      variance: -150,
                      closedBy: 'Ananya Roy (Cashier)',
                      isDark: isDark,
                      currencyFmt: currencyFmt,
                    ),
                    const SizedBox(height: 20),
                    const Text('GST & Tax Breakdown', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 10),
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: isDark ? AppTheme.surfaceDark : AppTheme.surfaceLight,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: isDark ? AppTheme.borderDark : AppTheme.borderLight),
                      ),
                      child: Column(
                        children: [
                          _buildTaxRow('Taxable Turnover', '₹5,00,000.00'),
                          const Divider(height: 16),
                          _buildTaxRow('CGST (2.5%)', '₹12,500.00'),
                          const Divider(height: 16),
                          _buildTaxRow('SGST (2.5%)', '₹12,500.00'),
                          const Divider(height: 16),
                          _buildTaxRow('Total Tax Collected', '₹25,000.00', isBold: true),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              // ── TAB 3: CATALOG & PRICE OVERRIDES ──
              SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text('Store Pricing & 86 Availability', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                    const Text('Adjust local prices or toggle out-of-stock dishes for this outlet.', style: TextStyle(fontSize: 12, color: Colors.grey)),
                    const SizedBox(height: 16),
                    ...hq.catalogItems.map((item) {
                      final isAvailable = item['isAvailable'] as bool? ?? true;
                      final basePrice = (item['basePrice'] as num? ?? 100.0).toDouble();
                      final overridePrice = (item['overridePrice'] as num?)?.toDouble();

                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: isDark ? AppTheme.surfaceDark : AppTheme.surfaceLight,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: isDark ? AppTheme.borderDark : AppTheme.borderLight),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    item['name'] as String? ?? 'Item',
                                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  const SizedBox(height: 2),
                                  Text('Base Price: ₹${basePrice.toStringAsFixed(0)}', style: const TextStyle(fontSize: 12, color: Colors.grey)),
                                  if (overridePrice != null)
                                    Text(
                                      'Branch Price: ₹${overridePrice.toStringAsFixed(0)} (Overridden)',
                                      style: const TextStyle(fontSize: 12, color: AppTheme.primary, fontWeight: FontWeight.bold),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 8),
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                IconButton(
                                  icon: const Icon(Icons.edit, size: 18),
                                  tooltip: 'Edit Price',
                                  onPressed: () => _showEditPriceDialog(context, hq, item),
                                ),
                                TextButton(
                                  onPressed: () => hq.saveCatalogOverride(item['id'] as String, overridePrice, !isAvailable),
                                  style: TextButton.styleFrom(
                                    backgroundColor: isAvailable ? Colors.green.withOpacity(0.15) : Colors.red.withOpacity(0.15),
                                    foregroundColor: isAvailable ? Colors.green : Colors.red,
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                  ),
                                  child: Text(isAvailable ? 'In Stock' : "86'd", style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                                ),
                              ],
                            ),
                          ],
                        ),
                      );
                    }),
                  ],
                ),
              ),

              // ── TAB 4: STOCK TRANSFERS ──
              SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Expanded(
                          child: Text(
                            'Inter-Branch Stock Transfers',
                            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 8),
                        ElevatedButton.icon(
                          onPressed: () => _showRequestTransferDialog(context, hq),
                          icon: const Icon(Icons.add, size: 16),
                          label: const Text('Request', style: TextStyle(fontSize: 12)),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppTheme.primary,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    ...hq.transfers.map((t) => Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: isDark ? AppTheme.surfaceDark : AppTheme.surfaceLight,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: isDark ? AppTheme.borderDark : AppTheme.borderLight),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Expanded(
                                child: Text(
                                  t.item,
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(
                                  color: t.status == 'received'
                                      ? Colors.green.withOpacity(0.15)
                                      : t.status == 'dispatched'
                                          ? Colors.cyan.withOpacity(0.15)
                                          : Colors.amber.withOpacity(0.15),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  t.status.toUpperCase(),
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                    color: t.status == 'received' ? Colors.green : t.status == 'dispatched' ? Colors.cyan : Colors.amber,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'From ${t.source} ➔ ${t.dest}',
                            style: const TextStyle(fontSize: 12, color: Colors.grey),
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 6),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text('Quantity: ${t.qty} ${t.unit}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                              if (t.status == 'pending')
                                TextButton(
                                  onPressed: () => hq.updateTransferStatus(t.id, 'dispatched'),
                                  child: const Text('Dispatch', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                                ),
                              if (t.status == 'dispatched')
                                TextButton(
                                  onPressed: () => hq.updateTransferStatus(t.id, 'received'),
                                  style: TextButton.styleFrom(foregroundColor: Colors.green),
                                  child: const Text('Mark Received', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                                ),
                            ],
                          ),
                        ],
                      ),
                    )),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildKpiCard({
    required String title,
    required String value,
    required IconData icon,
    required Color color,
    required bool isDark,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: isDark ? AppTheme.surfaceDark : AppTheme.surfaceLight,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isDark ? AppTheme.borderDark : AppTheme.borderLight),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(fontSize: 11, color: Colors.grey, fontWeight: FontWeight.w600),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Icon(icon, color: color, size: 16),
            ],
          ),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(value, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  Widget _buildClosureCard({
    required String date,
    required String branch,
    required double opening,
    required double cashSales,
    required double digitalSales,
    required double actual,
    required double variance,
    required String closedBy,
    required bool isDark,
    required NumberFormat currencyFmt,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? AppTheme.surfaceDark : AppTheme.surfaceLight,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: isDark ? AppTheme.borderDark : AppTheme.borderLight),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  branch,
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: variance == 0 ? Colors.green.withOpacity(0.15) : Colors.red.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  variance == 0 ? 'Exact ₹0' : '₹${variance.toStringAsFixed(0)} Short',
                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: variance == 0 ? Colors.green : Colors.red),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'Cash Sales: ${currencyFmt.format(cashSales)} • Digital: ${currencyFmt.format(digitalSales)}',
            style: const TextStyle(fontSize: 11, color: Colors.grey),
            overflow: TextOverflow.ellipsis,
          ),
          Text(
            'Actual Counted: ${currencyFmt.format(actual)} • Closed by $closedBy',
            style: const TextStyle(fontSize: 11, color: Colors.grey),
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  Widget _buildTaxRow(String label, String value, {bool isBold = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Expanded(
          child: Text(
            label,
            style: TextStyle(fontSize: 12, fontWeight: isBold ? FontWeight.bold : FontWeight.normal),
            overflow: TextOverflow.ellipsis,
          ),
        ),
        Text(value, style: TextStyle(fontSize: 12, fontWeight: isBold ? FontWeight.bold : FontWeight.w600)),
      ],
    );
  }

  void _showEditPriceDialog(BuildContext context, CloudHqProvider hq, Map<String, dynamic> item) {
    final controller = TextEditingController(text: item['overridePrice']?.toString() ?? '');
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: Text('Override Price for ${item['name']}'),
        content: TextField(
          controller: controller,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(labelText: 'Custom Branch Price (₹)'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              final val = double.tryParse(controller.text);
              hq.saveCatalogOverride(item['id'] as String, val, item['isAvailable'] as bool?);
              Navigator.pop(context);
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  void _showRequestTransferDialog(BuildContext context, CloudHqProvider hq) {
    final itemController = TextEditingController();
    final qtyController = TextEditingController(text: '10');
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Request Stock Transfer'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: itemController, decoration: const InputDecoration(labelText: 'Raw Material / Ingredient')),
            TextField(controller: qtyController, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Quantity')),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              if (itemController.text.isNotEmpty) {
                hq.requestTransfer(item: itemController.text, qty: double.tryParse(qtyController.text) ?? 10.0);
              }
              Navigator.pop(context);
            },
            child: const Text('Submit'),
          ),
        ],
      ),
    );
  }
}
