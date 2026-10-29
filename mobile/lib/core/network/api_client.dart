import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:uuid/uuid.dart';

class ApiException implements Exception {
  final String message;
  final int? statusCode;
  final dynamic details;

  ApiException(this.message, {this.statusCode, this.details});

  @override
  String toString() => 'ApiException: $message (status: $statusCode)';
}

class ApiClient {
  String baseUrl;
  String? authToken;
  final http.Client _client = http.Client();
  final Duration timeoutDuration = const Duration(seconds: 10);
  final Uuid _uuid = const Uuid();

  ApiClient({required this.baseUrl, this.authToken});

  void updateConfig({required String baseUrl, String? authToken}) {
    this.baseUrl = baseUrl;
    this.authToken = authToken;
  }

  Map<String, String> _buildHeaders({String? idempotencyKey, Map<String, String>? extraHeaders}) {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (authToken != null && authToken!.isNotEmpty) {
      headers['Authorization'] = 'Bearer $authToken';
    }

    if (idempotencyKey != null && idempotencyKey.isNotEmpty) {
      headers['Idempotency-Key'] = idempotencyKey;
    }

    if (extraHeaders != null) {
      headers.addAll(extraHeaders);
    }

    return headers;
  }

  Uri _buildUri(String path, [Map<String, dynamic>? queryParams]) {
    final cleanPath = path.startsWith('/') ? path : '/$path';
    final urlString = '$baseUrl$cleanPath';
    final uri = Uri.parse(urlString);

    if (queryParams != null && queryParams.isNotEmpty) {
      final stringParams = queryParams.map((k, v) => MapEntry(k, v.toString()));
      return uri.replace(queryParameters: stringParams);
    }
    return uri;
  }

  Future<dynamic> get(String path, {Map<String, dynamic>? queryParams}) async {
    try {
      final uri = _buildUri(path, queryParams);
      final response = await _client
          .get(uri, headers: _buildHeaders())
          .timeout(timeoutDuration);

      return _handleResponse(response);
    } on TimeoutException {
      throw ApiException('Connection timed out. Check POS server IP or network.');
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException('Network error: ${e.toString()}');
    }
  }

  Future<dynamic> post(
    String path, {
    dynamic body,
    bool withIdempotency = false,
    Map<String, String>? extraHeaders,
  }) async {
    try {
      final uri = _buildUri(path);
      final idempotencyKey = withIdempotency ? 'mob-${_uuid.v4()}' : null;
      final headers = _buildHeaders(
        idempotencyKey: idempotencyKey,
        extraHeaders: extraHeaders,
      );

      final response = await _client
          .post(
            uri,
            headers: headers,
            body: body != null ? jsonEncode(body) : null,
          )
          .timeout(timeoutDuration);

      return _handleResponse(response);
    } on TimeoutException {
      throw ApiException('Connection timed out. Check POS server IP or network.');
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException('Network error: ${e.toString()}');
    }
  }

  Future<dynamic> put(String path, {dynamic body}) async {
    try {
      final uri = _buildUri(path);
      final response = await _client
          .put(
            uri,
            headers: _buildHeaders(),
            body: body != null ? jsonEncode(body) : null,
          )
          .timeout(timeoutDuration);

      return _handleResponse(response);
    } on TimeoutException {
      throw ApiException('Connection timed out.');
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException('Network error: ${e.toString()}');
    }
  }

  Future<dynamic> delete(String path) async {
    try {
      final uri = _buildUri(path);
      final response = await _client
          .delete(uri, headers: _buildHeaders())
          .timeout(timeoutDuration);

      return _handleResponse(response);
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException('Network error: ${e.toString()}');
    }
  }

  dynamic _handleResponse(http.Response response) {
    dynamic jsonBody;
    try {
      if (response.body.isNotEmpty) {
        jsonBody = jsonDecode(response.body);
      }
    } catch (_) {
      jsonBody = response.body;
    }

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return jsonBody;
    } else {
      String errorMessage = 'Server error (${response.statusCode})';
      if (jsonBody is Map && jsonBody.containsKey('error')) {
        errorMessage = jsonBody['error'].toString();
      } else if (jsonBody is Map && jsonBody.containsKey('message')) {
        errorMessage = jsonBody['message'].toString();
      }
      throw ApiException(
        errorMessage,
        statusCode: response.statusCode,
        details: jsonBody,
      );
    }
  }
}
