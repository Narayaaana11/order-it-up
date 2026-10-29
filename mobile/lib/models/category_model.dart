class CategoryModel {
  final String id;
  final String name;
  final int sortOrder;
  final String? icon;

  CategoryModel({
    required this.id,
    required this.name,
    this.sortOrder = 0,
    this.icon,
  });

  factory CategoryModel.fromJson(Map<String, dynamic> json) {
    return CategoryModel(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Category',
      sortOrder: int.tryParse(json['sort_order']?.toString() ?? '0') ?? 0,
      icon: json['icon']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'sort_order': sortOrder,
      'icon': icon,
    };
  }
}
