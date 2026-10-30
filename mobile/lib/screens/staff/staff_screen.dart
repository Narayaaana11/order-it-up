import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';
import '../../core/responsive/responsive_layout.dart';
import '../../services/api_service.dart';
import '../../services/storage_service.dart';
import '../../core/network/api_client.dart';

class StaffScreen extends StatefulWidget {
  const StaffScreen({Key? key}) : super(key: key);

  @override
  State<StaffScreen> createState() => _StaffScreenState();
}

class _StaffScreenState extends State<StaffScreen> {
  late ApiService _apiService;
  bool _isLoading = true;
  List<Map<String, dynamic>> _staff = [];
  String _roleFilter = 'all';

  @override
  void initState() {
    super.initState();
    final storage = StorageService();
    final isDemo = storage.isDemoMode();
    _apiService = ApiService(
      apiClient: ApiClient(
          baseUrl:
              'http://${storage.getServerHost()}:${storage.getServerPort()}'),
      isDemoMode: isDemo,
    );
    _loadStaff();
  }

  Future<void> _loadStaff() async {
    setState(() => _isLoading = true);
    final list = await _apiService.fetchStaffMembers();
    if (mounted) {
      setState(() {
        _staff = list;
        _isLoading = false;
      });
    }
  }

  Color _getRoleColor(String role) {
    switch (role.toLowerCase()) {
      case 'owner':
      case 'manager':
        return Colors.purple;
      case 'cashier':
        return Colors.blue;
      case 'server':
        return Colors.green;
      case 'chef':
        return Colors.deepOrange;
      default:
        return AppTheme.primary;
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final filteredStaff = _staff.where((s) {
      if (_roleFilter == 'all') return true;
      return (s['role'] as String? ?? '').toLowerCase() == _roleFilter;
    }).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Staff & Shifts Management'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _loadStaff),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 1200),
                child: Column(
                  children: [
                    // Role Filter Chips
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: Row(
                          children: [
                            'all',
                            'manager',
                            'cashier',
                            'server',
                            'chef'
                          ].map((role) {
                            final isSelected = _roleFilter == role;
                            return Padding(
                              padding: const EdgeInsets.only(right: 8),
                              child: FilterChip(
                                label: Text(role.toUpperCase()),
                                selected: isSelected,
                                onSelected: (_) =>
                                    setState(() => _roleFilter = role),
                                selectedColor:
                                    AppTheme.primary.withOpacity(0.2),
                                checkmarkColor: AppTheme.primary,
                              ),
                            );
                          }).toList(),
                        ),
                      ),
                    ),

                    // Staff Cards
                    Expanded(
                      child: RefreshIndicator(
                        onRefresh: _loadStaff,
                        child: ListView.builder(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          itemCount: filteredStaff.length,
                          itemBuilder: (context, idx) {
                            final s = filteredStaff[idx];
                            final role = (s['role'] as String? ?? 'server')
                                .toLowerCase();
                            final roleColor = _getRoleColor(role);

                            return Container(
                              margin: const EdgeInsets.only(bottom: 10),
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: isDark
                                    ? AppTheme.surfaceDark
                                    : AppTheme.surfaceLight,
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(
                                    color: isDark
                                        ? AppTheme.borderDark
                                        : AppTheme.borderLight),
                              ),
                              child: Row(
                                children: [
                                  CircleAvatar(
                                    radius: 20,
                                    backgroundColor:
                                        roleColor.withOpacity(0.15),
                                    child: Icon(
                                      role == 'chef'
                                          ? Icons.soup_kitchen
                                          : role == 'manager'
                                              ? Icons.badge
                                              : Icons.person,
                                      color: roleColor,
                                      size: 20,
                                    ),
                                  ),
                                  const SizedBox(width: 14),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          s['name'] as String? ??
                                              'Staff Member',
                                          style: const TextStyle(
                                              fontWeight: FontWeight.bold,
                                              fontSize: 14),
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          s['email'] as String? ?? '',
                                          style: const TextStyle(
                                              fontSize: 12, color: Colors.grey),
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 10, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: roleColor.withOpacity(0.12),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Text(
                                      role.toUpperCase(),
                                      style: TextStyle(
                                          color: roleColor,
                                          fontSize: 11,
                                          fontWeight: FontWeight.bold),
                                    ),
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
    );
  }
}
