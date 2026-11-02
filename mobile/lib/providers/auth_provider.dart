import 'package:flutter/material.dart';
import '../models/user_model.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';
import '../services/mock_data_service.dart';
import '../core/network/api_client.dart';

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
    final token = storageService.getAuthToken();
    if (token != null && token.isNotEmpty) {
      _currentUser = storageService.isDemoMode()
          ? (storageService.getCachedUser() ?? MockDataService.mockWaiterUser)
          : storageService.getCachedUser();
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
      await storageService.cacheUser(user);
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _currentUser = null;
      apiService.apiClient.authToken = null;
      _isLoading = false;
      _errorMessage = e.toString().replaceAll('ApiException: ', '');
      notifyListeners();
      return false;
    }
  }

  Future<bool> quickLoginDemoRole(String role) async {
    if (!apiService.isDemoMode) {
      _errorMessage = 'Demo sign-in is only available in Demo Mode.';
      notifyListeners();
      return false;
    }

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
    try {
      await storageService.setAuthToken(_currentUser!.token);
      await storageService.cacheUser(_currentUser);
    } catch (error) {
      _currentUser = null;
      _errorMessage = error.toString();
      notifyListeners();
      return false;
    }
    _errorMessage = null;
    notifyListeners();
    return true;
  }

  Future<void> logout() async {
    try {
      if (!apiService.isDemoMode && storageService.getAuthToken() != null) {
        await apiService.logout();
      }
    } catch (_) {
      // Clear the local session even when the server cannot be reached.
    } finally {
      _currentUser = null;
      apiService.apiClient.authToken = null;
      await storageService.setAuthToken(null);
      notifyListeners();
    }
  }

  Future<void> restoreSession() async {
    final token = storageService.getAuthToken();
    if (token == null || token.isEmpty) return;
    if (apiService.isDemoMode) {
      _currentUser ??= storageService.getCachedUser() ?? MockDataService.mockWaiterUser;
      notifyListeners();
      return;
    }

    apiService.apiClient.authToken = token;
    final cachedUser = storageService.getCachedUser();
    try {
      final refreshedToken = await apiService.refreshSession();
      await storageService.setAuthToken(refreshedToken);
      final user = await apiService.getCurrentUser();
      _currentUser = user;
      await storageService.setAuthToken(user.token);
      await storageService.cacheUser(user);
    } catch (error) {
      final statusCode = error is ApiException ? error.statusCode : null;
      if (statusCode == 401 || statusCode == 403 || statusCode == 404 ||
          error is SecureSessionStorageException) {
        _currentUser = null;
        apiService.apiClient.authToken = null;
        await storageService.setAuthToken(null);
      } else {
        // Keep cached identity for an offline retry; do not erase a valid session
        // merely because the server is temporarily unreachable.
        _currentUser = cachedUser;
      }
    }
    notifyListeners();
  }
}
