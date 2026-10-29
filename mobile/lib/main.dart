import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'core/theme/app_theme.dart';
import 'core/constants/app_constants.dart';
import 'core/network/api_client.dart';
import 'services/storage_service.dart';
import 'services/api_service.dart';
import 'providers/server_config_provider.dart';
import 'providers/auth_provider.dart';
import 'providers/table_provider.dart';
import 'providers/menu_provider.dart';
import 'providers/order_provider.dart';
import 'providers/cashier_provider.dart';
import 'providers/kds_provider.dart';
import 'providers/manager_provider.dart';
import 'providers/held_order_provider.dart';
import 'providers/customer_provider.dart';
import 'providers/inventory_provider.dart';
import 'providers/closure_provider.dart';
import 'providers/reservation_provider.dart';
import 'providers/cloud_hq_provider.dart';
import 'screens/splash_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final storageService = StorageService();
  await storageService.init();

  final initialHost = storageService.getServerHost();
  final initialPort = storageService.getServerPort();
  final initialToken = storageService.getAuthToken();
  final isDemoMode = storageService.isDemoMode();

  final apiClient = ApiClient(
    baseUrl: 'http://$initialHost:$initialPort',
    authToken: initialToken,
  );

  final apiService = ApiService(
    apiClient: apiClient,
    isDemoMode: isDemoMode,
  );

  runApp(
    OrderItUpApp(
      storageService: storageService,
      apiService: apiService,
    ),
  );
}

class OrderItUpApp extends StatelessWidget {
  final StorageService storageService;
  final ApiService apiService;

  const OrderItUpApp({
    Key? key,
    required this.storageService,
    required this.apiService,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(
          create: (_) => ServerConfigProvider(
            storageService: storageService,
            apiService: apiService,
          ),
        ),
        ChangeNotifierProvider(
          create: (_) => AuthProvider(
            apiService: apiService,
            storageService: storageService,
          ),
        ),
        ChangeNotifierProvider(
          create: (_) => TableProvider(apiService: apiService),
        ),
        ChangeNotifierProvider(
          create: (_) => MenuProvider(apiService: apiService),
        ),
        ChangeNotifierProvider(
          create: (_) => OrderProvider(apiService: apiService),
        ),
        ChangeNotifierProvider(
          create: (_) => CashierProvider(apiService: apiService),
        ),
        ChangeNotifierProvider(
          create: (_) => KdsProvider(apiService: apiService),
        ),
        ChangeNotifierProvider(
          create: (_) => ManagerProvider(apiService: apiService),
        ),
        ChangeNotifierProvider(
          create: (_) => HeldOrderProvider(apiService: apiService),
        ),
        ChangeNotifierProvider(
          create: (_) => CustomerProvider(apiService: apiService),
        ),
        ChangeNotifierProvider(
          create: (_) => InventoryProvider(apiService: apiService),
        ),
        ChangeNotifierProvider(
          create: (_) => ClosureProvider(apiService: apiService),
        ),
        ChangeNotifierProvider(
          create: (_) => ReservationProvider(apiService: apiService),
        ),
        ChangeNotifierProvider(
          create: (_) => CloudHqProvider(apiService: apiService),
        ),
      ],
      child: MaterialApp(
        title: AppConstants.appName,
        debugShowCheckedModeBanner: false,
        theme: AppTheme.lightTheme,
        darkTheme: AppTheme.darkTheme,
        themeMode: ThemeMode.system,
        home: const SplashScreen(),
      ),
    );
  }
}
