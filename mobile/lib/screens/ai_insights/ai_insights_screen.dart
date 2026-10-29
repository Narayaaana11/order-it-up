import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';
import '../../core/responsive/responsive_layout.dart';
import '../../services/api_service.dart';
import '../../services/storage_service.dart';
import '../../core/network/api_client.dart';

class AiInsightsScreen extends StatefulWidget {
  const AiInsightsScreen({Key? key}) : super(key: key);

  @override
  State<AiInsightsScreen> createState() => _AiInsightsScreenState();
}

class _AiInsightsScreenState extends State<AiInsightsScreen> {
  late ApiService _apiService;
  bool _isLoading = true;
  Map<String, dynamic> _aiData = {};

  @override
  void initState() {
    super.initState();
    final storage = StorageService();
    final isDemo = storage.isDemoMode();
    _apiService = ApiService(
      apiClient: ApiClient(baseUrl: 'http://${storage.getServerHost()}:${storage.getServerPort()}'),
      isDemoMode: isDemo,
    );
    _loadInsights();
  }

  Future<void> _loadInsights() async {
    setState(() => _isLoading = true);
    final data = await _apiService.fetchAiInsights();
    if (mounted) {
      setState(() {
        _aiData = data;
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final prepItems = (_aiData['prepItems'] as List? ?? []).cast<Map<String, dynamic>>();
    final menuMatrix = (_aiData['menuMatrix'] as List? ?? []).cast<Map<String, dynamic>>();
    final peakRush = _aiData['peakRushHour'] as String? ?? '08:30 PM - 10:15 PM';

    return Scaffold(
      appBar: AppBar(
        title: const Text('AI Kitchen Insights'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _loadInsights),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 1200),
                child: RefreshIndicator(
                  onRefresh: _loadInsights,
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // Peak Rush Forecast Banner
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: [Colors.purple.shade900.withOpacity(0.4), AppTheme.primary.withOpacity(0.3)],
                            ),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: AppTheme.primary.withOpacity(0.4)),
                          ),
                          child: Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(10),
                                decoration: BoxDecoration(
                                  color: AppTheme.primary.withOpacity(0.2),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: const Icon(Icons.auto_awesome, color: Colors.amber, size: 24),
                              ),
                              const SizedBox(width: 14),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text('Forecasted Rush Window', style: TextStyle(fontSize: 12, color: Colors.grey, fontWeight: FontWeight.w600)),
                                    const SizedBox(height: 2),
                                    Text(peakRush, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 20),

                        // Section 1: Kitchen Prep Batch Recommendations
                        const Text('Kitchen Prep Recommendations', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                        const Text('AI calculated prep quantities based on historical evening covers.', style: TextStyle(fontSize: 11, color: Colors.grey)),
                        const SizedBox(height: 12),
                        ...prepItems.map((item) {
                          final urgency = item['urgency'] as String? ?? 'NORMAL';
                          final isCritical = urgency == 'CRITICAL';
                          final isHigh = urgency == 'HIGH';

                          return Container(
                            margin: const EdgeInsets.only(bottom: 10),
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
                                        item['item'] as String? ?? 'Item',
                                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                      decoration: BoxDecoration(
                                        color: isCritical
                                            ? Colors.red.withOpacity(0.15)
                                            : isHigh
                                                ? Colors.orange.withOpacity(0.15)
                                                : Colors.green.withOpacity(0.15),
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: Text(
                                        urgency,
                                        style: TextStyle(
                                          color: isCritical ? Colors.red : isHigh ? Colors.orange : Colors.green,
                                          fontSize: 10,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  '${item['station']} • Prep: ${item['batches']} ${item['unit']}',
                                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.primary),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  item['reason'] as String? ?? '',
                                  style: const TextStyle(fontSize: 11, color: Colors.grey),
                                ),
                              ],
                            ),
                          );
                        }),
                        const SizedBox(height: 20),

                        // Section 2: Menu Engineering Matrix
                        const Text('Menu Engineering Matrix', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 12),
                        ...menuMatrix.map((m) => Container(
                          margin: const EdgeInsets.only(bottom: 10),
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: isDark ? AppTheme.surfaceDark : AppTheme.surfaceLight,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: isDark ? AppTheme.borderDark : AppTheme.borderLight),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Expanded(
                                    child: Text(
                                      m['name'] as String? ?? '',
                                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: Colors.cyan.withOpacity(0.15),
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Text(
                                      m['category'] as String? ?? 'Strategy',
                                      style: const TextStyle(color: Colors.cyan, fontSize: 10, fontWeight: FontWeight.bold),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Text(m['advice'] as String? ?? '', style: const TextStyle(fontSize: 12, color: Colors.grey)),
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
}
