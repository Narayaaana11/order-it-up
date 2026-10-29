import 'package:flutter/material.dart';
import '../models/reservation_model.dart';
import '../services/api_service.dart';

class ReservationProvider extends ChangeNotifier {
  final ApiService apiService;

  List<ReservationModel> _reservations = [];
  bool _isLoading = false;

  ReservationProvider({required this.apiService});

  List<ReservationModel> get reservations => _reservations;
  int get confirmedCount => _reservations.where((r) => r.isConfirmed).length;
  bool get isLoading => _isLoading;

  Future<void> loadReservations() async {
    _isLoading = true;
    notifyListeners();

    try {
      _reservations = await apiService.getReservations();
    } catch (_) {}

    _isLoading = false;
    notifyListeners();
  }

  Future<bool> addReservation({
    required String customerName,
    required String customerPhone,
    required int guestCount,
    required String time,
    String? tableId,
    String? tableNumber,
    String? notes,
  }) async {
    final newRes = ReservationModel(
      id: 'res-${DateTime.now().millisecondsSinceEpoch}',
      customerName: customerName,
      customerPhone: customerPhone,
      guestCount: guestCount,
      reservationDate: 'Today',
      reservationTime: time,
      tableId: tableId,
      tableNumber: tableNumber ?? 'T-Auto',
      notes: notes,
    );

    final ok = await apiService.createReservation(newRes);
    if (ok) {
      await loadReservations();
    }
    return ok;
  }

  Future<void> updateStatus(String id, String status) async {
    await apiService.updateReservationStatus(id, status);
    final idx = _reservations.indexWhere((r) => r.id == id);
    if (idx >= 0) {
      _reservations[idx] = _reservations[idx].copyWith(status: status);
      notifyListeners();
    }
  }
}
