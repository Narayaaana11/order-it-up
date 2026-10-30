import 'package:flutter_test/flutter_test.dart';
import 'package:order_it_up_mobile/core/network/api_client.dart';
import 'package:order_it_up_mobile/models/product_model.dart';
import 'package:order_it_up_mobile/providers/order_provider.dart';
import 'package:order_it_up_mobile/services/api_service.dart';

void main() {
  group('OrderProvider Tests', () {
    late ApiClient apiClient;
    late ApiService apiService;
    late OrderProvider orderProvider;

    final testProductA = ProductModel(
      id: 'p-test-1',
      name: 'Paneer Tikka',
      price: 240.0,
      dietaryType: 'veg',
    );

    final testProductB = ProductModel(
      id: 'p-test-2',
      name: 'Butter Chicken',
      price: 380.0,
      dietaryType: 'non_veg',
    );

    setUp(() {
      apiClient = ApiClient(baseUrl: 'http://127.0.0.1:3003');
      apiService = ApiService(apiClient: apiClient, isDemoMode: true);
      orderProvider = OrderProvider(apiService: apiService);
    });

    test('Initial draft is empty', () {
      expect(orderProvider.draftLines.isEmpty, true);
      expect(orderProvider.totalItemCount, 0);
      expect(orderProvider.draftTotal, 0.0);
    });

    test('Adding product increments draft item count and total', () {
      orderProvider.addProduct(testProductA);
      expect(orderProvider.draftLines.length, 1);
      expect(orderProvider.totalItemCount, 1);
      expect(orderProvider.draftTotal, 240.0);

      // Adding same product increments quantity
      orderProvider.addProduct(testProductA);
      expect(orderProvider.draftLines.length, 1);
      expect(orderProvider.totalItemCount, 2);
      expect(orderProvider.draftTotal, 480.0);

      // Adding different product adds new line
      orderProvider.addProduct(testProductB);
      expect(orderProvider.draftLines.length, 2);
      expect(orderProvider.totalItemCount, 3);
      expect(orderProvider.draftTotal, 480.0 + 380.0);
    });

    test('Quantity decrement and removal', () {
      orderProvider.addProduct(testProductA);
      orderProvider.changeQuantity(testProductA.id, 1); // quantity now 2
      expect(orderProvider.totalItemCount, 2);

      orderProvider.changeQuantity(testProductA.id, -1); // quantity now 1
      expect(orderProvider.totalItemCount, 1);

      orderProvider.changeQuantity(
          testProductA.id, -1); // quantity 0 -> removed
      expect(orderProvider.draftLines.isEmpty, true);
      expect(orderProvider.totalItemCount, 0);
    });

    test('Clear draft empties all lines', () {
      orderProvider.addProduct(testProductA);
      orderProvider.addProduct(testProductB);
      expect(orderProvider.draftLines.length, 2);

      orderProvider.clearDraft();
      expect(orderProvider.draftLines.isEmpty, true);
      expect(orderProvider.draftTotal, 0.0);
    });
  });
}
