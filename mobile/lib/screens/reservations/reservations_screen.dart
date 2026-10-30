import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_theme.dart';
import '../../providers/reservation_provider.dart';
import '../../providers/table_provider.dart';

class ReservationsScreen extends StatefulWidget {
  const ReservationsScreen({Key? key}) : super(key: key);

  @override
  State<ReservationsScreen> createState() => _ReservationsScreenState();
}

class _ReservationsScreenState extends State<ReservationsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<ReservationProvider>(context, listen: false)
          .loadReservations();
    });
  }

  void _showNewBookingDialog() {
    final nameCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    final guestCtrl = TextEditingController(text: '4');
    final timeCtrl = TextEditingController(text: '08:00 PM');
    final notesCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('New Table Reservation'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                  controller: nameCtrl,
                  decoration: const InputDecoration(labelText: 'Guest Name')),
              const SizedBox(height: 8),
              TextField(
                  controller: phoneCtrl,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(labelText: 'Phone Number')),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                      child: TextField(
                          controller: guestCtrl,
                          keyboardType: TextInputType.number,
                          decoration:
                              const InputDecoration(labelText: 'Guests'))),
                  const SizedBox(width: 8),
                  Expanded(
                      child: TextField(
                          controller: timeCtrl,
                          decoration: const InputDecoration(
                              labelText: 'Time (e.g. 8 PM)'))),
                ],
              ),
              const SizedBox(height: 8),
              TextField(
                  controller: notesCtrl,
                  decoration: const InputDecoration(
                      labelText: 'Special Requests (e.g. Birthday)')),
            ],
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              if (nameCtrl.text.isNotEmpty && phoneCtrl.text.isNotEmpty) {
                await Provider.of<ReservationProvider>(context, listen: false)
                    .addReservation(
                  customerName: nameCtrl.text.trim(),
                  customerPhone: phoneCtrl.text.trim(),
                  guestCount: int.tryParse(guestCtrl.text) ?? 2,
                  time: timeCtrl.text.trim(),
                  notes: notesCtrl.text.trim().isNotEmpty
                      ? notesCtrl.text.trim()
                      : null,
                );
                if (mounted) Navigator.pop(context);
              }
            },
            child: const Text('Confirm Booking'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final resProv = Provider.of<ReservationProvider>(context);
    final tableProv = Provider.of<TableProvider>(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Table Reservations'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            tooltip: 'New Reservation',
            onPressed: _showNewBookingDialog,
          ),
        ],
      ),
      body: resProv.reservations.isEmpty
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.event_busy,
                      size: 54,
                      color:
                          isDark ? AppTheme.borderDark : AppTheme.borderLight),
                  const SizedBox(height: 12),
                  const Text('No bookings for today.',
                      style: TextStyle(fontWeight: FontWeight.w600)),
                ],
              ),
            )
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: resProv.reservations.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, index) {
                final res = resProv.reservations[index];

                return Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: isDark ? AppTheme.surfaceDark : Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                        color: isDark
                            ? AppTheme.borderDark
                            : AppTheme.borderLight),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(
                                  color: AppTheme.primaryLight,
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  res.reservationTime,
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w800,
                                      color: AppTheme.primaryDark,
                                      fontSize: 12),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Text(res.tableNumber,
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w700,
                                      fontSize: 15)),
                            ],
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: (res.isSeated
                                      ? AppTheme.info
                                      : AppTheme.success)
                                  .withOpacity(0.12),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              res.status.toUpperCase(),
                              style: TextStyle(
                                color: res.isSeated
                                    ? AppTheme.info
                                    : AppTheme.success,
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '${res.customerName} • ${res.customerPhone}',
                        style: const TextStyle(
                            fontSize: 14, fontWeight: FontWeight.w600),
                      ),
                      Text(
                        'Party of ${res.guestCount} guests',
                        style: TextStyle(
                            fontSize: 12,
                            color: isDark
                                ? AppTheme.textMutedDark
                                : AppTheme.textMutedLight),
                      ),
                      if (res.notes != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(
                            'Note: ${res.notes}',
                            style: const TextStyle(
                                fontSize: 12,
                                fontStyle: FontStyle.italic,
                                color: AppTheme.warning),
                          ),
                        ),
                      if (res.isConfirmed) ...[
                        const Divider(height: 16),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            TextButton(
                              onPressed: () =>
                                  resProv.updateStatus(res.id, 'cancelled'),
                              style: TextButton.styleFrom(
                                  foregroundColor: AppTheme.danger),
                              child: const Text('Cancel Booking'),
                            ),
                            const SizedBox(width: 8),
                            ElevatedButton.icon(
                              onPressed: () {
                                resProv.updateStatus(res.id, 'seated');
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                      content: Text(
                                          'Guest ${res.customerName} seated at ${res.tableNumber}!'),
                                      backgroundColor: AppTheme.success),
                                );
                              },
                              icon: const Icon(Icons.check, size: 16),
                              label: const Text('Seat Guest'),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                );
              },
            ),
    );
  }
}
