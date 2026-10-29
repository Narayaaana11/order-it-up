import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_theme.dart';
import '../../core/constants/app_constants.dart';
import '../../providers/customer_provider.dart';
import '../../providers/order_provider.dart';

class CustomerCrmScreen extends StatefulWidget {
  const CustomerCrmScreen({Key? key}) : super(key: key);

  @override
  State<CustomerCrmScreen> createState() => _CustomerCrmScreenState();
}

class _CustomerCrmScreenState extends State<CustomerCrmScreen> {
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<CustomerProvider>(context, listen: false).loadCustomers();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _showAddCustomerDialog() {
    final nameCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    final emailCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Add New Customer'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Full Name')),
            const SizedBox(height: 8),
            TextField(controller: phoneCtrl, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Phone Number')),
            const SizedBox(height: 8),
            TextField(controller: emailCtrl, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Email (Optional)')),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              if (nameCtrl.text.isNotEmpty && phoneCtrl.text.isNotEmpty) {
                await Provider.of<CustomerProvider>(context, listen: false).addCustomer(
                  name: nameCtrl.text.trim(),
                  phone: phoneCtrl.text.trim(),
                  email: emailCtrl.text.trim().isNotEmpty ? emailCtrl.text.trim() : null,
                );
                if (mounted) Navigator.pop(context);
              }
            },
            child: const Text('Save Customer'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final custProv = Provider.of<CustomerProvider>(context);
    final orderProv = Provider.of<OrderProvider>(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Customer CRM & Loyalty Wallet'),
        actions: [
          IconButton(
            icon: const Icon(Icons.person_add),
            tooltip: 'Add Customer',
            onPressed: _showAddCustomerDialog,
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              controller: _searchController,
              onChanged: custProv.setSearchQuery,
              decoration: const InputDecoration(
                hintText: 'Search by phone number or guest name...',
                prefixIcon: Icon(Icons.search),
              ),
            ),
          ),
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              itemCount: custProv.filteredCustomers.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, index) {
                final cust = custProv.filteredCustomers[index];

                return Container(
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
                        backgroundColor: const Color(0xFF8B5CF6).withOpacity(0.12),
                        child: const Icon(Icons.person, color: Color(0xFF8B5CF6), size: 28),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(cust.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                            const SizedBox(height: 2),
                            Text(cust.phone, style: TextStyle(fontSize: 13, color: isDark ? AppTheme.textMutedDark : AppTheme.textMutedLight)),
                            const SizedBox(height: 4),
                            Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: AppTheme.primaryLight,
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: Text(
                                    '🪙 ${cust.loyaltyPoints.toStringAsFixed(0)} Points',
                                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.primaryDark),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  '${cust.totalVisits} Visits • ${AppConstants.defaultCurrency}${cust.totalSpend.toStringAsFixed(0)}',
                                  style: TextStyle(fontSize: 11, color: isDark ? AppTheme.textMutedDark : AppTheme.textMutedLight),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      ElevatedButton(
                        onPressed: () {
                          orderProv.setCustomer(cust.name, cust.phone);
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('Tagged ${cust.name} to active order!'), backgroundColor: AppTheme.success),
                          );
                          Navigator.pop(context);
                        },
                        style: ElevatedButton.styleFrom(
                          minimumSize: const Size(64, 36),
                          padding: const EdgeInsets.symmetric(horizontal: 10),
                        ),
                        child: const Text('Tag to Order', style: TextStyle(fontSize: 12)),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
