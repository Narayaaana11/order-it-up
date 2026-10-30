import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../core/theme/app_theme.dart';
import '../../core/responsive/responsive_layout.dart';
import '../../services/api_service.dart';
import '../../services/storage_service.dart';
import '../../core/network/api_client.dart';

class OnlineOrdersScreen extends StatefulWidget {
  const OnlineOrdersScreen({Key? key}) : super(key: key);

  @override
  State<OnlineOrdersScreen> createState() => _OnlineOrdersScreenState();
}

class _OnlineOrdersScreenState extends State<OnlineOrdersScreen> {
  late ApiService _apiService;
  bool _isLoading = true;
  List<Map<String, dynamic>> _orders = [];
  final NumberFormat _currencyFmt =
      NumberFormat.currency(symbol: '₹', decimalDigits: 2);

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
    _loadOrders();
  }

  Future<void> _loadOrders() async {
    setState(() => _isLoading = true);
    final list = await _apiService.fetchOnlineOrders();
    if (mounted) {
      setState(() {
        _orders = list;
        _isLoading = false;
      });
    }
  }

  Future<void> _updateStatus(
      int orderId, String action, String newStatus) async {
    setState(() {
      final idx = _orders.indexWhere((o) => o['id'] == orderId);
      if (idx >= 0) _orders[idx]['status'] = newStatus;
    });
    await _apiService.updateAggregatorOrderStatus(orderId, action);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Online Orders (Swiggy / Zomato)'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _loadOrders),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 1200),
                child: RefreshIndicator(
                  onRefresh: _loadOrders,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _orders.length,
                    itemBuilder: (context, idx) {
                      final order = _orders[idx];
                      final platform =
                          (order['platform'] as String? ?? 'zomato')
                              .toLowerCase();
                      final isZomato = platform.contains('zomato');
                      final status = order['status'] as String? ?? 'pending';
                      final riderStatus =
                          order['rider_status'] as String? ?? 'assigned';
                      final items = (order['items'] as List? ?? [])
                          .cast<Map<String, dynamic>>();

                      return Container(
                        margin: const EdgeInsets.only(bottom: 14),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: isDark
                              ? AppTheme.surfaceDark
                              : AppTheme.surfaceLight,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: isZomato
                                ? Colors.red.withOpacity(0.3)
                                : Colors.orange.withOpacity(0.3),
                            width: 1.5,
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            // Header: Platform Tag & Order Number
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 8, vertical: 3),
                                      decoration: BoxDecoration(
                                        color: isZomato
                                            ? Colors.red
                                            : Colors.deepOrange,
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: Text(
                                        isZomato ? 'ZOMATO' : 'SWIGGY',
                                        style: const TextStyle(
                                            color: Colors.white,
                                            fontSize: 10,
                                            fontWeight: FontWeight.w900),
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Text(
                                      order['order_number'] as String? ??
                                          '#ORD',
                                      style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 14),
                                    ),
                                  ],
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: status == 'ready'
                                        ? Colors.green.withOpacity(0.15)
                                        : Colors.blue.withOpacity(0.15),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    status.toUpperCase(),
                                    style: TextStyle(
                                      color: status == 'ready'
                                          ? Colors.green
                                          : Colors.blue,
                                      fontSize: 10,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const Divider(height: 18),

                            // Customer & Address
                            Row(
                              children: [
                                const Icon(Icons.person_pin,
                                    size: 16, color: Colors.grey),
                                const SizedBox(width: 6),
                                Expanded(
                                  child: Text(
                                    '${order['customer_name']} • ${order['customer_phone']}',
                                    style: const TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w600),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Row(
                              children: [
                                const Icon(Icons.location_on,
                                    size: 16, color: Colors.grey),
                                const SizedBox(width: 6),
                                Expanded(
                                  child: Text(
                                    order['delivery_address'] as String? ??
                                        'Delivery',
                                    style: const TextStyle(
                                        fontSize: 11, color: Colors.grey),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),

                            // Items List
                            ...items.map((i) => Padding(
                                  padding:
                                      const EdgeInsets.symmetric(vertical: 2),
                                  child: Row(
                                    mainAxisAlignment:
                                        MainAxisAlignment.spaceBetween,
                                    children: [
                                      Expanded(
                                        child: Text(
                                          '${i['qty']}x ${i['name']}',
                                          style: const TextStyle(
                                              fontSize: 13,
                                              fontWeight: FontWeight.w500),
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                      Text(_currencyFmt.format(i['price'] ?? 0),
                                          style: const TextStyle(fontSize: 12)),
                                    ],
                                  ),
                                )),
                            const SizedBox(height: 8),

                            // Rider Status Strip
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: (isDark
                                        ? Colors.black
                                        : Colors.grey.shade100)
                                    .withOpacity(0.5),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Row(
                                children: [
                                  const Icon(Icons.delivery_dining,
                                      size: 18, color: AppTheme.primary),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      '${order['rider_name']} (${riderStatus.toUpperCase().replaceAll('_', ' ')})',
                                      style: const TextStyle(
                                          fontSize: 11,
                                          fontWeight: FontWeight.w600),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                  Text(
                                    _currencyFmt.format(order['total'] ?? 0),
                                    style: const TextStyle(
                                        fontWeight: FontWeight.bold,
                                        fontSize: 14),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 12),

                            // Kitchen Action Buttons
                            Row(
                              mainAxisAlignment: MainAxisAlignment.end,
                              children: [
                                if (status == 'pending')
                                  ElevatedButton.icon(
                                    onPressed: () => _updateStatus(
                                        order['id'] as int,
                                        'accept',
                                        'preparing'),
                                    icon: const Icon(Icons.check, size: 16),
                                    label: const Text('Accept Order'),
                                    style: ElevatedButton.styleFrom(
                                        backgroundColor: AppTheme.primary,
                                        foregroundColor: Colors.white),
                                  ),
                                if (status == 'preparing')
                                  ElevatedButton.icon(
                                    onPressed: () => _updateStatus(
                                        order['id'] as int, 'ready', 'ready'),
                                    icon: const Icon(Icons.soup_kitchen,
                                        size: 16),
                                    label: const Text('Food Ready'),
                                    style: ElevatedButton.styleFrom(
                                        backgroundColor: Colors.green,
                                        foregroundColor: Colors.white),
                                  ),
                                if (status == 'ready')
                                  ElevatedButton.icon(
                                    onPressed: () => _updateStatus(
                                        order['id'] as int,
                                        'dispatch',
                                        'dispatched'),
                                    icon: const Icon(Icons.sports_motorsports,
                                        size: 16),
                                    label: const Text('Hand Over to Rider'),
                                    style: ElevatedButton.styleFrom(
                                        backgroundColor: Colors.blue,
                                        foregroundColor: Colors.white),
                                  ),
                              ],
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
              ),
            ),
    );
  }
}
