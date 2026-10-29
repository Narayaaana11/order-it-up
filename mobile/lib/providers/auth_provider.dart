import 'package:flutter/material.dart';
import '../models/user_model.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';
import '../services/mock_data_service.dart';

class AuthProvider extends ChangeNotifier {
  final ApiService apiService;
  final StorageService storageService;

  UserModel? _currentUser;
  bool _isLoading = false;
  String? _errorMessage;

  AuthProvider({
    required this.apiService,
    required this.storageService,
  }) {
    // Check if token exists or restore demo user
    final token = storageService.getAuthToken();
    if (token != null) {
      if (storageService.isDemoMode()) {
        _currentUser = MockDataService.mockWaiterUser;
      }
    }
  }

  UserModel? get currentUser => _currentUser;
  bool get isAuthenticated => _currentUser != null;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  Future<bool> login(String email, String password) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final user = await apiService.login(email: email, password: password);
      _currentUser = user;
      await storageService.setAuthToken(user.token);
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _isLoading = false;
      _errorMessage = e.toString().replaceAll('ApiException: ', '');
      notifyListeners();
      return false;
    }
  }

  void quickLoginDemoRole(String role) {
    switch (role) {
      case 'cashier':
        _currentUser = MockDataService.mockCashierUser;
        break;
      case 'chef':
        _currentUser = MockDataService.mockChefUser;
        break;
      case 'manager':
      case 'owner':
        _currentUser = MockDataService.mockManagerUser;
        break;
      case 'server':
      default:
        _currentUser = MockDataService.mockWaiterUser;
        break;
    }
    storageService.setAuthToken(_currentUser!.token);
    notifyListeners();
  }

  Future<void> logout() async {
    _currentUser = null;
    await storageService.setAuthToken(null);
    notifyListeners();
  }
}
