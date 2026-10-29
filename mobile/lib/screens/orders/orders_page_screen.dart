import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../core/theme/app_theme.dart';
import '../../models/order_model.dart';
import '../../services/api_service.dart';
import 'package:provider/provider.dart';

class OrdersPageScreen extends StatefulWidget {
  const OrdersPageScreen({super.key});

  @override
  State<OrdersPageScreen> createState() => _OrdersPageScreenState();
}

class _OrdersPageScreenState extends State<OrdersPageScreen> {
  String _typeFilter = 'all'; // 'all', 'dine_in', 'takeaway', 'delivery'
  String _search = '';
  List<OrderModel> _orders = [];
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _fetchOrders();
  }

  Future<void> _fetchOrders() async {
    setState(() => _isLoading = true);
    final apiService = context.read<ApiService>();
    try {
      _orders = await apiService.getAllOrders();
    } catch (_) {}
    if (mounted) setState(() => _isLoading = false);
  }

  List<OrderModel> get _filteredOrders {
    return _orders.where((o) {
      if (_typeFilter != 'all' && o.type.toLowerCase() != _typeFilter) {
        return false;
      }
      if (_search.isNotEmpty) {
        final q = _search.toLowerCase();
        final matchesNum = o.orderNumber.toLowerCase().contains(q);
        final matchesTable = o.tableId?.toLowerCase().contains(q) ?? false;
        final matchesCustomer = o.customerName?.toLowerCase().contains(q) ?? false;
        if (!matchesNum && !matchesTable && !matchesCustomer) return false;
      }
      return true;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final currencyFmt = NumberFormat.currency(symbol: '₹', decimalDigits: 2);

    return Scaffold(
      body: Column(
        children: [
          // Top Search & Filter Bar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: isDark ? AppTheme.surfaceDark : AppTheme.surfaceLight,
              border: Border(
                bottom: BorderSide(
                  color: isDark ? AppTheme.borderDark : AppTheme.borderLight,
                ),
              ),
            ),
            child: Column(
              children: [
                Row(
                  children: [
                    Expanded(
                      child: SizedBox(
                        height: 38,
                        child: TextField(
                          onChanged: (val) => setState(() => _search = val),
                          decoration: InputDecoration(
                            hintText: 'Search order #, table, customer...',
                            prefixIcon: const Icon(Icons.search, size: 18),
                            contentPadding: EdgeInsets.zero,
                            filled: true,
                            fillColor: isDark ? AppTheme.cardDark : Colors.grey.shade100,
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(10),
                              borderSide: BorderSide.none,
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton(
                      icon: const Icon(Icons.refresh),
                      onPressed: _fetchOrders,
                      tooltip: 'Refresh orders',
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      _buildFilterChip('all', 'All Orders'),
                      const SizedBox(width: 6),
                      _buildFilterChip('dine_in', 'Dine-In'),
                      const SizedBox(width: 6),
                      _buildFilterChip('takeaway', 'Takeaway'),
                      const SizedBox(width: 6),
                      _buildFilterChip('delivery', 'Delivery'),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Orders List
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _filteredOrders.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.receipt_long, size: 48, color: Colors.grey.shade400),
                            const SizedBox(height: 8),
                            const Text('No orders found matching this filter.'),
                          ],
                        ),
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.all(12),
                        itemCount: _filteredOrders.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (context, index) {
                          final order = _filteredOrders[index];
                          final isPaid = order.status == 'completed';

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
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Row(
                                      children: [
                                        Text(
                                          '#${order.orderNumber}',
                                          style: const TextStyle(
                                            fontSize: 14,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                        const SizedBox(width: 8),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: AppTheme.primaryLight,
                                            borderRadius: BorderRadius.circular(6),
                                          ),
                                          child: Text(
                                            order.tableId != null ? 'Table ${order.tableId}' : order.type.toUpperCase(),
                                            style: const TextStyle(
                                              fontSize: 11,
                                              fontWeight: FontWeight.bold,
                                              color: AppTheme.primaryDark,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                    Row(
                                      children: [
                                        _buildStatusBadge(order.status),
                                        const SizedBox(width: 6),
                                        _buildPaymentBadge(isPaid),
                                      ],
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  order.items.map((i) => '${i.quantity}x ${i.productName}').join(', '),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: isDark ? AppTheme.textMutedDark : AppTheme.textMutedLight,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(
                                      DateFormat('hh:mm a').format(order.createdAtDateTime),
                                      style: TextStyle(
                                        fontSize: 11,
                                        color: isDark ? AppTheme.textMutedDark : AppTheme.textMutedLight,
                                      ),
                                    ),
                                    Text(
                                      currencyFmt.format(order.totalAmount),
                                      style: const TextStyle(
                                        fontSize: 15,
                                        fontWeight: FontWeight.w900,
                                        color: AppTheme.primary,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String key, String label) {
    final isSelected = _typeFilter == key;
    return ChoiceChip(
      label: Text(label),
      selected: isSelected,
      selectedColor: AppTheme.primary,
      labelStyle: TextStyle(
        fontSize: 12,
        fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
        color: isSelected ? Colors.white : null,
      ),
      onSelected: (_) => setState(() => _typeFilter = key),
    );
  }

  Widget _buildStatusBadge(String status) {
    Color bg = Colors.yellow.shade100;
    Color fg = Colors.yellow.shade900;
    if (status == 'preparing') {
      bg = Colors.blue.shade100;
      fg = Colors.blue.shade900;
    } else if (status == 'ready' || status == 'completed') {
      bg = Colors.green.shade100;
      fg = Colors.green.shade900;
    } else if (status == 'cancelled') {
      bg = Colors.red.shade100;
      fg = Colors.red.shade900;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6)),
      child: Text(
        status.toUpperCase(),
        style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: fg),
      ),
    );
  }

  Widget _buildPaymentBadge(bool isPaid) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: isPaid ? Colors.green.shade100 : Colors.red.shade100,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        isPaid ? 'PAID' : 'UNPAID',
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.bold,
          color: isPaid ? Colors.green.shade900 : Colors.red.shade900,
        ),
      ),
    );
  }
}
