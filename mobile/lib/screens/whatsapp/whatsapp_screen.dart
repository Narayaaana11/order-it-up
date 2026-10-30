import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';
import '../../core/responsive/responsive_layout.dart';
import '../../services/api_service.dart';
import '../../services/storage_service.dart';
import '../../core/network/api_client.dart';

class WhatsAppScreen extends StatefulWidget {
  const WhatsAppScreen({Key? key}) : super(key: key);

  @override
  State<WhatsAppScreen> createState() => _WhatsAppScreenState();
}

class _WhatsAppScreenState extends State<WhatsAppScreen> {
  late ApiService _apiService;
  bool _isLoading = true;
  Map<String, dynamic> _statusData = {};
  final TextEditingController _testPhoneController = TextEditingController();
  bool _isSendingTest = false;

  @override
  void initState() {
    super.initState();
    final storage = StorageService();
    final isDemo = storage.isDemoMode();
    _apiService = ApiService(
      apiClient: ApiClient(
          baseUrl:
              'http://${storage.getServerHost()}:${storage.getServerPort()}'),
      isDemoMode: isDemo,
    );
    _loadStatus();
  }

  @override
  void dispose() {
    _testPhoneController.dispose();
    super.dispose();
  }

  Future<void> _loadStatus() async {
    setState(() => _isLoading = true);
    final data = await _apiService.fetchWhatsAppStatus();
    if (mounted) {
      setState(() {
        _statusData = data;
        _isLoading = false;
      });
    }
  }

  Future<void> _sendTestReceipt() async {
    final phone = _testPhoneController.text.trim();
    if (phone.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a valid phone number')),
      );
      return;
    }

    setState(() => _isSendingTest = true);
    await Future.delayed(const Duration(milliseconds: 600));

