import 'package:flutter/material.dart';
import '../models/kds_ticket_model.dart';
import '../services/api_service.dart';

class KdsProvider extends ChangeNotifier {
  final ApiService apiService;

  List<KdsTicketModel> _tickets = [];
  String _selectedStation = 'All';
  bool _isLoading = false;
  bool _soundAlerts = true;

  KdsProvider({required this.apiService});

  List<KdsTicketModel> get tickets => _tickets;
  String get selectedStation => _selectedStation;
  bool get isLoading => _isLoading;
  bool get soundAlerts => _soundAlerts;

  List<String> get stations => [
        'All',
        'Main Kitchen',
        'Grill Station',
        'Bar',
        'Dessert',
      ];

  List<KdsTicketModel> get filteredTickets {
    if (_selectedStation == 'All') return _tickets;
    return _tickets
        .where((t) =>
            t.station.toLowerCase().contains(_selectedStation.toLowerCase()))
        .toList();
  }

  int get waitingCount => _tickets.where((t) => t.isWaiting).length;
  int get preparingCount => _tickets.where((t) => t.isPreparing).length;
  int get readyCount => _tickets.where((t) => t.isReady).length;

  Future<void> loadTickets() async {
    _isLoading = true;
    notifyListeners();

    try {
      _tickets = await apiService.getKdsTickets();
    } catch (_) {}

    _isLoading = false;
    notifyListeners();
  }

  void selectStation(String station) {
    _selectedStation = station;
    notifyListeners();
  }

  void toggleSound() {
    _soundAlerts = !_soundAlerts;
    notifyListeners();
  }

  Future<void> bumpTicket(int ticketId) async {
    final idx = _tickets.indexWhere((t) => t.id == ticketId);
    if (idx >= 0) {
      final current = _tickets[idx];
      String nextStatus;
      if (current.isWaiting) {
        nextStatus = 'preparing';
      } else if (current.isPreparing) {
        nextStatus = 'ready';
      } else {
        nextStatus = 'served';
      }

      await apiService.updateKdsTicketStatus(ticketId, nextStatus);

      if (nextStatus == 'served') {
        _tickets.removeAt(idx);
      } else {
        _tickets[idx] = current.copyWith(status: nextStatus);
      }
      notifyListeners();
    }
  }
}
