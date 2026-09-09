'use client';

import React, { useState, useEffect } from 'react';
import { Cloud, Upload, RefreshCw, CheckCircle2, AlertCircle, HardDrive, ShieldCheck, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface S3BackupItem {
  key: string;
  filename: string;
  size: number;
  lastModified: string;
}

export default function AmazonS3Settings() {
  const [region, setRegion] = useState('us-east-1');
  const [bucketName, setBucketName] = useState('');
  const [accessKeyId, setAccessKeyId] = useState('');
  const [secretAccessKey, setSecretAccessKey] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [retention, setRetention] = useState(30);

  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [backups, setBackups] = useState<S3BackupItem[]>([]);

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
        setEnabled(!!s.enabled);
        setRetention(s.retention || 30);
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

  useEffect(() => {
    fetchStatusAndBackups();
  }, []);

  const handleTestConnection = async () => {
    if (!bucketName || !accessKeyId) {
      toast.error('Bucket Name and Access Key ID are required.');
      return;
    }
    setTesting(true);
    try {
      const res = await api.post('/s3/test-connection', {
        region,
        bucketName,
        accessKeyId,
        secretAccessKey,
      });
      toast.success(res.data.message || 'Connected to S3 bucket successfully!');
      setConfigured(true);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.error || err.message;
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
        enabled,
        retention,
      });
      toast.success('Amazon S3 settings saved');
      fetchStatusAndBackups();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save S3 settings');
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
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.error || err.message;
      toast.error(`Backup upload failed: ${msg}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-orange-500/10 text-orange-600">
              <Cloud size={24} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Amazon S3 Cloud Backup</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Automatically archive encrypted database snapshots to your AWS S3 bucket for disaster recovery.
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
              {configured ? 'Configured' : 'Not Configured'}
            </span>

            <button
              onClick={fetchStatusAndBackups}
              disabled={loading}
              className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted"
              title="Refresh S3 status"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="s3Enabled"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-border text-brand focus:ring-brand"
            />
            <label htmlFor="s3Enabled" className="text-sm font-medium text-foreground cursor-pointer">
              Enable automated daily backups to Amazon S3
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                AWS S3 Bucket Name
              </label>
              <input
                type="text"
                value={bucketName}
                onChange={(e) => setBucketName(e.target.value)}
                placeholder="order-it-up-backups"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                AWS Region
              </label>
              <input
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="us-east-1 or ap-south-1"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                AWS Access Key ID
              </label>
              <input
                type="text"
                value={accessKeyId}
                onChange={(e) => setAccessKeyId(e.target.value)}
                placeholder="AKIA..."
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                AWS Secret Access Key
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

          <div className="w-full sm:w-48">
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
              disabled={testing || !bucketName}
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

      {/* S3 Backups List */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <HardDrive size={18} className="text-muted-foreground" />
            <h3 className="font-semibold text-foreground">Backups in S3 Bucket</h3>
          </div>
          <span className="text-xs text-muted-foreground">
            {backups.length} {backups.length === 1 ? 'backup' : 'backups'} found
          </span>
        </div>

        {backups.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No backups found in this bucket yet. Click &quot;Backup Now to S3&quot; to upload your first snapshot.
          </p>
        ) : (
          <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
            {backups.map((b) => (
              <div key={b.key} className="flex items-center justify-between p-3.5 bg-background hover:bg-muted/20 text-sm">
                <div className="min-w-0 pr-4">
                  <p className="font-medium text-foreground truncate">{b.filename}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {b.lastModified ? new Date(b.lastModified).toLocaleString() : ''} · {formatSize(b.size)}
                  </p>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  Stored in S3
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
