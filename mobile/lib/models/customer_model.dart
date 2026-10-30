class CustomerModel {
  final String id;
  final String name;
  final String phone;
  final String? email;
  final double loyaltyPoints;
  final int totalVisits;
  final double totalSpend;
  final String? notes;
  final String? lastVisit;

  CustomerModel({
    required this.id,
    required this.name,
    required this.phone,
    this.email,
    this.loyaltyPoints = 0.0,
    this.totalVisits = 1,
    this.totalSpend = 0.0,
    this.notes,
    this.lastVisit,
  });

  factory CustomerModel.fromJson(Map<String, dynamic> json) {
    return CustomerModel(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Guest',
      phone: json['phone']?.toString() ?? '',
      email: json['email']?.toString(),
      loyaltyPoints: double.tryParse(json['loyalty_points']?.toString() ??
              json['wallet_balance']?.toString() ??
              '0.0') ??
          0.0,
      totalVisits: int.tryParse(json['total_visits']?.toString() ??
              json['orders_count']?.toString() ??
              '1') ??
          1,
      totalSpend:
          double.tryParse(json['total_spend']?.toString() ?? '0.0') ?? 0.0,
      notes: json['notes']?.toString(),
      lastVisit:
          json['last_visit']?.toString() ?? json['created_at']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'phone': phone,
      'email': email,
      'loyalty_points': loyaltyPoints,
      'total_visits': totalVisits,
      'total_spend': totalSpend,
      'notes': notes,
    };
  }
}
