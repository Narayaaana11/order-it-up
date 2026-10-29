import 'package:flutter/material.dart';
import '../services/api_service.dart';

class ManagerProvider extends ChangeNotifier {
  final ApiService apiService;

  double _totalRevenueToday = 42850.0;
  int _ordersToday = 38;
  int _occupiedTables = 4;
  int _totalTables = 10;
  int _averagePrepMinutes = 14;
  bool _isLoading = false;

  ManagerProvider({required this.apiService});

  double get totalRevenueToday => _totalRevenueToday;
  int get ordersToday => _ordersToday;
  double get averageTicketSize => _ordersToday > 0 ? _totalRevenueToday / _ordersToday : 0.0;
  int get occupiedTables => _occupiedTables;
  int get totalTables => _totalTables;
  double get occupancyPercent => _totalTables > 0 ? (_occupiedTables / _totalTables) * 100 : 0.0;
  int get averagePrepMinutes => _averagePrepMinutes;
  bool get isLoading => _isLoading;

  Future<void> refreshMetrics() async {
    _isLoading = true;
    notifyListeners();

    try {
      final tables = await apiService.getTables();
      final orders = await apiService.getAllOrders();

      _totalTables = tables.length;
      _occupiedTables = tables.where((t) => t.isOccupied || t.isBilled).length;

      if (orders.isNotEmpty) {
        _ordersToday = orders.length;
        _totalRevenueToday = orders.fold<double>(0.0, (sum, o) => sum + o.total);
      }
    } catch (_) {}

    _isLoading = false;
    notifyListeners();
  }
}
