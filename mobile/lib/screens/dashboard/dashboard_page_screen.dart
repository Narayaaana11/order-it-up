import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../core/theme/app_theme.dart';
import '../closures/shift_closure_screen.dart';

class DashboardPageScreen extends StatelessWidget {
  const DashboardPageScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final currencyFmt = NumberFormat.currency(symbol: '₹', decimalDigits: 2);

    return Scaffold(
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Shift Actions Header
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Store Dashboard',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    Text(
                      'Today: ${DateFormat('dd MMM yyyy').format(DateTime.now())}',
                      style: TextStyle(
                        fontSize: 12,
                        color: isDark ? AppTheme.textMutedDark : AppTheme.textMutedLight,
                      ),
                    ),
                  ],
                ),
                ElevatedButton.icon(
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const ShiftClosureScreen()),
                    );
                  },
                  icon: const Icon(Icons.point_of_sale, size: 16),
                  label: const Text('Cash Close & Z-Report', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 16),

            // 4 KPI Cards Grid
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisSpacing: 10,
              mainAxisSpacing: 10,
              childAspectRatio: 1.4,
              children: [
                _buildKpiCard(
                  title: "Today's Gross Sales",
                  value: currencyFmt.format(48250.00),
                  icon: Icons.payments_outlined,
                  color: Colors.green,
                  isDark: isDark,
                ),
                _buildKpiCard(
                  title: 'Active Orders',
                  value: '8 Running',
                  icon: Icons.receipt_long,
                  color: AppTheme.primary,
                  isDark: isDark,
                ),
                _buildKpiCard(
                  title: 'Occupied Tables',
                  value: '6 / 12 Tables',
                  icon: Icons.table_restaurant,
                  color: Colors.blue,
                  isDark: isDark,
                ),
                _buildKpiCard(
                  title: 'Avg Table Turn',
                  value: '34 Mins',
                  icon: Icons.timer_outlined,
                  color: Colors.amber,
                  isDark: isDark,
                ),
              ],
            ),

            const SizedBox(height: 16),

            // Payment Methods Breakdown
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: isDark ? AppTheme.cardDark : Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: isDark ? AppTheme.borderDark : AppTheme.borderLight,
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Payment Breakdown',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 12),
                  _buildPaymentRow('UPI / Dynamic QR', '₹26,400.00', '54.7%', Colors.purple, isDark),
                  const SizedBox(height: 8),
                  _buildPaymentRow('Cash Drawer', '₹16,350.00', '33.9%', Colors.green, isDark),
                  const SizedBox(height: 8),
                  _buildPaymentRow('Credit / Debit Cards', '₹5,500.00', '11.4%', Colors.blue, isDark),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // Top Selling Menu Items
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: isDark ? AppTheme.cardDark : Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: isDark ? AppTheme.borderDark : AppTheme.borderLight,
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Top Selling Items Today',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 10),
                  _buildTopItem('Chicken Dum Biryani', '42 orders', '₹15,960.00', isDark),
                  const Divider(height: 12),
                  _buildTopItem('Paneer Butter Masala', '28 orders', '₹8,400.00', isDark),
                  const Divider(height: 12),
                  _buildTopItem('Butter Naan', '64 orders', '₹3,840.00', isDark),
                  const Divider(height: 12),
                  _buildTopItem('Masala Chai', '55 orders', '₹2,200.00', isDark),
                ],
              ),
            ),
          ],
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
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isDark ? AppTheme.cardDark : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDark ? AppTheme.borderDark : AppTheme.borderLight,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 4,
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
              Flexible(
                child: Text(
                  title,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: isDark ? AppTheme.textMutedDark : AppTheme.textMutedLight,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Icon(icon, size: 18, color: color),
            ],
          ),
          Text(
            value,
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentRow(String label, String amount, String pct, Color color, bool isDark) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Row(
          children: [
            Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
            const SizedBox(width: 8),
            Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500)),
          ],
        ),
        Row(
          children: [
            Text(pct, style: TextStyle(fontSize: 11, color: isDark ? AppTheme.textMutedDark : AppTheme.textMutedLight)),
            const SizedBox(width: 8),
            Text(amount, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
          ],
        ),
      ],
    );
  }

  Widget _buildTopItem(String name, String orders, String revenue, bool isDark) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
            Text(orders, style: TextStyle(fontSize: 11, color: isDark ? AppTheme.textMutedDark : AppTheme.textMutedLight)),
          ],
        ),
        Text(revenue, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppTheme.primary)),
      ],
    );
  }
}
