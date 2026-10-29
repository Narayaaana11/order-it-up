class IngredientModel {
  final String id;
  final String name;
  final String unit; // 'kg', 'ltr', 'pcs', 'grams'
  final double currentStock;
  final double minimumStock;
  final double costPerUnit;
  final bool isActive;

  IngredientModel({
    required this.id,
    required this.name,
    this.unit = 'kg',
    required this.currentStock,
    this.minimumStock = 5.0,
    this.costPerUnit = 0.0,
    this.isActive = true,
  });

  bool get isLowStock => currentStock <= minimumStock;

  factory IngredientModel.fromJson(Map<String, dynamic> json) {
    return IngredientModel(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Ingredient',
      unit: json['unit']?.toString() ?? 'kg',
      currentStock: double.tryParse(json['current_stock']?.toString() ?? '0.0') ?? 0.0,
      minimumStock: double.tryParse(json['minimum_stock']?.toString() ?? '5.0') ?? 5.0,
      costPerUnit: double.tryParse(json['cost_per_unit']?.toString() ?? '0.0') ?? 0.0,
      isActive: json['is_active'] == 1 || json['is_active'] == true,
    );
  }

  IngredientModel copyWith({
    double? currentStock,
  }) {
    return IngredientModel(
      id: id,
      name: name,
      unit: unit,
      currentStock: currentStock ?? this.currentStock,
      minimumStock: minimumStock,
      costPerUnit: costPerUnit,
      isActive: isActive,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'unit': unit,
      'current_stock': currentStock,
      'minimum_stock': minimumStock,
      'cost_per_unit': costPerUnit,
    };
  }
}
