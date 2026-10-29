import 'package:shared_preferences/shared_preferences.dart';
import '../core/constants/app_constants.dart';

class StorageService {
  SharedPreferences? _prefs;
  final Map<String, dynamic> _inMemoryFallback = {};

  Future<void> init() async {
    try {
      _prefs = await SharedPreferences.getInstance();
    } catch (_) {
      // In tests or headless environments, use in-memory fallback
      _prefs = null;
    }
  }

  String getServerHost() {
    return _prefs?.getString(AppConstants.keyServerHost) ??
        _inMemoryFallback[AppConstants.keyServerHost] ??
        AppConstants.defaultHost;
  }

  Future<void> setServerHost(String host) async {
    _inMemoryFallback[AppConstants.keyServerHost] = host;
    await _prefs?.setString(AppConstants.keyServerHost, host);
  }

  int getServerPort() {
    return _prefs?.getInt(AppConstants.keyServerPort) ??
        _inMemoryFallback[AppConstants.keyServerPort] ??
        AppConstants.defaultServerAppPort;
  }

  Future<void> setServerPort(int port) async {
    _inMemoryFallback[AppConstants.keyServerPort] = port;
    await _prefs?.setInt(AppConstants.keyServerPort, port);
  }

  String? getAuthToken() {
    return _prefs?.getString(AppConstants.keyAuthToken) ??
        _inMemoryFallback[AppConstants.keyAuthToken];
  }

  Future<void> setAuthToken(String? token) async {
    if (token == null) {
      _inMemoryFallback.remove(AppConstants.keyAuthToken);
      await _prefs?.remove(AppConstants.keyAuthToken);
    } else {
      _inMemoryFallback[AppConstants.keyAuthToken] = token;
      await _prefs?.setString(AppConstants.keyAuthToken, token);
    }
  }

  bool isDemoMode() {
    return _prefs?.getBool(AppConstants.keyDemoMode) ??
        _inMemoryFallback[AppConstants.keyDemoMode] ??
        false;
  }

  Future<void> setDemoMode(bool isDemo) async {
    _inMemoryFallback[AppConstants.keyDemoMode] = isDemo;
    await _prefs?.setBool(AppConstants.keyDemoMode, isDemo);
  }

  bool isDarkMode() {
    return _prefs?.getBool(AppConstants.keyThemeMode) ??
        _inMemoryFallback[AppConstants.keyThemeMode] ??
        false;
  }

  Future<void> setDarkMode(bool dark) async {
    _inMemoryFallback[AppConstants.keyThemeMode] = dark;
    await _prefs?.setBool(AppConstants.keyThemeMode, dark);
  }
}
