import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_theme.dart';
import '../../core/constants/app_constants.dart';
import '../../providers/auth_provider.dart';
import '../../providers/server_config_provider.dart';
import '../server_connect_screen.dart';
import '../login_screen.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final config = Provider.of<ServerConfigProvider>(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Settings & Configuration'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Current Staff Card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: isDark ? AppTheme.surfaceDark : Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: isDark ? AppTheme.borderDark : AppTheme.borderLight),
            ),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 24,
                  backgroundColor: AppTheme.primaryLight,
                  child: const Icon(Icons.person, color: AppTheme.primaryDark, size: 28),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        auth.currentUser?.name ?? 'Staff User',
                        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Role: ${auth.currentUser?.roleDisplayName ?? "Waiter"}',
                        style: const TextStyle(color: AppTheme.primaryDark, fontSize: 13, fontWeight: FontWeight.w600),
                      ),
                      Text(
                        auth.currentUser?.email ?? '',
                        style: TextStyle(fontSize: 12, color: isDark ? AppTheme.textMutedDark : AppTheme.textMutedLight),
                      ),
                    ],
                  ),
                ),
                OutlinedButton(
                  onPressed: () async {
                    await auth.logout();
                    if (context.mounted) {
                      Navigator.pushReplacement(
                        context,
                        MaterialPageRoute(builder: (_) => const LoginScreen()),
                      );
                    }
                  },
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppTheme.danger,
                    side: const BorderSide(color: AppTheme.danger),
                    minimumSize: const Size(60, 36),
                  ),
                  child: const Text('Switch'),
                ),
              ],
            ),
          ),

          const SizedBox(height: 24),
          const Text('Network & POS Connection', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppTheme.neutral)),
          const SizedBox(height: 8),

          Container(
            decoration: BoxDecoration(
              color: isDark ? AppTheme.surfaceDark : Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: isDark ? AppTheme.borderDark : AppTheme.borderLight),
            ),
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.wifi, color: AppTheme.primary),
                  title: const Text('POS Server URL'),
                  subtitle: Text(config.isDemoMode ? 'Running in Demo Mode (Offline)' : config.serverUrl),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const ServerConnectScreen()),
                    );
                  },
                ),
                const Divider(height: 1),
                SwitchListTile(
                  secondary: const Icon(Icons.play_circle_outline, color: AppTheme.warning),
                  title: const Text('Demo Mode (Standalone)'),
                  subtitle: const Text('Run without live desktop connection'),
                  value: config.isDemoMode,
                  activeColor: AppTheme.primary,
                  onChanged: (val) => config.setDemoMode(val),
                ),
              ],
            ),
          ),

          const SizedBox(height: 24),
          const Text('App Information', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppTheme.neutral)),
          const SizedBox(height: 8),

          Container(
            decoration: BoxDecoration(
              color: isDark ? AppTheme.surfaceDark : Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: isDark ? AppTheme.borderDark : AppTheme.borderLight),
            ),
            child: Column(
              children: [
                ListTile(
                  leading: Image.asset(
                    'assets/images/logo.png',
                    width: 28,
                    height: 28,
                    errorBuilder: (_, __, ___) => const Icon(Icons.restaurant, color: AppTheme.primary),
                  ),
                  title: const Text(AppConstants.appName, style: TextStyle(fontWeight: FontWeight.bold)),
                  subtitle: const Text('Offline-First Mobile & Tablet POS'),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.info_outline),
                  title: const Text('Version'),
                  trailing: Text(AppConstants.appVersion, style: const TextStyle(fontWeight: FontWeight.w600)),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.devices_outlined),
                  title: const Text('Responsive Engine'),
                  trailing: const Text('Smartphones & Tablets (Active)', style: TextStyle(color: AppTheme.success, fontWeight: FontWeight.w600)),
                ),
              ],
            ),
          ),

          const SizedBox(height: 32),
          Center(
            child: TextButton.icon(
              onPressed: () async {
                await auth.logout();
                if (context.mounted) {
                  Navigator.pushReplacement(
                    context,
                    MaterialPageRoute(builder: (_) => const ServerConnectScreen()),
                  );
                }
              },
              icon: const Icon(Icons.logout, color: AppTheme.danger),
              label: const Text('Sign Out & Disconnect', style: TextStyle(color: AppTheme.danger, fontWeight: FontWeight.w600)),
            ),
          ),
        ],
      ),
    );
  }
}
