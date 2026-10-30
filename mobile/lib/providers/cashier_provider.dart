import 'package:flutter/material.dart';
import '../models/order_model.dart';
import '../models/bill_model.dart';
import '../services/api_service.dart';

class CashierProvider extends ChangeNotifier {
  final ApiService apiService;

  List<OrderModel> _activeOrders = [];
  OrderModel? _selectedOrder;
  double _discountPercent = 0.0;
  final double _taxPercent = 5.0;
  String _paymentMethod = 'cash';
  bool _isLoading = false;
  bool _isSettling = false;

  CashierProvider({required this.apiService});

  List<OrderModel> get activeOrders =>
      _activeOrders.where((o) => !o.isCompleted).toList();
  OrderModel? get selectedOrder => _selectedOrder;
  double get discountPercent => _discountPercent;
  double get taxPercent => _taxPercent;
  String get paymentMethod => _paymentMethod;
  bool get isLoading => _isLoading;
  bool get isSettling => _isSettling;

  BillModel? get activeBill {
    if (_selectedOrder == null) return null;
    return BillModel.fromOrder(
      _selectedOrder!,
      discountPercent: _discountPercent,
      taxPercent: _taxPercent,
      paymentMethod: _paymentMethod,
    );
  }

  Future<void> loadOrders() async {
    _isLoading = true;
    notifyListeners();

    try {
      _activeOrders = await apiService.getAllOrders();
      if (_selectedOrder != null) {
        final match = _activeOrders.where((o) => o.id == _selectedOrder!.id);
        if (match.isNotEmpty) {
          _selectedOrder = match.first;
        } else {
          _selectedOrder =
              _activeOrders.isNotEmpty ? _activeOrders.first : null;
        }
      } else if (_activeOrders.isNotEmpty) {
        _selectedOrder = _activeOrders.first;
      }
    } catch (_) {}

    _isLoading = false;
    notifyListeners();
  }

  void selectOrder(OrderModel order) {
    _selectedOrder = order;
    notifyListeners();
  }

  void setDiscount(double percent) {
    _discountPercent = percent;
    notifyListeners();
  }

  String _externalReference = '';
  String get externalReference => _externalReference;

  void setPaymentMethod(String method) {
    _paymentMethod = method;
    notifyListeners();
  }

  void setExternalReference(String ref) {
    _externalReference = ref;
    notifyListeners();
  }

  Future<bool> settleBill({String? externalReference}) async {
    if (_selectedOrder == null || activeBill == null) return false;

    _isSettling = true;
    notifyListeners();

    final refToUse = externalReference ??
        (_externalReference.isNotEmpty ? _externalReference : null);

    try {
      final success = await apiService.settleBill(
        orderId: _selectedOrder!.id,
        paymentMethod: _paymentMethod,
        amount: activeBill!.totalPayable,
        externalReferenceId: refToUse,
      );

      if (success) {
        _externalReference = '';
        await loadOrders();
      }
      _isSettling = false;
      notifyListeners();
      return success;
    } catch (_) {
      _isSettling = false;
      notifyListeners();
      return false;
    }
  }
}
