import 'order_model.dart';

class KdsTicketModel {
  final int id;
  final String orderNumber;
  final String tableNumber;
  final String serverName;
  final String type;
  final String station;
  final DateTime createdAt;
  final String status; // 'waiting', 'preparing', 'ready', 'served'
  final List<OrderItemModel> items;

  KdsTicketModel({
    required this.id,
    required this.orderNumber,
    required this.tableNumber,
    this.serverName = 'Staff',
    this.type = 'Dine-In',
    this.station = 'Main Kitchen',
    required this.createdAt,
    this.status = 'waiting',
    required this.items,
  });

  int get elapsedMinutes {
    return DateTime.now().difference(createdAt).inMinutes;
  }

  bool get isWaiting => status == 'waiting';
  bool get isPreparing => status == 'preparing';
  bool get isReady => status == 'ready';

  bool get isFresh => elapsedMinutes < 5;
  bool get isWarning => elapsedMinutes >= 5 && elapsedMinutes < 15;
  bool get isOverdue => elapsedMinutes >= 15;

  KdsTicketModel copyWith({
    String? status,
    List<OrderItemModel>? items,
  }) {
    return KdsTicketModel(
      id: id,
      orderNumber: orderNumber,
      tableNumber: tableNumber,
      serverName: serverName,
      type: type,
      station: station,
      createdAt: createdAt,
      status: status ?? this.status,
      items: items ?? this.items,
    );
  }
}
