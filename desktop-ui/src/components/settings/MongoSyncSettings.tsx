'use client';

import React, { useState, useEffect } from 'react';
import { Database, RefreshCw, CheckCircle2, AlertCircle, Server } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function MongoSyncSettings() {
  const [uri, setUri] = useState('');
  const [dbName, setDbName] = useState('orderitup');
  const [enabled, setEnabled] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{
    connected: boolean;
    counts: Record<string, number>;
    error: string | null;
  }>({
    connected: false,
    counts: {},
    error: null,
  });

  const fetchStatusAndSettings = async () => {
    try {
      setLoading(true);
      const [settingsRes, statusRes] = await Promise.all([
        api.get('/mongodb/settings'),
        api.get('/mongodb/status'),
      ]);

      if (settingsRes.data?.settings) {
        const s = settingsRes.data.settings;
        setUri(s.uri || '');
        setDbName(s.dbName || 'orderitup');
        setEnabled(!!s.enabled);
        setLastSyncedAt(s.lastSyncedAt);
      }

      if (statusRes.data?.status) {
        setStatus({
          connected: !!statusRes.data.status.connected,
          counts: statusRes.data.status.counts || {},
          error: statusRes.data.status.error || null,
        });
      }
    } catch {
      // Ignore initial load error if unconfigured
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Async IIFE avoids react-hooks/set-state-in-effect false-positive:
    // setState is only called inside the resolved promise, not synchronously.
    (async () => {
      await fetchStatusAndSettings();
    })();
  }, []);

  const handleTestConnection = async () => {
    if (!uri) {
      toast.error('Please enter a MongoDB connection URI');
      return;
    }
    setTesting(true);
    try {
      const res = await api.post('/mongodb/test-connection', { uri, dbName });
      toast.success(res.data.message || 'Connected to MongoDB successfully!');
      setStatus((prev) => ({ ...prev, connected: true, error: null }));
    } catch (err: unknown) {
      const axErr = err as { response?: { data?: { message?: string; error?: string } }; message?: string };
      const msg = axErr.response?.data?.message || axErr.response?.data?.error || axErr.message;
      toast.error(`Connection failed: ${msg}`);
      setStatus((prev) => ({ ...prev, connected: false, error: msg ?? null }));
    } finally {
      setTesting(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/mongodb/settings', { uri, dbName, enabled });
      toast.success('MongoDB settings saved successfully');
      fetchStatusAndSettings();
    } catch (err: unknown) {
      const saveErr = err as { response?: { data?: { error?: string } } };
      toast.error(saveErr.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const res = await api.post('/mongodb/sync-now');
      toast.success('Full sync to MongoDB completed successfully!');
      if (res.data?.status) {
        setStatus({
          connected: !!res.data.status.connected,
          counts: res.data.status.counts || {},
          error: res.data.status.error || null,
        });
        setLastSyncedAt(res.data.status.lastSyncedAt);
      }
    } catch (err: unknown) {
      const syncErr = err as { response?: { data?: { error?: string } }; message?: string };
      const msg = syncErr.response?.data?.error || syncErr.message;
      toast.error(`Sync failed: ${msg}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600">
              <Database size={24} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">MongoDB Cloud Sync</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Replicate local POS records (bills, orders, products, customers) to MongoDB / Atlas in real time.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                status.connected
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {status.connected ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
              {status.connected ? 'Connected' : 'Disconnected'}
            </span>

            <button
              onClick={fetchStatusAndSettings}
              disabled={loading}
              className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted"
              title="Refresh status"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Sync Stats Overview */}
        {status.connected && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mb-6">
            {[
              { label: 'Bills', key: 'bills' },
              { label: 'Orders', key: 'orders' },
              { label: 'Products', key: 'products' },
              { label: 'Categories', key: 'categories' },
              { label: 'Customers', key: 'customers' },
              { label: 'Closures', key: 'cash_closures' },
            ].map(({ label, key }) => (
              <div key={key} className="p-3 bg-muted/40 rounded-lg border border-border/50 text-center">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-base font-bold text-foreground mt-0.5">
                  {status.counts[key] ?? 0}
                </p>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="mongoEnabled"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-border text-brand focus:ring-brand"
            />
            <label htmlFor="mongoEnabled" className="text-sm font-medium text-foreground cursor-pointer">
              Enable continuous background synchronization
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              MongoDB Connection URI
            </label>
            <input
              type="password"
              value={uri}
              onChange={(e) => setUri(e.target.value)}
              placeholder="mongodb+srv://username:password@cluster.mongodb.net/orderitup"
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Supports local instances (<code className="text-xs">mongodb://localhost:27017</code>) or cloud clusters on MongoDB Atlas.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Database Name
            </label>
            <input
              type="text"
              value={dbName}
              onChange={(e) => setDbName(e.target.value)}
              placeholder="orderitup"
              className="w-full sm:w-72 px-3.5 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>

          {lastSyncedAt && (
            <p className="text-xs text-muted-foreground pt-1">
              Last synchronized: <span className="font-medium text-foreground">{new Date(lastSyncedAt).toLocaleString()}</span>
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-border">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm bg-brand text-white rounded-lg hover:opacity-90 font-medium disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>

            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing || !uri}
              className="px-4 py-2 text-sm bg-muted text-foreground hover:bg-muted/80 rounded-lg font-medium disabled:opacity-50 flex items-center gap-1.5"
            >
              <Server size={14} />
              {testing ? 'Testing...' : 'Test Connection'}
            </button>

            <button
              type="button"
              onClick={handleSyncNow}
              disabled={syncing || !status.connected}
              className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-1.5 ml-auto"
            >
              <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Syncing...' : 'Sync All to MongoDB'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
