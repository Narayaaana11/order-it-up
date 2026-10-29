import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/theme/app_theme.dart';
import '../core/constants/app_constants.dart';
import '../providers/server_config_provider.dart';
import '../providers/cloud_hq_provider.dart';
import 'login_screen.dart';

class ServerConnectScreen extends StatefulWidget {
  const ServerConnectScreen({Key? key}) : super(key: key);

  @override
  State<ServerConnectScreen> createState() => _ServerConnectScreenState();
}

class _ServerConnectScreenState extends State<ServerConnectScreen> {
  late TextEditingController _hostController;
  late TextEditingController _portController;
  final TextEditingController _pinController = TextEditingController();
  int _connectionMode = 0; // 0: 6-Digit PIN, 1: Manual IP & Port
  bool _isPairing = false;
  String? _pairError;

  @override
  void initState() {
    super.initState();
    final config = Provider.of<ServerConfigProvider>(context, listen: false);
    _hostController = TextEditingController(text: config.host);
    _portController = TextEditingController(text: config.port.toString());
  }

  @override
  void dispose() {
    _hostController.dispose();
    _portController.dispose();
    _pinController.dispose();
    super.dispose();
  }

  Future<void> _handlePinPairing() async {
    final pin = _pinController.text.trim();
    if (pin.length < 6) {
      setState(() => _pairError = 'Please enter a valid 6-digit pairing code.');
      return;
    }

    setState(() {
      _isPairing = true;
      _pairError = null;
    });

    try {
      final hqProvider = Provider.of<CloudHqProvider>(context, listen: false);
      final res = await hqProvider.claimPairingPin(pin);

      if (res != null && res['success'] == true) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Connected to ${res['branch'] ?? 'Cloud Franchise Terminal'}'),
              backgroundColor: AppTheme.success,
            ),
          );
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(builder: (_) => const LoginScreen()),
          );
        }
      } else {
        setState(() {
          _pairError = 'Invalid or expired 6-digit pairing code. Please generate a new code on your counter POS.';
        });
      }
    } catch (e) {
      setState(() {
        _pairError = 'Pairing error: ${e.toString()}';
      });
    } finally {
      if (mounted) setState(() => _isPairing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final config = Provider.of<ServerConfigProvider>(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
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
                        errorBuilder: (_, __, ___) => const Icon(Icons.wifi_tethering, color: AppTheme.primary, size: 32),
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  const Text(
                    'Connect Mobile POS',
                    style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Pair with your Order It Up POS counter or franchise cloud to begin orders and KDS.',
                    style: TextStyle(
                      fontSize: 13,
                      color: isDark ? AppTheme.textMutedDark : AppTheme.textMutedLight,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 20),

                  // Segmented Mode Selector
                  Container(
                    decoration: BoxDecoration(
                      color: isDark ? AppTheme.surfaceDark : Colors.grey.shade100,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: isDark ? AppTheme.borderDark : AppTheme.borderLight),
                    ),
                    padding: const EdgeInsets.all(4),
                    child: Row(
                      children: [
                        Expanded(
                          child: InkWell(
                            onTap: () => setState(() => _connectionMode = 0),
                            borderRadius: BorderRadius.circular(8),
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 8),
                              decoration: BoxDecoration(
                                color: _connectionMode == 0 ? AppTheme.primary : Colors.transparent,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                '6-Digit PIN Pairing',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: _connectionMode == 0
                                      ? Colors.white
                                      : (isDark ? AppTheme.textMutedDark : AppTheme.textMutedLight),
                                ),
                              ),
                            ),
                          ),
                        ),
                        Expanded(
                          child: InkWell(
                            onTap: () => setState(() => _connectionMode = 1),
                            borderRadius: BorderRadius.circular(8),
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 8),
                              decoration: BoxDecoration(
                                color: _connectionMode == 1 ? AppTheme.primary : Colors.transparent,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                'Local Wi-Fi IP',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: _connectionMode == 1
                                      ? Colors.white
                                      : (isDark ? AppTheme.textMutedDark : AppTheme.textMutedLight),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),

                  if (_connectionMode == 0) ...[
                    // PIN PAIRING MODE
                    const Text(
                      'Counter Pairing PIN',
                      style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Enter the 6-digit PIN shown under Settings → Terminal Pairing on the counter POS.',
                      style: TextStyle(fontSize: 11, color: isDark ? AppTheme.textMutedDark : AppTheme.textMutedLight),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _pinController,
                      keyboardType: TextInputType.number,
                      textAlign: TextAlign.center,
                      maxLength: 6,
                      style: const TextStyle(
                        fontSize: 26,
                        letterSpacing: 10,
                        fontWeight: FontWeight.w800,
                        fontFamily: 'monospace',
                      ),
                      decoration: const InputDecoration(
                        hintText: '123456',
                        counterText: '',
                        prefixIcon: Icon(Icons.pin, size: 20),
                      ),
                    ),
                    const SizedBox(height: 16),

                    if (_pairError != null)
                      Container(
                        padding: const EdgeInsets.all(12),
                        margin: const EdgeInsets.only(bottom: 16),
                        decoration: BoxDecoration(
                          color: AppTheme.danger.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: AppTheme.danger.withOpacity(0.3)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.error_outline, color: AppTheme.danger, size: 18),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                _pairError!,
                                style: const TextStyle(color: AppTheme.danger, fontSize: 12),
                              ),
                            ),
                          ],
                        ),
                      ),

                    SizedBox(
                      height: 48,
                      child: ElevatedButton.icon(
                        onPressed: _isPairing ? null : _handlePinPairing,
                        icon: _isPairing
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                              )
                            : const Icon(Icons.phonelink_setup, size: 20),
                        label: Text(_isPairing ? 'Pairing...' : 'Pair Device Now'),
                      ),
                    ),
                  ] else ...[
                    // LOCAL IP MODE
                    const Text('Server IP / Hostname', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                    const SizedBox(height: 6),
                    TextField(
                      controller: _hostController,
                      keyboardType: TextInputType.url,
                      decoration: const InputDecoration(
                        hintText: 'e.g. 192.168.1.100 or 127.0.0.1',
                        prefixIcon: Icon(Icons.computer, size: 18),
                      ),
                    ),
                    const SizedBox(height: 16),

                    const Text('Port', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _portController,
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(
                              hintText: '3003 (Server App) or 3001',
                              prefixIcon: Icon(Icons.numbers, size: 18),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        OutlinedButton(
                          onPressed: () => _portController.text = '3003',
                          child: const Text(':3003'),
                        ),
                        const SizedBox(width: 4),
                        OutlinedButton(
                          onPressed: () => _portController.text = '3001',
                          child: const Text(':3001'),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),

                    if (config.errorMessage != null)
                      Container(
                        padding: const EdgeInsets.all(12),
                        margin: const EdgeInsets.only(bottom: 16),
                        decoration: BoxDecoration(
                          color: AppTheme.danger.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: AppTheme.danger.withOpacity(0.3)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.error_outline, color: AppTheme.danger, size: 18),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                config.errorMessage!,
                                style: const TextStyle(color: AppTheme.danger, fontSize: 12),
                              ),
                            ),
                          ],
                        ),
                      ),

                    SizedBox(
                      height: 48,
                      child: ElevatedButton(
                        onPressed: config.isChecking
                            ? null
                            : () async {
                                await config.setHost(_hostController.text);
                                await config.setPort(int.tryParse(_portController.text) ?? 3003);
                                await config.setDemoMode(false);
                                final ok = await config.testConnection();
                                if (ok && mounted) {
                                  Navigator.pushReplacement(
                                    context,
                                    MaterialPageRoute(builder: (_) => const LoginScreen()),
                                  );
                                }
                              },
                        child: config.isChecking
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                              )
                            : const Text('Test & Connect'),
                      ),
                    ),
                  ],

                  const SizedBox(height: 24),
                  Row(
                    children: [
                      Expanded(child: Divider(color: isDark ? AppTheme.borderDark : AppTheme.borderLight)),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        child: Text(
                          'OR',
                          style: TextStyle(
                            fontSize: 12,
                            color: isDark ? AppTheme.textMutedDark : AppTheme.textMutedLight,
                          ),
                        ),
                      ),
                      Expanded(child: Divider(color: isDark ? AppTheme.borderDark : AppTheme.borderLight)),
                    ],
                  ),
                  const SizedBox(height: 20),

                  // Standalone Demo Mode button
                  SizedBox(
                    height: 48,
                    child: OutlinedButton.icon(
                      onPressed: () async {
                        await config.setDemoMode(true);
                        if (mounted) {
                          Navigator.pushReplacement(
                            context,
                            MaterialPageRoute(builder: (_) => const LoginScreen()),
                          );
                        }
                      },
                      icon: const Icon(Icons.play_circle_fill_rounded, color: AppTheme.primary),
                      label: const Text(
                        'Launch Demo Mode (Offline)',
                        style: TextStyle(fontWeight: FontWeight.w700),
                      ),
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: AppTheme.primary, width: 1.5),
                        backgroundColor: AppTheme.primaryLight.withOpacity(isDark ? 0.1 : 0.4),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Full smartphone and tablet interactive demo with mock menu, tables, KDS tickets, and cashier checkout.',
                    style: TextStyle(
                      fontSize: 11,
                      color: isDark ? AppTheme.textMutedDark : AppTheme.textMutedLight,
                    ),
                    textAlign: TextAlign.center,
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
