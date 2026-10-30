import 'package:flutter/foundation.dart';
import '../models/branch_model.dart';
import '../services/api_service.dart';

class CloudHqProvider with ChangeNotifier {
  final ApiService apiService;

  List<BranchSaleModel> _branches = [];
  List<ItemVelocityModel> _topItems = [];
  List<StockTransferModel> _transfers = [];
  List<Map<String, dynamic>> _catalogItems = [];
  String _selectedBranchFilter = 'all';
  bool _isLoading = false;
  String? _errorMessage;

  CloudHqProvider({required this.apiService}) {
    loadData();
  }

  List<BranchSaleModel> get branches => _branches;
  List<ItemVelocityModel> get topItems => _topItems;
  List<StockTransferModel> get transfers => _transfers;
  List<Map<String, dynamic>> get catalogItems => _catalogItems;
  String get selectedBranchFilter => _selectedBranchFilter;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  List<BranchSaleModel> get displayedBranches {
    if (_selectedBranchFilter == 'all') return _branches;
    return _branches.where((b) => b.id == _selectedBranchFilter).toList();
  }

  double get totalGroupRevenue {
    return displayedBranches.fold(0.0, (acc, b) => acc + b.revenue);
  }

  int get totalGroupOrders {
    return displayedBranches.fold(0, (acc, b) => acc + b.orders);
  }

  double get avgGroupTicket {
    final orders = totalGroupOrders;
    if (orders <= 0) return 0.0;
    return totalGroupRevenue / orders;
  }

  void setBranchFilter(String branchId) {
    _selectedBranchFilter = branchId;
    notifyListeners();
  }

  Future<void> loadData() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final overview = await apiService.fetchCloudOverview();
      if (overview['branches'] is List) {
        _branches = (overview['branches'] as List)
            .map((b) => BranchSaleModel.fromJson(b as Map<String, dynamic>))
            .toList();
      }
      if (overview['top_items'] is List) {
        _topItems = (overview['top_items'] as List)
            .map((i) => ItemVelocityModel.fromJson(i as Map<String, dynamic>))
            .toList();
      }

      _catalogItems = await apiService.fetchCloudCatalog();
      _transfers = await apiService.fetchStockTransfers();
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString();
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> saveCatalogOverride(
      String productId, double? priceOverride, bool? isAvailable) async {
    final idx = _catalogItems.indexWhere((p) => p['id'] == productId);
    if (idx >= 0) {
      if (priceOverride != null)
        _catalogItems[idx]['overridePrice'] = priceOverride;
      if (isAvailable != null) _catalogItems[idx]['isAvailable'] = isAvailable;
      notifyListeners();
    }
    await apiService.saveCatalogOverride(productId, priceOverride, isAvailable);
  }

  Future<void> requestTransfer({
    required String item,
    required double qty,
    String unit = 'units',
    String source = 'Connaught Place (Main Outlet)',
    String dest = 'Gurugram CyberHub (Franchise)',
  }) async {
    final newTransfer = StockTransferModel(
      id: 'tr-${DateTime.now().millisecondsSinceEpoch}',
      source: source,
      dest: dest,
      item: item,
      qty: qty,
      unit: unit,
      status: 'pending',
      date: DateTime.now().toIso8601String().split('T')[0],
    );

    _transfers.insert(0, newTransfer);
    notifyListeners();
    await apiService.createStockTransfer(newTransfer);
  }

  Future<void> updateTransferStatus(String id, String status) async {
    final idx = _transfers.indexWhere((t) => t.id == id);
    if (idx >= 0) {
      _transfers[idx].status = status;
      notifyListeners();
      await apiService.updateStockTransferStatus(id, status);
    }
  }

  Future<Map<String, dynamic>?> claimPairingPin(String pin) async {
    return await apiService.claimPairingPin(pin);
  }
}
