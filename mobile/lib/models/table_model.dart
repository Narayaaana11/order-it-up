class TableModel {
  final String id;
  final String number;
  final int capacity;
  final String section;
  final String status; // 'available', 'occupied', 'billed'
  final int? activeOrderId;
  final String? activeOrderNumber;
  final double? activeOrderTotal;
  final String? seatedAt;

  TableModel({
    required this.id,
    required this.number,
    this.capacity = 4,
    this.section = 'Main Dining',
    this.status = 'available',
    this.activeOrderId,
    this.activeOrderNumber,
    this.activeOrderTotal,
    this.seatedAt,
  });

  bool get isAvailable => status == 'available';
  bool get isOccupied => status == 'occupied';
  bool get isBilled => status == 'billed';
  String get name => number;

  factory TableModel.fromJson(Map<String, dynamic> json) {
    final activeOrder = json['activeOrder'] ?? json['current_order'];
    int? orderId;
    String? orderNum;
    double? orderTot;

    if (activeOrder is Map<String, dynamic>) {
      orderId = activeOrder['id'] != null ? int.tryParse(activeOrder['id'].toString()) : null;
      orderNum = activeOrder['order_number']?.toString();
      orderTot = activeOrder['total_amount'] != null
          ? double.tryParse(activeOrder['total_amount'].toString())
          : null;
    }

    final rawStatus = json['status']?.toString().toLowerCase() ?? 'available';
    // If order exists and status was available, treat as occupied
    final finalStatus = (orderId != null && rawStatus == 'available') ? 'occupied' : rawStatus;

    return TableModel(
      id: json['id']?.toString() ?? '',
      number: json['number']?.toString() ?? json['name']?.toString() ?? 'T-?',
      capacity: int.tryParse(json['capacity']?.toString() ?? '4') ?? 4,
      section: json['section']?.toString() ?? json['floor']?.toString() ?? 'Main Dining',
      status: finalStatus,
      activeOrderId: orderId,
      activeOrderNumber: orderNum,
      activeOrderTotal: orderTot,
      seatedAt: json['seated_at']?.toString(),
    );
  }

  TableModel copyWith({
    String? status,
    int? activeOrderId,
    String? activeOrderNumber,
    double? activeOrderTotal,
  }) {
    return TableModel(
      id: id,
      number: number,
      capacity: capacity,
      section: section,
      status: status ?? this.status,
      activeOrderId: activeOrderId ?? this.activeOrderId,
      activeOrderNumber: activeOrderNumber ?? this.activeOrderNumber,
      activeOrderTotal: activeOrderTotal ?? this.activeOrderTotal,
      seatedAt: seatedAt,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'number': number,
      'capacity': capacity,
      'section': section,
      'status': status,
      'active_order_id': activeOrderId,
    };
  }
}
