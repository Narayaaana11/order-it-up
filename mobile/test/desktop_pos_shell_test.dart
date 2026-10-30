import 'package:flutter_test/flutter_test.dart';
import 'package:order_it_up_mobile/models/product_model.dart';
import 'package:order_it_up_mobile/providers/order_provider.dart';
import 'package:order_it_up_mobile/services/api_service.dart';
import 'package:order_it_up_mobile/core/network/api_client.dart';
import 'package:order_it_up_mobile/widgets/layout/app_sidebar_drawer.dart';

void main() {
  group('Desktop POS Shell & 100% Parity Tests', () {
    late ApiService apiService;
    late OrderProvider orderProvider;

    final testProduct = ProductModel(
      id: 'prod-test-1',
      name: 'Special Biryani',
      price: 300.0,
      isActive: true,
      dietaryType: 'non_veg',
    );

    setUp(() {
      final apiClient = ApiClient(baseUrl: 'http://localhost:3001');
      apiService = ApiService(apiClient: apiClient, isDemoMode: true);
      orderProvider = OrderProvider(apiService: apiService);
    });

    test('All 16 desktop sidebar navigation routes exist', () {
      expect(desktopNavItems.length, 16);
      final ids = desktopNavItems.map((item) => item.id).toList();
      expect(ids.contains('pos'), true);
      expect(ids.contains('dashboard'), true);
      expect(ids.contains('orders'), true);
      expect(ids.contains('tables'), true);
      expect(ids.contains('kds'), true);
      expect(ids.contains('reservations'), true);
      expect(ids.contains('inventory'), true);
      expect(ids.contains('customers'), true);
      expect(ids.contains('online_orders'), true);
      expect(ids.contains('reports'), true);
      expect(ids.contains('expenses'), true);
      expect(ids.contains('whatsapp'), true);
      expect(ids.contains('products'), true);
      expect(ids.contains('ai_insights'), true);
      expect(ids.contains('staff'), true);
      expect(ids.contains('settings'), true);
    });

    test('OrderProvider calculates exact subtotal, 5% GST, and grand total',
        () {
      orderProvider.addProduct(testProduct); // ₹300.00
      expect(orderProvider.subtotal, 300.0);
      expect(orderProvider.taxTotal, 15.0); // 5% of 300
      expect(orderProvider.grandTotal, 315.0); // 300 + 15
    });

    test('OrderProvider applies flat and percentage discounts accurately', () {
      orderProvider.addProduct(testProduct); // ₹300.00

      // 10% discount: 300 - 30 = 270 taxable -> GST: 13.5 -> Total: 283.5
      orderProvider.applyDiscount(percent: 10.0, isPercent: true);
      expect(orderProvider.discountTotal, 30.0);
      expect(orderProvider.taxableAmount, 270.0);
      expect(orderProvider.taxTotal, 13.5);
      expect(orderProvider.grandTotal, 283.5);

      // Flat ₹50 discount: 300 - 50 = 250 taxable -> GST: 12.5 -> Total: 262.5
      orderProvider.applyDiscount(amount: 50.0, isPercent: false);
      expect(orderProvider.discountTotal, 50.0);
      expect(orderProvider.taxableAmount, 250.0);
      expect(orderProvider.taxTotal, 12.5);
      expect(orderProvider.grandTotal, 262.5);

      // Clear discount
      orderProvider.clearDiscount();
      expect(orderProvider.discountTotal, 0.0);
      expect(orderProvider.grandTotal, 315.0);
    });

    test('OrderProvider manages Pax and Order Types', () {
      expect(orderProvider.orderType, 'dine_in');
      expect(orderProvider.guestCount, 1);

      orderProvider.setGuestCount(4);
      expect(orderProvider.guestCount, 4);

      orderProvider.setOrderType('takeaway');
      expect(orderProvider.orderType, 'takeaway');
      expect(orderProvider.selectedTableId, isNull);
    });
  });
}
