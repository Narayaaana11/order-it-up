class ProductModel {
  final String id;
  final String? categoryId;
  final String name;
  final double price;
  final String description;
  final bool isActive;
  final String dietaryType; // 'veg', 'non_veg', 'vegan'
  final String station; // 'kitchen', 'bar', 'grill', 'dessert'
  final List<String> availableVariants;

  ProductModel({
    required this.id,
    this.categoryId,
    required this.name,
    required this.price,
    this.description = '',
    this.isActive = true,
    this.dietaryType = 'veg',
    this.station = 'kitchen',
    this.availableVariants = const [],
  });

  bool get isVeg => dietaryType == 'veg' || dietaryType == 'vegan';
  bool get isAvailable => isActive;
  String? get categoryName => null;
  String? get code => null;

  factory ProductModel.fromJson(Map<String, dynamic> json) {
    final rawPrice = json['price'];
    final parsedPrice = rawPrice != null ? (double.tryParse(rawPrice.toString()) ?? 0.0) : 0.0;
    final activeVal = json['is_active'];
    final isActive = activeVal == null || activeVal == 1 || activeVal == true || activeVal.toString() == '1';

    return ProductModel(
      id: json['id']?.toString() ?? '',
      categoryId: json['category_id']?.toString(),
      name: json['name']?.toString() ?? 'Item',
      price: parsedPrice,
      description: json['description']?.toString() ?? '',
      isActive: isActive,
      dietaryType: json['dietary_type']?.toString().toLowerCase() ?? 'veg',
      station: json['kitchen_station']?.toString() ?? 'kitchen',
    );
  }

  ProductModel copyWith({
    bool? isActive,
  }) {
    return ProductModel(
      id: id,
      categoryId: categoryId,
      name: name,
      price: price,
      description: description,
      isActive: isActive ?? this.isActive,
      dietaryType: dietaryType,
      station: station,
      availableVariants: availableVariants,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'category_id': categoryId,
      'name': name,
      'price': price,
      'description': description,
      'is_active': isActive ? 1 : 0,
      'dietary_type': dietaryType,
      'kitchen_station': station,
    };
  }
}
