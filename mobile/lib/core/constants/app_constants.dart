class AppConstants {
  static const String appName = 'Order It Up';
  static const String appTagline = 'Smart POS for Smartphones & Tablets';
  static const String appVersion = '1.0.0';

  // Network & Ports
  static const int defaultMainApiPort = 3001;
  static const int defaultServerAppPort = 3003;
  static const String defaultHost = '127.0.0.1';

  // Storage Keys
  static const String keyServerHost = 'oiu_server_host';
  static const String keyServerPort = 'oiu_server_port';
  static const String keyAuthToken = 'oiu_auth_token';
  static const String keyUserJson = 'oiu_user_json';
  static const String keyDemoMode = 'oiu_demo_mode';
  static const String keyThemeMode = 'oiu_theme_mode';

  // Roles
  static const String roleWaiter = 'server';
  static const String roleCashier = 'cashier';
  static const String roleChef = 'chef';
  static const String roleManager = 'manager';
  static const String roleOwner = 'owner';

  // Order Statuses
  static const String statusPending = 'pending';
  static const String statusPreparing = 'preparing';
  static const String statusReady = 'ready';
  static const String statusServed = 'served';
  static const String statusCompleted = 'completed';
  static const String statusCancelled = 'cancelled';

  // Table Statuses
  static const String tableAvailable = 'available';
  static const String tableOccupied = 'occupied';
  static const String tableBilled = 'billed';

  // Defaults
  static const String defaultCurrency = '₹';
}
