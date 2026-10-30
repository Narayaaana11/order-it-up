import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../core/theme/app_theme.dart';
import '../../core/responsive/responsive_layout.dart';
import '../../providers/menu_provider.dart';
import '../../models/product_model.dart';

class ProductsScreen extends StatefulWidget {
  const ProductsScreen({Key? key}) : super(key: key);

  @override
  State<ProductsScreen> createState() => _ProductsScreenState();
}

class _ProductsScreenState extends State<ProductsScreen> {
  final TextEditingController _searchController = TextEditingController();
  String _selectedCategory = 'all';
  final NumberFormat _currencyFmt =
      NumberFormat.currency(symbol: '₹', decimalDigits: 2);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<MenuProvider>(context, listen: false).loadMenu();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final menu = Provider.of<MenuProvider>(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final categories = menu.categories;
    final query = _searchController.text.trim().toLowerCase();

    final filteredProducts = menu.products.where((p) {
      final matchesQuery =
          query.isEmpty || p.name.toLowerCase().contains(query);
      final matchesCategory =
          _selectedCategory == 'all' || p.categoryId == _selectedCategory;
      return matchesQuery && matchesCategory;
    }).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Products & Menu Catalog'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => menu.loadMenu(),
          ),
        ],
      ),
      body: menu.isLoading
          ? const Center(child: CircularProgressIndicator())
          : Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 1200),
                child: Column(
                  children: [
                    // Search & Category Bar
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        children: [
                          TextField(
                            controller: _searchController,
                            onChanged: (_) => setState(() {}),
                            decoration: InputDecoration(
                              hintText: 'Search products by name...',
                              prefixIcon: const Icon(Icons.search, size: 20),
                              suffixIcon: _searchController.text.isNotEmpty
                                  ? IconButton(
                                      icon: const Icon(Icons.clear, size: 18),
                                      onPressed: () {
                                        _searchController.clear();
                                        setState(() {});
                                      },
                                    )
                                  : null,
                              contentPadding: const EdgeInsets.symmetric(
                                  vertical: 10, horizontal: 16),
                            ),
                          ),
                          const SizedBox(height: 12),
                          SingleChildScrollView(
                            scrollDirection: Axis.horizontal,
                            child: Row(
                              children: [
                                FilterChip(
                                  label: const Text('All Categories'),
                                  selected: _selectedCategory == 'all',
                                  onSelected: (_) =>
                                      setState(() => _selectedCategory = 'all'),
                                  selectedColor:
                                      AppTheme.primary.withOpacity(0.2),
                                  checkmarkColor: AppTheme.primary,
                                ),
                                const SizedBox(width: 8),
                                ...categories.map((c) => Padding(
                                      padding: const EdgeInsets.only(right: 8),
                                      child: FilterChip(
                                        label: Text(c.name),
                                        selected: _selectedCategory == c.id,
                                        onSelected: (_) => setState(
                                            () => _selectedCategory = c.id),
                                        selectedColor:
                                            AppTheme.primary.withOpacity(0.2),
                                        checkmarkColor: AppTheme.primary,
                                      ),
                                    )),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),

                    // Products List
                    Expanded(
                      child: filteredProducts.isEmpty
                          ? const Center(
                              child: Text('No products found matching filters',
                                  style: TextStyle(color: Colors.grey)))
                          : ListView.builder(
                              padding:
                                  const EdgeInsets.symmetric(horizontal: 16),
                              itemCount: filteredProducts.length,
                              itemBuilder: (context, idx) {
                                final p = filteredProducts[idx];
                                return Container(
                                  margin: const EdgeInsets.only(bottom: 10),
                                  padding: const EdgeInsets.all(14),
                                  decoration: BoxDecoration(
                                    color: isDark
                                        ? AppTheme.surfaceDark
                                        : AppTheme.surfaceLight,
                                    borderRadius: BorderRadius.circular(14),
                                    border: Border.all(
                                        color: isDark
                                            ? AppTheme.borderDark
                                            : AppTheme.borderLight),
                                  ),
                                  child: Row(
                                    mainAxisAlignment:
                                        MainAxisAlignment.spaceBetween,
                                    children: [
                                      // Dietary tag indicator dot
                                      Container(
                                        width: 14,
                                        height: 14,
                                        decoration: BoxDecoration(
                                          border: Border.all(
                                              color: p.isVeg
                                                  ? Colors.green
                                                  : Colors.red,
                                              width: 2),
                                          shape: BoxShape.rectangle,
                                          borderRadius:
                                              BorderRadius.circular(2),
                                        ),
                                        padding: const EdgeInsets.all(2),
                                        child: Container(
                                          decoration: BoxDecoration(
                                            color: p.isVeg
                                                ? Colors.green
                                                : Colors.red,
                                            shape: BoxShape.circle,
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 12),

                                      // Name & details
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              p.name,
                                              style: TextStyle(
                                                fontWeight: FontWeight.bold,
                                                fontSize: 14,
                                                decoration: p.isActive
                                                    ? null
                                                    : TextDecoration
                                                        .lineThrough,
                                              ),
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                            const SizedBox(height: 2),
                                            Text(
                                              '${_currencyFmt.format(p.price)} • ${p.kitchenStation.toUpperCase()}',
                                              style: const TextStyle(
                                                  fontSize: 12,
                                                  color: Colors.grey),
                                            ),
                                          ],
                                        ),
                                      ),
                                      const SizedBox(width: 8),

                                      // Availability 86 toggle button
                                      TextButton(
                                        onPressed: () {
                                          menu.toggleProductAvailability(p.id);
                                        },
                                        style: TextButton.styleFrom(
                                          backgroundColor: p.isActive
                                              ? Colors.green.withOpacity(0.12)
                                              : Colors.red.withOpacity(0.12),
                                          foregroundColor: p.isActive
                                              ? Colors.green
                                              : Colors.red,
                                          padding: const EdgeInsets.symmetric(
                                              horizontal: 10, vertical: 6),
                                        ),
                                        child: Text(
                                          p.isActive ? 'In Stock' : "86'd",
                                          style: const TextStyle(
                                              fontSize: 12,
                                              fontWeight: FontWeight.bold),
                                        ),
                                      ),
                                    ],
                                  ),
                                );
                              },
                            ),
                    ),
                  ],
                ),
              ),
            ),
    );
  }
}
