import 'package:flutter/material.dart';
import '../models/cash_closure_model.dart';
import '../services/api_service.dart';

class ClosureProvider extends ChangeNotifier {
  final ApiService apiService;

  List<CashClosureModel> _closures = [];
  CashClosureModel? _activeClosure;
  double _openingFloat = 2000.0;
  bool _isLoading = false;

  ClosureProvider({required this.apiService});

  List<CashClosureModel> get closures => _closures;
  CashClosureModel? get activeClosure => _activeClosure;
  double get openingFloat => _openingFloat;
  bool get isLoading => _isLoading;

  Future<void> loadClosures() async {
    _isLoading = true;
    notifyListeners();

    try {
      _closures = await apiService.getCashClosures();
      if (_closures.isNotEmpty) {
        _activeClosure = _closures.first;
      }
    } catch (_) {}

    _isLoading = false;
    notifyListeners();
  }

  void setOpeningFloat(double amount) {
    _openingFloat = amount;
    notifyListeners();
  }

  Future<CashClosureModel?> closeShift({
    required double countedCash,
    String? notes,
  }) async {
    _isLoading = true;
    notifyListeners();

    final result = await apiService.performCashClosure(
      openingFloat: _openingFloat,
      countedCash: countedCash,
      notes: notes,
    );

    if (result != null) {
      _activeClosure = result;
      await loadClosures();
    }

    _isLoading = false;
    notifyListeners();
    return result;
  }
}
