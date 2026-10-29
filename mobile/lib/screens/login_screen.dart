import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/theme/app_theme.dart';
import '../core/constants/app_constants.dart';
import '../providers/auth_provider.dart';
import '../providers/server_config_provider.dart';
import 'main_navigation_screen.dart';
import 'server_connect_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({Key? key}) : super(key: key);

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final TextEditingController _emailController = TextEditingController(text: 'waiter@restaurant.com');
  final TextEditingController _passwordController = TextEditingController(text: '123456');
  bool _obscurePassword = true;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _onLoginSuccess() {
    Navigator.pushReplacement(
      context,
      MaterialPageRoute(builder: (_) => const MainNavigationScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final config = Provider.of<ServerConfigProvider>(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            Navigator.pushReplacement(
              context,
              MaterialPageRoute(builder: (_) => const ServerConnectScreen()),
            );
          },
        ),
        actions: [
          if (config.isDemoMode)
            Container(
              margin: const EdgeInsets.only(right: 16),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: AppTheme.primaryLight,
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Center(
                child: Text(
                  'DEMO MODE',
                  style: TextStyle(
                    color: AppTheme.primaryDark,
                    fontWeight: FontWeight.w800,
                    fontSize: 11,
                  ),
                ),
              ),
            ),
        ],
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Container(
                      width: 64,
                      height: 64,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: [
                          BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 10),
                        ],
                      ),
                      padding: const EdgeInsets.all(8),
                      child: Image.asset(
                        'assets/images/logo.png',
                        errorBuilder: (_, __, ___) => const Icon(Icons.lock_person_rounded, color: AppTheme.primary, size: 28),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Staff Sign In',
                    style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Sign in with your server, cashier, or manager PIN/credentials',
                    style: TextStyle(
                      fontSize: 13,
                      color: isDark ? AppTheme.textMutedDark : AppTheme.textMutedLight,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 24),

                  // Quick Demo Role Chips
                  const Text(
                    'Instant Role Access (Tap to Test):',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      ActionChip(
                        avatar: const Icon(Icons.table_restaurant, size: 16),
                        label: const Text('Waiter / Server'),
                        onPressed: () {
                          auth.quickLoginDemoRole('server');
                          _onLoginSuccess();
                        },
                      ),
                      ActionChip(
                        avatar: const Icon(Icons.point_of_sale, size: 16),
                        label: const Text('Cashier'),
                        onPressed: () {
                          auth.quickLoginDemoRole('cashier');
                          _onLoginSuccess();
                        },
                      ),
                      ActionChip(
                        avatar: const Icon(Icons.kitchen, size: 16),
                        label: const Text('Kitchen (KDS)'),
                        onPressed: () {
                          auth.quickLoginDemoRole('chef');
                          _onLoginSuccess();
                        },
                      ),
                      ActionChip(
                        avatar: const Icon(Icons.analytics, size: 16),
                        label: const Text('Manager'),
                        onPressed: () {
                          auth.quickLoginDemoRole('manager');
                          _onLoginSuccess();
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),

                  // Email input
                  const Text('Email Address', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(
                      hintText: 'staff@restaurant.com',
                      prefixIcon: Icon(Icons.email_outlined, size: 18),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Password input
                  const Text('Password / PIN', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _passwordController,
                    obscureText: _obscurePassword,
                    decoration: InputDecoration(
                      hintText: 'Enter password or PIN',
                      prefixIcon: const Icon(Icons.lock_outline, size: 18),
                      suffixIcon: IconButton(
                        icon: Icon(_obscurePassword ? Icons.visibility_off : Icons.visibility, size: 18),
                        onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),

                  if (auth.errorMessage != null)
                    Container(
                      padding: const EdgeInsets.all(12),
                      margin: const EdgeInsets.only(bottom: 16),
                      decoration: BoxDecoration(
                        color: AppTheme.danger.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        auth.errorMessage!,
                        style: const TextStyle(color: AppTheme.danger, fontSize: 12),
                      ),
                    ),

                  SizedBox(
                    height: 48,
                    child: ElevatedButton(
                      onPressed: auth.isLoading
                          ? null
                          : () async {
                              final ok = await auth.login(
                                _emailController.text.trim(),
                                _passwordController.text.trim(),
                              );
                              if (ok && mounted) {
                                _onLoginSuccess();
                              }
                            },
                      child: auth.isLoading
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                            )
                          : const Text('Sign In'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
