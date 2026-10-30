import 'order_model.dart';

class HeldOrderModel {
  final String id;
  final String tableId;
  final String tableName;
  final List<DraftLineModel> items;
  final String? customerId;
  final String? customerName;
  final String? customerPhone;
  final int guestCount;
  final String? orderNotes;
  final DateTime createdAt;

  HeldOrderModel({
    required this.id,
    required this.tableId,
    required this.tableName,
    required this.items,
    this.customerId,
    this.customerName,
    this.customerPhone,
    this.guestCount = 2,
    this.orderNotes,
    required this.createdAt,
  });

  int get totalQuantity => items.fold<int>(0, (sum, i) => sum + i.quantity);

  double get totalAmount =>
      items.fold<double>(0.0, (sum, i) => sum + i.lineTotal);

  factory HeldOrderModel.fromJson(Map<String, dynamic> json) {
    return HeldOrderModel(
      id: json['id']?.toString() ?? '',
      tableId: json['table_id']?.toString() ?? '',
      tableName: json['table_name']?.toString() ?? 'Table',
      items: [], // Parsed when deserializing stored lines
      customerId: json['customer_id']?.toString(),
      customerName: json['customer_name']?.toString(),
      customerPhone: json['customer_phone']?.toString(),
      guestCount: int.tryParse(json['guest_count']?.toString() ?? '2') ?? 2,
      orderNotes: json['order_notes']?.toString(),
      createdAt: DateTime.tryParse(json['created_at']?.toString() ?? '') ??
          DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'table_id': tableId,
      'customer_id': customerId,
      'guest_count': guestCount,
      'order_notes': orderNotes,
      'created_at': createdAt.toIso8601String(),
    };
  }
}
