import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:order_it_up_mobile/core/network/api_client.dart';
import 'package:order_it_up_mobile/models/user_model.dart';
import 'package:order_it_up_mobile/providers/auth_provider.dart';
import 'package:order_it_up_mobile/services/api_service.dart';
import 'package:order_it_up_mobile/services/storage_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

class MemorySecureTokenStore implements SecureTokenStore {
  final Map<String, String> values = {};
  bool failReads = false;
  bool failWrites = false;
  bool failDeletes = false;

  @override
  Future<String?> read(String key) async {
    if (failReads) throw StateError('secure storage unavailable');
    return values[key];
  }

  @override
  Future<void> write(String key, String value) async {
    if (failWrites) throw StateError('secure storage unavailable');
    values[key] = value;
  }

  @override
  Future<void> delete(String key) async {
    if (failDeletes) throw StateError('secure storage unavailable');
    values.remove(key);
  }
}

Future<StorageService> createStorage(String token) async {
  SharedPreferences.setMockInitialValues({});
  final storage = StorageService(secureTokenStore: MemorySecureTokenStore());
  await storage.init();
  await storage.setAuthToken(token);
  return storage;
}

http.Response jsonResponse(int status, Object value) => http.Response(
      jsonEncode(value),
      status,
      headers: {'content-type': 'application/json'},
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('restores user and rotates the persisted session token', () async {
    final storage = await createStorage('old-token');
    final requests = <http.Request>[];
    final client = MockClient((request) async {
      requests.add(request);
      if (request.url.path == '/api/auth/refresh') {
        return jsonResponse(200, {'access_token': 'new-token'});
      }
      if (request.url.path == '/api/auth/me') {
        return jsonResponse(200, {
          'user': {
            'id': 'staff-1',
            'name': 'Asha Rao',
            'email': 'asha@example.com',
            'role': 'manager',
          },
          'tenants': [],
        });
      }
      return jsonResponse(404, {'error': 'Not found'});
    });
    final api = ApiService(
      apiClient: ApiClient(baseUrl: 'http://localhost', client: client),
    );
    final auth = AuthProvider(apiService: api, storageService: storage);

    await auth.restoreSession();

    expect(auth.currentUser?.name, 'Asha Rao');
    expect(auth.currentUser?.role, 'manager');
    expect(storage.getAuthToken(), 'new-token');
    expect(requests.map((request) => request.url.path), [
      '/api/auth/refresh',
      '/api/auth/me',
    ]);
    expect(requests[1].headers['authorization'], 'Bearer new-token');
    expect(storage.getCachedUser()?.email, 'asha@example.com');
  });

  test('migrates legacy plaintext token to secure storage then removes it from preferences', () async {
    SharedPreferences.setMockInitialValues({'oiu_auth_token': 'legacy-token'});
    final secure = MemorySecureTokenStore();
    final storage = StorageService(secureTokenStore: secure);
    await storage.init();

    final preferences = await SharedPreferences.getInstance();
    expect(storage.getAuthToken(), 'legacy-token');
    expect(secure.values['oiu_auth_token'], 'legacy-token');
    expect(preferences.containsKey('oiu_auth_token'), isFalse);
  });

  test('fails closed and erases plaintext token when secure storage cannot be read', () async {
    SharedPreferences.setMockInitialValues({'oiu_auth_token': 'plaintext-token'});
    final secure = MemorySecureTokenStore()..failReads = true;
    final storage = StorageService(secureTokenStore: secure);
    await storage.init();

    final preferences = await SharedPreferences.getInstance();
    expect(storage.getAuthToken(), isNull);
    expect(preferences.containsKey('oiu_auth_token'), isFalse);
  });

  test('does not save a session in plaintext when secure writes fail', () async {
    SharedPreferences.setMockInitialValues({});
    final secure = MemorySecureTokenStore()..failWrites = true;
    final storage = StorageService(secureTokenStore: secure);
    await storage.init();

    await expectLater(
      storage.setAuthToken('must-not-leak'),
      throwsA(isA<SecureSessionStorageException>()),
    );
    final preferences = await SharedPreferences.getInstance();
    expect(storage.getAuthToken(), isNull);
    expect(preferences.containsKey('oiu_auth_token'), isFalse);
  });

  test('retains a logout tombstone when secure deletion fails and clears it on next startup', () async {
    SharedPreferences.setMockInitialValues({});
    final secure = MemorySecureTokenStore();
    final storage = StorageService(secureTokenStore: secure);
    await storage.init();
    await storage.setAuthToken('logout-token');
    secure.failDeletes = true;
    await storage.setAuthToken(null);

    final preferences = await SharedPreferences.getInstance();
    expect(preferences.getBool('oiu_auth_logout_pending'), isTrue);
    secure.failDeletes = false;
    final restarted = StorageService(secureTokenStore: secure);
    await restarted.init();

    expect(restarted.getAuthToken(), isNull);
    expect(secure.values.containsKey('oiu_auth_token'), isFalse);
    expect(preferences.containsKey('oiu_auth_logout_pending'), isFalse);
  });

  test('clears a server-issued token when secure persistence fails during login', () async {
    SharedPreferences.setMockInitialValues({});
    final secure = MemorySecureTokenStore()..failWrites = true;
    final storage = StorageService(secureTokenStore: secure);
    await storage.init();
    final api = ApiService(
      apiClient: ApiClient(
        baseUrl: 'http://localhost',
        client: MockClient((request) async {
          expect(request.url.path, '/api/auth/login');
          return jsonResponse(200, {
            'access_token': 'server-issued-token',
            'user': {
              'id': 'staff-1', 'name': 'Asha Rao',
              'email': 'asha@example.com', 'role': 'manager',
            },
          });
        }),
      ),
    );
    final auth = AuthProvider(apiService: api, storageService: storage);

    expect(await auth.login('asha@example.com', 'secret'), isFalse);
    expect(auth.currentUser, isNull);
    expect(api.apiClient.authToken, isNull);
    expect(storage.getAuthToken(), isNull);
  });

  test('clears a revoked session during restoration', () async {
    final storage = await createStorage('revoked-token');
    await storage.cacheUser(UserModelForTest.user);
    final api = ApiService(
      apiClient: ApiClient(
        baseUrl: 'http://localhost',
        client: MockClient((_) async => jsonResponse(401, {'error': 'Invalid token'})),
      ),
    );
    final auth = AuthProvider(apiService: api, storageService: storage);

    await auth.restoreSession();

    expect(auth.isAuthenticated, isFalse);
    expect(storage.getAuthToken(), isNull);
    expect(storage.getCachedUser(), isNull);
  });

  test('revokes token on logout and clears local session', () async {
    final storage = await createStorage('active-token');
    final api = ApiService(
      apiClient: ApiClient(
        baseUrl: 'http://localhost',
        authToken: 'active-token',
        client: MockClient((request) async {
          expect(request.url.path, '/api/auth/logout');
          expect(request.headers['authorization'], 'Bearer active-token');
          return jsonResponse(200, {'message': 'Logged out successfully'});
        }),
      ),
    );
    final auth = AuthProvider(apiService: api, storageService: storage);

    await auth.logout();

    expect(auth.isAuthenticated, isFalse);
    expect(storage.getAuthToken(), isNull);
    expect(api.apiClient.authToken, isNull);
  });
}

class UserModelForTest {
  static final user = UserModel(
    id: 'staff-1',
    name: 'Asha Rao',
    email: 'asha@example.com',
    role: 'manager',
    token: 'revoked-token',
  );
}
