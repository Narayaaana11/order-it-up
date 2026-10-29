import 'package:flutter/material.dart';
import '../models/ingredient_model.dart';
import '../services/api_service.dart';

class InventoryProvider extends ChangeNotifier {
  final ApiService apiService;

  List<IngredientModel> _ingredients = [];
  bool _lowStockOnly = false;
  String _searchQuery = '';
  bool _isLoading = false;

  InventoryProvider({required this.apiService});

  List<IngredientModel> get ingredients => _ingredients;
  bool get lowStockOnly => _lowStockOnly;
  String get searchQuery => _searchQuery;
  bool get isLoading => _isLoading;

  int get lowStockCount => _ingredients.where((i) => i.isLowStock).length;

  List<IngredientModel> get filteredIngredients {
    return _ingredients.where((i) {
      final matchesSearch = _searchQuery.isEmpty ||
          i.name.toLowerCase().contains(_searchQuery.toLowerCase());
      final matchesLowStock = !_lowStockOnly || i.isLowStock;
      return matchesSearch && matchesLowStock;
    }).toList();
  }

  Future<void> loadIngredients() async {
    _isLoading = true;
    notifyListeners();

    try {
      _ingredients = await apiService.getIngredients();
    } catch (_) {}

    _isLoading = false;
    notifyListeners();
  }

  void setSearchQuery(String query) {
    _searchQuery = query;
    notifyListeners();
  }

  void toggleLowStockFilter() {
    _lowStockOnly = !_lowStockOnly;
    notifyListeners();
  }

  Future<void> adjustStock(String id, double delta) async {
    await apiService.updateIngredientStock(id, delta);
    await loadIngredients();
  }
}
