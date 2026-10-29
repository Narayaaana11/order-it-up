import 'product_model.dart';

class OrderItemModel {
  final int id;
  final String productId;
  final String productName;
  final int quantity;
  final double unitPrice;
  final String status; // 'waiting', 'preparing', 'ready', 'served'
  final String? notes;

  OrderItemModel({
    required this.id,
    required this.productId,
    required this.productName,
    required this.quantity,
    this.unitPrice = 0.0,
    this.status = 'waiting',
    this.notes,
  });

  bool get isWaiting => status == 'waiting';
  bool get isPreparing => status == 'preparing';
  bool get isReady => status == 'ready';
  bool get isServed => status == 'served';

  factory OrderItemModel.fromJson(Map<String, dynamic> json) {
    return OrderItemModel(
      id: int.tryParse(json['id']?.toString() ?? '0') ?? 0,
      productId: json['product_id']?.toString() ?? '',
      productName: json['product_name']?.toString() ?? 'Item',
      quantity: int.tryParse(json['quantity']?.toString() ?? '1') ?? 1,
      unitPrice: double.tryParse(json['unit_price']?.toString() ?? '0.0') ?? 0.0,
      status: json['status']?.toString().toLowerCase() ?? 'waiting',
      notes: json['special_instructions']?.toString() ?? json['notes']?.toString(),
    );
  }

  OrderItemModel copyWith({String? status}) {
    return OrderItemModel(
      id: id,
      productId: productId,
      productName: productName,
      quantity: quantity,
      unitPrice: unitPrice,
      status: status ?? this.status,
      notes: notes,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'product_id': productId,
      'product_name': productName,
      'quantity': quantity,
      'unit_price': unitPrice,
      'status': status,
      'special_instructions': notes,
    };
  }
}

class DraftLineModel {
  final ProductModel product;
  int quantity;
  String note;

  DraftLineModel({
    required this.product,
    this.quantity = 1,
    this.note = '',
  });

  double get lineTotal => product.price * quantity;

  DraftLineModel copyWith({
    int? quantity,
    String? note,
  }) {
    return DraftLineModel(
      product: product,
      quantity: quantity ?? this.quantity,
      note: note ?? this.note,
    );
  }
}

class OrderModel {
  final int id;
  final String orderNumber;
  final String? tableId;
  final String? tableName;
  final String type; // 'dine_in', 'takeaway', 'delivery'
  final String status; // 'pending', 'preparing', 'ready', 'served', 'completed'
  final double subtotal;
  final double tax;
  final double total;
  final List<OrderItemModel> items;
  final String? customerName;
  final String? customerPhone;
  final String? createdAt;

  OrderModel({
    required this.id,
    required this.orderNumber,
    this.tableId,
    this.tableName,
    this.type = 'dine_in',
    this.status = 'pending',
    this.subtotal = 0.0,
    this.tax = 0.0,
    required this.total,
    this.items = const [],
    this.customerName,
    this.customerPhone,
    this.createdAt,
  });

  bool get isCompleted => status == 'completed';
  bool get isPending => status == 'pending';
  bool get isPreparing => status == 'preparing';
  bool get isReady => status == 'ready';
  double get totalAmount => total;
  DateTime get createdAtDateTime => createdAt != null ? (DateTime.tryParse(createdAt!) ?? DateTime.now()) : DateTime.now();

  factory OrderModel.fromJson(Map<String, dynamic> json) {
    List<OrderItemModel> parsedItems = [];
    if (json['items'] is List) {
      parsedItems = (json['items'] as List)
          .map((item) => OrderItemModel.fromJson(item as Map<String, dynamic>))
          .toList();
    }

    String? custName;
    String? custPhone;
    if (json['customer'] is Map) {
      custName = json['customer']['name']?.toString();
      custPhone = json['customer']['phone']?.toString();
    }

    final totalVal = double.tryParse(json['total_amount']?.toString() ?? json['total']?.toString() ?? '0.0') ?? 0.0;
    final subVal = double.tryParse(json['subtotal']?.toString() ?? totalVal.toString()) ?? totalVal;
    final taxVal = double.tryParse(json['tax_amount']?.toString() ?? '0.0') ?? 0.0;

    return OrderModel(
      id: int.tryParse(json['id']?.toString() ?? '0') ?? 0,
      orderNumber: json['order_number']?.toString() ?? '#ORD-?',
      tableId: json['table_id']?.toString(),
      tableName: json['table_name']?.toString() ?? json['table_number']?.toString(),
      type: json['type']?.toString().toLowerCase() ?? 'dine_in',
      status: json['status']?.toString().toLowerCase() ?? 'pending',
      subtotal: subVal,
      tax: taxVal,
      total: totalVal,
      items: parsedItems,
      customerName: custName,
      customerPhone: custPhone,
      createdAt: json['created_at']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'order_number': orderNumber,
      'table_id': tableId,
      'type': type,
      'status': status,
      'total_amount': total,
      'items': items.map((i) => i.toJson()).toList(),
    };
  }
}
