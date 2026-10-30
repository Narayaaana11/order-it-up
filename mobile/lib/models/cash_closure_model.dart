class CashClosureModel {
  final String id;
  final int zNumber;
  final String businessDate;
  final double openingFloat;
  final double expectedCash;
  final double countedCash;
  final double cardTotal;
  final double upiTotal;
  final double grossSales;
  final DateTime closedAt;
  final String closedBy;
  final String? notes;

  CashClosureModel({
    required this.id,
    required this.zNumber,
    required this.businessDate,
    this.openingFloat = 1000.0,
    required this.expectedCash,
    required this.countedCash,
    this.cardTotal = 0.0,
    this.upiTotal = 0.0,
    required this.grossSales,
    required this.closedAt,
    this.closedBy = 'Manager',
    this.notes,
  });

  double get difference => countedCash - expectedCash;
  bool get isBalanced => difference.abs() < 0.01;
  bool get isOver => difference > 0.01;
  bool get isShort => difference < -0.01;

  factory CashClosureModel.fromJson(Map<String, dynamic> json) {
    return CashClosureModel(
      id: json['id']?.toString() ?? '',
      zNumber: int.tryParse(json['z_number']?.toString() ?? '1') ?? 1,
      businessDate: json['business_date']?.toString() ?? '',
      openingFloat:
          double.tryParse(json['opening_float']?.toString() ?? '0.0') ?? 0.0,
      expectedCash:
          double.tryParse(json['expected_cash']?.toString() ?? '0.0') ?? 0.0,
      countedCash:
          double.tryParse(json['counted_cash']?.toString() ?? '0.0') ?? 0.0,
      cardTotal:
          double.tryParse(json['card_total']?.toString() ?? '0.0') ?? 0.0,
      upiTotal: double.tryParse(json['upi_total']?.toString() ?? '0.0') ?? 0.0,
      grossSales:
          double.tryParse(json['gross_sales']?.toString() ?? '0.0') ?? 0.0,
      closedAt: DateTime.tryParse(json['closed_at']?.toString() ?? '') ??
          DateTime.now(),
      closedBy: json['closed_by']?.toString() ?? 'Manager',
      notes: json['notes']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'z_number': zNumber,
      'business_date': businessDate,
      'opening_float': openingFloat,
      'expected_cash': expectedCash,
      'counted_cash': countedCash,
      'gross_sales': grossSales,
      'closed_at': closedAt.toIso8601String(),
      'closed_by': closedBy,
      'notes': notes,
    };
  }
}
