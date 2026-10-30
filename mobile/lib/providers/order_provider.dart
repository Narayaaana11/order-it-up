import 'package:flutter/material.dart';
import '../models/order_model.dart';
import '../models/product_model.dart';
import '../services/api_service.dart';

class OrderProvider extends ChangeNotifier {
  final ApiService apiService;

  List<DraftLineModel> _draftLines = [];
  OrderModel? _currentTableOrder;
  String _customerName = '';
  String _customerPhone = '';
  bool _isSubmitting = false;

  // Desktop cart-matching state
  String _orderType = 'dine_in'; // 'dine_in', 'takeaway', 'delivery', 'online'
  String? _selectedTableId;
  String? _selectedTableName;
  int _guestCount = 1;
  String _deliveryAddress = '';
  double _discountAmount = 0.0;
  double _discountPercent = 0.0;
  bool _isPercentDiscount = false;
  double _appliedLoyaltyPoints = 0.0;
  String? _heldOrderId;
  String? _errorMessage;

  OrderProvider({required this.apiService});

  List<DraftLineModel> get draftLines => _draftLines;
  OrderModel? get currentTableOrder => _currentTableOrder;
  String get customerName => _customerName;
  String get customerPhone => _customerPhone;
  bool get isSubmitting => _isSubmitting;
  String? get errorMessage => _errorMessage;

  String get orderType => _orderType;
  String? get selectedTableId => _selectedTableId;
  String? get selectedTableName => _selectedTableName;
  int get guestCount => _guestCount;
  String get deliveryAddress => _deliveryAddress;
  double get discountAmount => _discountAmount;
  double get discountPercent => _discountPercent;
  bool get isPercentDiscount => _isPercentDiscount;
  double get appliedLoyaltyPoints => _appliedLoyaltyPoints;
  String? get heldOrderId => _heldOrderId;

  int get totalItemCount {
    return _draftLines.fold<int>(0, (sum, line) => sum + line.quantity);
  }

  double get subtotal {
    return _draftLines.fold<double>(0.0, (sum, line) => sum + line.lineTotal);
  }

  double get discountTotal {
    if (_isPercentDiscount) {
      return (subtotal * (_discountPercent / 100)).clamp(0.0, subtotal);
    }
    return _discountAmount.clamp(0.0, subtotal);
  }

  double get taxableAmount {
    return (subtotal - discountTotal).clamp(0.0, double.infinity);
  }

  double get taxTotal {
    // 5% GST (2.5% CGST + 2.5% SGST) matching desktop
    return taxableAmount * 0.05;
  }

  double get grandTotal {
    final raw = taxableAmount + taxTotal - _appliedLoyaltyPoints;
    return raw > 0 ? raw : 0.0;
  }

  // Backward compatibility getter
  double get draftTotal => subtotal;

  void setOrderType(String type) {
    _orderType = type;
    if (_orderType != 'dine_in') {
      _selectedTableId = null;
      _selectedTableName = null;
    }
    notifyListeners();
  }

  void setTable(String? id, String? name) {
    _selectedTableId = id;
    _selectedTableName = name;
    if (id != null) {
      loadActiveTableOrder(id);
    } else {
      _currentTableOrder = null;
    }
    notifyListeners();
  }

  void setGuestCount(int count) {
    _guestCount = count.clamp(1, 99);
    notifyListeners();
  }

  void setDeliveryAddress(String address) {
    _deliveryAddress = address;
    notifyListeners();
  }

  void applyDiscount(
      {double amount = 0.0, double percent = 0.0, bool isPercent = false}) {
    _isPercentDiscount = isPercent;
    _discountPercent = percent;
    _discountAmount = amount;
    notifyListeners();
  }

  void clearDiscount() {
    _discountAmount = 0.0;
    _discountPercent = 0.0;
    _isPercentDiscount = false;
    notifyListeners();
  }

  void applyLoyaltyPoints(double points) {
    _appliedLoyaltyPoints = points.clamp(0.0, taxableAmount + taxTotal);
    notifyListeners();
  }

  void clearLoyaltyPoints() {
    _appliedLoyaltyPoints = 0.0;
    notifyListeners();
  }

  void addProduct(ProductModel product, {String note = ''}) {
    final existingIdx = _draftLines.indexWhere(
      (line) => line.product.id == product.id && line.note == note,
    );

    if (existingIdx >= 0) {
      _draftLines[existingIdx].quantity += 1;
    } else {
      _draftLines.add(DraftLineModel(
        product: product,
        quantity: 1,
        note: note,
      ));
    }
    notifyListeners();
  }

  void changeQuantity(String productId, int delta) {
    final idx = _draftLines.indexWhere((l) => l.product.id == productId);
    if (idx >= 0) {
      final line = _draftLines[idx];
      line.quantity += delta;
      if (line.quantity <= 0) {
        _draftLines.removeAt(idx);
      }
      notifyListeners();
    }
  }

  void updateLineNote(String productId, String note) {
    final idx = _draftLines.indexWhere((l) => l.product.id == productId);
    if (idx >= 0) {
      _draftLines[idx].note = note;
      notifyListeners();
    }
  }

  void removeProduct(String productId) {
    _draftLines.removeWhere((l) => l.product.id == productId);
    notifyListeners();
  }

  void clearDraft() {
    _draftLines.clear();
    _customerName = '';
    _customerPhone = '';
    _discountAmount = 0.0;
    _discountPercent = 0.0;
    _appliedLoyaltyPoints = 0.0;
    _heldOrderId = null;
    notifyListeners();
  }

  void setCustomer(String name, String phone) {
    _customerName = name;
    _customerPhone = phone;
    notifyListeners();
  }

  void loadCartItems({
    required List<DraftLineModel> items,
    String? tableId,
    String? tableName,
    String? customerName,
    String? customerPhone,
    int guestCount = 1,
    String? heldOrderId,
  }) {
    _draftLines = List.from(items);
    _selectedTableId = tableId;
    _selectedTableName = tableName;
    _customerName = customerName ?? '';
    _customerPhone = customerPhone ?? '';
    _guestCount = guestCount;
    _heldOrderId = heldOrderId;
    notifyListeners();
  }

  Future<void> loadActiveTableOrder(String tableId) async {
    _errorMessage = null;
    try {
      _currentTableOrder = await apiService.getActiveOrderForTable(tableId);
      if (_currentTableOrder?.customerName != null) {
        _customerName = _currentTableOrder!.customerName!;
        _customerPhone = _currentTableOrder!.customerPhone ?? '';
      }
    } catch (e) {
      _currentTableOrder = null;
      _errorMessage = e.toString().replaceAll('ApiException: ', '');
    }
    notifyListeners();
  }

  Future<bool> sendDraftOrder(String tableId) async {
    if (_draftLines.isEmpty) return false;

    _isSubmitting = true;
    notifyListeners();

    try {
      final success = await apiService.sendOrder(
        tableId: tableId,
        items: _draftLines,
        customerName: _customerName.isNotEmpty ? _customerName : null,
        customerPhone: _customerPhone.isNotEmpty ? _customerPhone : null,
        existingOrderId: _currentTableOrder?.id,
      );

      if (success) {
        _draftLines.clear();
        await loadActiveTableOrder(tableId);
      }
      _isSubmitting = false;
      notifyListeners();
      return success;
    } catch (e) {
      _isSubmitting = false;
      notifyListeners();
      return false;
    }
  }
}
