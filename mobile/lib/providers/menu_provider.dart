import 'package:flutter/material.dart';
import '../models/category_model.dart';
import '../models/product_model.dart';
import '../services/api_service.dart';

class MenuProvider extends ChangeNotifier {
  final ApiService apiService;

  List<CategoryModel> _categories = [];
  List<ProductModel> _products = [];
  String _selectedCategoryId = 'all';
  String _searchQuery = '';
  bool _vegOnlyFilter = false;
  bool _isLoading = false;

  MenuProvider({required this.apiService});

  List<CategoryModel> get categories => _categories;
  List<ProductModel> get products => _products;
  String get selectedCategoryId => _selectedCategoryId;
  String get searchQuery => _searchQuery;
  bool get vegOnlyFilter => _vegOnlyFilter;
  bool get isLoading => _isLoading;

  List<ProductModel> get filteredProducts {
    return _products.where((product) {
      // Category filter
      final matchesCategory = _selectedCategoryId == 'all' || product.categoryId == _selectedCategoryId;

      // Search query filter
      final matchesSearch = _searchQuery.isEmpty ||
          product.name.toLowerCase().contains(_searchQuery.toLowerCase()) ||
          product.description.toLowerCase().contains(_searchQuery.toLowerCase());

      // Veg filter
      final matchesDiet = !_vegOnlyFilter || product.isVeg;

      return matchesCategory && matchesSearch && matchesDiet;
    }).toList();
  }

  Future<void> loadMenu() async {
    _isLoading = true;
    notifyListeners();

    try {
      final catsFuture = apiService.getCategories();
      final prodsFuture = apiService.getProducts();

      final results = await Future.wait([catsFuture, prodsFuture]);
      _categories = results[0] as List<CategoryModel>;
      _products = results[1] as List<ProductModel>;
    } catch (_) {
      // Retain existing items
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadCategories() => loadMenu();
  Future<void> loadProducts() => loadMenu();

  void selectCategory(String categoryId) {
    _selectedCategoryId = categoryId;
    notifyListeners();
  }

  void setSearchQuery(String query) {
    _searchQuery = query;
    notifyListeners();
  }

  void toggleVegOnly() {
    _vegOnlyFilter = !_vegOnlyFilter;
    notifyListeners();
  }

  void toggleProductAvailability(String productId) {
    apiService.toggleProductAvailability(productId);
    final idx = _products.indexWhere((p) => p.id == productId);
    if (idx >= 0) {
      final p = _products[idx];
      _products[idx] = p.copyWith(isActive: !p.isActive);
      notifyListeners();
    }
  }
}
