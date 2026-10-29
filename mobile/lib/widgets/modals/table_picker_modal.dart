import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';
import '../../models/table_model.dart';

class TablePickerModal extends StatefulWidget {
  final List<TableModel> tables;
  final String? selectedTableId;
  final Function(TableModel table) onTableSelected;

  const TablePickerModal({
    super.key,
    required this.tables,
    this.selectedTableId,
    required this.onTableSelected,
  });

  @override
  State<TablePickerModal> createState() => _TablePickerModalState();
}

class _TablePickerModalState extends State<TablePickerModal> {
  String _filter = 'all'; // 'all', 'available', 'occupied', 'reserved', 'billed'

  List<TableModel> get _filteredTables {
    if (_filter == 'all') return widget.tables;
    if (_filter == 'available') {
      return widget.tables.where((t) => t.status == 'available').toList();
    }
    if (_filter == 'occupied') {
      return widget.tables.where((t) => t.status == 'occupied').toList();
    }
    if (_filter == 'reserved') {
      return widget.tables.where((t) => t.status == 'reserved').toList();
    }
    if (_filter == 'billed') {
      return widget.tables.where((t) => t.status == 'billed').toList();
    }
    return widget.tables;
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      backgroundColor: isDark ? AppTheme.surfaceDark : AppTheme.surfaceLight,
      child: Container(
        width: 600,
        height: 520,
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: AppTheme.primaryLight,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(Icons.table_restaurant, color: AppTheme.primary, size: 20),
                    ),
                    const SizedBox(width: 10),
                    const Text(
                      'Select Dine-In Table',
                      style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
                IconButton(
                  icon: const Icon(Icons.close, size: 20),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),

            const SizedBox(height: 12),

            // Status Filter Chips
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _buildFilterChip('all', 'All Tables (${widget.tables.length})'),
                  const SizedBox(width: 6),
                  _buildFilterChip(
                    'available',
                    'Available (${widget.tables.where((t) => t.status == 'available').length})',
                  ),
                  const SizedBox(width: 6),
                  _buildFilterChip(
                    'occupied',
                    'Occupied (${widget.tables.where((t) => t.status == 'occupied').length})',
                  ),
                  const SizedBox(width: 6),
                  _buildFilterChip(
                    'reserved',
                    'Reserved (${widget.tables.where((t) => t.status == 'reserved').length})',
                  ),
                  const SizedBox(width: 6),
                  _buildFilterChip(
                    'billed',
                    'Billed (${widget.tables.where((t) => t.status == 'billed').length})',
                  ),
                ],
              ),
            ),

            const SizedBox(height: 14),

            // Tables Grid
            Expanded(
              child: _filteredTables.isEmpty
                  ? Center(
                      child: Text(
                        'No tables match this filter',
                        style: TextStyle(
                          color: isDark ? AppTheme.textMutedDark : AppTheme.textMutedLight,
                        ),
                      ),
                    )
                  : GridView.builder(
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 3,
                        mainAxisSpacing: 10,
                        crossAxisSpacing: 10,
                        childAspectRatio: 1.25,
                      ),
                      itemCount: _filteredTables.length,
                      itemBuilder: (context, index) {
                        final table = _filteredTables[index];
                        final isSelected = widget.selectedTableId == table.id;
                        final statusColor = _getTableColor(table.status);

                        return InkWell(
                          onTap: () {
                            widget.onTableSelected(table);
                            Navigator.pop(context);
                          },
                          borderRadius: BorderRadius.circular(12),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 150),
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: isDark ? AppTheme.cardDark : Colors.white,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: isSelected
                                    ? AppTheme.primary
                                    : (isDark ? AppTheme.borderDark : AppTheme.borderLight),
                                width: isSelected ? 2.0 : 1.0,
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
                                    Expanded(
                                      child: Text(
                                        table.name,
                                        style: const TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.bold,
                                        ),
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                    Container(
                                      width: 10,
                                      height: 10,
                                      decoration: BoxDecoration(
                                        color: statusColor,
                                        shape: BoxShape.circle,
                                      ),
                                    ),
                                  ],
                                ),
                                Row(
                                  children: [
                                    Icon(
                                      Icons.person_outline,
                                      size: 13,
                                      color: isDark ? AppTheme.textMutedDark : AppTheme.textMutedLight,
                                    ),
                                    const SizedBox(width: 4),
                                    Text(
                                      '${table.capacity} Pax',
                                      style: TextStyle(
                                        fontSize: 11,
                                        color: isDark ? AppTheme.textMutedDark : AppTheme.textMutedLight,
                                      ),
                                    ),
                                  ],
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
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

  Widget _buildFilterChip(String key, String label) {
    final isSelected = _filter == key;
    return ChoiceChip(
      label: Text(
        label,
        style: TextStyle(
          fontSize: 12,
          fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
          color: isSelected ? Colors.white : null,
        ),
      ),
      selected: isSelected,
      selectedColor: AppTheme.primary,
      onSelected: (_) => setState(() => _filter = key),
    );
  }

  Color _getTableColor(String status) {
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
