'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShieldAlert, ShieldCheck, Download, AlertTriangle, RefreshCw, Filter } from 'lucide-react';
import api from '@/lib/api';

interface AuditRow {
  id: number;
  ts: string;
  actor_user_id: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  severity: string;
  reason: string | null;
  approver_user_id: string | null;
  before_json: string | null;
  after_json: string | null;
  row_hash: string;
  prev_hash: string;
}

interface Anomaly {
  type: string;
  description: string;
  severity: 'warning' | 'critical';
  actor_user_id?: string;
  count?: number;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [verification, setVerification] = useState<{ valid: boolean; totalRows: number; reason?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (actionFilter !== 'all') params.set('action', actionFilter);
      if (severityFilter !== 'all') params.set('severity', severityFilter);
      if (searchQuery) params.set('actor_user_id', searchQuery);

      const [logsRes, anomaliesRes] = await Promise.all([
        api.get(`/api/audit-log?${params.toString()}`),
        api.get('/api/audit-log/anomalies'),
      ]);

      setLogs(logsRes.data?.data || []);
      setAnomalies(anomaliesRes.data?.anomalies || []);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [actionFilter, severityFilter, searchQuery]);

  const handleVerify = useCallback(async () => {
    try {
      setVerifying(true);
      const res = await api.get('/api/audit-log/verify');
      setVerification(res.data);
    } catch (err) {
      console.error('Audit verification check failed:', err);
    } finally {
      setVerifying(false);
    }
  }, []);

  const exportCsv = () => {
    window.open(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/audit-log?format=csv`, '_blank');
  };

  useEffect(() => {
    void loadData();
    void handleVerify();
  }, [loadData, handleVerify]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Trail & Security Anomalies</h1>
          <p className="text-muted-foreground text-sm">
            Tamper-evident, hash-chained log of voids, cancellations, refunds, PIN overrides, and configuration changes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleVerify} disabled={verifying}>
            <RefreshCw className={`h-4 w-4 mr-2 ${verifying ? 'animate-spin' : ''}`} />
            Verify Chain
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {verification && (
        <Card className={verification.valid ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-destructive bg-destructive/5'}>
          <CardHeader className="py-3">
            <div className="flex items-center gap-2">
              {verification.valid ? (
                <>
                  <ShieldCheck className="h-5 w-5 text-emerald-500" />
                  <CardTitle className="text-base text-emerald-600 dark:text-emerald-400">Cryptographic Hash Chain Authentic</CardTitle>
                </>
              ) : (
                <>
                  <ShieldAlert className="h-5 w-5 text-destructive" />
                  <CardTitle className="text-base text-destructive">Cryptographic Hash Chain Compromised</CardTitle>
                </>
              )}
            </div>
            <CardDescription className="text-xs">
              {verification.valid
                ? `All ${verification.totalRows} log entries have matching SHA-256 signatures with unbroken chaining and active SQLite append-only triggers.`
                : verification.reason || 'Integrity violation detected in audit log records.'}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {anomalies.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader className="py-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-base text-amber-600 dark:text-amber-400">Operational Fraud & Anomaly Alerts ({anomalies.length})</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {anomalies.map((anom, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 rounded bg-background/50 border text-xs">
                <div className="flex items-center gap-2">
                  <Badge variant={anom.severity === 'critical' ? 'destructive' : 'secondary'}>{anom.type}</Badge>
                  <span>{anom.description}</span>
                </div>
                {anom.actor_user_id && <span className="font-mono text-muted-foreground">User: {anom.actor_user_id}</span>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="py-4">
          <div className="flex flex-col md:flex-row gap-3 justify-between items-start md:items-center">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Input
                placeholder="Search user ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadData()}
                className="w-48 h-8 text-xs"
              />
              <Button size="sm" variant="ghost" onClick={loadData}>
                <Filter className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-40 h-8 text-xs">
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="order_cancel">Order Cancel</SelectItem>
                  <SelectItem value="void">Item Void</SelectItem>
                  <SelectItem value="item_cancel">Item Cancel</SelectItem>
                  <SelectItem value="discount_apply">Discount</SelectItem>
                  <SelectItem value="refund">Refund</SelectItem>
                  <SelectItem value="cash_drawer_open">Drawer Open</SelectItem>
                  <SelectItem value="bill_reprint">Bill Reprint</SelectItem>
                  <SelectItem value="staff_role_change">Role Change</SelectItem>
                </SelectContent>
              </Select>

              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-32 h-8 text-xs">
                  <SelectValue placeholder="All Severities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead className="w-16">ID</TableHead>
                <TableHead className="w-40">Timestamp</TableHead>
                <TableHead className="w-32">Actor</TableHead>
                <TableHead className="w-36">Action</TableHead>
                <TableHead className="w-24">Entity</TableHead>
                <TableHead>Details / Reason</TableHead>
                <TableHead className="w-24">Severity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-xs text-muted-foreground">
                    Loading audit trail...
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-xs text-muted-foreground">
                    No audit records found matching current criteria.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id} className="text-xs">
                    <TableCell className="font-mono text-muted-foreground">{log.id}</TableCell>
                    <TableCell className="whitespace-nowrap font-mono">{new Date(log.ts).toLocaleString()}</TableCell>
                    <TableCell>
                      <div className="font-medium">{log.actor_user_id || 'System'}</div>
                      {log.actor_role && <div className="text-[10px] text-muted-foreground">{log.actor_role}</div>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-[10px]">
                      {log.entity_type} {log.entity_id ? `#${log.entity_id}` : ''}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {log.reason && <span className="font-medium mr-2">[{log.reason}]</span>}
                      {log.approver_user_id && <span className="text-muted-foreground text-[10px] mr-2">Approved by: {log.approver_user_id}</span>}
                      <span className="text-muted-foreground font-mono text-[10px]">
                        {log.after_json ? (typeof log.after_json === 'string' ? log.after_json : JSON.stringify(log.after_json)) : ''}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          log.severity === 'critical'
                            ? 'destructive'
                            : log.severity === 'warning' || log.severity === 'warn'
                            ? 'secondary'
                            : 'outline'
                        }
                        className="text-[10px]"
                      >
                        {log.severity}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
