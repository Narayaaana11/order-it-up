import 'package:flutter/material.dart';
import '../models/held_order_model.dart';
import '../models/order_model.dart';
import '../services/api_service.dart';

class HeldOrderProvider extends ChangeNotifier {
  final ApiService apiService;

  List<HeldOrderModel> _heldOrders = [];
  bool _isLoading = false;

  HeldOrderProvider({required this.apiService});

  List<HeldOrderModel> get heldOrders => _heldOrders;
  int get heldCount => _heldOrders.length;
  bool get isLoading => _isLoading;

  Future<void> loadHeldOrders() async {
    _isLoading = true;
    notifyListeners();

    try {
      _heldOrders = await apiService.getHeldOrders();
    } catch (_) {}

    _isLoading = false;
    notifyListeners();
  }

  Future<bool> holdDraft({
    required String tableId,
    required String tableName,
    required List<DraftLineModel> items,
    String? customerName,
    String? customerPhone,
    String? orderNotes,
  }) async {
    return holdCart(
      tableId: tableId,
      tableName: tableName,
      items: items,
      customerName: customerName,
      customerPhone: customerPhone,
      orderNotes: orderNotes,
    );
  }

  Future<bool> holdCart({
    required String tableId,
    required String tableName,
    required List<DraftLineModel> items,
    String? customerName,
    String? customerPhone,
    int guestCount = 2,
    String? orderNotes,
  }) async {
    final newHeld = HeldOrderModel(
      id: 'held-${DateTime.now().millisecondsSinceEpoch}',
      tableId: tableId,
      tableName: tableName,
      items: List.from(items),
      customerName: customerName,
      customerPhone: customerPhone,
      guestCount: guestCount,
      orderNotes: orderNotes,
      createdAt: DateTime.now(),
    );

    final success = await apiService.holdOrder(newHeld);
    if (success) {
      await loadHeldOrders();
    }
    return success;
  }

  Future<void> removeHeld(String id) async {
    await apiService.removeHeldOrder(id);
    _heldOrders.removeWhere((o) => o.id == id);
    notifyListeners();
  }

  Future<void> recallOrder(String id) async {
    await removeHeld(id);
  }
}
