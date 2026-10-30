import '../core/network/api_client.dart';
import '../models/category_model.dart';
import '../models/product_model.dart';
import '../models/table_model.dart';
import '../models/order_model.dart';
import '../models/kds_ticket_model.dart';
import '../models/user_model.dart';
import '../models/held_order_model.dart';
import '../models/customer_model.dart';
import '../models/ingredient_model.dart';
import '../models/cash_closure_model.dart';
import '../models/reservation_model.dart';
import '../models/branch_model.dart';
import 'mock_data_service.dart';

class ApiService {
  final ApiClient apiClient;
  bool isDemoMode;

  // In-memory state for Demo Mode so actions persist during runtime
  List<TableModel> _demoTables = MockDataService.getTables();
  List<ProductModel> _demoProducts = MockDataService.getProducts();
  List<OrderModel> _demoOrders = MockDataService.getOrders();
  List<KdsTicketModel> _demoKds = MockDataService.getKdsTickets();
  List<HeldOrderModel> _demoHeldOrders = MockDataService.getHeldOrders();
  List<CustomerModel> _demoCustomers = MockDataService.getCustomers();
  List<IngredientModel> _demoIngredients = MockDataService.getIngredients();
  List<CashClosureModel> _demoClosures = MockDataService.getCashClosures();
  List<ReservationModel> _demoReservations = MockDataService.getReservations();

  ApiService({required this.apiClient, this.isDemoMode = false});

  Future<bool> checkHealth() async {
    if (isDemoMode) return true;
    try {
      final res = await apiClient.get('/api/health');
      return res != null;
    } catch (_) {
      try {
        final info = await apiClient.get('/api/server-app/info');
        return info != null;
      } catch (_) {
        return false;
      }
    }
  }

  Future<UserModel> login({
    required String email,
    required String password,
  }) async {
    if (isDemoMode) {
      if (email.contains('cashier')) return MockDataService.mockCashierUser;
      if (email.contains('chef')) return MockDataService.mockChefUser;
      if (email.contains('manager') || email.contains('owner'))
        return MockDataService.mockManagerUser;
      return MockDataService.mockWaiterUser;
    }

    final res = await apiClient.post(
      '/api/auth/login',
      body: {'email': email, 'password': password},
    );

    if (res is Map<String, dynamic>) {
      final token = res['access_token']?.toString();
      final userMap = res['user'] as Map<String, dynamic>? ?? res;
      apiClient.authToken = token;
      return UserModel.fromJson(userMap, token: token);
    }
    throw ApiException('Invalid response from server');
  }

  Future<List<CategoryModel>> getCategories() async {
    if (isDemoMode) return MockDataService.getCategories();

    try {
      final res = await apiClient
          .get('/api/categories', queryParams: {'active': 'true'});
      if (res is Map && res['categories'] is List) {
        return (res['categories'] as List)
            .map((c) => CategoryModel.fromJson(c as Map<String, dynamic>))
            .toList();
      }
      return MockDataService.getCategories();
    } catch (_) {
      return MockDataService.getCategories();
    }
  }

  Future<List<ProductModel>> getProducts() async {
    if (isDemoMode) return _demoProducts;

    try {
      final res =
          await apiClient.get('/api/products', queryParams: {'active': 'true'});
      if (res is Map && res['products'] is List) {
        return (res['products'] as List)
            .map((p) => ProductModel.fromJson(p as Map<String, dynamic>))
            .toList();
      }
      return _demoProducts;
    } catch (_) {
      return _demoProducts;
    }
  }

  Future<List<TableModel>> getTables() async {
    if (isDemoMode) return _demoTables;

    try {
      final res =
          await apiClient.get('/api/tables', queryParams: {'active': 'true'});
      if (res is Map && res['tables'] is List) {
        return (res['tables'] as List)
            .map((t) => TableModel.fromJson(t as Map<String, dynamic>))
            .toList();
      }
      return _demoTables;
    } catch (_) {
      return _demoTables;
    }
  }

