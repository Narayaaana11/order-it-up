import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_theme.dart';
import '../../core/constants/app_constants.dart';
import '../../core/responsive/responsive_layout.dart';
import '../../models/product_model.dart';
import '../../models/order_model.dart';
import '../../models/bill_model.dart';
import '../../providers/menu_provider.dart';
import '../../providers/order_provider.dart';
import '../../providers/customer_provider.dart';
import '../../widgets/product_grid_card.dart';
import '../../widgets/upi_qr_dialog.dart';
import '../../widgets/receipt_preview_dialog.dart';

class QuickPosScreen extends StatefulWidget {
  const QuickPosScreen({Key? key}) : super(key: key);

  @override
  State<QuickPosScreen> createState() => _QuickPosScreenState();
}

class _QuickPosScreenState extends State<QuickPosScreen> {
  final List<DraftLineModel> _cart = [];
  final TextEditingController _searchController = TextEditingController();
  final TextEditingController _customerPhoneController =
      TextEditingController();
  String _customerName = 'Walk-in Guest';
  double _customerLoyalty = 0.0;
  String _orderType = 'takeaway'; // 'takeaway' or 'counter'
  String _paymentMethod = 'cash';

  @override
  void dispose() {
    _searchController.dispose();
    _customerPhoneController.dispose();
    super.dispose();
  }

  double get _cartTotal =>
      _cart.fold<double>(0.0, (sum, i) => sum + i.lineTotal);
  int get _cartCount => _cart.fold<int>(0, (sum, i) => sum + i.quantity);

  void _addToCart(ProductModel product) {
    setState(() {
      final idx =
          _cart.indexWhere((l) => l.product.id == product.id && l.note.isEmpty);
      if (idx >= 0) {
        _cart[idx].quantity += 1;
      } else {
        _cart.add(DraftLineModel(product: product, quantity: 1));
      }
    });
  }

  void _changeQty(String productId, int delta) {
    setState(() {
      final idx = _cart.indexWhere((l) => l.product.id == productId);
      if (idx >= 0) {
        _cart[idx].quantity += delta;
        if (_cart[idx].quantity <= 0) {
          _cart.removeAt(idx);
        }
      }
    });
  }

  Future<void> _onPhoneChanged(String phone) async {
    if (phone.length >= 10) {
      final cust = await Provider.of<CustomerProvider>(context, listen: false)
          .lookupByPhone(phone);
      if (cust != null) {
        setState(() {
          _customerName = cust.name;
          _customerLoyalty = cust.loyaltyPoints;
        });
      }
    }
  }

  void _processPayment() {
    if (_cart.isEmpty) return;

    final dummyOrder = OrderModel(
      id: DateTime.now().millisecondsSinceEpoch % 100000,
      orderNumber: '#CTR-${DateTime.now().millisecondsSinceEpoch % 1000}',
      tableName: _orderType == 'takeaway' ? 'Takeaway' : 'Counter Sale',
      type: _orderType,
      total: _cartTotal,
      customerName: _customerName,
      customerPhone: _customerPhoneController.text.trim(),
      items: _cart
          .map((line) => OrderItemModel(
                id: DateTime.now().millisecondsSinceEpoch % 10000,
                productId: line.product.id,
                productName: line.product.name,
                quantity: line.quantity,
                unitPrice: line.product.price,
                status: 'served',
              ))
          .toList(),
    );

    final bill = BillModel.fromOrder(dummyOrder, paymentMethod: _paymentMethod);

    if (_paymentMethod == 'upi') {
      showDialog(
        context: context,
        builder: (_) => UpiQrDialog(
          amount: bill.totalPayable,
          orderNumber: bill.orderNumber,
          onPaymentConfirmed: () {
            setState(() => _cart.clear());
            showDialog(
                context: context,
                builder: (_) => ReceiptPreviewDialog(bill: bill));
          },
        ),
      );
    } else {
      setState(() => _cart.clear());
      showDialog(
          context: context, builder: (_) => ReceiptPreviewDialog(bill: bill));
    }
  }

