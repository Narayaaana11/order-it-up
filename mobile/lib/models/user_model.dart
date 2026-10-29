class UserModel {
  final String id;
  final String name;
  final String email;
  final String role; // 'server', 'cashier', 'chef', 'manager', 'owner'
  final String? token;

  UserModel({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    this.token,
  });

  bool get isWaiter => role == 'server';
  bool get isCashier => role == 'cashier';
  bool get isChef => role == 'chef';
  bool get isManager => role == 'manager' || role == 'owner';
  bool get isOwner => role == 'owner';

  String get roleDisplayName {
    switch (role) {
      case 'server':
        return 'Server / Waiter';
      case 'cashier':
        return 'Cashier';
      case 'chef':
        return 'Kitchen Chef';
      case 'manager':
        return 'Manager';
      case 'owner':
        return 'Owner';
      default:
        return role;
    }
  }

  factory UserModel.fromJson(Map<String, dynamic> json, {String? token}) {
    return UserModel(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Staff User',
      email: json['email']?.toString() ?? '',
      role: json['role']?.toString().toLowerCase() ?? 'server',
      token: token ?? json['access_token']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'email': email,
      'role': role,
      'access_token': token,
    };
  }
}
