import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_theme.dart';
import '../../core/constants/app_constants.dart';
import '../../providers/inventory_provider.dart';

class InventoryScreen extends StatefulWidget {
  const InventoryScreen({Key? key}) : super(key: key);

  @override
  State<InventoryScreen> createState() => _InventoryScreenState();
}

class _InventoryScreenState extends State<InventoryScreen> {
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<InventoryProvider>(context, listen: false).loadIngredients();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _showRestockDialog(String id, String name, String unit) {
    final qtyCtrl = TextEditingController(text: '5');
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: Text('Restock $name'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Enter quantity to add to current stock in $unit:'),
            const SizedBox(height: 12),
            TextField(
              controller: qtyCtrl,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              decoration: InputDecoration(suffixText: unit),
            ),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              final qty = double.tryParse(qtyCtrl.text) ?? 0.0;
              if (qty > 0) {
                Provider.of<InventoryProvider>(context, listen: false)
                    .adjustStock(id, qty);
                Navigator.pop(context);
              }
            },
            child: const Text('Add to Stock'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final invProv = Provider.of<InventoryProvider>(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Inventory & Raw Stock'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: invProv.loadIngredients,
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _searchController,
                    onChanged: invProv.setSearchQuery,
                    decoration: const InputDecoration(
                      hintText: 'Search raw ingredients & BOM...',
                      prefixIcon: Icon(Icons.search),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                FilterChip(
                  label: Text('Low Stock (${invProv.lowStockCount})'),
                  selected: invProv.lowStockOnly,
                  selectedColor: AppTheme.danger.withOpacity(0.2),
                  onSelected: (_) => invProv.toggleLowStockFilter(),
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              itemCount: invProv.filteredIngredients.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, index) {
                final item = invProv.filteredIngredients[index];

                return Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: isDark ? AppTheme.surfaceDark : Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: item.isLowStock
                          ? AppTheme.danger.withOpacity(0.4)
                          : (isDark
                              ? AppTheme.borderDark
                              : AppTheme.borderLight),
                      width: item.isLowStock ? 1.5 : 1.0,
                    ),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: (item.isLowStock
                                  ? AppTheme.danger
                                  : const Color(0xFF0EA5E9))
                              .withOpacity(0.12),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Icon(
                          Icons.inventory_2,
                          color: item.isLowStock
                              ? AppTheme.danger
                              : const Color(0xFF0EA5E9),
                          size: 22,
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(item.name,
                                      style: const TextStyle(
                                          fontWeight: FontWeight.w700,
                                          fontSize: 15)),
                                ),
                                if (item.isLowStock)
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: AppTheme.danger.withOpacity(0.15),
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: const Text(
                                      'LOW STOCK',
                                      style: TextStyle(
                                          color: AppTheme.danger,
                                          fontSize: 10,
                                          fontWeight: FontWeight.bold),
                                    ),
                                  ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Current: ${item.currentStock} ${item.unit} • Min threshold: ${item.minimumStock} ${item.unit}',
                              style: TextStyle(
                                fontSize: 12,
                                color: isDark
                                    ? AppTheme.textMutedDark
                                    : AppTheme.textMutedLight,
                              ),
                            ),
                            Text(
                              'Unit Cost: ${AppConstants.defaultCurrency}${item.costPerUnit.toStringAsFixed(0)} / ${item.unit}',
                              style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: AppTheme.primaryDark),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      OutlinedButton.icon(
                        onPressed: () =>
                            _showRestockDialog(item.id, item.name, item.unit),
                        icon: const Icon(Icons.add, size: 14),
                        label: const Text('Restock',
                            style: TextStyle(fontSize: 12)),
                        style: OutlinedButton.styleFrom(
                            minimumSize: const Size(60, 36)),
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
}
