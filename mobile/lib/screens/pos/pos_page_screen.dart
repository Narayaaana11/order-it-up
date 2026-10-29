import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/responsive/responsive_layout.dart';
import '../../core/theme/app_theme.dart';
import '../../models/product_model.dart';
import '../../models/table_model.dart';
import '../../providers/customer_provider.dart';
import '../../providers/held_order_provider.dart';
import '../../providers/menu_provider.dart';
import '../../providers/order_provider.dart';
import '../../providers/table_provider.dart';
import '../../widgets/modals/desktop_payment_modal.dart';
import '../../widgets/modals/discount_modal.dart';
import '../../widgets/modals/table_picker_modal.dart';
import '../../widgets/pos/desktop_cart_panel.dart';
import '../../widgets/pos/desktop_product_card.dart';
import '../../widgets/pos/pos_topbar_widget.dart';

class PosPageScreen extends StatefulWidget {
  final VoidCallback? onOpenDrawer;

  const PosPageScreen({super.key, this.onOpenDrawer});

  @override
  State<PosPageScreen> createState() => _PosPageScreenState();
}

class _PosPageScreenState extends State<PosPageScreen> {
  String? _selectedCategory;
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<MenuProvider>().loadMenu();
      context.read<TableProvider>().loadTables();
      context.read<HeldOrderProvider>().loadHeldOrders();
      context.read<CustomerProvider>().loadCustomers();
    });
  }

  List<ProductModel> _getFilteredProducts(List<ProductModel> allProducts) {
    return allProducts.where((p) {
      if (_selectedCategory != null && p.categoryId != _selectedCategory) {
        return false;
      }
      if (_searchQuery.isNotEmpty) {
        final q = _searchQuery.toLowerCase();
        final matchesName = p.name.toLowerCase().contains(q);
        final matchesCode = p.code?.toLowerCase().contains(q) ?? false;
        if (!matchesName && !matchesCode) return false;
      }
      return true;
    }).toList();
  }

  void _showTablePicker(BuildContext context, TableProvider tableProv, OrderProvider orderProv) {
    showDialog(
      context: context,
      builder: (_) => TablePickerModal(
        tables: tableProv.tables,
        selectedTableId: orderProv.selectedTableId,
        onTableSelected: (TableModel table) {
          orderProv.setTable(table.id, table.name);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Selected table: ${table.name}'),
              duration: const Duration(seconds: 1),
            ),
          );
        },
      ),
    );
  }

  void _showDiscountModal(BuildContext context, OrderProvider orderProv) {
    showDialog(
      context: context,
      builder: (_) => DiscountModal(
        subtotal: orderProv.subtotal,
        onApplyDiscount: (amt, pct, isPct) {
          orderProv.applyDiscount(amount: amt, percent: pct, isPercent: isPct);
        },
        onClearDiscount: () => orderProv.clearDiscount(),
      ),
    );
  }

  void _showPaymentModal(BuildContext context, OrderProvider orderProv) {
    if (orderProv.draftLines.isEmpty) return;

    showDialog(
      context: context,
      builder: (_) => DesktopPaymentModal(
        grandTotal: orderProv.grandTotal,
        subtotal: orderProv.subtotal,
        discount: orderProv.discountTotal,
        tax: orderProv.taxTotal,
        orderType: orderProv.orderType,
        tableName: orderProv.selectedTableName,
        customerName: orderProv.customerName,
        customerPhone: orderProv.customerPhone,
        items: orderProv.draftLines,
        onPaymentComplete: (method, tendered, change) {
          final summaryMsg = 'Order settled via ${method.toUpperCase()}! Change: ₹${change.toStringAsFixed(2)}';
          orderProv.clearDraft();
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              backgroundColor: Colors.green.shade700,
              content: Text(summaryMsg),
              duration: const Duration(seconds: 3),
            ),
          );
        },
      ),
    );
  }

  void _holdCurrentCart(BuildContext context, OrderProvider orderProv, HeldOrderProvider heldProv) async {
    if (orderProv.draftLines.isEmpty) return;
    final tableName = orderProv.selectedTableName ?? 'Counter';
    final success = await heldProv.holdCart(
      tableId: orderProv.selectedTableId ?? 'counter',
      tableName: tableName,
      items: orderProv.draftLines,
      customerName: orderProv.customerName,
      customerPhone: orderProv.customerPhone,
      guestCount: orderProv.guestCount,
    );

    if (success && mounted) {
      orderProv.clearDraft();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Order parked for $tableName'),
          backgroundColor: AppTheme.heldOrder,
        ),
      );
    }
  }

  void _showHeldOrdersSheet(BuildContext context, HeldOrderProvider heldProv, OrderProvider orderProv) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Icon(Icons.pause_circle_filled, color: AppTheme.heldOrder),
                    const SizedBox(width: 8),
                    const Text('Parked & Held Orders', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  ],
                ),
                IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(ctx)),
              ],
            ),
            const SizedBox(height: 10),
            Expanded(
              child: heldProv.heldOrders.isEmpty
                  ? const Center(child: Text('No orders are currently parked.'))
                  : ListView.separated(
                      itemCount: heldProv.heldOrders.length,
                      separatorBuilder: (_, __) => const Divider(),
                      itemBuilder: (ctx, idx) {
                        final order = heldProv.heldOrders[idx];
                        return ListTile(
                          title: Text(order.tableName, style: const TextStyle(fontWeight: FontWeight.bold)),
                          subtitle: Text('${order.items.length} items • ${order.guestCount} Pax'),
                          trailing: ElevatedButton(
                            onPressed: () {
                              orderProv.loadCartItems(
                                items: order.items,
                                tableId: order.tableId,
                                tableName: order.tableName,
                                customerName: order.customerName,
                                customerPhone: order.customerPhone,
                                guestCount: order.guestCount,
                                heldOrderId: order.id,
                              );
                              heldProv.recallOrder(order.id);
                              Navigator.pop(ctx);
                            },
                            child: const Text('Recall'),
                          ),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }

  void _showMobileCartDrawer(BuildContext context, OrderProvider orderProv, HeldOrderProvider heldProv) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.88,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        builder: (_, scrollController) => Container(
          decoration: BoxDecoration(
            color: Theme.of(context).scaffoldBackgroundColor,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(
            children: [
              Container(
                margin: const EdgeInsets.symmetric(vertical: 8),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade400,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Expanded(
                child: DesktopCartPanel(
                  isDrawer: true,
                  items: orderProv.draftLines,
                  orderType: orderProv.orderType,
                  guestCount: orderProv.guestCount,
                  onGuestCountChanged: orderProv.setGuestCount,
                  deliveryAddress: orderProv.deliveryAddress,
                  onDeliveryAddressChanged: orderProv.setDeliveryAddress,
                  onQuantityChanged: orderProv.changeQuantity,
                  onRemoveItem: orderProv.removeProduct,
                  onUpdateNote: orderProv.updateLineNote,
                  subtotal: orderProv.subtotal,
                  discount: orderProv.discountTotal,
                  tax: orderProv.taxTotal,
                  grandTotal: orderProv.grandTotal,
                  appliedLoyaltyPoints: orderProv.appliedLoyaltyPoints,
                  onAddDiscount: () => _showDiscountModal(context, orderProv),
                  onHoldOrder: () {
                    Navigator.pop(ctx);
                    _holdCurrentCart(context, orderProv, heldProv);
                  },
                  onSendKot: () async {
                    if (orderProv.selectedTableId != null) {
                      await orderProv.sendDraftOrder(orderProv.selectedTableId!);
                      if (mounted) Navigator.pop(ctx);
                    }
                  },
                  onCheckout: () {
                    Navigator.pop(ctx);
                    _showPaymentModal(context, orderProv);
                  },
                  onClearCart: orderProv.clearDraft,
                  isSubmitting: orderProv.isSubmitting,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isTablet = ResponsiveBreakpoints.isTablet(context) ||
        ResponsiveBreakpoints.isDesktop(context);

    return Consumer5<OrderProvider, MenuProvider, TableProvider, HeldOrderProvider, CustomerProvider>(
      builder: (context, orderProv, menuProv, tableProv, heldProv, custProv, _) {
        final filteredProducts = _getFilteredProducts(menuProv.products);

        return Scaffold(
          body: Column(
            children: [
              // 1. Desktop PosTopbar Controls
              PosTopbarWidget(
                orderType: orderProv.orderType,
                onOrderTypeChanged: orderProv.setOrderType,
                selectedTableName: orderProv.selectedTableName,
                onSelectTable: () => _showTablePicker(context, tableProv, orderProv),
                searchQuery: _searchQuery,
                onSearchChanged: (q) => setState(() => _searchQuery = q),
                onClearSearch: () => setState(() => _searchQuery = ''),
                customerName: orderProv.customerName,
                customerPhone: orderProv.customerPhone,
                loyaltyPoints: 120.0,
                onCustomerTap: () {},
                heldOrdersCount: heldProv.heldOrders.length,
                onHeldOrdersTap: () => _showHeldOrdersSheet(context, heldProv, orderProv),
              ),

              // 2. Main Body: Menu + Pinned Cart (Tablet) OR Floating Cart (Phone)
              Expanded(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Product Menu Section
                    Expanded(
                      flex: 3,
                      child: Column(
                        children: [
                          // Category Scroll Bar
                          Container(
                            height: 48,
                            padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 10),
                            decoration: BoxDecoration(
                              color: isDark ? AppTheme.surfaceDark : AppTheme.surfaceLight,
                              border: Border(
                                bottom: BorderSide(
                                  color: isDark ? AppTheme.borderDark : AppTheme.borderLight,
                                ),
                              ),
                            ),
                            child: ListView(
                              scrollDirection: Axis.horizontal,
                              children: [
                                _buildCategoryPill(
                                  label: 'All Items (${menuProv.products.length})',
                                  isSelected: _selectedCategory == null,
                                  onTap: () => setState(() => _selectedCategory = null),
                                ),
                                ...menuProv.categories.map((cat) {
                                  return _buildCategoryPill(
                                    label: cat.name,
                                    isSelected: _selectedCategory == cat.id,
                                    onTap: () => setState(() => _selectedCategory = cat.id),
                                  );
                                }),
                              ],
                            ),
                          ),

                          // Product Grid
                          Expanded(
                            child: filteredProducts.isEmpty
                                ? Center(
                                    child: Column(
                                      mainAxisAlignment: MainAxisAlignment.center,
                                      children: [
                                        Icon(
                                          Icons.fastfood_outlined,
                                          size: 48,
                                          color: isDark ? AppTheme.textMutedDark : AppTheme.textMutedLight,
                                        ),
                                        const SizedBox(height: 8),
                                        const Text('No dishes match this category or search'),
                                      ],
                                    ),
                                  )
                                : GridView.builder(
                                    padding: const EdgeInsets.all(12),
                                    gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                                      crossAxisCount: isTablet ? 3 : 2,
                                      mainAxisSpacing: 10,
                                      crossAxisSpacing: 10,
                                      childAspectRatio: 0.95,
                                    ),
                                    itemCount: filteredProducts.length,
                                    itemBuilder: (context, index) {
                                      final product = filteredProducts[index];
                                      final cartItem = orderProv.draftLines
                                          .where((l) => l.product.id == product.id)
                                          .firstOrNull;

                                      return DesktopProductCard(
                                        product: product,
                                        cartQuantity: cartItem?.quantity ?? 0,
                                        onTap: () => orderProv.addProduct(product),
                                      );
                                    },
                                  ),
                          ),
                        ],
                      ),
                    ),

                    // Tablet Pinned Cart Panel
                    if (isTablet)
                      Container(
                        width: 360,
                        margin: const EdgeInsets.fromLTRB(0, 10, 10, 10),
                        child: DesktopCartPanel(
                          items: orderProv.draftLines,
                          orderType: orderProv.orderType,
                          guestCount: orderProv.guestCount,
                          onGuestCountChanged: orderProv.setGuestCount,
                          deliveryAddress: orderProv.deliveryAddress,
                          onDeliveryAddressChanged: orderProv.setDeliveryAddress,
                          onQuantityChanged: orderProv.changeQuantity,
                          onRemoveItem: orderProv.removeProduct,
                          onUpdateNote: orderProv.updateLineNote,
                          subtotal: orderProv.subtotal,
                          discount: orderProv.discountTotal,
                          tax: orderProv.taxTotal,
                          grandTotal: orderProv.grandTotal,
                          appliedLoyaltyPoints: orderProv.appliedLoyaltyPoints,
                          onAddDiscount: () => _showDiscountModal(context, orderProv),
                          onHoldOrder: () => _holdCurrentCart(context, orderProv, heldProv),
                          onSendKot: () async {
                            if (orderProv.selectedTableId != null) {
                              await orderProv.sendDraftOrder(orderProv.selectedTableId!);
                            }
                          },
                          onCheckout: () => _showPaymentModal(context, orderProv),
                          onClearCart: orderProv.clearDraft,
                          isSubmitting: orderProv.isSubmitting,
                        ),
                      ),
                  ],
                ),
              ),

              // 3. Floating Bottom Cart Bar on Smartphone
              if (!isTablet && orderProv.totalItemCount > 0)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  decoration: BoxDecoration(
                    color: AppTheme.primary,
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.15),
                        blurRadius: 8,
                        offset: const Offset(0, -2),
                      ),
                    ],
                  ),
                  child: InkWell(
                    onTap: () => _showMobileCartDrawer(context, orderProv, heldProv),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Text(
                                '${orderProv.totalItemCount}',
                                style: const TextStyle(
                                  color: AppTheme.primary,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 13,
                                ),
                              ),
                            ),
                            const SizedBox(width: 10),
                            const Text(
                              'View Current Order',
                              style: TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                                fontSize: 14,
                              ),
                            ),
                          ],
                        ),
                        Row(
                          children: [
                            Text(
                              '₹${orderProv.grandTotal.toStringAsFixed(2)}',
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w900,
                                fontSize: 16,
                              ),
                            ),
                            const SizedBox(width: 4),
                            const Icon(Icons.arrow_forward_ios, color: Colors.white, size: 14),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildCategoryPill({
    required String label,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
          decoration: BoxDecoration(
            color: isSelected ? AppTheme.primary : Colors.grey.withOpacity(0.12),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                color: isSelected ? Colors.white : null,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
