import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_theme.dart';
import '../../models/table_model.dart';
import '../../providers/table_provider.dart';

class TablesPageScreen extends StatefulWidget {
  const TablesPageScreen({super.key});

  @override
  State<TablesPageScreen> createState() => _TablesPageScreenState();
}

class _TablesPageScreenState extends State<TablesPageScreen> {
  String _filter = 'all';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<TableProvider>().loadTables();
    });
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Consumer<TableProvider>(
      builder: (context, tableProv, _) {
        final tables = tableProv.tables.where((t) {
          if (_filter == 'all') return true;
          return t.status == _filter;
        }).toList();

        return Scaffold(
          body: Column(
            children: [
              // Header Filter Chips
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
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      _buildChip('all', 'All (${tableProv.tables.length})'),
                      const SizedBox(width: 6),
                      _buildChip('available', 'Available (${tableProv.availableCount})'),
                      const SizedBox(width: 6),
                      _buildChip('occupied', 'Occupied (${tableProv.occupiedCount})'),
                      const SizedBox(width: 6),
                      _buildChip('reserved', 'Reserved (${tableProv.tables.where((t) => t.status == 'reserved').length})'),
                      const SizedBox(width: 6),
                      _buildChip('billed', 'Billed (${tableProv.tables.where((t) => t.status == 'billed').length})'),
                    ],
                  ),
                ),
              ),

              // Tables Grid
              Expanded(
                child: tables.isEmpty
                    ? const Center(child: Text('No tables in this status.'))
                    : GridView.builder(
                        padding: const EdgeInsets.all(12),
                        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          mainAxisSpacing: 10,
                          crossAxisSpacing: 10,
                          childAspectRatio: 1.25,
                        ),
                        itemCount: tables.length,
                        itemBuilder: (context, index) {
                          final table = tables[index];
                          final isOccupied = table.status == 'occupied';
                          final statusColor = _getStatusColor(table.status);

                          return Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: isDark ? AppTheme.cardDark : Colors.white,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: isOccupied
                                    ? AppTheme.primary
                                    : (isDark ? AppTheme.borderDark : AppTheme.borderLight),
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
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(
                                      table.name,
                                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                                    ),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: statusColor.withOpacity(0.15),
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: Text(
                                        table.status.toUpperCase(),
                                        style: TextStyle(
                                          fontSize: 10,
                                          fontWeight: FontWeight.bold,
                                          color: statusColor,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                Row(
                                  children: [
                                    const Icon(Icons.people_outline, size: 14, color: Colors.grey),
                                    const SizedBox(width: 4),
                                    Text(
                                      '${table.capacity} Pax',
                                      style: const TextStyle(fontSize: 12, color: Colors.grey),
                                    ),
                                  ],
                                ),
                                if (isOccupied)
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      const Row(
                                        children: [
                                          Icon(Icons.timer_outlined, size: 13, color: Colors.amber),
                                          SizedBox(width: 3),
                                          Text('24m', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                                        ],
                                      ),
                                      Text(
                                        '₹${(table.activeOrderTotal ?? 0.0).toStringAsFixed(2)}',
                                        style: const TextStyle(
                                          fontSize: 13,
                                          fontWeight: FontWeight.bold,
                                          color: AppTheme.primary,
                                        ),
                                      ),
                                    ],
                                  )
                                else
                                  const Text(
                                    'Ready for seating',
                                    style: TextStyle(fontSize: 11, color: Colors.green),
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
      },
    );
  }

  Widget _buildChip(String key, String label) {
    final isSelected = _filter == key;
    return ChoiceChip(
      label: Text(label),
      selected: isSelected,
      selectedColor: AppTheme.primary,
      labelStyle: TextStyle(
        fontSize: 12,
        fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
        color: isSelected ? Colors.white : null,
      ),
      onSelected: (_) => setState(() => _filter = key),
    );
  }

  Color _getStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'available':
        return AppTheme.tableAvailable;
      case 'occupied':
        return AppTheme.tableOccupied;
      case 'reserved':
        return AppTheme.tableReserved;
      case 'billed':
        return AppTheme.tableBilled;
      default:
        return Colors.grey;
    }
  }
}
