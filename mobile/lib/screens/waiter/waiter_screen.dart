import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_theme.dart';
import '../../core/constants/app_constants.dart';
import '../../core/responsive/responsive_layout.dart';
import '../../models/product_model.dart';
import '../../providers/table_provider.dart';
import '../../providers/menu_provider.dart';
import '../../providers/order_provider.dart';
import '../../widgets/table_grid_card.dart';
import '../../widgets/product_grid_card.dart';
import '../../widgets/order_cart_sheet.dart';
import '../../widgets/item_modifier_dialog.dart';

class WaiterScreen extends StatefulWidget {
  const WaiterScreen({Key? key}) : super(key: key);

  @override
  State<WaiterScreen> createState() => _WaiterScreenState();
}

class _WaiterScreenState extends State<WaiterScreen> with SingleTickerProviderStateMixin {
  late TabController _phoneTabController;
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _phoneTabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _phoneTabController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  void _onProductTap(ProductModel product) {
    final orderProv = Provider.of<OrderProvider>(context, listen: false);
    orderProv.addProduct(product);
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Added 1x ${product.name} to ticket'),
        duration: const Duration(seconds: 1),
        action: SnackBarAction(
          label: 'Undo',
          onPressed: () => orderProv.changeQuantity(product.id, -1),
        ),
      ),
    );
  }

  void _onProductLongPress(ProductModel product) {
    showDialog(
      context: context,
      builder: (_) => ItemModifierDialog(
        product: product,
        onConfirm: (qty, note) {
          final orderProv = Provider.of<OrderProvider>(context, listen: false);
          for (int i = 0; i < qty; i++) {
            orderProv.addProduct(product, note: note);
          }
        },
      ),
    );
  }

  void _openCartBottomSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const SizedBox(
        height: 600,
        child: OrderCartSheet(isBottomSheet: true),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final tableProv = Provider.of<TableProvider>(context);
    final menuProv = Provider.of<MenuProvider>(context);
    final orderProv = Provider.of<OrderProvider>(context);
    final isTablet = ResponsiveBreakpoints.isTabletOrLarger(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (isTablet) {
      // Tablet: Master-Detail 3-Pane Layout
      return Scaffold(
        appBar: AppBar(
          title: const Text('Tableside Order Terminal'),
          actions: [
            IconButton(
              icon: const Icon(Icons.refresh),
              onPressed: () {
                tableProv.loadTables();
                menuProv.loadMenu();
                if (tableProv.selectedTable != null) {
                  orderProv.loadActiveTableOrder(tableProv.selectedTable!.id);
                }
              },
            ),
          ],
        ),
        body: Row(
          children: [
            // Left Pane: Floor Plan / Tables (240dp)
            SizedBox(
              width: 250,
              child: Column(
                children: [
                  // Section chips
                  Container(
                    height: 50,
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: tableProv.sections.length,
                      separatorBuilder: (_, __) => const SizedBox(width: 6),
                      itemBuilder: (context, index) {
                        final sec = tableProv.sections[index];
                        final isSelected = sec == tableProv.selectedSection;
                        return ChoiceChip(
                          label: Text(sec, style: const TextStyle(fontSize: 11)),
                          selected: isSelected,
                          onSelected: (_) => tableProv.selectSection(sec),
                        );
                      },
                    ),
                  ),
                  const Divider(height: 1),
                  Expanded(
                    child: ListView.separated(
                      padding: const EdgeInsets.all(12),
                      itemCount: tableProv.filteredTables.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (context, index) {
                        final table = tableProv.filteredTables[index];
                        return TableGridCard(
                          table: table,
                          isSelected: table.id == tableProv.selectedTable?.id,
                          onTap: () {
                            tableProv.selectTable(table);
                            orderProv.loadActiveTableOrder(table.id);
                          },
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
            const VerticalDivider(thickness: 1, width: 1),

            // Middle Pane: Menu Catalog
            Expanded(
              child: Column(
                children: [
                  // Search & Category Bar
                  Padding(
                    padding: const EdgeInsets.all(12),
                    child: Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _searchController,
                            onChanged: menuProv.setSearchQuery,
                            decoration: const InputDecoration(
                              hintText: 'Search dishes, drinks, appetizers...',
                              prefixIcon: Icon(Icons.search, size: 20),
                              isDense: true,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        FilterChip(
                          avatar: Icon(
                            Icons.eco,
                            size: 16,
                            color: menuProv.vegOnlyFilter ? Colors.white : AppTheme.success,
                          ),
                          label: const Text('Veg Only'),
                          selected: menuProv.vegOnlyFilter,
                          onSelected: (_) => menuProv.toggleVegOnly(),
                        ),
                      ],
                    ),
                  ),
                  // Categories Horizontal Bar
                  Container(
                    height: 44,
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      children: [
                        Padding(
                          padding: const EdgeInsets.only(right: 6),
                          child: ChoiceChip(
                            label: const Text('All Items'),
                            selected: menuProv.selectedCategoryId == 'all',
                            onSelected: (_) => menuProv.selectCategory('all'),
                          ),
                        ),
                        ...menuProv.categories.map((cat) => Padding(
                              padding: const EdgeInsets.only(right: 6),
                              child: ChoiceChip(
                                label: Text(cat.name),
                                selected: menuProv.selectedCategoryId == cat.id,
                                onSelected: (_) => menuProv.selectCategory(cat.id),
                              ),
                            )),
                      ],
                    ),
                  ),
                  const Divider(height: 1),
                  // Products Grid
                  Expanded(
                    child: LayoutBuilder(
                      builder: (context, constraints) {
                        final cols = ResponsiveBreakpoints.getGridColumnCount(constraints.maxWidth, itemMinWidth: 170);
                        return GridView.builder(
                          padding: const EdgeInsets.all(14),
                          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: cols,
                            childAspectRatio: 0.95,
                            crossAxisSpacing: 10,
                            mainAxisSpacing: 10,
                          ),
                          itemCount: menuProv.filteredProducts.length,
                          itemBuilder: (context, index) {
                            final prod = menuProv.filteredProducts[index];
                            return ProductGridCard(
                              product: prod,
                              onAdd: () => _onProductTap(prod),
                              onLongPress: () => _onProductLongPress(prod),
                            );
                          },
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
            const VerticalDivider(thickness: 1, width: 1),

            // Right Pane: Pinned Live Ticket (350dp)
            const SizedBox(
              width: 350,
              child: OrderCartSheet(isBottomSheet: false),
            ),
          ],
        ),
      );
    }

    // Phone Layout: 2 Tabs (Floor Map & Menu) + Floating Cart Bar
    return Scaffold(
      appBar: AppBar(
        title: const Text('Tableside POS'),
        bottom: TabBar(
          controller: _phoneTabController,
          labelColor: AppTheme.primary,
          indicatorColor: AppTheme.primary,
          tabs: [
            Tab(
              icon: const Icon(Icons.table_restaurant, size: 18),
              text: tableProv.selectedTable != null ? tableProv.selectedTable!.number : 'Tables',
            ),
            const Tab(
              icon: Icon(Icons.menu_book, size: 18),
              text: 'Menu Catalog',
            ),
          ],
        ),
      ),
      body: TabBarView(
        controller: _phoneTabController,
        children: [
          // Tab 1: Tables
          Column(
            children: [
              // Floor Section Selector
              Container(
                height: 48,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: tableProv.sections.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 6),
                  itemBuilder: (context, index) {
                    final sec = tableProv.sections[index];
                    return ChoiceChip(
                      label: Text(sec),
                      selected: sec == tableProv.selectedSection,
                      onSelected: (_) => tableProv.selectSection(sec),
                    );
                  },
                ),
              ),
              Expanded(
                child: GridView.builder(
                  padding: const EdgeInsets.all(12),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    childAspectRatio: 1.3,
                    crossAxisSpacing: 10,
                    mainAxisSpacing: 10,
                  ),
                  itemCount: tableProv.filteredTables.length,
                  itemBuilder: (context, index) {
                    final table = tableProv.filteredTables[index];
                    return TableGridCard(
                      table: table,
                      isSelected: table.id == tableProv.selectedTable?.id,
                      onTap: () {
                        tableProv.selectTable(table);
                        orderProv.loadActiveTableOrder(table.id);
                        _phoneTabController.animateTo(1); // Auto-navigate to Menu
                      },
                    );
                  },
                ),
              ),
            ],
          ),

          // Tab 2: Menu
          Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 10, 12, 6),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _searchController,
                        onChanged: menuProv.setSearchQuery,
                        decoration: const InputDecoration(
                          hintText: 'Search dishes...',
                          prefixIcon: Icon(Icons.search, size: 18),
                          isDense: true,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    FilterChip(
                      label: const Text('Veg'),
                      selected: menuProv.vegOnlyFilter,
                      onSelected: (_) => menuProv.toggleVegOnly(),
                    ),
                  ],
                ),
              ),
              // Category Bar
              Container(
                height: 44,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  children: [
                    ChoiceChip(
                      label: const Text('All'),
                      selected: menuProv.selectedCategoryId == 'all',
                      onSelected: (_) => menuProv.selectCategory('all'),
                    ),
                    ...menuProv.categories.map((cat) => Padding(
                          padding: const EdgeInsets.only(left: 6),
                          child: ChoiceChip(
                            label: Text(cat.name),
                            selected: menuProv.selectedCategoryId == cat.id,
                            onSelected: (_) => menuProv.selectCategory(cat.id),
                          ),
                        )),
                  ],
                ),
              ),
              Expanded(
                child: GridView.builder(
                  padding: const EdgeInsets.fromLTRB(12, 8, 12, 80),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    childAspectRatio: 0.95,
                    crossAxisSpacing: 10,
                    mainAxisSpacing: 10,
                  ),
                  itemCount: menuProv.filteredProducts.length,
                  itemBuilder: (context, index) {
                    final prod = menuProv.filteredProducts[index];
                    return ProductGridCard(
                      product: prod,
                      onAdd: () => _onProductTap(prod),
                      onLongPress: () => _onProductLongPress(prod),
                    );
                  },
                ),
              ),
            ],
          ),
        ],
      ),
      // Sticky Phone Cart Action Bar
      bottomSheet: (orderProv.totalItemCount > 0 || orderProv.currentTableOrder != null)
          ? Container(
              height: 64,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: BoxDecoration(
                color: isDark ? AppTheme.surfaceDark : Colors.white,
                boxShadow: [
                  BoxShadow(color: Colors.black.withOpacity(0.1), blurRadius: 10, offset: const Offset(0, -3)),
                ],
              ),
              child: Row(
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        '${tableProv.selectedTable?.number ?? "Order"} • ${orderProv.totalItemCount} items',
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                      ),
                      Text(
                        '${AppConstants.defaultCurrency}${orderProv.draftTotal.toStringAsFixed(0)}',
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: AppTheme.primaryDark,
                        ),
                      ),
                    ],
                  ),
                  const Spacer(),
                  ElevatedButton.icon(
                    onPressed: _openCartBottomSheet,
                    icon: const Icon(Icons.shopping_bag_outlined, size: 18),
                    label: const Text('View Ticket'),
                  ),
                ],
              ),
            )
          : null,
    );
  }
}
