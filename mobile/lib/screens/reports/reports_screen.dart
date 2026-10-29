import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../core/theme/app_theme.dart';
import '../../core/responsive/responsive_layout.dart';
import '../../services/api_service.dart';
import '../../services/storage_service.dart';
import '../../core/network/api_client.dart';

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({Key? key}) : super(key: key);

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  late ApiService _apiService;
  bool _isLoading = true;
  String _selectedRange = 'Today';
  Map<String, dynamic> _reportData = {};
  final NumberFormat _currencyFmt = NumberFormat.currency(symbol: '₹', decimalDigits: 2);

  @override
  void initState() {
    super.initState();
    final storage = StorageService();
    final isDemo = storage.isDemoMode();
    _apiService = ApiService(
      apiClient: ApiClient(baseUrl: 'http://${storage.getServerHost()}:${storage.getServerPort()}'),
      isDemoMode: isDemo,
    );
    _loadReports();
  }

  Future<void> _loadReports() async {
    setState(() => _isLoading = true);
    final data = await _apiService.fetchReportsSummary();
    if (mounted) {
      setState(() {
        _reportData = data;
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isTablet = ResponsiveBreakpoints.isTabletOrLarger(context);
    final kpiCols = isTablet ? 4 : 2;
    final kpiRatio = isTablet ? 2.2 : 1.45;

    final gross = (_reportData['grossCollected'] as num? ?? 142500.0).toDouble();
    final net = (_reportData['netCollected'] as num? ?? 138200.0).toDouble();
    final refunded = (_reportData['refunded'] as num? ?? 4300.0).toDouble();
    final billCount = _reportData['billCount'] as int? ?? 342;
    final avgTicket = (_reportData['avgOrderValue'] as num? ?? 404.09).toDouble();
    final payMethods = (_reportData['paymentMethods'] as List? ?? []).cast<Map<String, dynamic>>();
    final topProducts = (_reportData['topProducts'] as List? ?? []).cast<Map<String, dynamic>>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Reports & Sales Analytics'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadReports,
            tooltip: 'Refresh Reports',
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 1200),
                child: RefreshIndicator(
                  onRefresh: _loadReports,
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // Quick Date Selector
                        SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          child: Row(
                            children: ['Today', 'Yesterday', 'Last 7 Days', 'This Month'].map((range) {
                              final isSelected = _selectedRange == range;
                              return Padding(
                                padding: const EdgeInsets.only(right: 8),
                                child: FilterChip(
                                  label: Text(range),
                                  selected: isSelected,
                                  onSelected: (_) {
                                    setState(() => _selectedRange = range);
                                    _loadReports();
                                  },
                                  selectedColor: AppTheme.primary.withOpacity(0.2),
                                  checkmarkColor: AppTheme.primary,
                                ),
                              );
                            }).toList(),
                          ),
                        ),
                        const SizedBox(height: 16),

                        // Financial KPI Grid
                        GridView.count(
                          crossAxisCount: kpiCols,
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          crossAxisSpacing: 10,
                          mainAxisSpacing: 10,
                          childAspectRatio: kpiRatio,
                          children: [
                            _buildStatCard('Gross Collected', _currencyFmt.format(gross), Icons.monetization_on, Colors.green, isDark),
                            _buildStatCard('Net Revenue', _currencyFmt.format(net), Icons.trending_up, AppTheme.primary, isDark),
                            _buildStatCard('Bills Count', '$billCount bills', Icons.receipt_long, Colors.blue, isDark),
                            _buildStatCard('Average Ticket', _currencyFmt.format(avgTicket), Icons.tune, Colors.purple, isDark),
                          ],
                        ),
                        const SizedBox(height: 24),

                        // Payment Methods Distribution
                        const Text('Payment Method Breakdown', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 12),
                        Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: isDark ? AppTheme.surfaceDark : AppTheme.surfaceLight,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: isDark ? AppTheme.borderDark : AppTheme.borderLight),
                          ),
                          child: Column(
                            children: payMethods.map((pm) {
                              final method = pm['method'] as String? ?? 'Other';
                              final total = (pm['total'] as num? ?? 0.0).toDouble();
                              final count = pm['count'] as int? ?? 0;
                              final share = gross > 0 ? (total / gross) : 0.0;

                              return Padding(
                                padding: const EdgeInsets.only(bottom: 12),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.stretch,
                                  children: [
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Text('$method ($count bills)', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                                        Text(_currencyFmt.format(total), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                                      ],
                                    ),
                                    const SizedBox(height: 6),
                                    ClipRRect(
                                      borderRadius: BorderRadius.circular(4),
                                      child: LinearProgressIndicator(
                                        value: share.clamp(0.02, 1.0),
                                        minHeight: 6,
                                        backgroundColor: Colors.grey.withOpacity(0.2),
                                        valueColor: AlwaysStoppedAnimation(
                                          method.contains('Cash') ? Colors.green : method.contains('UPI') ? Colors.purple : AppTheme.primary,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              );
                            }).toList(),
                          ),
                        ),
                        const SizedBox(height: 24),

                        // Top Selling Products
                        const Text('Top Performing Products', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 12),
                        ...topProducts.map((p) => Container(
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
                                child: Text(
                                  p['name'] as String? ?? 'Item',
                                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  Text('${p['qty']} sold', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                                  Text(_currencyFmt.format(p['revenue'] ?? 0), style: const TextStyle(fontSize: 11, color: Colors.green, fontWeight: FontWeight.w600)),
                                ],
                              ),
                            ],
                          ),
                        )),
                      ],
                    ),
                  ),
                ),
              ),
            ),
    );
  }

  Widget _buildStatCard(String title, String value, IconData icon, Color color, bool isDark) {
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
                child: Text(title, style: const TextStyle(fontSize: 11, color: Colors.grey, fontWeight: FontWeight.w600), overflow: TextOverflow.ellipsis),
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
}
