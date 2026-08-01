import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  RefreshCw, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  Check, 
  Send, 
  Database, 
  Search, 
  Info, 
  Clock,
  Code,
  ShieldAlert,
  Server
} from 'lucide-react';

export interface GasLogEntry {
  id: string;
  timestamp: string;
  action: string;
  targetUrl: string;
  status: number;
  ok: boolean;
  payload: any;
  responseText: string;
  responseData: any;
  durationMs: number;
}

interface GasLogViewerProps {
  webhookUrl?: string;
  onRefreshData?: () => void;
}

export const GasLogViewer: React.FC<GasLogViewerProps> = ({ webhookUrl, onRefreshData }) => {
  const [logs, setLogs] = useState<GasLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'error'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [testingAction, setTestingAction] = useState<string | null>(null);
  const [testResultMsg, setTestResultMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/gas-logs');
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.logs)) {
          setLogs(data.logs);
          // Auto expand the most recent log if none expanded
          if (data.logs.length > 0 && !expandedLogId) {
            setExpandedLogId(data.logs[0].id);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch GAS logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    let interval: NodeJS.Timeout | null = null;
    if (autoRefresh) {
      interval = setInterval(fetchLogs, 4000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const handleClearLogs = async () => {
    if (!confirm('Apakah Anda yakin ingin menghapus semua log diagnostik?')) return;
    try {
      await fetch('/api/gas-logs', { method: 'DELETE' });
      setLogs([]);
      setExpandedLogId(null);
    } catch (err) {
      console.error('Failed to clear logs:', err);
    }
  };

  const handleTestCall = async (action: 'ping' | 'load' | 'backup' | 'register_customer') => {
    try {
      setTestingAction(action);
      setTestResultMsg(null);

      let payload: any = {
        action,
        timestamp: new Date().toISOString(),
        testRunner: 'LogViewerDiagnostics'
      };

      if (action === 'register_customer') {
        payload = {
          action: 'register_customer',
          customer: {
            id: `TR-TEST-${Math.floor(100 + Math.random() * 900)}`,
            name: 'Pelanggan Tes Otomatis',
            email: 'tes.koneksi@patasnet.id',
            phone: '081299887766',
            address: 'Jl. Raya Patasnet No. 88 (Data Tes)',
            packageId: 'home-50',
            status: 'active',
            createdAt: new Date().toISOString().split('T')[0],
            payments: [
              {
                id: `PAY-TEST-${Date.now()}`,
                date: new Date().toISOString().split('T')[0],
                amount: 270000,
                status: 'paid',
                billingPeriod: 'Agustus 2026',
                method: 'Transfer Bank'
              }
            ]
          }
        };
      }

      const res = await fetch('/api/gas-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl,
          payload
        })
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setTestResultMsg({
          type: 'success',
          text: `Test '${action}' BERHASIL: ${data.message || 'Respon sukses diterima dari Google Apps Script!'}`
        });
        if (onRefreshData && (action === 'load' || action === 'register_customer')) {
          onRefreshData();
        }
      } else {
        setTestResultMsg({
          type: 'error',
          text: `Test '${action}' GAGAL: ${data.message || 'Respon error dari Apps Script.'}`
        });
      }
      await fetchLogs();
    } catch (err: any) {
      setTestResultMsg({
        type: 'error',
        text: `Error saat pengujian: ${err.message || 'Gagal menghubungi server proxy.'}`
      });
      await fetchLogs();
    } finally {
      setTestingAction(null);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredLogs = logs.filter(log => {
    if (filterStatus === 'success' && !log.ok) return false;
    if (filterStatus === 'error' && log.ok) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchAction = log.action?.toLowerCase().includes(q);
      const matchText = log.responseText?.toLowerCase().includes(q);
      const matchUrl = log.targetUrl?.toLowerCase().includes(q);
      const matchPayload = JSON.stringify(log.payload || {}).toLowerCase().includes(q);
      return matchAction || matchText || matchUrl || matchPayload;
    }
    return true;
  });

  const analyzeLog = (log: GasLogEntry) => {
    const text = log.responseText || '';
    const warnings: string[] = [];
    const suggestions: string[] = [];

    if (text.includes('<!DOCTYPE html>') || text.includes('google.com/accounts') || text.includes('Service Login')) {
      warnings.push('Respon Google Apps Script mengembalikan halaman HTML Login Google (Halaman Terkunci).');
      suggestions.push('Pengaturan akses Web App masih memerlukan login akun Google. Harap ikuti langkah:\n1. Buka Apps Script -> Klik "Deploy" -> "New deployment".\n2. Atur "Who has access" (Siapa yang memiliki akses) menjadi "Anyone" (Siapa saja).\n3. Re-deploy dan salin URL Web App baru.');
    } else if (text.includes('Resource not found') || log.status === 404) {
      warnings.push('Google Apps Script menolak koneksi ("Resource not found" / HTTP 404).');
      suggestions.push('Web App URL lama telah kadaluarsa atau terhapus. Buat "New Deployment" baru dengan akses "Anyone", lalu tempelkan URL baru.');
    } else if (log.status === 400 && text.includes('Halaman Editor')) {
      warnings.push('URL yang digunakan adalah URL Editor Apps Script, bukan Web App URL.');
      suggestions.push('Salin Web App URL dari menu Deploy (Penerapan) -> Web App. URL yang benar berakhiran /exec.');
    } else if (log.ok && log.action === 'backup') {
      suggestions.push('Respon server menyatakan sukses. Jika data belum berubah di spreadsheet:\n1. Pastikan nama Sheet di Google Spreadsheet persis: "Pelanggan", "Tiket", "Paket", "Cover", "Settings", "Galeri".\n2. Pastikan Script Apps Script terbaru sudah disalin penuh.');
    } else if (log.ok && log.responseData?.status === 'success') {
      suggestions.push('Respon Apps Script VALID dan BERHASIL (status 200 OK & payload diproses).');
    }

    return { warnings, suggestions };
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 text-slate-100 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
            <Activity className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              Google Apps Script API Diagnostics & Live Logs
            </h3>
            <p className="text-xs text-slate-400">
              Pantau respon HTTP, payload JSON, dan status penulisan data ke Google Sheets secara real-time.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-2 text-xs text-slate-300 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700 cursor-pointer hover:bg-slate-800">
            <input 
              type="checkbox" 
              checked={autoRefresh} 
              onChange={e => setAutoRefresh(e.target.checked)} 
              className="rounded bg-slate-900 border-slate-700 text-indigo-500 focus:ring-0"
            />
            <span>Auto-Refresh (4s)</span>
          </label>

          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 text-xs font-medium transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Segarkan
          </button>

          <button
            onClick={handleClearLogs}
            disabled={logs.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg border border-red-500/20 text-xs font-medium transition disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Bersihkan
          </button>
        </div>
      </div>

      {/* Direct Test Panel */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Send className="w-3.5 h-3.5 text-indigo-400" />
            Uji Langsung Koneksi ke Google Apps Script:
          </span>
          <span className="text-[11px] text-slate-500 truncate max-w-xs">
            URL: {webhookUrl || 'Belum dikonfigurasi'}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => handleTestCall('ping')}
            disabled={!!testingAction}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition disabled:opacity-50"
          >
            <Server className="w-3.5 h-3.5" />
            {testingAction === 'ping' ? 'Menguji Ping...' : '1. Test Ping / Server Check'}
          </button>

          <button
            onClick={() => handleTestCall('backup')}
            disabled={!!testingAction}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition disabled:opacity-50"
          >
            <Database className="w-3.5 h-3.5" />
            {testingAction === 'backup' ? 'Mengirim Sync...' : '2. Test Backup Ke Spreadsheet'}
          </button>

          <button
            onClick={() => handleTestCall('load')}
            disabled={!!testingAction}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition disabled:opacity-50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {testingAction === 'load' ? 'Membaca Data...' : '3. Test Load Dari Spreadsheet'}
          </button>

          <button
            onClick={() => handleTestCall('register_customer')}
            disabled={!!testingAction}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-medium transition disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            {testingAction === 'register_customer' ? 'Menulis Baris...' : '4. Test Tulis 1 Baris Pelanggan Baru'}
          </button>
        </div>

        {testResultMsg && (
          <div className={`p-3 rounded-lg text-xs flex items-start gap-2 ${
            testResultMsg.type === 'success' 
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' 
              : 'bg-red-500/10 border border-red-500/30 text-red-300'
          }`}>
            {testResultMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <div className="whitespace-pre-line leading-relaxed">{testResultMsg.text}</div>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              filterStatus === 'all' 
                ? 'bg-indigo-600 text-white' 
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Semua ({logs.length})
          </button>
          <button
            onClick={() => setFilterStatus('success')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              filterStatus === 'success' 
                ? 'bg-emerald-600 text-white' 
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Berhasil ({logs.filter(l => l.ok).length})
          </button>
          <button
            onClick={() => setFilterStatus('error')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              filterStatus === 'error' 
                ? 'bg-red-600 text-white' 
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Gagal ({logs.filter(l => !l.ok).length})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari action, payload, respon..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Logs Table / List */}
      {filteredLogs.length === 0 ? (
        <div className="bg-slate-950/50 border border-dashed border-slate-800 rounded-xl p-8 text-center text-slate-500 space-y-2">
          <Activity className="w-8 h-8 mx-auto opacity-30 text-indigo-400" />
          <p className="text-sm font-medium text-slate-400">Belum ada log transaksi API Apps Script</p>
          <p className="text-xs">Log akan otomatis tercatat setiap kali ada aksi perubahan data, pendaftaran, atau pengujian koneksi.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map(log => {
            const isExpanded = expandedLogId === log.id;
            const analysis = analyzeLog(log);

            return (
              <div 
                key={log.id} 
                className={`border rounded-xl transition overflow-hidden ${
                  log.ok 
                    ? 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700' 
                    : 'bg-red-950/10 border-red-900/40 hover:border-red-800/60'
                }`}
              >
                {/* Summary Row */}
                <div 
                  onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                  className="p-3.5 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-slate-800/30"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {log.ok ? (
                      <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg shrink-0">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="p-1.5 bg-red-500/10 text-red-400 rounded-lg shrink-0">
                        <XCircle className="w-4 h-4" />
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-xs text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                          {log.action?.toUpperCase() || 'UNKNOWN'}
                        </span>

                        <span className={`text-[11px] px-2 py-0.5 rounded font-semibold ${
                          log.status === 200 
                            ? 'bg-emerald-500/20 text-emerald-300' 
                            : log.status === 404 || log.status === 400 
                            ? 'bg-amber-500/20 text-amber-300' 
                            : 'bg-red-500/20 text-red-300'
                        }`}>
                          HTTP {log.status || 'ERR'}
                        </span>

                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          {log.durationMs}ms
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-400 truncate mt-1">
                        {log.responseData?.message || log.responseText || 'Respon kosong'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-slate-500 hidden sm:inline">
                      {new Date(log.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="p-4 border-t border-slate-800 bg-slate-950/80 space-y-4">
                    {/* Diagnosis & Suggestions */}
                    {(analysis.warnings.length > 0 || analysis.suggestions.length > 0) && (
                      <div className="space-y-2">
                        {analysis.warnings.map((warn, i) => (
                          <div key={i} className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-300 flex items-start gap-2">
                            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                            <div>
                              <strong className="block font-semibold text-red-200">Masalah Terdeteksi:</strong>
                              {warn}
                            </div>
                          </div>
                        ))}

                        {analysis.suggestions.map((sug, i) => (
                          <div key={i} className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-lg text-xs text-indigo-200 flex items-start gap-2">
                            <Info className="w-4 h-4 shrink-0 mt-0.5 text-indigo-400" />
                            <div>
                              <strong className="block font-semibold text-indigo-300">Saran Diagnostik:</strong>
                              <span className="whitespace-pre-line">{sug}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Metadata */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                        <span className="text-slate-500 block text-[11px] mb-0.5">Waktu Eksekusi:</span>
                        <span className="text-slate-200 font-mono">{new Date(log.timestamp).toLocaleString('id-ID')}</span>
                      </div>
                      <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 min-w-0">
                        <span className="text-slate-500 block text-[11px] mb-0.5">Target Web App URL:</span>
                        <span className="text-slate-200 font-mono text-[11px] truncate block">{log.targetUrl}</span>
                      </div>
                    </div>

                    {/* Request Payload */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                          <Code className="w-3.5 h-3.5 text-indigo-400" />
                          Request Payload (Dikirim Ke Apps Script):
                        </span>
                        <button
                          onClick={() => copyToClipboard(JSON.stringify(log.payload, null, 2), `req-${log.id}`)}
                          className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 bg-slate-900 px-2 py-0.5 rounded border border-slate-800"
                        >
                          {copiedId === `req-${log.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          {copiedId === `req-${log.id}` ? 'Tersalin' : 'Salin JSON'}
                        </button>
                      </div>
                      <pre className="bg-slate-900/90 border border-slate-800 rounded-lg p-3 text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-48 scrollbar-thin">
                        {JSON.stringify(log.payload, null, 2)}
                      </pre>
                    </div>

                    {/* Response Raw Body */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                          <Database className="w-3.5 h-3.5 text-emerald-400" />
                          Raw Server Response (Diterima Dari Apps Script):
                        </span>
                        <button
                          onClick={() => copyToClipboard(log.responseText || '', `res-${log.id}`)}
                          className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 bg-slate-900 px-2 py-0.5 rounded border border-slate-800"
                        >
                          {copiedId === `res-${log.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          {copiedId === `res-${log.id}` ? 'Tersalin' : 'Salin Respon'}
                        </button>
                      </div>
                      <pre className={`bg-slate-900/90 border border-slate-800 rounded-lg p-3 font-mono text-[11px] overflow-x-auto max-h-48 scrollbar-thin ${
                        log.ok ? 'text-indigo-300' : 'text-red-300'
                      }`}>
                        {log.responseText || '(Respon Kosong)'}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
