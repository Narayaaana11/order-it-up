'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import type { Order } from '@/lib/types';
import { Volume2, VolumeX, Bell } from 'lucide-react';

const ACTIVE_STATUSES = new Set<Order['status']>(['pending', 'preparing', 'ready']);

function getCustomerOrderNumber(order: Order): string {
  return order.bill?.bill_number || order.order_number;
}

/**
 * Synthesizes a pleasant dual-tone airport/restaurant chime using Web Audio API
 */
function playChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    // First tone (659.25 Hz - E5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, ctx.currentTime);
    gain1.gain.setValueAtTime(0.15, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.6);

    // Second tone (880 Hz - A5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
    gain2.gain.setValueAtTime(0.2, ctx.currentTime + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.15);
    osc2.stop(ctx.currentTime + 0.9);
  } catch {
    // Audio context may be restricted by browser auto-play policy
  }
}

/**
 * Speaks the token number via SpeechSynthesis API
 */
function announceOrder(token: string) {
  try {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const text = `Order ${token.replace(/^QR-/, '').replace(/^ORD-/, '')} is ready for pickup`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1.05;
      window.speechSynthesis.speak(utterance);
    }
  } catch {
    // Ignore speech errors
  }
}

export default function CustomerDisplayPage() {
  const router = useRouter();
  const { user, currentTenant, loading: authLoading, loadFromStorage } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Audio settings
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const knownReadyOrderIds = useRef<Set<number>>(new Set());
  const initialLoadCompleted = useRef(false);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/auth/login?redirect=/customer-display');
    }
  }, [authLoading, user, router]);

  const fetchOrders = async () => {
    try {
      const { data } = await api.get('/orders', { params: { per_page: 50 } });
      const nextOrders: Order[] = (data.orders || [])
        .filter((order: Order) => ACTIVE_STATUSES.has(order.status))
        .sort((a: Order, b: Order) => a.created_at.localeCompare(b.created_at));

      // Detect newly ready orders to trigger chime and voice
      const currentReady = nextOrders.filter((o) => o.status === 'ready');
      if (initialLoadCompleted.current) {
        for (const rOrder of currentReady) {
          if (!knownReadyOrderIds.current.has(rOrder.id)) {
            // New order ready!
            if (soundEnabled) playChime();
            if (voiceEnabled) {
              setTimeout(() => {
                announceOrder(getCustomerOrderNumber(rOrder));
              }, 400);
            }
          }
        }
      } else {
        initialLoadCompleted.current = true;
      }

      knownReadyOrderIds.current = new Set(currentReady.map((o) => o.id));
      setOrders(nextOrders);
      setError(false);
      setLastUpdated(new Date());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || !currentTenant) return;
    const initial = setTimeout(fetchOrders, 0);
    const interval = setInterval(fetchOrders, 3000);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [user, currentTenant, soundEnabled, voiceEnabled]);

  const preparing = useMemo(
    () => orders.filter((order) => order.status === 'pending' || order.status === 'preparing'),
    [orders],
  );
  const ready = useMemo(() => orders.filter((order) => order.status === 'ready'), [orders]);

  if (authLoading || !user || !currentTenant) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-slate-400">Loading…</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6 md:p-10 select-none">
      <header className="max-w-7xl mx-auto flex items-end justify-between gap-4 mb-8">
        <div>
          <div className="text-2xl md:text-3xl font-bold tracking-tight">{currentTenant.business_name}</div>
          <div className="text-slate-400 mt-1 text-sm md:text-base flex items-center gap-2">
            <span>Live Order & Token Display</span>
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          </div>
        </div>

        {/* Audio Controls & Status */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSoundEnabled(prev => !prev)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 border transition ${
              soundEnabled
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
            title="Toggle notification chime"
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            {soundEnabled ? 'Chime ON' : 'Chime Muted'}
          </button>

          <button
            onClick={() => setVoiceEnabled(prev => !prev)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 border transition ${
              voiceEnabled
                ? 'bg-blue-500/10 border-blue-500/40 text-blue-400'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
            title="Toggle voice token announcement"
          >
            <Bell className="w-3.5 h-3.5" />
            {voiceEnabled ? 'Voice Calling' : 'Voice OFF'}
          </button>

          <div className="text-end text-xs text-slate-500 hidden sm:block">
            {error ? 'Connection problem — retrying…' : lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'Connecting…'}
          </div>
        </div>
      </header>

      {loading ? (
        <div className="max-w-7xl mx-auto text-center text-slate-400 py-20">Loading orders…</div>
      ) : (
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* PREPARING COLUMN */}
          <section className="rounded-3xl bg-blue-950/40 border border-blue-900/60 overflow-hidden shadow-2xl">
            <div className="px-6 py-5 bg-blue-900/40 border-b border-blue-800/60 flex justify-between items-center">
              <div>
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-wide text-blue-100">PREPARING</h1>
                <p className="text-blue-300/70 mt-0.5 text-sm">Chef is preparing your meal</p>
              </div>
              <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 font-bold text-sm">
                {preparing.length}
              </span>
            </div>
            <div className="p-6 grid grid-cols-2 sm:grid-cols-3 gap-4 min-h-[300px]">
              {preparing.length === 0 ? (
                <div className="col-span-full py-16 text-center text-slate-500 text-base">No orders currently in the kitchen</div>
              ) : preparing.map((order) => (
                <div key={order.id} className="rounded-2xl bg-slate-900/80 border border-blue-900/40 p-5 text-center transition hover:scale-105">
                  <div className="text-[10px] uppercase tracking-widest text-blue-400/70 font-semibold mb-1">Token</div>
                  <div className="text-3xl md:text-4xl font-black tracking-tight text-white">{getCustomerOrderNumber(order)}</div>
                </div>
              ))}
            </div>
          </section>

          {/* READY FOR PICKUP COLUMN */}
          <section className="rounded-3xl bg-emerald-950/40 border border-emerald-900/60 overflow-hidden shadow-2xl">
            <div className="px-6 py-5 bg-emerald-900/40 border-b border-emerald-800/60 flex justify-between items-center">
              <div>
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-wide text-emerald-100">READY FOR PICKUP</h1>
                <p className="text-emerald-300/70 mt-0.5 text-sm">Please collect at the counter</p>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-sm">
                {ready.length}
              </span>
            </div>
            <div className="p-6 grid grid-cols-2 sm:grid-cols-3 gap-4 min-h-[300px]">
              {ready.length === 0 ? (
                <div className="col-span-full py-16 text-center text-slate-500 text-base">No orders ready for pickup yet</div>
              ) : ready.map((order) => (
                <div key={order.id} className="rounded-2xl bg-gradient-to-b from-emerald-950/80 to-slate-900 border-2 border-emerald-500/80 p-5 text-center shadow-lg shadow-emerald-950/50 animate-pulse">
                  <div className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold mb-1">Token Ready</div>
                  <div className="text-3xl md:text-4xl font-black tracking-tight text-emerald-300">{getCustomerOrderNumber(order)}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
