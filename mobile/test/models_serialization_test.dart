import 'package:flutter_test/flutter_test.dart';
import 'package:order_it_up_mobile/models/product_model.dart';
import 'package:order_it_up_mobile/models/table_model.dart';
import 'package:order_it_up_mobile/models/order_model.dart';
import 'package:order_it_up_mobile/models/bill_model.dart';
import 'package:order_it_up_mobile/models/kds_ticket_model.dart';

void main() {
  group('Models Serialization & Logic Tests', () {
    test('ProductModel parses JSON correctly', () {
      final json = {
        'id': 'p-100',
        'category_id': 'c-1',
        'name': 'Garlic Naan',
        'price': '65.50',
        'is_active': 1,
        'dietary_type': 'veg',
        'kitchen_station': 'kitchen',
      };

      final product = ProductModel.fromJson(json);
      expect(product.id, 'p-100');
      expect(product.name, 'Garlic Naan');
      expect(product.price, 65.50);
      expect(product.isActive, true);
      expect(product.isVeg, true);
    });

    test('TableModel parses active order and status', () {
      final json = {
        'id': 't-4',
        'number': 'Table 4',
        'capacity': 6,
        'section': 'Terrace',
        'status': 'available',
        'activeOrder': {
          'id': 105,
          'order_number': '#ORD-105',
          'total_amount': '1250.00',
        },
      };

      final table = TableModel.fromJson(json);
      expect(table.id, 't-4');
      expect(table.number, 'Table 4');
      expect(table.capacity, 6);
      expect(table.activeOrderId, 105);
      expect(table.activeOrderTotal, 1250.0);
      // Because order exists, status should resolve to occupied
      expect(table.isOccupied, true);
    });

    test('BillModel calculates discount, 5% GST and payable accurately', () {
      final order = OrderModel(
        id: 201,
        orderNumber: '#ORD-201',
        tableName: 'Table 2',
        total: 1000.0,
        items: [
          OrderItemModel(
            id: 1,
            productId: 'p-1',
            productName: 'Item 1',
            quantity: 2,
            unitPrice: 500.0, // Subtotal = 1000.0
          ),
        ],
      );

      // 10% discount on ₹1000 = ₹100 discount, taxable = ₹900
      // 5% GST on ₹900 = ₹45
      // Total payable = ₹945.00
      final bill = BillModel.fromOrder(order, discountPercent: 10.0, taxPercent: 5.0);

      expect(bill.subtotal, 1000.0);
      expect(bill.discountAmount, 100.0);
      expect(bill.taxAmount, 45.0);
      expect(bill.totalPayable, 945.0);
    });

    test('KdsTicketModel elapsed minutes and warning logic', () {
      final freshTicket = KdsTicketModel(
        id: 1,
        orderNumber: '#ORD-1',
        tableNumber: 'Table 1',
        createdAt: DateTime.now().subtract(const Duration(minutes: 3)),
        items: [],
      );
      expect(freshTicket.isFresh, true);
      expect(freshTicket.isOverdue, false);

      final overdueTicket = KdsTicketModel(
        id: 2,
        orderNumber: '#ORD-2',
        tableNumber: 'Table 2',
        createdAt: DateTime.now().subtract(const Duration(minutes: 18)),
        items: [],
      );
      expect(overdueTicket.isFresh, false);
      expect(overdueTicket.isOverdue, true);
    });
  });
}
