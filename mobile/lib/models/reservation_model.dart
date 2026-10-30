class ReservationModel {
  final String id;
  final String? tableId;
  final String tableNumber;
  final String customerName;
  final String customerPhone;
  final int guestCount;
  final String reservationDate;
  final String reservationTime;
  final String status; // 'confirmed', 'seated', 'cancelled'
  final String? notes;

  ReservationModel({
    required this.id,
    this.tableId,
    this.tableNumber = 'Unassigned',
    required this.customerName,
    required this.customerPhone,
    this.guestCount = 2,
    required this.reservationDate,
    required this.reservationTime,
    this.status = 'confirmed',
    this.notes,
  });

  bool get isConfirmed => status == 'confirmed';
  bool get isSeated => status == 'seated';
  bool get isCancelled => status == 'cancelled';

  factory ReservationModel.fromJson(Map<String, dynamic> json) {
    return ReservationModel(
      id: json['id']?.toString() ?? '',
      tableId: json['table_id']?.toString(),
      tableNumber: json['table_number']?.toString() ??
          json['table_name']?.toString() ??
          'T-?',
      customerName: json['customer_name']?.toString() ?? 'Guest',
      customerPhone: json['customer_phone']?.toString() ?? '',
      guestCount: int.tryParse(json['guest_count']?.toString() ?? '2') ?? 2,
      reservationDate: json['reservation_date']?.toString() ?? '',
      reservationTime: json['reservation_time']?.toString() ?? '',
      status: json['status']?.toString().toLowerCase() ?? 'confirmed',
      notes: json['notes']?.toString(),
    );
  }

  ReservationModel copyWith({
    String? status,
    String? tableId,
    String? tableNumber,
  }) {
    return ReservationModel(
      id: id,
      tableId: tableId ?? this.tableId,
      tableNumber: tableNumber ?? this.tableNumber,
      customerName: customerName,
      customerPhone: customerPhone,
      guestCount: guestCount,
      reservationDate: reservationDate,
      reservationTime: reservationTime,
      status: status ?? this.status,
      notes: notes,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'table_id': tableId,
      'customer_name': customerName,
      'customer_phone': customerPhone,
      'guest_count': guestCount,
      'reservation_date': reservationDate,
      'reservation_time': reservationTime,
      'status': status,
      'notes': notes,
    };
  }
}
