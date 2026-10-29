import 'package:flutter/material.dart';
import '../services/storage_service.dart';
import '../services/api_service.dart';

class ServerConfigProvider extends ChangeNotifier {
  final StorageService storageService;
  final ApiService apiService;

  String _host = '127.0.0.1';
  int _port = 3003;
  bool _isDemoMode = false;
  bool _isConnected = false;
  bool _isChecking = false;
  String? _errorMessage;

  ServerConfigProvider({
    required this.storageService,
    required this.apiService,
  }) {
    _host = storageService.getServerHost();
    _port = storageService.getServerPort();
    _isDemoMode = storageService.isDemoMode();
    apiService.isDemoMode = _isDemoMode;
  }

  String get host => _host;
  int get port => _port;
  bool get isDemoMode => _isDemoMode;
  bool get isConnected => _isConnected;
  bool get isChecking => _isChecking;
  String? get errorMessage => _errorMessage;

  String get serverUrl => 'http://$_host:$_port';

  Future<void> setHost(String host) async {
    _host = host.trim();
    await storageService.setServerHost(_host);
    apiService.apiClient.updateConfig(baseUrl: serverUrl);
    notifyListeners();
  }

  Future<void> setPort(int port) async {
    _port = port;
    await storageService.setServerPort(_port);
    apiService.apiClient.updateConfig(baseUrl: serverUrl);
    notifyListeners();
  }

  Future<void> setDemoMode(bool isDemo) async {
    _isDemoMode = isDemo;
    apiService.isDemoMode = isDemo;
    await storageService.setDemoMode(isDemo);
    if (isDemo) {
      _isConnected = true;
      _errorMessage = null;
    }
    notifyListeners();
  }

  Future<bool> testConnection() async {
    if (_isDemoMode) {
      _isConnected = true;
      _errorMessage = null;
      notifyListeners();
      return true;
    }

    _isChecking = true;
    _errorMessage = null;
    notifyListeners();

    try {
      apiService.apiClient.updateConfig(baseUrl: serverUrl);
      final healthy = await apiService.checkHealth();
      _isConnected = healthy;
      if (!healthy) {
        _errorMessage = 'POS server not responding at $serverUrl';
      }
    } catch (e) {
      _isConnected = false;
      _errorMessage = 'Failed to connect: ${e.toString()}';
    } finally {
      _isChecking = false;
      notifyListeners();
    }
    return _isConnected;
  }
}
