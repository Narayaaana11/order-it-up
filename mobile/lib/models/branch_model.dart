class BranchSaleModel {
  final String id;
  final String name;
  final String code;
  final String city;
  final bool isMain;
  final double revenue;
  final int orders;
  final double avgTicket;
  final double cashSales;
  final double digitalSales;
  final int sharePercent;
  final double variance;
  final String status;

  const BranchSaleModel({
    required this.id,
    required this.name,
    this.code = '',
    this.city = '',
    this.isMain = false,
    required this.revenue,
    required this.orders,
    this.avgTicket = 0.0,
    this.cashSales = 0.0,
    this.digitalSales = 0.0,
    this.sharePercent = 0,
    this.variance = 0.0,
    this.status = 'online',
  });

  bool get isOnline => status == 'online';
  bool get hasVarianceAlert => variance.abs() > 50;

  factory BranchSaleModel.fromJson(Map<String, dynamic> json) {
    return BranchSaleModel(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      code: json['code'] as String? ?? '',
      city: json['city'] as String? ?? '',
      isMain: json['isMain'] as bool? ??
          (json['is_main_branch'] == 1 || json['is_main_branch'] == true),
      revenue: (json['revenue'] as num? ?? json['total_sales'] as num? ?? 0.0)
          .toDouble(),
      orders: json['orders'] as int? ?? json['order_count'] as int? ?? 0,
      avgTicket:
          (json['avgTicket'] as num? ?? json['average_ticket'] as num? ?? 0.0)
              .toDouble(),
      cashSales:
          (json['cashSales'] as num? ?? json['cash_sales'] as num? ?? 0.0)
              .toDouble(),
      digitalSales:
          (json['digitalSales'] as num? ?? json['digital_sales'] as num? ?? 0.0)
              .toDouble(),
      sharePercent: json['sharePercent'] as int? ?? 0,
      variance: (json['variance'] as num? ?? 0.0).toDouble(),
      status: json['status'] as String? ?? 'online',
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'code': code,
        'city': city,
        'isMain': isMain,
        'revenue': revenue,
        'orders': orders,
        'avgTicket': avgTicket,
        'cashSales': cashSales,
        'digitalSales': digitalSales,
        'sharePercent': sharePercent,
        'variance': variance,
        'status': status,
      };
}

class ItemVelocityModel {
  final String id;
  final String name;
  final String category;
  final int totalQty;
  final double totalRev;
  final String topBranch;

  const ItemVelocityModel({
    required this.id,
    required this.name,
    required this.category,
    required this.totalQty,
    required this.totalRev,
    required this.topBranch,
  });

  factory ItemVelocityModel.fromJson(Map<String, dynamic> json) {
    return ItemVelocityModel(
      id: json['id'] as String? ?? json['product_name'] as String? ?? '',
      name: json['name'] as String? ?? json['product_name'] as String? ?? '',
      category: json['category'] as String? ?? 'Mains',
      totalQty: json['totalQty'] as int? ??
          (json['quantity_sold'] as num? ?? 0).toInt(),
      totalRev:
          (json['totalRev'] as num? ?? json['total_revenue'] as num? ?? 0.0)
              .toDouble(),
      topBranch: json['topBranch'] as String? ??
          json['branch_name'] as String? ??
          'Connaught Place',
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'category': category,
        'totalQty': totalQty,
        'totalRev': totalRev,
        'topBranch': topBranch,
      };
}

class StockTransferModel {
  final String id;
  final String source;
  final String dest;
  final String item;
  final double qty;
  final String unit;
  String status; // 'pending' | 'dispatched' | 'received'
  final String date;

  StockTransferModel({
    required this.id,
    required this.source,
    required this.dest,
    required this.item,
    required this.qty,
    required this.unit,
    required this.status,
    required this.date,
  });

  factory StockTransferModel.fromJson(Map<String, dynamic> json) {
    return StockTransferModel(
      id: json['id'] as String? ?? '',
      source: json['source'] as String? ??
          json['source_branch_name'] as String? ??
          '',
      dest:
          json['dest'] as String? ?? json['dest_branch_name'] as String? ?? '',
      item: json['item'] as String? ??
          (json['items'] is List && (json['items'] as List).isNotEmpty
              ? json['items'][0]['product_name'] ?? 'Ingredient'
              : 'Material'),
      qty: (json['qty'] as num? ?? 1.0).toDouble(),
      unit: json['unit'] as String? ?? 'units',
      status: json['status'] as String? ?? 'pending',
      date: json['date'] as String? ??
          (json['created_at'] != null
              ? json['created_at'].toString().split('T')[0]
              : '2026-10-12'),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'source': source,
        'dest': dest,
        'item': item,
        'qty': qty,
        'unit': unit,
        'status': status,
        'date': date,
      };
}
