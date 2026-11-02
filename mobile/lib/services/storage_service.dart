import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../core/constants/app_constants.dart';
import '../models/user_model.dart';

abstract interface class SecureTokenStore {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> delete(String key);
}

class SecureSessionStorageException implements Exception {
  const SecureSessionStorageException();

  @override
  String toString() =>
      'Secure session storage is unavailable. Sign-in was not saved.';
}

class FlutterSecureTokenStore implements SecureTokenStore {
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  @override
  Future<String?> read(String key) => _storage.read(key: key);

  @override
  Future<void> write(String key, String value) =>
      _storage.write(key: key, value: value);

  @override
  Future<void> delete(String key) => _storage.delete(key: key);
}

class StorageService {
  static const _logoutPendingKey = 'oiu_auth_logout_pending';

  StorageService({SecureTokenStore? secureTokenStore})
      : _secureTokenStore = secureTokenStore ?? FlutterSecureTokenStore();

  SharedPreferences? _prefs;
  final SecureTokenStore _secureTokenStore;
  String? _authToken;
  final Map<String, dynamic> _inMemoryFallback = {};

  Future<void> init() async {
    try {
      _prefs = await SharedPreferences.getInstance();
    } catch (_) {
      // Non-secret preferences can still use the in-memory fallback.
      _prefs = null;
    }

    try {
      if (_prefs?.getBool(_logoutPendingKey) == true) {
        await _secureTokenStore.delete(AppConstants.keyAuthToken);
        await _prefs?.remove(_logoutPendingKey);
        _authToken = null;
        await _prefs?.remove(AppConstants.keyAuthToken);
        return;
      }
      _authToken = await _secureTokenStore.read(AppConstants.keyAuthToken);
      final legacyToken = _prefs?.getString(AppConstants.keyAuthToken);
      if ((_authToken == null || _authToken!.isEmpty) &&
          legacyToken != null && legacyToken.isNotEmpty) {
        await _secureTokenStore.write(AppConstants.keyAuthToken, legacyToken);
        _authToken = legacyToken;
      }
      // Remove the old unencrypted bearer credential only after the secure write succeeds.
      await _prefs?.remove(AppConstants.keyAuthToken);
    } catch (_) {
      // Never fall back to plaintext preferences if platform secure storage fails.
      _authToken = null;
      await _prefs?.remove(AppConstants.keyAuthToken);
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
    return _authToken;
  }

  Future<void> setAuthToken(String? token) async {
    if (token == null) {
      _authToken = null;
      _inMemoryFallback.remove(AppConstants.keyAuthToken);
      await _prefs?.setBool(_logoutPendingKey, true);
      try {
        await _secureTokenStore.delete(AppConstants.keyAuthToken);
        await _prefs?.remove(_logoutPendingKey);
      } catch (_) {
        // Keep a durable logout tombstone so a credential cannot be restored at startup.
      }
      await _prefs?.remove(AppConstants.keyAuthToken);
      _inMemoryFallback.remove(AppConstants.keyUserJson);
      await _prefs?.remove(AppConstants.keyUserJson);
    } else {
      try {
        await _prefs?.remove(_logoutPendingKey);
        await _secureTokenStore.write(AppConstants.keyAuthToken, token);
        _authToken = token;
        _inMemoryFallback.remove(AppConstants.keyAuthToken);
        await _prefs?.remove(AppConstants.keyAuthToken);
      } catch (_) {
        _authToken = null;
        try {
          await _secureTokenStore.delete(AppConstants.keyAuthToken);
        } catch (_) {
          await _prefs?.setBool(_logoutPendingKey, true);
        }
        await _prefs?.remove(AppConstants.keyAuthToken);
        throw const SecureSessionStorageException();
      }
    }
  }

  UserModel? getCachedUser() {
    final raw = _prefs?.getString(AppConstants.keyUserJson) ??
        _inMemoryFallback[AppConstants.keyUserJson] as String?;
    if (raw == null) return null;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! Map<String, dynamic>) return null;
      return UserModel.fromJson(decoded, token: getAuthToken());
    } catch (_) {
      return null;
    }
  }

  Future<void> cacheUser(UserModel? user) async {
    if (user == null) {
      _inMemoryFallback.remove(AppConstants.keyUserJson);
      await _prefs?.remove(AppConstants.keyUserJson);
      return;
    }
    // The bearer token is stored separately and is never duplicated in this profile.
    final value = jsonEncode({
      'id': user.id,
      'name': user.name,
      'email': user.email,
      'role': user.role,
    });
    _inMemoryFallback[AppConstants.keyUserJson] = value;
    await _prefs?.setString(AppConstants.keyUserJson, value);
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
