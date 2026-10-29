import 'package:flutter/material.dart';
import '../models/customer_model.dart';
import '../services/api_service.dart';

class CustomerProvider extends ChangeNotifier {
  final ApiService apiService;

  List<CustomerModel> _customers = [];
  CustomerModel? _selectedCustomer;
  String _searchQuery = '';
  bool _isLoading = false;

  CustomerProvider({required this.apiService});

  List<CustomerModel> get customers => _customers;
  CustomerModel? get selectedCustomer => _selectedCustomer;
  String get searchQuery => _searchQuery;
  bool get isLoading => _isLoading;

  List<CustomerModel> get filteredCustomers {
    if (_searchQuery.isEmpty) return _customers;
    final q = _searchQuery.toLowerCase();
    return _customers.where((c) {
      return c.name.toLowerCase().contains(q) || c.phone.contains(q);
    }).toList();
  }

  Future<void> loadCustomers() async {
    _isLoading = true;
    notifyListeners();

    try {
      _customers = await apiService.getCustomers();
    } catch (_) {}

    _isLoading = false;
    notifyListeners();
  }

  void setSearchQuery(String query) {
    _searchQuery = query;
    notifyListeners();
  }

  void selectCustomer(CustomerModel? customer) {
    _selectedCustomer = customer;
    notifyListeners();
  }

  Future<CustomerModel?> lookupByPhone(String phone) async {
    return await apiService.lookupCustomerByPhone(phone);
  }

  Future<CustomerModel?> addCustomer({
    required String name,
    required String phone,
    String? email,
  }) async {
    final customer = await apiService.createCustomer(
      name: name,
      phone: phone,
      email: email,
    );
    if (customer != null) {
      await loadCustomers();
      selectCustomer(customer);
    }
    return customer;
  }
}