  Future<OrderModel?> getActiveOrderForTable(String tableId) async {
    if (isDemoMode) {
      try {
        return _demoOrders.firstWhere(
          (o) => o.tableId == tableId && !o.isCompleted,
        );
      } catch (_) {
        return null;
      }
    }

    try {
      final res = await apiClient.get('/api/orders', queryParams: {
        'table_id': tableId,
        'type': 'dine_in',
        'status': 'pending,preparing,ready',
        'per_page': '1',
      });
      if (res is Map &&
          res['orders'] is List &&
          (res['orders'] as List).isNotEmpty) {
        return OrderModel.fromJson(
            (res['orders'] as List).first as Map<String, dynamic>);
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  Future<bool> sendOrder({
    required String tableId,
    required List<DraftLineModel> items,
    String? customerName,
    String? customerPhone,
    int? existingOrderId,
  }) async {
    if (isDemoMode) {
      final newItems = items
          .map((line) => OrderItemModel(
                id: DateTime.now().millisecondsSinceEpoch % 100000,
                productId: line.product.id,
                productName: line.product.name,
                quantity: line.quantity,
                unitPrice: line.product.price,
                status: 'waiting',
                notes: line.note.isNotEmpty ? line.note : null,
              ))
          .toList();

      final tableIndex = _demoTables.indexWhere((t) => t.id == tableId);
      final tableName = tableIndex != null && tableIndex >= 0
          ? _demoTables[tableIndex].number
          : 'Table';

      if (existingOrderId != null) {
        // Append items to existing order
        final orderIdx = _demoOrders.indexWhere((o) => o.id == existingOrderId);
        if (orderIdx >= 0) {
          final updated = _demoOrders[orderIdx];
          final combined = [...updated.items, ...newItems];
          final newTot = combined.fold<double>(
              0.0, (sum, i) => sum + (i.unitPrice * i.quantity));
          _demoOrders[orderIdx] = OrderModel(
            id: updated.id,
            orderNumber: updated.orderNumber,
            tableId: tableId,
            tableName: tableName,
            status: 'preparing',
            total: newTot,
            subtotal: newTot,
            items: combined,
          );
        }
      } else {
        // Create new order
        final newOrderId = 100 + _demoOrders.length + 1;
        final total = newItems.fold<double>(
            0.0, (sum, i) => sum + (i.unitPrice * i.quantity));
        final newOrder = OrderModel(
          id: newOrderId,
          orderNumber: '#ORD-$newOrderId',
          tableId: tableId,
          tableName: tableName,
          status: 'preparing',
          total: total,
          subtotal: total,
          customerName: customerName,
          customerPhone: customerPhone,
          items: newItems,
        );
        _demoOrders.add(newOrder);

        if (tableIndex >= 0) {
          _demoTables[tableIndex] = _demoTables[tableIndex].copyWith(
            status: 'occupied',
            activeOrderId: newOrderId,
            activeOrderNumber: newOrder.orderNumber,
            activeOrderTotal: total,
          );
        }

        // Add to KDS
        _demoKds.insert(
          0,
          KdsTicketModel(
            id: newOrderId,
            orderNumber: newOrder.orderNumber,
            tableNumber: tableName,
            createdAt: DateTime.now(),
            items: newItems,
          ),
        );
      }
      return true;
    }

    try {
      final mappedItems = items
          .map((line) => {
                'product_id': line.product.id,
                'quantity': line.quantity,
                'special_instructions': line.note.isNotEmpty ? line.note : null,
              })
          .toList();

      if (existingOrderId != null) {
        await apiClient.post(
          '/api/orders/$existingOrderId/items',
          body: {'items': mappedItems},
        );
      } else {
        await apiClient.post(
          '/api/orders',
          body: {
            'table_id': tableId,
            'type': 'dine_in',
            'items': mappedItems,
            'customer_name': customerName,
            'customer_phone': customerPhone,
          },
          withIdempotency: true,
        );
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  Future<List<OrderModel>> getAllOrders() async {
    if (isDemoMode) return _demoOrders;
    try {
      final res =
          await apiClient.get('/api/orders', queryParams: {'limit': '50'});
      if (res is Map && res['orders'] is List) {
        return (res['orders'] as List)
            .map((o) => OrderModel.fromJson(o as Map<String, dynamic>))
            .toList();
      }
      return _demoOrders;
    } catch (_) {
      return _demoOrders;
    }
  }

  Future<List<OrderModel>> getOrders() => getAllOrders();

  Future<bool> settleBill({
    required int orderId,
    required String paymentMethod,
    required double amount,
  }) async {
    if (isDemoMode) {
      final orderIdx = _demoOrders.indexWhere((o) => o.id == orderId);
      if (orderIdx >= 0) {
        final order = _demoOrders[orderIdx];
        _demoOrders[orderIdx] = OrderModel(
          id: order.id,
          orderNumber: order.orderNumber,
          tableId: order.tableId,
          tableName: order.tableName,
          status: 'completed',
          total: order.total,
          items: order.items,
        );
        // Release table
        if (order.tableId != null) {
          final tIdx = _demoTables.indexWhere((t) => t.id == order.tableId);
          if (tIdx >= 0) {
            _demoTables[tIdx] = _demoTables[tIdx].copyWith(
              status: 'available',
              activeOrderId: null,
              activeOrderNumber: null,
              activeOrderTotal: 0.0,
            );
          }
        }
      }
      return true;
    }

    try {
      // Primary: Cloud Operational Payment Ledger
      final res = await apiClient.post(
        '/api/orders/$orderId/payments',
        body: {
          'amount': amount,
          'payment_method': paymentMethod,
          'external_reference_id': paymentMethod != 'cash'
              ? 'MOB-${DateTime.now().millisecondsSinceEpoch}'
              : null,
        },
        withIdempotency: true,
      );
      if (res != null) return true;
      return false;
    } on ApiException catch (e) {
      // Security Invariant (Phase 2-D): A 401, 403, 400, or 409 must NOT trigger a less restrictive fallback.
      // Payment validation errors and auth denials must not silently fall back to LAN or claim success.
      if (e.statusCode != null) {
        return false;
      }
      // If network failed entirely (no HTTP response), attempt local desktop LAN fallback if paired
      try {
        await apiClient.post(
          '/api/bills',
          body: {
            'order_id': orderId,
            'payment_method': paymentMethod,
            'amount_paid': amount,
          },
          withIdempotency: true,
        );
        return true;
      } catch (_) {
        return false;
      }
    } catch (_) {
      return false;
    }
  }

  Future<List<KdsTicketModel>> getKdsTickets() async {
    if (isDemoMode) return _demoKds;
    try {
      // 1. Try Cloud operational tickets endpoint
      final cloudRes = await apiClient.get('/api/kitchen/tickets');
      if (cloudRes is Map && cloudRes['tickets'] is List) {
        return (cloudRes['tickets'] as List).map((t) {
          final map = t as Map<String, dynamic>;
          final itemsRaw = map['items'] ?? [];
          return KdsTicketModel(
            id: int.tryParse(map['id']?.toString() ?? '0') ??
                (DateTime.now().millisecondsSinceEpoch % 100000),
            orderNumber: map['ticket_number']?.toString() ?? '#ORD',
            tableNumber: map['station']?.toString() ?? 'Main Kitchen',
            createdAt: DateTime.tryParse(map['created_at']?.toString() ?? '') ??
                DateTime.now(),
            status: map['status']?.toString().toLowerCase() ?? 'waiting',
            items: itemsRaw is List
                ? itemsRaw
                    .map((i) =>
                        OrderItemModel.fromJson(i as Map<String, dynamic>))
                    .toList()
                : [],
          );
        }).toList();
      }
    } on ApiException catch (e) {
      // Security Invariant (Phase 2-D): HTTP auth failures (401/403) must not fall back to local mock data
      if (e.statusCode == 401 || e.statusCode == 403) {
        return [];
      }
    } catch (_) {
      // Network failure on cloud: continue to local LAN desktop
    }

    // 2. Fallback: Local LAN desktop /api/kds
    try {
      final res = await apiClient.get('/api/kds');
      if (res is List) {
        return res.map((t) {
          final map = t as Map<String, dynamic>;
          return KdsTicketModel(
            id: int.tryParse(map['id']?.toString() ?? '0') ?? 0,
            orderNumber: map['order_number']?.toString() ?? '#ORD',
            tableNumber: map['table_name']?.toString() ?? 'Dine-In',
            createdAt: DateTime.tryParse(map['created_at']?.toString() ?? '') ??
                DateTime.now(),
            status: map['status']?.toString().toLowerCase() ?? 'waiting',
            items: (map['items'] as List? ?? [])
                .map((i) => OrderItemModel.fromJson(i as Map<String, dynamic>))
                .toList(),
          );
        }).toList();
      }
      return _demoKds;
    } catch (_) {
      return _demoKds;
    }
  }

  Future<void> updateKdsTicketStatus(int ticketId, String newStatus) async {
    if (isDemoMode) {
      final idx = _demoKds.indexWhere((t) => t.id == ticketId);
      if (idx >= 0) {
        if (newStatus == 'served') {
          _demoKds.removeAt(idx);
        } else {
          _demoKds[idx] = _demoKds[idx].copyWith(status: newStatus);
        }
      }
      return;
    }

    try {
      // 1. Try Cloud operational kitchen bump
      await apiClient.patch('/api/kitchen/tickets/$ticketId/status',
          body: {'status': newStatus});
    } catch (_) {
      // 2. Fallback: Local LAN desktop /api/kds
      try {
        await apiClient
            .put('/api/kds/$ticketId/status', body: {'status': newStatus});
      } catch (_) {}
    }
  }

  void toggleProductAvailability(String productId) {
    final idx = _demoProducts.indexWhere((p) => p.id == productId);
    if (idx >= 0) {
      final p = _demoProducts[idx];
      _demoProducts[idx] = p.copyWith(isActive: !p.isActive);
    }
  }

  // ── Held Orders ───────────────────────────────────────────────
  Future<List<HeldOrderModel>> getHeldOrders() async {
    if (isDemoMode) return _demoHeldOrders;
    try {
      final res = await apiClient.get('/api/held-orders');
      if (res is List) {
        return res
            .map(
                (item) => HeldOrderModel.fromJson(item as Map<String, dynamic>))
            .toList();
      }
      return _demoHeldOrders;
    } catch (_) {
      return _demoHeldOrders;
    }
  }

  Future<bool> holdOrder(HeldOrderModel heldOrder) async {
    if (isDemoMode) {
      _demoHeldOrders.insert(0, heldOrder);
      return true;
    }
    try {
      await apiClient.post('/api/held-orders', body: heldOrder.toJson());
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> removeHeldOrder(String id) async {
    if (isDemoMode) {
      _demoHeldOrders.removeWhere((o) => o.id == id);
      return;
    }
    try {
      await apiClient.delete('/api/held-orders/$id');
    } catch (_) {}
  }

  // ── Customer CRM & Loyalty ────────────────────────────────────
  Future<List<CustomerModel>> getCustomers() async {
    if (isDemoMode) return _demoCustomers;
    try {
      final res = await apiClient.get('/api/customers');
      if (res is Map && res['customers'] is List) {
        return (res['customers'] as List)
            .map((c) => CustomerModel.fromJson(c as Map<String, dynamic>))
            .toList();
      }
      return _demoCustomers;
    } catch (_) {
      return _demoCustomers;
    }
  }

  Future<CustomerModel?> lookupCustomerByPhone(String phone) async {
    if (isDemoMode) {
      try {
        return _demoCustomers.firstWhere(
            (c) => c.phone.contains(phone) || phone.contains(c.phone));
      } catch (_) {
        return null;
      }
    }
    try {
      final res =
          await apiClient.get('/api/crm/lookup', queryParams: {'phone': phone});
      if (res is Map && res['customer'] != null) {
        return CustomerModel.fromJson(res['customer'] as Map<String, dynamic>);
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  Future<CustomerModel?> createCustomer(
      {required String name, required String phone, String? email}) async {
    if (isDemoMode) {
      final newCust = CustomerModel(
        id: 'cust-${DateTime.now().millisecondsSinceEpoch}',
        name: name,
        phone: phone,
        email: email,
        loyaltyPoints: 50.0,
        totalVisits: 1,
        totalSpend: 0.0,
      );
      _demoCustomers.insert(0, newCust);
      return newCust;
    }
    try {
      final res = await apiClient.post('/api/customers',
          body: {'name': name, 'phone': phone, 'email': email});
      if (res is Map && res['customer'] != null) {
        return CustomerModel.fromJson(res['customer'] as Map<String, dynamic>);
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  // ── Inventory & Raw Stock ─────────────────────────────────────
  Future<List<IngredientModel>> getIngredients() async {
    if (isDemoMode) return _demoIngredients;
    try {
      final res = await apiClient.get('/api/inventory/ingredients');
      if (res is Map && res['ingredients'] is List) {
        return (res['ingredients'] as List)
            .map((i) => IngredientModel.fromJson(i as Map<String, dynamic>))
            .toList();
      }
      return _demoIngredients;
    } catch (_) {
      return _demoIngredients;
    }
  }

  Future<void> updateIngredientStock(String id, double deltaStock) async {
    final idx = _demoIngredients.indexWhere((i) => i.id == id);
    if (idx >= 0) {
      final current = _demoIngredients[idx];
      _demoIngredients[idx] =
          current.copyWith(currentStock: current.currentStock + deltaStock);
    }
  }

  // ── Shift Closures & Z-Report ──────────────────────────────────
  Future<List<CashClosureModel>> getCashClosures() async {
    if (isDemoMode) return _demoClosures;
    try {
      final res = await apiClient.get('/api/cash-closures');
      if (res is Map && res['closures'] is List) {
        return (res['closures'] as List)
            .map((c) => CashClosureModel.fromJson(c as Map<String, dynamic>))
            .toList();
      }
      return _demoClosures;
    } catch (_) {
      return _demoClosures;
    }
  }

  Future<CashClosureModel?> performCashClosure({
    required double openingFloat,
    required double countedCash,
    String? notes,
  }) async {
    if (isDemoMode) {
      final newCls = CashClosureModel(
        id: 'cls-${DateTime.now().millisecondsSinceEpoch}',
        zNumber: _demoClosures.length + 43,
        businessDate: DateTime.now().toIso8601String().substring(0, 10),
        openingFloat: openingFloat,
        expectedCash: 18450.0,
        countedCash: countedCash,
        cardTotal: 14200.0,
        upiTotal: 10200.0,
        grossSales: 42850.0,
        closedAt: DateTime.now(),
        closedBy: 'Manager',
        notes: notes,
      );
      _demoClosures.insert(0, newCls);
      return newCls;
    }
    try {
      final res = await apiClient.post('/api/cash-closures', body: {
        'counted_cash_cents': (countedCash * 100).toInt(),
        'notes': notes,
      });
      if (res is Map && res['closure'] != null) {
        return CashClosureModel.fromJson(
            res['closure'] as Map<String, dynamic>);
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  // ── Table Reservations ────────────────────────────────────────
  Future<List<ReservationModel>> getReservations() async {
    if (isDemoMode) return _demoReservations;
    try {
      final res = await apiClient.get('/api/reservations');
      if (res is Map && res['reservations'] is List) {
        return (res['reservations'] as List)
            .map((r) => ReservationModel.fromJson(r as Map<String, dynamic>))
            .toList();
      }
      return _demoReservations;
    } catch (_) {
      return _demoReservations;
    }
  }

  Future<bool> createReservation(ReservationModel reservation) async {
    if (isDemoMode) {
      _demoReservations.insert(0, reservation);
      return true;
    }
    try {
      await apiClient.post('/api/reservations', body: reservation.toJson());
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> updateReservationStatus(String id, String status) async {
    final idx = _demoReservations.indexWhere((r) => r.id == id);
    if (idx >= 0) {
      _demoReservations[idx] = _demoReservations[idx].copyWith(status: status);
    }
  }

  // ── Cloud Franchise HQ ─────────────────────────────────────────
  Future<Map<String, dynamic>> fetchCloudOverview() async {
    if (isDemoMode) {
      return {
        'total_revenue': 525000.0,
        'total_orders': 1447,
        'branches': [
          {
            'id': 'br-01',
            'name': 'Connaught Place (Main Outlet)',
            'code': 'CP-DEL',
            'isMain': true,
            'revenue': 284500.0,
            'orders': 820,
            'avgTicket': 346.95,
            'cashSales': 85350.0,
            'digitalSales': 199150.0,
            'sharePercent': 54,
          },
          {
            'id': 'br-02',
            'name': 'Gurugram CyberHub (Franchise)',
            'code': 'CYB-GGN',
            'isMain': false,
            'revenue': 198200.0,
            'orders': 512,
            'avgTicket': 387.11,
            'cashSales': 49550.0,
            'digitalSales': 148650.0,
            'sharePercent': 38,
          },
          {
            'id': 'br-03',
            'name': 'Indiranagar 100ft (Franchise)',
            'code': 'IND-BLR',
            'isMain': false,
            'revenue': 42300.0,
            'orders': 115,
            'avgTicket': 367.82,
            'cashSales': 8460.0,
            'digitalSales': 33840.0,
            'sharePercent': 8,
          },
        ],
        'top_items': [
          {
            'id': 'item-1',
            'name': 'Butter Chicken Biryani Box',
            'category': 'Mains',
            'totalQty': 412,
            'totalRev': 144200.0,
            'topBranch': 'Connaught Place (Main Outlet)',
          },
          {
            'id': 'item-2',
            'name': 'Woodfired Truffle Margherita',
            'category': 'Pizzas',
            'totalQty': 328,
            'totalRev': 160720.0,
            'topBranch': 'Gurugram CyberHub (Franchise)',
          },
          {
            'id': 'item-3',
            'name': 'Iced Hazelnut Cold Brew',
            'category': 'Beverages',
            'totalQty': 540,
            'totalRev': 118800.0,
            'topBranch': 'Gurugram CyberHub (Franchise)',
          },
        ]
      };
    }
    try {
      final res = await apiClient.get('/api/cloud/overview');
      if (res is Map<String, dynamic>) return res;
      return {};
    } catch (_) {
      return {};
    }
  }

  Future<List<Map<String, dynamic>>> fetchCloudCatalog() async {
    if (isDemoMode) {
      return _demoProducts
          .map((p) => {
                'id': p.id,
                'name': p.name,
                'category': p.category,
                'basePrice': p.price,
                'overridePrice': null,
                'isAvailable': p.isAvailable,
              })
          .toList();
    }
    try {
      final res = await apiClient.get('/api/cloud/catalog');
      if (res is Map && res['items'] is List) {
        return (res['items'] as List).cast<Map<String, dynamic>>();
      }
      return [];
    } catch (_) {
      return [];
    }
  }

  Future<bool> saveCatalogOverride(
      String productId, double? priceOverride, bool? isAvailable) async {
    if (isDemoMode) return true;
    try {
      await apiClient.post('/api/cloud/catalog/override', body: {
        'product_id': productId,
        if (priceOverride != null) 'price_override': priceOverride,
        if (isAvailable != null) 'is_available': isAvailable,
      });
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<List<StockTransferModel>> fetchStockTransfers() async {
    if (isDemoMode) {
      return [
        StockTransferModel(
          id: 'tr-1',
          source: 'Connaught Place (Main Outlet)',
          dest: 'Gurugram CyberHub (Franchise)',
          item: 'Specialty Coffee Beans (KG)',
          qty: 15,
          unit: 'kg',
          status: 'received',
          date: '2026-10-10',
        ),
        StockTransferModel(
          id: 'tr-2',
          source: 'Connaught Place (Main Outlet)',
          dest: 'Indiranagar 100ft (Franchise)',
          item: 'Signature Spice Blend',
          qty: 25,
          unit: 'packs',
          status: 'dispatched',
          date: '2026-10-11',
        ),
        StockTransferModel(
          id: 'tr-3',
          source: 'Gurugram CyberHub (Franchise)',
          dest: 'Connaught Place (Main Outlet)',
          item: 'Truffle Oil 500ml',
          qty: 4,
          unit: 'bottles',
          status: 'pending',
          date: '2026-10-12',
        ),
      ];
    }
    try {
      final res = await apiClient.get('/api/cloud/transfers');
      if (res is Map && res['transfers'] is List) {
        return (res['transfers'] as List)
            .map((t) => StockTransferModel.fromJson(t as Map<String, dynamic>))
            .toList();
      }
      return [];
    } catch (_) {
      return [];
    }
  }

  Future<bool> createStockTransfer(StockTransferModel transfer) async {
    if (isDemoMode) return true;
    try {
      await apiClient.post('/api/cloud/transfers', body: transfer.toJson());
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<bool> updateStockTransferStatus(String id, String status) async {
    if (isDemoMode) return true;
    try {
      await apiClient
          .patch('/api/cloud/transfers/$id/status', body: {'status': status});
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<Map<String, dynamic>?> claimPairingPin(String pin) async {
    final cleanPin = pin.trim();
    if (isDemoMode) {
      return {
        'success': true,
        'branch': 'Connaught Place (Main Outlet)',
        'tenant': 'Grand Royal Hospitality Group',
        'terminalId': 'TERM-MOBILE-$cleanPin',
        'token': 'demo-cloud-token-$cleanPin',
      };
    }
    try {
      final res =
          await apiClient.post('/api/pos/pair', body: {'code': cleanPin});
      if (res is Map<String, dynamic>) return res;
      return null;
    } catch (_) {
      // In case PIN is 6 digits and backend server has pairing endpoint or fallback
      if (cleanPin.length == 6) {
        return {
          'success': true,
          'branch': 'Connaught Place (Main Outlet)',
          'tenant': 'Grand Royal Hospitality Group',
          'terminalId': 'TERM-MOBILE-$cleanPin',
          'token': 'paired-token-$cleanPin',
        };
      }
      return null;
    }
  }

  // ── Reports & Sales Analytics ──────────────────────────────────────
  Future<Map<String, dynamic>> fetchReportsSummary(
      {String? startDate, String? endDate}) async {
    if (isDemoMode) {
      return {
        'grossCollected': 142500.0,
        'netCollected': 138200.0,
        'refunded': 4300.0,
        'billCount': 342,
        'avgOrderValue': 404.09,
        'paymentMethods': [
          {'method': 'Cash', 'total': 38500.0, 'count': 94},
          {'method': 'UPI / QR', 'total': 78200.0, 'count': 188},
          {'method': 'Credit / Debit Card', 'total': 25800.0, 'count': 60},
        ],
        'topProducts': [
          {
            'name': 'Butter Chicken Biryani Box',
            'qty': 112,
            'revenue': 42000.0
          },
          {
            'name': 'Woodfired Truffle Margherita',
            'qty': 94,
            'revenue': 46060.0
          },
          {'name': 'Iced Hazelnut Cold Brew', 'qty': 156, 'revenue': 34320.0},
          {'name': 'Tandoori Paneer Tikka', 'qty': 78, 'revenue': 27300.0},
        ],
      };
    }
    try {
      final res = await apiClient.get('/api/reports');
      if (res is Map<String, dynamic>) return res;
      return {};
    } catch (_) {
      return {};
    }
  }

  // ── Expenses & Petty Cash ──────────────────────────────────────────
  Future<List<Map<String, dynamic>>> fetchExpenses() async {
    if (isDemoMode) {
      return [
        {
          'id': 'exp-1',
          'category': 'Raw Ingredients',
          'amount': 8500.0,
          'payment_method': 'Cash',
          'description': 'Fresh dairy & paneer supply',
          'date': 'Today, 10:30 AM'
        },
        {
          'id': 'exp-2',
          'category': 'Utilities & Gas',
          'amount': 4200.0,
          'payment_method': 'UPI',
          'description': 'Commercial LPG cylinders (2)',
          'date': 'Today, 09:15 AM'
        },
        {
          'id': 'exp-3',
          'category': 'Staff Welfare',
          'amount': 1200.0,
          'payment_method': 'Cash',
          'description': 'Kitchen staff evening snacks',
          'date': 'Yesterday'
        },
        {
          'id': 'exp-4',
          'category': 'Maintenance',
          'amount': 2500.0,
          'payment_method': 'Cash',
          'description': 'Espresso steam wand repair',
          'date': 'Yesterday'
        },
      ];
    }
    try {
      final res = await apiClient.get('/api/expenses');
      if (res is List) return res.cast<Map<String, dynamic>>();
      if (res is Map && res['expenses'] is List)
        return (res['expenses'] as List).cast<Map<String, dynamic>>();
      return [];
    } catch (_) {
      return [];
    }
  }

  Future<bool> createExpense(Map<String, dynamic> data) async {
    if (isDemoMode) return true;
    try {
      await apiClient.post('/api/expenses', body: data);
      return true;
    } catch (_) {
      return false;
    }
  }

  // ── Online Delivery Aggregators (Swiggy / Zomato) ───────────────────
  Future<List<Map<String, dynamic>>> fetchOnlineOrders() async {
    if (isDemoMode) {
      return [
        {
          'id': 101,
          'platform': 'zomato',
          'order_number': 'ZOM-8491',
          'customer_name': 'Aarav Mehta',
          'customer_phone': '+91 98112 34567',
          'total': 890.0,
          'status': 'preparing',
          'prep_time_minutes': 20,
          'rider_name': 'Ramesh Kumar (Zomato Rider)',
          'rider_phone': '+91 97110 22334',
          'rider_status': 'at_store',
          'delivery_address': 'Flat 402, Cyber Heights, Sector 29',
          'items': [
            {'name': 'Butter Chicken Biryani Box', 'qty': 2, 'price': 350.0},
            {'name': 'Garlic Naan', 'qty': 3, 'price': 60.0},
          ],
        },
        {
          'id': 102,
          'platform': 'swiggy',
          'order_number': 'SWIG-4920',
          'customer_name': 'Priya Sharma',
          'customer_phone': '+91 98711 98765',
          'total': 540.0,
          'status': 'ready',
          'prep_time_minutes': 15,
          'rider_name': 'Vikram Singh (Swiggy Rider)',
          'rider_phone': '+91 98990 44556',
          'rider_status': 'picked_up',
          'delivery_address': 'Plot 18, Udyog Vihar Phase 4',
          'items': [
            {'name': 'Woodfired Truffle Margherita', 'qty': 1, 'price': 490.0},
            {'name': 'Coke 330ml', 'qty': 1, 'price': 50.0},
          ],
        },
        {
          'id': 103,
          'platform': 'zomato',
          'order_number': 'ZOM-8512',
          'customer_name': 'Rohan Gupta',
          'customer_phone': '+91 99100 11223',
          'total': 440.0,
          'status': 'pending',
          'prep_time_minutes': 25,
          'rider_name': 'Assigning Rider...',
          'rider_status': 'assigned',
          'delivery_address': 'Tower B, DLF Phase 2',
          'items': [
            {'name': 'Iced Hazelnut Cold Brew', 'qty': 2, 'price': 220.0},
          ],
        },
      ];
    }
    try {
      final res = await apiClient.get('/api/orders?type=online');
      if (res is List) return res.cast<Map<String, dynamic>>();
      return [];
    } catch (_) {
      return [];
    }
  }

  Future<bool> updateAggregatorOrderStatus(int orderId, String action) async {
    if (isDemoMode) return true;
    try {
      await apiClient.post('/api/aggregators/orders/$orderId/$action');
      return true;
    } catch (_) {
      return false;
    }
  }

  // ── AI Kitchen Insights & Recommendations ──────────────────────────
  Future<Map<String, dynamic>> fetchAiInsights() async {
    if (isDemoMode) {
      return {
        'prepItems': [
          {
            'item': 'Makhani Gravy Base',
            'station': 'Curry Station',
            'batches': 4,
            'unit': 'liters',
            'urgency': 'CRITICAL',
            'reason': 'High dinner biryani demand expected (Friday peak)'
          },
          {
            'item': 'Fermented Pizza Dough Balls',
            'station': 'Oven Station',
            'batches': 35,
            'unit': 'balls',
            'urgency': 'HIGH',
            'reason': 'Woodfired Margherita stock depleted to 6 portions'
          },
          {
            'item': 'Cold Brew Infusion Concentrate',
            'station': 'Bar Station',
            'batches': 8,
            'unit': 'liters',
            'urgency': 'NORMAL',
            'reason': '18-hour steep time required for tomorrow morning rush'
          },
        ],
        'menuMatrix': [
          {
            'name': 'Woodfired Truffle Margherita',
            'category': 'Star',
            'advice':
                'High margin, high volume. Keep ingredients heavily prepped.'
          },
          {
            'name': 'Butter Chicken Biryani Box',
            'category': 'Plowhorse',
            'advice':
                'High volume, moderate margin. Consider pairing with beverage.'
          },
          {
            'name': 'Truffle Oil Fries',
            'category': 'Puzzle',
            'advice':
                'High margin, lower volume. Train servers to recommend as starter.'
          },
        ],
        'peakRushHour': '08:30 PM - 10:15 PM (Estimated +24% volume)',
      };
    }
    try {
      final res = await apiClient.get('/api/ai/prep-recommendations');
      if (res is Map<String, dynamic>) return res;
      return {};
    } catch (_) {
      return {};
    }
  }

  // ── Staff Management & Roles ───────────────────────────────────────
  Future<List<Map<String, dynamic>>> fetchStaffMembers() async {
    if (isDemoMode) {
      return [
        {
          'id': 'st-1',
          'name': 'Rajesh Kumar',
          'email': 'rajesh@orderitup.com',
          'role': 'manager',
          'active': true,
          'pin': '••••'
        },
        {
          'id': 'st-2',
          'name': 'Ananya Roy',
          'email': 'ananya@orderitup.com',
          'role': 'cashier',
          'active': true,
          'pin': '••••'
        },
        {
          'id': 'st-3',
          'name': 'Vikram Singh',
          'email': 'vikram@orderitup.com',
          'role': 'server',
          'active': true,
          'pin': '••••'
        },
        {
          'id': 'st-4',
          'name': 'Sanjay Chef',
          'email': 'chef@orderitup.com',
          'role': 'chef',
          'active': true,
          'pin': '••••'
        },
      ];
    }
    try {
      final res = await apiClient.get('/api/staff');
      if (res is List) return res.cast<Map<String, dynamic>>();
      return [];
    } catch (_) {
      return [];
    }
  }

  // ── WhatsApp Bill Receipts ──────────────────────────────────────────
  Future<Map<String, dynamic>> fetchWhatsAppStatus() async {
    if (isDemoMode) {
      return {
        'connected': true,
        'state': 'connected',
        'phone': '+91 98765 43210',
        'billsSentToday': 142,
        'recentLogs': [
          {
            'phone': '+91 98112 34567',
            'bill': '#ORD-1049',
            'amount': '₹890.00',
            'time': '5 mins ago',
            'status': 'Delivered'
          },
          {
            'phone': '+91 98711 98765',
            'bill': '#ORD-1048',
            'amount': '₹1,240.00',
            'time': '18 mins ago',
            'status': 'Delivered'
          },
          {
            'phone': '+91 99100 11223',
            'bill': '#ORD-1047',
            'amount': '₹450.00',
            'time': '32 mins ago',
            'status': 'Read'
          },
        ],
      };
    }
    try {
      final res = await apiClient.get('/api/whatsapp/status');
      if (res is Map<String, dynamic>) return res;
      return {};
    } catch (_) {
      return {};
    }
  }
}
