import 'order_model.dart';

class BillModel {
  final int orderId;
  final String orderNumber;
  final String tableNumber;
  final List<OrderItemModel> items;
  final double subtotal;
  final double taxPercent;
  final double taxAmount;
  final double discountPercent;
  final double discountAmount;
  final double totalPayable;
  final String? customerName;
  final String? customerPhone;
  final String? paymentMethod;
  final String? billNumber;
  final String? settledAt;
  final String? restaurantName;

  BillModel({
    required this.orderId,
    required this.orderNumber,
    required this.tableNumber,
    required this.items,
    required this.subtotal,
    this.taxPercent = 5.0,
    required this.taxAmount,
    this.discountPercent = 0.0,
    this.discountAmount = 0.0,
    required this.totalPayable,
    this.customerName,
    this.customerPhone,
    this.paymentMethod,
    this.billNumber,
    this.settledAt,
    this.restaurantName = 'KANCHI FILTER COFFEE',
  });

  factory BillModel.fromOrder(
    OrderModel order, {
    double discountPercent = 0.0,
    double taxPercent = 5.0,
    String? paymentMethod,
    String? restaurantName,
  }) {
    final sub = order.items.fold<double>(
      0.0,
      (sum, item) => sum + (item.unitPrice * item.quantity),
    );
    final disc = sub * (discountPercent / 100.0);
    final taxable = sub - disc;
    final tax = taxable * (taxPercent / 100.0);
    final total = taxable + tax;

    return BillModel(
      orderId: order.id,
      orderNumber: order.orderNumber,
      tableNumber: order.tableName ?? 'Dine-In',
      items: order.items,
      subtotal: sub,
      taxPercent: taxPercent,
      taxAmount: tax,
      discountPercent: discountPercent,
      discountAmount: disc,
      totalPayable: total,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      paymentMethod: paymentMethod ?? 'cash',
      billNumber: 'INV-${order.id}-${DateTime.now().millisecondsSinceEpoch % 10000}',
      restaurantName: restaurantName ?? 'KANCHI FILTER COFFEE',
    );
  }
}
