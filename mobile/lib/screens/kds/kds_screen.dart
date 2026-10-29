import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_theme.dart';
import '../../core/responsive/responsive_layout.dart';
import '../../providers/kds_provider.dart';
import '../../widgets/kds_ticket_card.dart';

class KdsScreen extends StatefulWidget {
  const KdsScreen({Key? key}) : super(key: key);

  @override
  State<KdsScreen> createState() => _KdsScreenState();
}

class _KdsScreenState extends State<KdsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<KdsProvider>(context, listen: false).loadTickets();
    });
  }

  @override
  Widget build(BuildContext context) {
    final kds = Provider.of<KdsProvider>(context);
    final isTablet = ResponsiveBreakpoints.isTabletOrLarger(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            const Icon(Icons.soup_kitchen, size: 22, color: AppTheme.primary),
            const SizedBox(width: 8),
            const Text('Kitchen Display (KDS)'),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: AppTheme.primaryLight,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                '${kds.filteredTickets.length} ACTIVE',
                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: AppTheme.primaryDark),
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: Icon(kds.soundAlerts ? Icons.volume_up : Icons.volume_off),
            tooltip: 'Toggle Sound Alerts',
            onPressed: kds.toggleSound,
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: kds.loadTickets,
          ),
        ],
      ),
      body: Column(
        children: [
          // Station filter bar
          Container(
            height: 48,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: kds.stations.length,
              separatorBuilder: (_, __) => const SizedBox(width: 6),
              itemBuilder: (context, index) {
                final st = kds.stations[index];
                return ChoiceChip(
                  label: Text(st),
                  selected: kds.selectedStation == st,
                  onSelected: (_) => kds.selectStation(st),
                );
              },
            ),
          ),
          const Divider(height: 1),

          Expanded(
            child: kds.filteredTickets.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.check_circle_outline, size: 54, color: AppTheme.success),
                        const SizedBox(height: 12),
                        const Text('Kitchen all clear! No pending tickets.', style: TextStyle(fontWeight: FontWeight.w600)),
                      ],
                    ),
                  )
                : LayoutBuilder(
                    builder: (context, constraints) {
                      final cols = ResponsiveBreakpoints.getGridColumnCount(constraints.maxWidth, itemMinWidth: 280);

                      if (cols <= 1) {
                        // Phone: Single Column list
                        return ListView.separated(
                          padding: const EdgeInsets.all(12),
                          itemCount: kds.filteredTickets.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 12),
                          itemBuilder: (context, index) {
                            final ticket = kds.filteredTickets[index];
                            return SizedBox(
                              height: 280,
                              child: KdsTicketCard(
                                ticket: ticket,
                                onBump: () => kds.bumpTicket(ticket.id),
                              ),
                            );
                          },
                        );
                      }

                      // Tablet: Multi-column Kanban Grid
                      return GridView.builder(
                        padding: const EdgeInsets.all(14),
                        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: cols,
                          crossAxisSpacing: 12,
                          mainAxisSpacing: 12,
                          childAspectRatio: 0.85,
                        ),
                        itemCount: kds.filteredTickets.length,
                        itemBuilder: (context, index) {
                          final ticket = kds.filteredTickets[index];
                          return KdsTicketCard(
                            ticket: ticket,
                            onBump: () => kds.bumpTicket(ticket.id),
                          );
                        },
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
