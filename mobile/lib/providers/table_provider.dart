import 'package:flutter/material.dart';
import '../models/table_model.dart';
import '../services/api_service.dart';

class TableProvider extends ChangeNotifier {
  final ApiService apiService;

  List<TableModel> _tables = [];
  String _selectedSection = 'All';
  TableModel? _selectedTable;
  bool _isLoading = false;

  TableProvider({required this.apiService});

  List<TableModel> get tables => _tables;
  String get selectedSection => _selectedSection;
  TableModel? get selectedTable => _selectedTable;
  bool get isLoading => _isLoading;

  List<String> get sections {
    final list = _tables.map((t) => t.section).toSet().toList();
    list.sort();
    return ['All', ...list];
  }

  List<TableModel> get filteredTables {
    if (_selectedSection == 'All') return _tables;
    return _tables.where((t) => t.section == _selectedSection).toList();
  }

  int get availableCount => _tables.where((t) => t.isAvailable).length;
  int get occupiedCount => _tables.where((t) => t.isOccupied).length;
  int get billedCount => _tables.where((t) => t.isBilled).length;

  Future<void> loadTables() async {
    _isLoading = true;
    notifyListeners();

    try {
      _tables = await apiService.getTables();
      if (_selectedTable != null) {
        final match = _tables.where((t) => t.id == _selectedTable!.id);
        if (match.isNotEmpty) {
          _selectedTable = match.first;
        }
      } else if (_tables.isNotEmpty) {
        _selectedTable = _tables.first;
      }
    } catch (_) {
      // keep current tables
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void selectTable(TableModel table) {
    _selectedTable = table;
    notifyListeners();
  }

  void selectSection(String section) {
    _selectedSection = section;
    notifyListeners();
  }
}
