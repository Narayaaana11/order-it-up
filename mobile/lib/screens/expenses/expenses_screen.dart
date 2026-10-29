import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../core/theme/app_theme.dart';
import '../../core/responsive/responsive_layout.dart';
import '../../services/api_service.dart';
import '../../services/storage_service.dart';
import '../../core/network/api_client.dart';

class ExpensesScreen extends StatefulWidget {
  const ExpensesScreen({Key? key}) : super(key: key);

  @override
  State<ExpensesScreen> createState() => _ExpensesScreenState();
}

class _ExpensesScreenState extends State<ExpensesScreen> {
  late ApiService _apiService;
  bool _isLoading = true;
  List<Map<String, dynamic>> _expenses = [];
  final NumberFormat _currencyFmt = NumberFormat.currency(symbol: '₹', decimalDigits: 2);

  @override
  void initState() {
    super.initState();
    final storage = StorageService();
    final isDemo = storage.isDemoMode();
    _apiService = ApiService(
      apiClient: ApiClient(baseUrl: 'http://${storage.getServerHost()}:${storage.getServerPort()}'),
      isDemoMode: isDemo,
    );
    _loadExpenses();
  }

  Future<void> _loadExpenses() async {
    setState(() => _isLoading = true);
    final list = await _apiService.fetchExpenses();
    if (mounted) {
      setState(() {
        _expenses = list;
        _isLoading = false;
      });
    }
  }

  void _showAddExpenseDialog() {
    final catController = TextEditingController(text: 'Raw Ingredients');
    final amountController = TextEditingController();
    final descController = TextEditingController();
    String paymentMethod = 'Cash';

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDlgState) => AlertDialog(
          title: const Text('Add Store Expense'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  value: catController.text,
                  decoration: const InputDecoration(labelText: 'Category'),
                  items: ['Raw Ingredients', 'Utilities & Gas', 'Staff Welfare', 'Maintenance', 'Packaging']
                      .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                      .toList(),
                  onChanged: (val) {
                    if (val != null) setDlgState(() => catController.text = val);
                  },
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: amountController,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Amount (₹)', prefixText: '₹ '),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: descController,
                  decoration: const InputDecoration(labelText: 'Description / Vendor'),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: paymentMethod,
                  decoration: const InputDecoration(labelText: 'Paid Via'),
                  items: ['Cash', 'UPI', 'Bank Transfer', 'Petty Cash']
                      .map((m) => DropdownMenuItem(value: m, child: Text(m)))
                      .toList(),
                  onChanged: (val) {
                    if (val != null) setDlgState(() => paymentMethod = val);
                  },
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () async {
                final amt = double.tryParse(amountController.text) ?? 0.0;
                if (amt > 0) {
                  final newExp = {
                    'id': 'exp-${DateTime.now().millisecondsSinceEpoch}',
                    'category': catController.text,
                    'amount': amt,
                    'payment_method': paymentMethod,
                    'description': descController.text.isNotEmpty ? descController.text : 'Store expense',
                    'date': 'Today, Just now',
                  };
                  setState(() => _expenses.insert(0, newExp));
                  await _apiService.createExpense(newExp);
                }
                Navigator.pop(ctx);
              },
              child: const Text('Save Expense'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final totalExpenses = _expenses.fold(0.0, (acc, e) => acc + (e['amount'] as num? ?? 0.0).toDouble());

    return Scaffold(
      appBar: AppBar(
        title: const Text('Store Expenses & Petty Cash'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadExpenses,
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showAddExpenseDialog,
        icon: const Icon(Icons.add),
        label: const Text('Add Expense'),
        backgroundColor: AppTheme.primary,
        foregroundColor: Colors.white,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 1200),
                child: RefreshIndicator(
                  onRefresh: _loadExpenses,
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // Summary Card
                        Container(
                          padding: const EdgeInsets.all(18),
                          decoration: BoxDecoration(
                            color: isDark ? AppTheme.surfaceDark : AppTheme.surfaceLight,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: isDark ? AppTheme.borderDark : AppTheme.borderLight),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text('Total Logged Expenses', style: TextStyle(fontSize: 12, color: Colors.grey)),
                                  const SizedBox(height: 4),
                                  Text(_currencyFmt.format(totalExpenses), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
                                ],
                              ),
                              Container(
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: Colors.red.withOpacity(0.12),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: const Icon(Icons.account_balance_wallet, color: Colors.red, size: 24),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 20),

                        const Text('Expense Transactions', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 12),
                        ..._expenses.map((exp) => Container(
                          margin: const EdgeInsets.only(bottom: 10),
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: isDark ? AppTheme.surfaceDark : AppTheme.surfaceLight,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: isDark ? AppTheme.borderDark : AppTheme.borderLight),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: AppTheme.primary.withOpacity(0.12),
                                            borderRadius: BorderRadius.circular(6),
                                          ),
                                          child: Text(
                                            exp['category'] as String? ?? 'General',
                                            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.primary),
                                          ),
                                        ),
                                        const SizedBox(width: 8),
                                        Text(
                                          exp['payment_method'] as String? ?? 'Cash',
                                          style: const TextStyle(fontSize: 11, color: Colors.grey),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 6),
                                    Text(
                                      exp['description'] as String? ?? '',
                                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      exp['date'] as String? ?? '',
                                      style: const TextStyle(fontSize: 11, color: Colors.grey),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 10),
                              Text(
                                '- ${_currencyFmt.format(exp['amount'] ?? 0)}',
                                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.red),
                              ),
                            ],
                          ),
                        )),
                        const SizedBox(height: 70), // Padding for FAB
                      ],
                    ),
                  ),
                ),
              ),
            ),
    );
  }
}
