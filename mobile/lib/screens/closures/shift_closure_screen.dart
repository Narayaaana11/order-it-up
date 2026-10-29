import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_theme.dart';
import '../../core/constants/app_constants.dart';
import '../../providers/closure_provider.dart';
import '../../providers/manager_provider.dart';

class ShiftClosureScreen extends StatefulWidget {
  const ShiftClosureScreen({Key? key}) : super(key: key);

  @override
  State<ShiftClosureScreen> createState() => _ShiftClosureScreenState();
}

class _ShiftClosureScreenState extends State<ShiftClosureScreen> {
  final TextEditingController _countedCashCtrl = TextEditingController(text: '18450');
  final TextEditingController _notesCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<ClosureProvider>(context, listen: false).loadClosures();
    });
  }

  @override
  void dispose() {
    _countedCashCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  void _showZReportDialog(BuildContext context, dynamic closure) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: Center(
          child: Column(
            children: [
              const Text('*** Z-REPORT ***', style: TextStyle(fontFamily: 'Courier', fontWeight: FontWeight.bold, fontSize: 18)),
              Text('Z-Number #${closure.zNumber}', style: const TextStyle(fontFamily: 'Courier', fontSize: 12)),
            ],
          ),
        ),
        content: SizedBox(
          width: 320,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Divider(),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Business Date:', style: TextStyle(fontFamily: 'Courier', fontSize: 12)),
                  Text('${closure.businessDate}', style: const TextStyle(fontFamily: 'Courier', fontSize: 12)),
                ],
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Closed By:', style: TextStyle(fontFamily: 'Courier', fontSize: 12)),
                  Text('${closure.closedBy}', style: const TextStyle(fontFamily: 'Courier', fontSize: 12)),
                ],
              ),
              const Divider(),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Opening Float:', style: TextStyle(fontFamily: 'Courier', fontSize: 12)),
                  Text('${AppConstants.defaultCurrency}${closure.openingFloat.toStringAsFixed(0)}', style: const TextStyle(fontFamily: 'Courier', fontSize: 12)),
                ],
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Expected Cash:', style: TextStyle(fontFamily: 'Courier', fontSize: 12)),
                  Text('${AppConstants.defaultCurrency}${closure.expectedCash.toStringAsFixed(0)}', style: const TextStyle(fontFamily: 'Courier', fontSize: 12)),
                ],
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Counted Cash:', style: TextStyle(fontFamily: 'Courier', fontSize: 12)),
                  Text('${AppConstants.defaultCurrency}${closure.countedCash.toStringAsFixed(0)}', style: const TextStyle(fontFamily: 'Courier', fontSize: 12)),
                ],
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Cash Variance:', style: TextStyle(fontFamily: 'Courier', fontSize: 12, fontWeight: FontWeight.bold)),
                  Text(
                    '${AppConstants.defaultCurrency}${closure.difference.toStringAsFixed(0)}',
                    style: TextStyle(
                      fontFamily: 'Courier',
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: closure.isShort ? AppTheme.danger : (closure.isOver ? AppTheme.warning : AppTheme.success),
                    ),
                  ),
                ],
              ),
              const Divider(),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('GROSS SALES:', style: TextStyle(fontFamily: 'Courier', fontSize: 13, fontWeight: FontWeight.bold)),
                  Text('${AppConstants.defaultCurrency}${closure.grossSales.toStringAsFixed(0)}', style: const TextStyle(fontFamily: 'Courier', fontSize: 13, fontWeight: FontWeight.bold)),
                ],
              ),
              const Divider(),
            ],
          ),
        ),
        actions: [
          ElevatedButton(onPressed: () => Navigator.pop(context), child: const Text('Close')),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final closureProv = Provider.of<ClosureProvider>(context);
    final mgrProv = Provider.of<ManagerProvider>(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final expected = 18450.0;
    final counted = double.tryParse(_countedCashCtrl.text) ?? expected;
    final diff = counted - expected;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Shift Cash Closure (Z-Report)'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Drawer Reconciliation Card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: isDark ? AppTheme.surfaceDark : Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: isDark ? AppTheme.borderDark : AppTheme.borderLight),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text('End of Day Drawer Count', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Opening Cash Drawer Float:'),
                      Text('${AppConstants.defaultCurrency}${closureProv.openingFloat.toStringAsFixed(0)}', style: const TextStyle(fontWeight: FontWeight.bold)),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('POS Expected Cash:'),
                      Text('${AppConstants.defaultCurrency}${expected.toStringAsFixed(0)}', style: const TextStyle(fontWeight: FontWeight.bold)),
                    ],
                  ),
                  const Divider(height: 20),
                  const Text('Enter Physical Cash Counted in Drawer:', style: TextStyle(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _countedCashCtrl,
                    keyboardType: TextInputType.number,
                    onChanged: (_) => setState(() {}),
                    decoration: InputDecoration(
                      prefixText: AppConstants.defaultCurrency,
                      prefixStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                  ),
                  const SizedBox(height: 14),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: (diff.abs() < 0.01 ? AppTheme.success : AppTheme.danger).withOpacity(0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Drawer Variance:'),
                        Text(
                          diff.abs() < 0.01
                              ? 'BALANCED (₹0.00)'
                              : (diff < 0 ? 'SHORT (-₹${(-diff).toStringAsFixed(0)})' : 'OVER (+₹${diff.toStringAsFixed(0)})'),
                          style: TextStyle(
                            fontWeight: FontWeight.w800,
                            color: diff.abs() < 0.01 ? AppTheme.success : AppTheme.danger,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: _notesCtrl,
                    decoration: const InputDecoration(hintText: 'Closure audit notes (e.g. drop box deposit)...'),
                    maxLines: 2,
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    height: 48,
                    child: ElevatedButton.icon(
                      onPressed: () async {
                        final res = await closureProv.closeShift(
                          countedCash: counted,
                          notes: _notesCtrl.text.trim(),
                        );
                        if (res != null && mounted) {
                          _showZReportDialog(context, res);
                        }
                      },
                      icon: const Icon(Icons.lock),
                      label: const Text('Close Shift & Generate Z-Report'),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),
            const Text('Previous Shift Z-Reports', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
            const SizedBox(height: 10),

            ...closureProv.closures.map((cls) => Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    leading: const Icon(Icons.receipt_long, color: AppTheme.primary),
                    title: Text('Z-Report #${cls.zNumber} (${cls.businessDate})', style: const TextStyle(fontWeight: FontWeight.w700)),
                    subtitle: Text('Gross Sales: ${AppConstants.defaultCurrency}${cls.grossSales.toStringAsFixed(0)} • Closed by ${cls.closedBy}'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => _showZReportDialog(context, cls),
                  ),
                )),
          ],
        ),
      ),
    );
  }
}
