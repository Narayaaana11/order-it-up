import 'package:flutter_test/flutter_test.dart';
import 'package:order_it_up_mobile/models/branch_model.dart';
import 'package:order_it_up_mobile/providers/cloud_hq_provider.dart';
import 'package:order_it_up_mobile/services/api_service.dart';
import 'package:order_it_up_mobile/core/network/api_client.dart';
import 'package:order_it_up_mobile/core/responsive/responsive_layout.dart';

void main() {
  group('Mobile Cloud HQ Models & Parity Tests', () {
    test('BranchSaleModel correctly parses JSON and calculates averages', () {
      final json = {
        'id': 'b-connaught',
        'name': 'Connaught Place (Main Outlet)',
        'city': 'New Delhi',
        'orders': 142,
        'revenue': 84250.0,
        'variance': -120.0,
        'status': 'online',
        'lastSync': 'Just now',
      };

      final model = BranchSaleModel.fromJson(json);
      expect(model.id, 'b-connaught');
      expect(model.name, 'Connaught Place (Main Outlet)');
      expect(model.city, 'New Delhi');
      expect(model.orders, 142);
      expect(model.revenue, 84250.0);
      expect(model.variance, -120.0);
      expect(model.isOnline, true);
      expect(model.hasVarianceAlert, true);
    });

    test('ItemVelocityModel correctly parses JSON across branches', () {
      final json = {
        'id': 'item-paneer-tikka',
        'name': 'Tandoori Paneer Tikka',
        'category': 'Starters',
        'totalQty': 410,
        'totalRev': 143500.0,
        'topBranch': 'Connaught Place (Main Outlet)',
      };

      final model = ItemVelocityModel.fromJson(json);
      expect(model.id, 'item-paneer-tikka');
      expect(model.name, 'Tandoori Paneer Tikka');
      expect(model.category, 'Starters');
      expect(model.totalQty, 410);
      expect(model.totalRev, 143500.0);
      expect(model.topBranch, 'Connaught Place (Main Outlet)');
    });

    test('StockTransferModel correctly round-trips to and from JSON', () {
      final transfer = StockTransferModel(
        id: 'tr-99',
        source: 'Connaught Place (Main Outlet)',
        dest: 'Gurugram CyberHub (Franchise)',
        item: 'Specialty Coffee Beans (KG)',
        qty: 20.0,
        unit: 'kg',
        status: 'pending',
        date: '2026-10-12',
      );

      final json = transfer.toJson();
      expect(json['id'], 'tr-99');
      expect(json['source_branch_id'], 'Connaught Place (Main Outlet)');
      expect(json['destination_branch_id'], 'Gurugram CyberHub (Franchise)');
      expect(json['quantity'], 20.0);
      expect(json['status'], 'pending');

      final reconstructed = StockTransferModel.fromJson(json);
      expect(reconstructed.id, transfer.id);
      expect(reconstructed.qty, transfer.qty);
      expect(reconstructed.unit, transfer.unit);
      expect(reconstructed.status, transfer.status);
    });

    test('CloudHqProvider computes group aggregations and filters properly',
        () async {
      final apiService = ApiService(
        apiClient: ApiClient(baseUrl: 'http://localhost:3003'),
        isDemoMode: true,
      );

      final provider = CloudHqProvider(apiService: apiService);
      // Wait for initial demo data load
      await Future.delayed(const Duration(milliseconds: 50));

      expect(provider.branches.length, greaterThanOrEqualTo(3));
      expect(provider.totalGroupRevenue, greaterThan(0));
      expect(provider.totalGroupOrders, greaterThan(0));
      expect(provider.avgGroupTicket, greaterThan(0));

      // Test Branch Filtering
      provider.setBranchFilter('b-connaught');
      expect(provider.selectedBranchFilter, 'b-connaught');
      expect(provider.displayedBranches.length, 1);
      expect(provider.displayedBranches.first.id, 'b-connaught');

      // Test Reset Filter
      provider.setBranchFilter('all');
      expect(provider.displayedBranches.length, provider.branches.length);

      // Test Stock Transfer Creation
      final initialCount = provider.transfers.length;
      await provider.requestTransfer(
        item: 'Arabica Coffee Blend',
        qty: 10,
        unit: 'kg',
      );
      expect(provider.transfers.length, initialCount + 1);
      expect(provider.transfers.first.item, 'Arabica Coffee Blend');
      expect(provider.transfers.first.status, 'pending');

      // Test Update Transfer Status
      final newId = provider.transfers.first.id;
      await provider.updateTransferStatus(newId, 'dispatched');
      expect(provider.transfers.first.status, 'dispatched');

      // Test 6-Digit PIN Claiming
      final pairingRes = await provider.claimPairingPin('123456');
      expect(pairingRes, isNotNull);
      expect(pairingRes!['success'], true);
    });

    test(
        'Responsive layout adapts seamlessly between Android phone and tablet breakpoints',
        () {
      // Small Android phone (e.g. 360dp width)
      expect(ResponsiveBreakpoints.getScreenType(360), DeviceScreenType.phone);
      expect(
          ResponsiveBreakpoints.getGridColumnCount(360, itemMinWidth: 160), 2);

      // Mid-size phone (412dp)
      expect(ResponsiveBreakpoints.getScreenType(412), DeviceScreenType.phone);
      expect(
          ResponsiveBreakpoints.getGridColumnCount(412, itemMinWidth: 160), 2);

      // 7-inch to 10-inch Android Tablet (768dp)
      expect(ResponsiveBreakpoints.getScreenType(768), DeviceScreenType.tablet);
      expect(
          ResponsiveBreakpoints.getGridColumnCount(768, itemMinWidth: 160), 4);

      // 12-inch POS Tablet / Desktop (1200dp)
      expect(
          ResponsiveBreakpoints.getScreenType(1200), DeviceScreenType.desktop);
    });
  });
}
