'use client';

import React, { useState, useEffect } from 'react';
import {
  Cloud,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Database,
  Users,
  CreditCard,
  Image as ImageIcon,
  Server,
  Layers,
} from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface S3BackupItem {
  key: string;
  filename: string;
  size: number;
  lastModified: string;
}

interface S3DomainItem {
  key: string;
  filename: string;
  size: number;
  lastModified: string;
  domain?: string;
}

interface DomainMetrics {
  totalSize: number;
  objectCount: number;
  byDomain: Record<string, { count: number; size: number }>;
}

export default function AmazonS3Settings() {
  const [region, setRegion] = useState('us-east-1');
  const [bucketName, setBucketName] = useState('');
  const [accessKeyId, setAccessKeyId] = useState('');
  const [secretAccessKey, setSecretAccessKey] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [forcePathStyle, setForcePathStyle] = useState(false);
  const [mockMode, setMockMode] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [retention, setRetention] = useState(30);

  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [backups, setBackups] = useState<S3BackupItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<'backups' | 'users' | 'payments' | 'media'>('backups');
  const [categoryItems, setCategoryItems] = useState<S3DomainItem[]>([]);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [metrics, setMetrics] = useState<DomainMetrics | null>(null);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const fetchStatusAndBackups = async () => {
    try {
      setLoading(true);
      const [statusRes, backupsRes] = await Promise.all([
        api.get('/s3/status'),
        api.get('/s3/backups'),
      ]);

      if (statusRes.data?.status) {
        const s = statusRes.data.status;
        setRegion(s.region || 'us-east-1');
        setBucketName(s.bucketName || '');
        setAccessKeyId(s.accessKeyId || '');
        setEndpoint(s.endpoint || '');
        setForcePathStyle(Boolean(s.forcePathStyle));
        setMockMode(Boolean(s.mockMode));
        setEnabled(!!s.enabled);
        setRetention(s.retentionDays || s.retention || 30);
        setConfigured(!!s.configured);
      }

      if (backupsRes.data?.backups) {
        setBackups(backupsRes.data.backups);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const fetchCategoryObjects = async (domain: 'backups' | 'users' | 'payments' | 'media') => {
    setCategoryLoading(true);
    try {
      // Default tenant identifier for store operational assets
      const tenantId = 'default';
      const [objectsRes, metricsRes] = await Promise.all([
        api.get(`/s3/tenants/${tenantId}/objects?domain=${domain}`),
        api.get(`/s3/tenants/${tenantId}/metrics`),
      ]);

      if (objectsRes.data?.objects) {
        setCategoryItems(objectsRes.data.objects);
      }
      if (metricsRes.data?.metrics) {
        setMetrics(metricsRes.data.metrics);
      }
    } catch {
      // Category objects might be empty on fresh tenant
      setCategoryItems([]);
    } finally {
      setCategoryLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await fetchStatusAndBackups();
      await fetchCategoryObjects('backups');
    })();
  }, []);

  const handleCategorySelect = (category: 'backups' | 'users' | 'payments' | 'media') => {
    setSelectedCategory(category);
    fetchCategoryObjects(category);
  };

  const handleTestConnection = async () => {
    if (!mockMode && (!bucketName || !accessKeyId)) {
      toast.error('Bucket Name and Access Key ID are required (or enable Mock Mode).');
      return;
    }
    setTesting(true);
    try {
      const res = await api.post('/s3/test-connection', {
        region,
        bucketName,
        accessKeyId,
        secretAccessKey,
        endpoint,
        forcePathStyle,
        mockMode,
      });
      toast.success(res.data.message || 'Connected to S3 bucket successfully!');
      setConfigured(true);
    } catch (err: unknown) {
      const axErr = err as { response?: { data?: { message?: string; error?: string } }; message?: string };
      const msg = axErr.response?.data?.message || axErr.response?.data?.error || axErr.message;
      toast.error(`S3 test failed: ${msg}`);
    } finally {
      setTesting(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/s3/settings', {
        region,
        bucketName,
        accessKeyId,
        secretAccessKey,
        endpoint,
        forcePathStyle,
        mockMode,
        enabled,
        retention,
        retentionDays: retention,
      });
      toast.success('Amazon S3 settings saved');
      fetchStatusAndBackups();
    } catch (err: unknown) {
      const saveErr = err as { response?: { data?: { error?: string } } };
      toast.error(saveErr.response?.data?.error || 'Failed to save S3 settings');
    } finally {
      setSaving(false);
    }
  };

  const handleBackupNow = async () => {
    setUploading(true);
    try {
      const res = await api.post('/s3/backup-now');
      toast.success('Backup uploaded to Amazon S3 successfully!');
      if (res.data?.backups) {
        setBackups(res.data.backups);
      } else {
        fetchStatusAndBackups();
      }
      fetchCategoryObjects(selectedCategory);
    } catch (err: unknown) {
      const backupErr = err as { response?: { data?: { message?: string; error?: string } }; message?: string };
      const msg = backupErr.response?.data?.message || backupErr.response?.data?.error || backupErr.message;
      toast.error(`Backup upload failed: ${msg}`);
    } finally {
      setUploading(false);
    }
  };

  const categories = [
    {
      id: 'backups' as const,
      label: 'Backups',
      icon: Database,
      count: metrics?.byDomain?.backups?.count ?? backups.length,
      size: metrics?.byDomain?.backups?.size ?? backups.reduce((acc, b) => acc + b.size, 0),
      description: 'SQLite database disaster recovery snapshots',
      prefix: 'tenants/{id}/backups/',
    },
    {
      id: 'users' as const,
      label: 'Users',
      icon: Users,
      count: metrics?.byDomain?.users?.count ?? 0,
      size: metrics?.byDomain?.users?.size ?? 0,
      description: 'User account archives and staff audit logs',
      prefix: 'tenants/{id}/users/',
    },
    {
      id: 'payments' as const,
      label: 'Payments',
      icon: CreditCard,
      count: metrics?.byDomain?.payments?.count ?? 0,
      size: metrics?.byDomain?.payments?.size ?? 0,
      description: 'Signed transaction batches, Z-reports, and receipts',
      prefix: 'tenants/{id}/payments/',
    },
    {
      id: 'media' as const,
      label: 'Media',
      icon: ImageIcon,
      count: metrics?.byDomain?.media?.count ?? 0,
      size: metrics?.byDomain?.media?.size ?? 0,
      description: 'Product photos, menu images, and brand graphics',
      prefix: 'tenants/{id}/media/',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-orange-500/10 text-orange-600">
              <Cloud size={24} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Cloud Data Storage & S3 Management</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Multi-cloud S3 storage (AWS, Cloudflare R2, MinIO, Wasabi) with strict tenant operational data segregation and offline resilience.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                configured
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {configured ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
              {configured ? (mockMode ? 'Mock S3 Active' : 'Connected') : 'Not Configured'}
            </span>

            <button
              onClick={() => {
                fetchStatusAndBackups();
                fetchCategoryObjects(selectedCategory);
              }}
              disabled={loading}
              className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted"
              title="Refresh S3 status"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="s3Enabled"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-border text-brand focus:ring-brand"
              />
              <label htmlFor="s3Enabled" className="text-sm font-medium text-foreground cursor-pointer">
                Enable automated daily backups to S3
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="s3ForcePathStyle"
                checked={forcePathStyle}
                onChange={(e) => setForcePathStyle(e.target.checked)}
                className="h-4 w-4 rounded border-border text-brand focus:ring-brand"
              />
              <label htmlFor="s3ForcePathStyle" className="text-sm font-medium text-foreground cursor-pointer">
                Path-Style Addressing (MinIO / LocalStack)
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="s3MockMode"
                checked={mockMode}
                onChange={(e) => setMockMode(e.target.checked)}
                className="h-4 w-4 rounded border-border text-brand focus:ring-brand"
              />
              <label htmlFor="s3MockMode" className="text-sm font-medium text-foreground cursor-pointer">
                Mock Mode (Local Offline Emulation)
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                S3 Bucket Name
              </label>
              <input
                type="text"
                value={bucketName}
                onChange={(e) => setBucketName(e.target.value)}
                placeholder="order-it-up-data"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Region (AWS or Compatible Provider)
              </label>
              <input
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="us-east-1, auto, or ap-south-1"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                <Server size={14} className="text-muted-foreground" />
                Custom Endpoint URL (Optional)
              </label>
              <input
                type="text"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="https://<account-id>.r2.cloudflarestorage.com or http://localhost:9000"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
              <span className="text-[11px] text-muted-foreground mt-1 block">
                Leave empty for standard AWS S3. Configure for Cloudflare R2, MinIO, Wasabi, or LocalStack.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Retention (Keep last N backups)
              </label>
              <input
                type="number"
                min={1}
                max={365}
                value={retention}
                onChange={(e) => setRetention(parseInt(e.target.value) || 30)}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
              <span className="text-[11px] text-muted-foreground mt-1 block">
                Older snapshots beyond this threshold are automatically pruned.
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Access Key ID
              </label>
              <input
                type="text"
                value={accessKeyId}
                onChange={(e) => setAccessKeyId(e.target.value)}
                placeholder="AKIA... or MinIO access key"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Secret Access Key
              </label>
              <input
                type="password"
                value={secretAccessKey}
                onChange={(e) => setSecretAccessKey(e.target.value)}
                placeholder="••••••••••••••••••••••••••••••••"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>
          </div>

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
              disabled={testing || (!mockMode && !bucketName)}
              className="px-4 py-2 text-sm bg-muted text-foreground hover:bg-muted/80 rounded-lg font-medium disabled:opacity-50 flex items-center gap-1.5"
            >
              <ShieldCheck size={14} />
              {testing ? 'Testing...' : 'Test Connection'}
            </button>

            <button
              type="button"
              onClick={handleBackupNow}
              disabled={uploading || !configured}
              className="px-4 py-2 text-sm bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-1.5 ml-auto"
            >
              <Upload size={14} className={uploading ? 'animate-bounce' : ''} />
              {uploading ? 'Uploading...' : 'Backup Now to S3'}
            </button>
          </div>
        </form>
      </div>

      {/* Multi-Domain Storage Categories Overview */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-muted-foreground" />
            <h3 className="font-semibold text-foreground">Multi-Domain Cloud Data Categories</h3>
          </div>
          <span className="text-xs text-muted-foreground">
            Strict Tenant Prefix Hierarchy: <code className="bg-muted px-1.5 py-0.5 rounded text-[11px]">{'tenants/{tenantId}/*'}</code>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleCategorySelect(cat.id)}
                className={`text-left p-4 rounded-xl border transition-all ${
                  isSelected
                    ? 'border-orange-500 bg-orange-500/5 ring-1 ring-orange-500/30'
                    : 'border-border bg-background hover:bg-muted/30'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 rounded-lg ${isSelected ? 'bg-orange-500/10 text-orange-600' : 'bg-muted text-muted-foreground'}`}>
                    <Icon size={18} />
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-muted text-foreground">
                    {cat.count} files
                  </span>
                </div>
                <h4 className="font-medium text-foreground text-sm">{cat.label}</h4>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{cat.description}</p>
                <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Size: {formatSize(cat.size)}</span>
                  <code className="text-[10px] opacity-75">{cat.prefix}</code>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Category Objects Explorer */}
        <div className="border border-border rounded-lg overflow-hidden bg-background">
          <div className="p-3 bg-muted/30 border-b border-border flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
              {selectedCategory.toUpperCase()} OBJECTS
            </span>
            <button
              onClick={() => fetchCategoryObjects(selectedCategory)}
              disabled={categoryLoading}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <RefreshCw size={12} className={categoryLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>

          {categoryLoading ? (
            <div className="p-6 text-center text-xs text-muted-foreground">Loading objects...</div>
          ) : selectedCategory === 'backups' && backups.length > 0 ? (
            <div className="divide-y divide-border">
              {backups.map((b) => (
                <div key={b.key} className="flex items-center justify-between p-3 hover:bg-muted/20 text-sm">
                  <div className="min-w-0 pr-4">
                    <p className="font-medium text-foreground truncate">{b.filename}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {b.lastModified ? new Date(b.lastModified).toLocaleString() : ''} · {formatSize(b.size)}
                    </p>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    Encrypted Snapshot
                  </span>
                </div>
              ))}
            </div>
          ) : categoryItems.length > 0 ? (
            <div className="divide-y divide-border">
              {categoryItems.map((item) => (
                <div key={item.key} className="flex items-center justify-between p-3 hover:bg-muted/20 text-sm">
                  <div className="min-w-0 pr-4">
                    <p className="font-medium text-foreground truncate">{item.filename}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.lastModified ? new Date(item.lastModified).toLocaleString() : ''} · {formatSize(item.size)}
                    </p>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                    {item.domain || selectedCategory}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No objects found under <code className="bg-muted px-1.5 py-0.5 rounded">tenants/default/{selectedCategory}/</code> yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
