import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_theme.dart';
import '../../core/constants/app_constants.dart';
import '../../providers/held_order_provider.dart';
import '../../providers/order_provider.dart';
import '../../providers/table_provider.dart';
import '../waiter/waiter_screen.dart';

class HeldOrdersScreen extends StatefulWidget {
  const HeldOrdersScreen({Key? key}) : super(key: key);

  @override
  State<HeldOrdersScreen> createState() => _HeldOrdersScreenState();
}

class _HeldOrdersScreenState extends State<HeldOrdersScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<HeldOrderProvider>(context, listen: false).loadHeldOrders();
    });
  }

  @override
  Widget build(BuildContext context) {
    final heldProv = Provider.of<HeldOrderProvider>(context);
    final orderProv = Provider.of<OrderProvider>(context);
    final tableProv = Provider.of<TableProvider>(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Held Orders (Parked Carts)'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: heldProv.loadHeldOrders,
          ),
        ],
      ),
      body: heldProv.heldOrders.isEmpty
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.pause_circle_outline,
                      size: 54,
                      color:
                          isDark ? AppTheme.borderDark : AppTheme.borderLight),
                  const SizedBox(height: 12),
                  const Text('No held orders! All carts processed.',
                      style: TextStyle(fontWeight: FontWeight.w600)),
                ],
              ),
            )
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: heldProv.heldOrders.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (context, index) {
                final held = heldProv.heldOrders[index];

                return Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: isDark ? AppTheme.surfaceDark : Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                        color: isDark
                            ? AppTheme.borderDark
                            : AppTheme.borderLight),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            held.tableName,
                            style: const TextStyle(
                                fontWeight: FontWeight.w800, fontSize: 16),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: AppTheme.info.withOpacity(0.12),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              'PARKED',
                              style: TextStyle(
                                color: AppTheme.info,
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      if (held.customerName != null)
                        Text(
                          'Guest: ${held.customerName} (${held.customerPhone ?? ""})',
                          style: TextStyle(
                              fontSize: 13,
                              color: isDark
                                  ? AppTheme.textMutedDark
                                  : AppTheme.textMutedLight),
                        ),
                      if (held.orderNotes != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(
                            'Reason: ${held.orderNotes}',
                            style: const TextStyle(
                                fontSize: 12,
                                color: AppTheme.warning,
                                fontStyle: FontStyle.italic),
                          ),
                        ),
                      const Divider(height: 16),
                      ...held.items.map((i) => Padding(
                            padding: const EdgeInsets.symmetric(vertical: 2),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text('${i.quantity}x ${i.product.name}',
                                    style: const TextStyle(fontSize: 13)),
                                Text(
                                    '${AppConstants.defaultCurrency}${i.lineTotal.toStringAsFixed(0)}'),
                              ],
                            ),
                          )),
                      const Divider(height: 16),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Total: ${AppConstants.defaultCurrency}${held.totalAmount.toStringAsFixed(0)}',
                            style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                                color: AppTheme.primaryDark),
                          ),
                          Row(
                            children: [
                              TextButton(
                                onPressed: () => heldProv.removeHeld(held.id),
                                style: TextButton.styleFrom(
                                    foregroundColor: AppTheme.danger),
                                child: const Text('Discard'),
                              ),
                              const SizedBox(width: 8),
                              ElevatedButton.icon(
                                onPressed: () {
                                  // Recall into active order cart
                                  orderProv.clearDraft();
                                  for (final item in held.items) {
                                    for (int i = 0; i < item.quantity; i++) {
                                      orderProv.addProduct(item.product,
                                          note: item.note);
                                    }
                                  }
                                  if (held.customerName != null) {
                                    orderProv.setCustomer(held.customerName!,
                                        held.customerPhone ?? '');
                                  }
                                  // Select table
                                  final match = tableProv.tables
                                      .where((t) => t.id == held.tableId);
                                  if (match.isNotEmpty) {
                                    tableProv.selectTable(match.first);
                                  }
                                  heldProv.removeHeld(held.id);

                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                        builder: (_) => const WaiterScreen()),
                                  );
                                },
                                icon: const Icon(Icons.replay, size: 16),
                                label: const Text('Recall to Cart'),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ],
                  ),
                );
              },
            ),
    );
  }
}
