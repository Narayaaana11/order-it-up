'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { useFormatDate } from '@/hooks/useFormatDate';
import { 
  CalendarDays, 
  Plus, 
  Users, 
  Clock, 
  Phone, 
  CheckCircle2, 
  XCircle, 
  UserCheck, 
  Calendar, 
  X, 
  Search, 
  Sparkles,
  AlertCircle,
  RefreshCw,
  UtensilsCrossed
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';

interface TableReservation {
  id: string;
  table_id: string | null;
  table_number?: string;
  table_capacity?: number;
  customer_name: string;
  customer_phone: string;
  guest_count: number;
  reservation_date: string;
  reservation_time: string;
  status: 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'no_show';
  notes: string | null;
  created_at: string;
}

interface DiningTable {
  id: string;
  number: string;
  capacity: number;
  status: string;
}

export default function ReservationsPage() {
  const formatDate = useFormatDate();

  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [reservations, setReservations] = useState<TableReservation[]>([]);
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({
    table_id: '',
    customer_name: '',
    customer_phone: '',
    guest_count: 2,
    reservation_date: new Date().toISOString().split('T')[0],
    reservation_time: '19:00',
    notes: '',
  });

  const loadReservations = async () => {
    setLoading(true);
    try {
      const [resRes, tablesRes] = await Promise.allSettled([
        api.get('/api/reservations', { params: { date } }),
        api.get('/api/tables'),
      ]);

      if (resRes.status === 'fulfilled' && resRes.value.data) {
        setReservations(resRes.value.data.reservations || []);
      }
      if (tablesRes.status === 'fulfilled' && tablesRes.value.data) {
        const tList = tablesRes.value.data.tables || tablesRes.value.data || [];
        setTables(Array.isArray(tList) ? tList : []);
      }
    } catch (err) {
      console.error('Failed to load reservations', err);
      toast.error('Failed to load reservations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReservations();
  }, [date]);

  // Handle status update
  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/api/reservations/${id}/status`, { status });
      toast.success(`Reservation marked as ${status}`);
      loadReservations();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update reservation');
    }
  };

  // Handle Save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customer_name.trim() || !form.customer_phone.trim()) {
      toast.error('Customer name and phone number are required');
      return;
    }

    try {
      await api.post('/api/reservations', {
        ...form,
        guest_count: Number(form.guest_count),
      });
      toast.success('Reservation confirmed!');
      setShowAddModal(false);
      setForm({
        table_id: '',
        customer_name: '',
        customer_phone: '',
        guest_count: 2,
        reservation_date: date,
        reservation_time: '19:00',
        notes: '',
      });
      loadReservations();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create reservation');
    }
  };

  // Summary Metrics
  const totalBookings = reservations.length;
  const totalGuests = reservations.reduce((sum, r) => sum + (Number(r.guest_count) || 0), 0);
  const confirmedCount = reservations.filter(r => r.status === 'confirmed').length;
  const seatedCount = reservations.filter(r => r.status === 'seated').length;

  const filtered = reservations.filter(r => {
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchesSearch = r.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.customer_phone.includes(searchTerm) ||
      (r.table_number && r.table_number.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/50">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Table Reservations</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-500 border border-purple-500/20 font-medium">
              Guest Concierge
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Manage advance table bookings, allocate dining seats, and track arrival statuses in real time.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowAddModal(true)}
            size="sm"
            className="gap-2 bg-primary text-primary-foreground"
          >
            <Plus className="w-4 h-4" />
            Book Reservation
          </Button>
          <Button onClick={loadReservations} variant="outline" size="sm" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-card border border-border/50 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Bookings Today</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
              <CalendarDays className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold tracking-tight">{totalBookings}</h3>
            <p className="text-xs text-muted-foreground mt-1">{totalGuests} expected covers</p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-card border border-border/50 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Upcoming Arrivals</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold tracking-tight text-blue-500">{confirmedCount}</h3>
            <p className="text-xs text-muted-foreground mt-1">Confirmed reservations</p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-card border border-border/50 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Currently Seated</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold tracking-tight text-emerald-500">{seatedCount}</h3>
            <p className="text-xs text-muted-foreground mt-1">Dining at tables</p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-card border border-border/50 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Available Tables</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold tracking-tight">
              {tables.filter(t => t.status === 'available').length} / {tables.length}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">Floor capacity</p>
          </div>
        </div>
      </div>

      {/* Date Controls & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/20 p-3 rounded-2xl border border-border/40">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const d = new Date().toISOString().split('T')[0];
              setDate(d);
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-xl transition-all ${
              date === new Date().toISOString().split('T')[0]
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted/40 hover:bg-muted text-muted-foreground'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => {
              const d = new Date();
              d.setDate(d.getDate() + 1);
              setDate(d.toISOString().split('T')[0]);
            }}
            className="px-3 py-1.5 text-xs font-medium rounded-xl bg-muted/40 hover:bg-muted text-muted-foreground transition-all"
          >
            Tomorrow
          </button>
          <div className="flex items-center gap-1.5 bg-muted/40 px-3 py-1.5 rounded-xl border border-border/40 text-xs">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="bg-transparent font-mono focus:outline-none"
            />
          </div>
        </div>

        {/* Search & Status Filter */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-muted/40 border border-border/40 px-3 py-1.5 rounded-xl text-xs w-48">
            <Search className="w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search guest or phone..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-transparent w-full focus:outline-none"
            />
          </div>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-muted/40 border border-border/40 text-xs rounded-xl px-3 py-1.5 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="seated">Seated</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Reservations Grid / Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length > 0 ? (
          filtered.map(r => {
            const isConfirmed = r.status === 'confirmed';
            const isSeated = r.status === 'seated';
            const isCompleted = r.status === 'completed';
            const isCancelled = r.status === 'cancelled' || r.status === 'no_show';

            return (
              <div
                key={r.id}
                className={`p-5 rounded-2xl border transition-all space-y-3 relative overflow-hidden bg-card ${
                  isSeated 
                    ? 'border-emerald-500/40 bg-emerald-500/5' 
                    : isConfirmed 
                    ? 'border-blue-500/40' 
                    : 'border-border/50 opacity-80'
                }`}
              >
                {/* Status Badge */}
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold font-mono flex items-center gap-1.5 text-foreground">
                    <Clock className="w-4 h-4 text-primary" />
                    {r.reservation_time}
                  </span>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      isSeated
                        ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30'
                        : isConfirmed
                        ? 'bg-blue-500/20 text-blue-500 border border-blue-500/30'
                        : isCompleted
                        ? 'bg-muted text-muted-foreground'
                        : 'bg-red-500/20 text-red-500 border border-red-500/30'
                    }`}
                  >
                    {r.status}
                  </span>
                </div>

                {/* Customer Details */}
                <div>
                  <h4 className="font-bold text-base text-foreground">{r.customer_name}</h4>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {r.customer_phone}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {r.guest_count} Guests
                    </span>
                  </div>
                </div>

                {/* Table Allocation & Notes */}
                <div className="p-2.5 rounded-xl bg-muted/30 border border-border/40 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Assigned Table:</span>
                    <span className="font-bold text-foreground">
                      {r.table_number ? `Table ${r.table_number}` : 'Unassigned'}
                    </span>
                  </div>
                  {r.notes && (
                    <p className="text-[11px] text-amber-500/90 italic pt-1 border-t border-border/30">
                      "{r.notes}"
                    </p>
                  )}
                </div>

                {/* Quick Action Controls */}
                <div className="pt-2 flex items-center justify-end gap-2">
                  {isConfirmed && (
                    <Button
                      onClick={() => handleUpdateStatus(r.id, 'seated')}
                      size="sm"
                      className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      Seat Guests
                    </Button>
                  )}
                  {isSeated && (
                    <Button
                      onClick={() => handleUpdateStatus(r.id, 'completed')}
                      size="sm"
                      variant="outline"
                      className="gap-1.5 border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10 text-xs h-8"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Completed
                    </Button>
                  )}
                  {!isCancelled && !isCompleted && (
                    <Button
                      onClick={() => handleUpdateStatus(r.id, 'cancelled')}
                      size="sm"
                      variant="ghost"
                      className="text-red-500 hover:text-red-600 text-xs h-8"
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full py-16 text-center text-muted-foreground border border-dashed border-border/50 rounded-2xl">
            <CalendarDays className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm font-medium">No reservations booked for {date}.</p>
            <p className="text-xs text-muted-foreground/80 mt-1">
              Click "Book Reservation" to add advance bookings for guests.
            </p>
          </div>
        )}
      </div>

      {/* Book Reservation Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border/40">
              <h3 className="font-bold text-base">Book Table Reservation</h3>
              <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-medium text-foreground">Guest Name</label>
                <input
                  type="text"
                  required
                  value={form.customer_name}
                  onChange={e => setForm({ ...form, customer_name: e.target.value })}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-medium text-foreground">Phone Number</label>
                  <input
                    type="tel"
                    required
                    value={form.customer_phone}
                    onChange={e => setForm({ ...form, customer_phone: e.target.value })}
                    placeholder="9876543210"
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 font-mono text-sm focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-foreground">Number of Guests</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    required
                    value={form.guest_count}
                    onChange={e => setForm({ ...form, guest_count: Number(e.target.value) })}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 font-mono text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-medium text-foreground">Date</label>
                  <input
                    type="date"
                    required
                    value={form.reservation_date}
                    onChange={e => setForm({ ...form, reservation_date: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 font-mono focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-foreground">Time Slot</label>
                  <input
                    type="time"
                    required
                    value={form.reservation_time}
                    onChange={e => setForm({ ...form, reservation_time: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-medium text-foreground">Allocate Table (Optional)</label>
                <select
                  value={form.table_id}
                  onChange={e => setForm({ ...form, table_id: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 focus:outline-none"
                >
                  <option value="">Assign Table upon Arrival</option>
                  {tables.map(tbl => (
                    <option key={tbl.id} value={tbl.id}>
                      Table {tbl.number} ({tbl.capacity} Seats) — {tbl.status}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-medium text-foreground">Special Instructions / Notes</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="e.g. Birthday celebration, High chair needed"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  Confirm Booking
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