  Widget _buildCartSummary(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? AppTheme.surfaceDark : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
            color: isDark ? AppTheme.borderDark : AppTheme.borderLight),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Current Sale',
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'takeaway', label: Text('Takeaway')),
                  ButtonSegment(value: 'counter', label: Text('Counter')),
                ],
                selected: {_orderType},
                onSelectionChanged: (set) =>
                    setState(() => _orderType = set.first),
              ),
            ],
          ),
          const SizedBox(height: 10),

          // Customer phone & loyalty tag
          TextField(
            controller: _customerPhoneController,
            keyboardType: TextInputType.phone,
            onChanged: _onPhoneChanged,
            decoration: InputDecoration(
              hintText: 'Customer Phone (e.g. 9876543210)',
              prefixIcon: const Icon(Icons.phone_outlined, size: 18),
              suffixText: _customerLoyalty > 0
                  ? '🪙 ${_customerLoyalty.toInt()} pts'
                  : null,
              suffixStyle: const TextStyle(
                  color: AppTheme.primaryDark, fontWeight: FontWeight.bold),
              isDense: true,
            ),
          ),
          const Divider(height: 16),

          // Cart lines
          Expanded(
            child: _cart.isEmpty
                ? const Center(
                    child: Text('Tap products to add to counter sale',
                        style: TextStyle(color: AppTheme.neutral)))
                : ListView.separated(
                    itemCount: _cart.length,
                    separatorBuilder: (_, __) => const Divider(height: 8),
                    itemBuilder: (context, index) {
                      final line = _cart[index];
                      return Row(
                        children: [
                          Expanded(
                            child: Text(line.product.name,
                                style: const TextStyle(
                                    fontSize: 13, fontWeight: FontWeight.w600)),
                          ),
                          IconButton(
                            icon: const Icon(Icons.remove, size: 16),
                            onPressed: () => _changeQty(line.product.id, -1),
                            constraints: const BoxConstraints(
                                minWidth: 28, minHeight: 28),
                            padding: EdgeInsets.zero,
                          ),
                          Text('${line.quantity}',
                              style:
                                  const TextStyle(fontWeight: FontWeight.bold)),
                          IconButton(
                            icon: const Icon(Icons.add, size: 16),
                            onPressed: () => _changeQty(line.product.id, 1),
                            constraints: const BoxConstraints(
                                minWidth: 28, minHeight: 28),
                            padding: EdgeInsets.zero,
                          ),
                          const SizedBox(width: 6),
                          Text(
                            '${AppConstants.defaultCurrency}${line.lineTotal.toStringAsFixed(0)}',
                            style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                color: AppTheme.primaryDark),
                          ),
                        ],
                      );
                    },
                  ),
          ),
          const Divider(height: 16),

          // Payment mode pills
          Row(
            children: [
              Expanded(
                child: ChoiceChip(
                  label: const Text('Cash'),
                  selected: _paymentMethod == 'cash',
                  onSelected: (_) => setState(() => _paymentMethod = 'cash'),
                ),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: ChoiceChip(
                  label: const Text('UPI QR'),
                  selected: _paymentMethod == 'upi',
                  onSelected: (_) => setState(() => _paymentMethod = 'upi'),
                ),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: ChoiceChip(
                  label: const Text('Card'),
                  selected: _paymentMethod == 'card',
                  onSelected: (_) => setState(() => _paymentMethod = 'card'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Total & Pay Button
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Total Payable',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
              Text(
                '${AppConstants.defaultCurrency}${_cartTotal.toStringAsFixed(0)}',
                style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w900,
                    color: AppTheme.primaryDark),
              ),
            ],
          ),
          const SizedBox(height: 10),
          SizedBox(
            height: 48,
            child: ElevatedButton.icon(
              onPressed: _cart.isNotEmpty ? _processPayment : null,
              icon: const Icon(Icons.check_circle_outline),
              label: Text(
                  'Pay & Print (${AppConstants.defaultCurrency}${_cartTotal.toStringAsFixed(0)})'),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final menuProv = Provider.of<MenuProvider>(context);
    final isTablet = ResponsiveBreakpoints.isTabletOrLarger(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Counter Quick POS (Direct Sale)'),
      ),
      body: isTablet
          ? Row(
              children: [
                // Catalog (Flex)
                Expanded(
                  flex: 3,
                  child: Column(
                    children: [
                      Padding(
                        padding: const EdgeInsets.all(12),
                        child: TextField(
                          controller: _searchController,
                          onChanged: menuProv.setSearchQuery,
                          decoration: const InputDecoration(
                            hintText: 'Search menu for counter checkout...',
                            prefixIcon: Icon(Icons.search),
                          ),
                        ),
                      ),
                      Expanded(
                        child: GridView.builder(
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          gridDelegate:
                              const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 3,
                            childAspectRatio: 0.95,
                            crossAxisSpacing: 10,
                            mainAxisSpacing: 10,
                          ),
                          itemCount: menuProv.filteredProducts.length,
                          itemBuilder: (context, index) {
                            final p = menuProv.filteredProducts[index];
                            return ProductGridCard(
                                product: p, onAdd: () => _addToCart(p));
                          },
                        ),
                      ),
                    ],
                  ),
                ),
                const VerticalDivider(width: 1),
                // Cart (360dp)
                SizedBox(
                  width: 360,
                  child: _buildCartSummary(isDark),
                ),
              ],
            )
          : Column(
              children: [
                Padding(
                  padding: const EdgeInsets.all(10),
                  child: TextField(
                    controller: _searchController,
                    onChanged: menuProv.setSearchQuery,
                    decoration: const InputDecoration(
                        hintText: 'Search dishes...',
                        prefixIcon: Icon(Icons.search)),
                  ),
                ),
                Expanded(
                  child: GridView.builder(
                    padding: const EdgeInsets.all(10),
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      childAspectRatio: 0.95,
                      crossAxisSpacing: 10,
                      mainAxisSpacing: 10,
                    ),
                    itemCount: menuProv.filteredProducts.length,
                    itemBuilder: (context, index) {
                      final p = menuProv.filteredProducts[index];
                      return ProductGridCard(
                          product: p, onAdd: () => _addToCart(p));
                    },
                  ),
                ),
                // Phone bottom checkout drawer
                Container(
                  height: 180,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: isDark ? AppTheme.surfaceDark : Colors.white,
                    border: Border(
                        top: BorderSide(
                            color: isDark
                                ? AppTheme.borderDark
                                : AppTheme.borderLight)),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('$_cartCount items in cart',
                              style:
                                  const TextStyle(fontWeight: FontWeight.w600)),
                          Text(
                            '${AppConstants.defaultCurrency}${_cartTotal.toStringAsFixed(0)}',
                            style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w800,
                                color: AppTheme.primaryDark),
                          ),
                        ],
                      ),
                      TextField(
                        controller: _customerPhoneController,
                        keyboardType: TextInputType.phone,
                        onChanged: _onPhoneChanged,
                        decoration: const InputDecoration(
                          hintText: 'Customer Phone',
                          isDense: true,
                          prefixIcon: Icon(Icons.phone, size: 16),
                        ),
                      ),
                      SizedBox(
                        width: double.infinity,
                        height: 44,
                        child: ElevatedButton(
                          onPressed: _cart.isNotEmpty ? _processPayment : null,
                          child: const Text('Proceed to Checkout & Print'),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
    );
  }
}
