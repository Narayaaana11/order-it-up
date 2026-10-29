import 'package:flutter_test/flutter_test.dart';
import 'package:order_it_up_mobile/core/network/api_client.dart';
import 'package:order_it_up_mobile/models/held_order_model.dart';
import 'package:order_it_up_mobile/models/customer_model.dart';
import 'package:order_it_up_mobile/models/ingredient_model.dart';
import 'package:order_it_up_mobile/models/cash_closure_model.dart';
import 'package:order_it_up_mobile/models/reservation_model.dart';
import 'package:order_it_up_mobile/providers/held_order_provider.dart';
import 'package:order_it_up_mobile/providers/customer_provider.dart';
import 'package:order_it_up_mobile/providers/inventory_provider.dart';
import 'package:order_it_up_mobile/providers/closure_provider.dart';
import 'package:order_it_up_mobile/providers/reservation_provider.dart';
import 'package:order_it_up_mobile/services/api_service.dart';

void main() {
  group('100% Desktop Parity Tests', () {
    late ApiClient apiClient;
    late ApiService apiService;

    setUp(() {
      apiClient = ApiClient(baseUrl: 'http://127.0.0.1:3003');
      apiService = ApiService(apiClient: apiClient, isDemoMode: true);
    });

    test('HeldOrderProvider loads and manages parked carts', () async {
      final heldProv = HeldOrderProvider(apiService: apiService);
      await heldProv.loadHeldOrders();

      expect(heldProv.heldOrders.isNotEmpty, true);
      final initialCount = heldProv.heldCount;

      await heldProv.removeHeld(heldProv.heldOrders.first.id);
      expect(heldProv.heldCount, initialCount - 1);
    });

    test('CustomerProvider searches by phone and tracks loyalty points', () async {
      final custProv = CustomerProvider(apiService: apiService);
      await custProv.loadCustomers();

      expect(custProv.customers.isNotEmpty, true);

      // Search by phone '98765'
      custProv.setSearchQuery('98765');
      expect(custProv.filteredCustomers.length, 1);
      expect(custProv.filteredCustomers.first.name, 'Amit Verma');
      expect(custProv.filteredCustomers.first.loyaltyPoints, 340.0);
    });

    test('InventoryProvider detects low stock ingredients and allows restocking', () async {
      final invProv = InventoryProvider(apiService: apiService);
      await invProv.loadIngredients();

      expect(invProv.ingredients.isNotEmpty, true);
      expect(invProv.lowStockCount > 0, true);

      final lowStockItem = invProv.ingredients.firstWhere((i) => i.isLowStock);
      final initialStock = lowStockItem.currentStock;

      await invProv.adjustStock(lowStockItem.id, 10.0);
      final updated = invProv.ingredients.firstWhere((i) => i.id == lowStockItem.id);
      expect(updated.currentStock, initialStock + 10.0);
    });

    test('ClosureProvider calculates cash variance and creates Z-Report', () async {
      final closureProv = ClosureProvider(apiService: apiService);
      await closureProv.loadClosures();

      expect(closureProv.closures.isNotEmpty, true);

      final newClosure = await closureProv.closeShift(
        countedCash: 18450.0,
        notes: 'End of dinner rush',
      );

      expect(newClosure, isNotNull);
      expect(newClosure!.expectedCash, 18450.0);
      expect(newClosure.countedCash, 18450.0);
      expect(newClosure.isBalanced, true);
      expect(newClosure.zNumber > 0, true);
    });

    test('ReservationProvider creates bookings and seats guests', () async {
      final resProv = ReservationProvider(apiService: apiService);
      await resProv.loadReservations();

      expect(resProv.reservations.isNotEmpty, true);
      final initialCount = resProv.reservations.length;

      final success = await resProv.addReservation(
        customerName: 'Rohit Sharma',
        customerPhone: '+91 98999 11223',
        guestCount: 4,
        time: '09:30 PM',
        tableNumber: 'Table 9',
      );

      expect(success, true);
      expect(resProv.reservations.length, initialCount + 1);

      final created = resProv.reservations.firstWhere((r) => r.customerName == 'Rohit Sharma');
      expect(created.isConfirmed, true);

      await resProv.updateStatus(created.id, 'seated');
      final seated = resProv.reservations.firstWhere((r) => r.id == created.id);
      expect(seated.isSeated, true);
    });
  });
}