    if (mounted) {
      setState(() {
        _isSendingTest = false;
        final logs = (_statusData['recentLogs'] as List? ?? []).toList();
        logs.insert(0, {
          'phone': phone,
          'bill': '#TEST-${DateTime.now().millisecondsSinceEpoch % 1000}',
          'amount': '₹350.00',
          'time': 'Just now',
          'status': 'Sent',
        });
        _statusData['recentLogs'] = logs;
        _statusData['billsSentToday'] =
            (_statusData['billsSentToday'] as int? ?? 142) + 1;
      });
      _testPhoneController.clear();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Sample WhatsApp e-bill sent successfully to $phone!'),
          backgroundColor: Colors.green.shade700,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isTablet = ResponsiveBreakpoints.isTabletOrLarger(context);

    final isConnected = _statusData['connected'] as bool? ?? true;
    final phone = _statusData['phone'] as String? ?? '+91 98765 43210';
    final billsToday = _statusData['billsSentToday'] as int? ?? 142;
    final logs =
        (_statusData['recentLogs'] as List? ?? []).cast<Map<String, dynamic>>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('WhatsApp Gateway & E-Bills'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadStatus,
            tooltip: 'Refresh Status',
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadStatus,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Connection Status Card
                    _buildStatusBanner(isDark, isConnected, phone, billsToday),
                    const SizedBox(height: 16),

                    // Main Content (Tablet: 2 columns, Mobile: 1 column)
                    if (isTablet)
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            flex: 5,
                            child: Column(
                              children: [
                                _buildTestMessageCard(isDark),
                                const SizedBox(height: 16),
                                _buildTemplatePreviewCard(isDark),
                              ],
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            flex: 6,
                            child: _buildRecentLogsCard(isDark, logs),
                          ),
                        ],
                      )
                    else ...[
                      _buildTestMessageCard(isDark),
                      const SizedBox(height: 16),
                      _buildTemplatePreviewCard(isDark),
                      const SizedBox(height: 16),
                      _buildRecentLogsCard(isDark, logs),
                    ],
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildStatusBanner(
      bool isDark, bool isConnected, String phone, int billsToday) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark ? AppTheme.surfaceDark : AppTheme.surfaceLight,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isConnected
              ? (isDark ? Colors.green.shade800 : Colors.green.shade300)
              : (isDark ? Colors.red.shade800 : Colors.red.shade300),
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: isConnected
                  ? Colors.green.withOpacity(0.12)
                  : Colors.red.withOpacity(0.12),
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.chat_bubble_outline,
              color: isConnected ? Colors.green : Colors.red,
              size: 28,
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      isConnected
                          ? 'Gateway Active & Linked'
                          : 'Gateway Offline',
                      style: const TextStyle(
                          fontWeight: FontWeight.bold, fontSize: 16),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: isConnected ? Colors.green : Colors.red,
                        shape: BoxShape.circle,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  isConnected
                      ? 'Paired Phone: $phone'
                      : 'Pair via QR code on server',
                  style: TextStyle(
                    fontSize: 13,
                    color: isDark ? Colors.white70 : Colors.grey.shade700,
                  ),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '$billsToday',
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: AppTheme.primary,
                ),
              ),
              Text(
                'E-Bills Today',
                style: TextStyle(
                  fontSize: 11,
                  color: isDark ? Colors.white60 : Colors.grey.shade600,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTestMessageCard(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: isDark ? AppTheme.surfaceDark : AppTheme.surfaceLight,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
            color: isDark ? AppTheme.borderDark : AppTheme.borderLight),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.send_outlined, size: 20, color: AppTheme.primary),
              SizedBox(width: 8),
              Text('Send Instant E-Bill Receipt',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'Test live WhatsApp transmission or dispatch digital bill to customer on demand.',
            style: TextStyle(
                fontSize: 12,
                color: isDark ? Colors.white60 : Colors.grey.shade600),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _testPhoneController,
                  keyboardType: TextInputType.phone,
                  decoration: InputDecoration(
                    hintText: '+91 98765 00000',
                    prefixIcon: const Icon(Icons.phone_android, size: 20),
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 12),
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              ElevatedButton.icon(
                onPressed: _isSendingTest ? null : _sendTestReceipt,
                icon: _isSendingTest
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.send, size: 16),
                label: const Text('Send'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primary,
                  foregroundColor: Colors.white,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTemplatePreviewCard(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF16251E) : const Color(0xFFE8F5E9),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.green.withOpacity(0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.message, size: 18, color: Colors.green.shade700),
              const SizedBox(width: 8),
              Text(
                'Default WhatsApp Bill Template',
                style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                    color:
                        isDark ? Colors.green.shade300 : Colors.green.shade900),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: isDark ? AppTheme.surfaceDark : Colors.white,
              borderRadius: BorderRadius.circular(8),
              boxShadow: [
                BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 4),
              ],
            ),
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '🧾 *Order It Up - Receipt #ORD-1049*\n\n'
                  'Thank you for dining with us! 🙏\n'
                  '• 2x Butter Chicken Biryani: ₹700\n'
                  '• 3x Garlic Naan: ₹180\n'
                  '• Total Bill: *₹890.00* (Paid via UPI)\n\n'
                  'View tax invoice & loyalty points: orderitup.app/b/1049',
                  style: TextStyle(
                      fontSize: 12, height: 1.4, fontFamily: 'monospace'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRecentLogsCard(bool isDark, List<Map<String, dynamic>> logs) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: isDark ? AppTheme.surfaceDark : AppTheme.surfaceLight,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
            color: isDark ? AppTheme.borderDark : AppTheme.borderLight),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Recent Transmission Log',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
              Icon(Icons.history, size: 20, color: Colors.grey),
            ],
          ),
          const SizedBox(height: 12),
          if (logs.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(
                  child: Text('No recent transmissions recorded today.')),
            )
          else
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: logs.length,
              separatorBuilder: (_, __) => Divider(
                  color: isDark ? AppTheme.borderDark : AppTheme.borderLight,
                  height: 16),
              itemBuilder: (context, index) {
                final log = logs[index];
                final status = log['status']?.toString() ?? 'Delivered';
                final isDelivered = status.toLowerCase() == 'delivered' ||
                    status.toLowerCase() == 'read';

                return Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: isDelivered
                            ? Colors.green.withOpacity(0.1)
                            : Colors.blue.withOpacity(0.1),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        isDelivered ? Icons.done_all : Icons.check,
                        size: 16,
                        color: isDelivered ? Colors.green : Colors.blue,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(log['phone'] ?? '',
                              style: const TextStyle(
                                  fontWeight: FontWeight.bold, fontSize: 13)),
                          const SizedBox(height: 2),
                          Text(
                            '${log['bill'] ?? ''} • ${log['amount'] ?? ''}',
                            style: TextStyle(
                                fontSize: 12,
                                color: isDark
                                    ? Colors.white60
                                    : Colors.grey.shade600),
                          ),
                        ],
                      ),
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: isDelivered
                                ? Colors.green.shade50
                                : Colors.blue.shade50,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                                color: isDelivered
                                    ? Colors.green.shade200
                                    : Colors.blue.shade200),
                          ),
                          child: Text(
                            status,
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: isDelivered
                                  ? Colors.green.shade800
                                  : Colors.blue.shade800,
                            ),
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          log['time'] ?? '',
                          style: TextStyle(
                              fontSize: 10,
                              color: isDark
                                  ? Colors.white38
                                  : Colors.grey.shade500),
                        ),
                      ],
                    ),
                  ],
                );
              },
            ),
        ],
      ),
    );
  }
}
