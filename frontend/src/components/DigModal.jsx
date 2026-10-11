import React, { useState, useEffect, useCallback } from 'react';
import { X, Terminal, Copy, Check, RefreshCw, Server, Search, Globe, FileText, ArrowRight, CornerDownLeft } from 'lucide-react';

const DNS_SERVERS = [
  { label: 'System Default', value: '' },
  { label: 'Cloudflare (1.1.1.1)', value: '1.1.1.1' },
  { label: 'Google (8.8.8.8)', value: '8.8.8.8' },
  { label: 'Quad9 (9.9.9.9)', value: '9.9.9.9' },
  { label: 'OpenDNS (208.67.222.222)', value: '208.67.222.222' }
];

const RECORD_TYPES = ['ALL', 'PTR', 'A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SOA'];

function isIpAddress(str) {
  if (!str) return false;
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){1,7}[0-9a-fA-F]{1,4}$|^::1$|^[0-9a-fA-F:]+$/;
  return ipv4Regex.test(str.trim()) || (str.includes(':') && ipv6Regex.test(str.trim()));
}

function toArpa(ip) {
  if (ip.includes('.')) {
    return ip.split('.').reverse().join('.') + '.in-addr.arpa';
  }
  return ip;
}

export default function DigModal({ hop, onClose, apiBase }) {
  const initialTarget = hop?.hostname && hop.hostname !== hop?.ip ? hop.hostname : (hop?.ip || '');
  const [target, setTarget] = useState(initialTarget);
  const [queryType, setQueryType] = useState(() => (isIpAddress(initialTarget) ? 'PTR' : 'ALL'));
  const [dnsServer, setDnsServer] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [viewMode, setViewMode] = useState('visual'); // 'visual' | 'raw'
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  const executeDig = useCallback(async (targetToQuery, typeToQuery, serverToQuery) => {
    const qTarget = (targetToQuery || target).trim();
    if (!qTarget) return;

    const qType = typeToQuery || queryType;
    const qServer = serverToQuery !== undefined ? serverToQuery : dnsServer;

    setLoading(true);
    const startTime = Date.now();

    try {
      // 1. Try local VNI Engine API if available
      let res;
      try {
        const queryParams = new URLSearchParams({
          target: qTarget,
          type: qType
        });
        if (qServer) queryParams.append('server', qServer);

        const response = await fetch(`${apiBase || ''}/api/dig?${queryParams.toString()}`);
        if (response.ok) {
          res = await response.json();
        }
      } catch (engineErr) {
        // Fallback to client-side DoH if backend unreachable
        console.warn('Backend /api/dig unavailable, falling back to DoH:', engineErr);
      }

      // 2. Client-side Cloudflare / Google DoH fallback
      if (!res) {
        const isIp = isIpAddress(qTarget);
        const nameToQuery = (qType === 'PTR' || isIp) ? toArpa(qTarget) : qTarget;
        const dohUrl = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(nameToQuery)}&type=${qType === 'ALL' ? 'ANY' : qType}`;

        const dohRes = await fetch(dohUrl, {
          headers: { Accept: 'application/dns-json' }
        });
        const dohData = await dohRes.json();
        const duration = Date.now() - startTime;

        const answers = (dohData.Answer || []).map(a => {
          const typeMap = { 1: 'A', 28: 'AAAA', 5: 'CNAME', 15: 'MX', 16: 'TXT', 2: 'NS', 6: 'SOA', 12: 'PTR' };
          return {
            name: a.name.replace(/\.$/, ''),
            type: typeMap[a.type] || `TYPE${a.type}`,
            ttl: a.TTL,
            data: a.data
          };
        });

        const statusMap = { 0: 'NOERROR', 2: 'SERVFAIL', 3: 'NXDOMAIN', 4: 'NOTIMP', 5: 'REFUSED' };
        const statusName = statusMap[dohData.Status] || (dohData.Status === 0 ? 'NOERROR' : 'ERROR');

        res = {
          status: statusName,
          statusCode: dohData.Status,
          queryTime: duration,
          server: '1.1.1.1#53 (Cloudflare DoH Fallback)',
          target: qTarget,
          type: qType,
          answers,
          errorMessage: dohData.Status !== 0 ? `DNS query returned status ${statusName}` : null,
          rawOutput: `; <<>> DiG (VNI Web Fallback) <<>> ${qType} ${qTarget}\n;; Got answer:\n;; ->>HEADER<<- opcode: QUERY, status: ${statusName}\n;; Query time: ${duration} msec\n;; SERVER: 1.1.1.1#53\n\n;; ANSWER SECTION:\n${answers.map(a => `${a.name}.\t${a.ttl}\tIN\t${a.type}\t${a.data}`).join('\n') || '; (No answers returned)'}`
        };
      }

      setData(res);
    } catch (err) {
      const duration = Date.now() - startTime;
      setData({
        status: 'ERROR',
        statusCode: 2,
        queryTime: duration,
        server: dnsServer || 'Default',
        target: qTarget,
        type: qType,
        answers: [],
        errorMessage: err.message || 'Lookup failed',
        rawOutput: `; <<>> DiG (VNI Engine) <<>> ${qType} ${qTarget}\n;; ERROR: ${err.message || 'Lookup failed'}\n;; Query time: ${duration} msec`
      });
    } finally {
      setLoading(false);
    }
  }, [target, queryType, dnsServer, apiBase]);

  // Initial lookup on open
  useEffect(() => {
    executeDig(initialTarget, isIpAddress(initialTarget) ? 'PTR' : 'ALL', '');
  }, [executeDig, initialTarget]);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleCopyRaw = () => {
    if (!data?.rawOutput) return;
    navigator.clipboard.writeText(data.rawOutput);
    setCopiedRaw(true);
    setTimeout(() => setCopiedRaw(false), 2000);
  };

  const handleCopyField = (val, id) => {
    navigator.clipboard.writeText(val);
    setCopiedField(id);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSwitchTarget = (newTarget) => {
    setTarget(newTarget);
    const newType = isIpAddress(newTarget) ? 'PTR' : 'ALL';
    setQueryType(newType);
    executeDig(newTarget, newType, dnsServer);
  };

  const handleTypeChange = (t) => {
    setQueryType(t);
    executeDig(target, t, dnsServer);
  };

  const handleServerChange = (s) => {
    setDnsServer(s);
    executeDig(target, queryType, s);
  };

  const hasHostnameOption = hop?.hostname && hop.hostname !== hop?.ip;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div 
        className="bg-gray-950 border border-sky-500/30 rounded-2xl w-full max-w-3xl max-h-[90vh] shadow-2xl shadow-black/80 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 bg-gray-900/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-950/80 border border-sky-500/40 flex items-center justify-center text-sky-400 font-mono font-bold text-sm shadow-[0_0_12px_rgba(14,165,233,0.3)]">
              {hop?.hop ? `#${hop.hop}` : 'DiG'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                  <Terminal size={17} className="text-sky-400" />
                  DNS Dig Inspector
                </h2>
                {data && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider border ${
                    data.status === 'NOERROR'
                      ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-400'
                      : data.status === 'NXDOMAIN' || data.status === 'NODATA'
                      ? 'bg-amber-950/70 border-amber-500/40 text-amber-400'
                      : 'bg-rose-950/70 border-rose-500/40 text-rose-400'
                  }`}>
                    {data.status}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-gray-400 mt-0.5">
                <span className="text-gray-200 font-semibold">{hop?.ip}</span>
                {hasHostnameOption && <span className="text-gray-500">({hop.hostname})</span>}
                {hop?.geo?.city && (
                  <>
                    <span className="text-gray-600">•</span>
                    <span className="text-sky-400/90">{hop.geo.city}, {hop.geo.countryCode || hop.geo.country || ''}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyRaw}
              className="px-2.5 py-1.5 rounded-lg bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white border border-gray-800 text-xs font-mono transition flex items-center gap-1.5 cursor-pointer"
              title="Copy Raw DiG CLI Output"
            >
              {copiedRaw ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              <span className="hidden sm:inline">Copy DiG</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-gray-900 hover:bg-rose-950/40 text-gray-400 hover:text-rose-400 border border-gray-800 hover:border-rose-900/50 transition cursor-pointer"
              title="Close (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Query Controls */}
        <div className="p-4 bg-gray-900/30 border-b border-gray-800/80 flex flex-col gap-3 shrink-0">
          {/* Target Input and Search button */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && executeDig(target, queryType, dnsServer)}
                placeholder="Domain or IP address (e.g. s4m.dev or 1.1.1.1)"
                className="w-full bg-gray-950 border border-gray-700/80 focus:border-sky-500/80 rounded-lg pl-9 pr-3 py-1.5 text-sm text-gray-200 font-mono focus:outline-none transition"
              />
            </div>
            
            <button
              onClick={() => executeDig(target, queryType, dnsServer)}
              disabled={loading}
              className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-sm flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer shadow-sm shadow-sky-950"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Dig</span>
            </button>
          </div>

          {/* Quick Target Switchers if hop has both IP and hostname */}
          {hasHostnameOption && (
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-gray-500">Quick target:</span>
              <button
                onClick={() => handleSwitchTarget(hop.ip)}
                className={`px-2 py-0.5 rounded border transition cursor-pointer ${
                  target === hop.ip
                    ? 'bg-sky-950/80 border-sky-500/60 text-sky-300 font-bold'
                    : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                IP: {hop.ip} (PTR)
              </button>
              <button
                onClick={() => handleSwitchTarget(hop.hostname)}
                className={`px-2 py-0.5 rounded border transition cursor-pointer truncate max-w-[260px] ${
                  target === hop.hostname
                    ? 'bg-sky-950/80 border-sky-500/60 text-sky-300 font-bold'
                    : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white'
                }`}
                title={hop.hostname}
              >
                Host: {hop.hostname}
              </button>
            </div>
          )}

          {/* Record Type pills & Resolver selection */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-gray-800/40">
            {/* Record Types */}
            <div className="flex items-center gap-1 overflow-x-auto py-0.5">
              <span className="text-[11px] font-mono uppercase text-gray-500 mr-1">Type:</span>
              {RECORD_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => handleTypeChange(t)}
                  className={`px-2 py-0.5 rounded text-xs font-mono font-medium transition cursor-pointer border ${
                    queryType === t
                      ? 'bg-sky-500 text-white border-sky-400 shadow-sm shadow-sky-900/40'
                      : 'bg-gray-950 text-gray-400 hover:text-gray-200 border-gray-800 hover:border-gray-700'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* DNS Resolver selector */}
            <div className="flex items-center gap-1.5 text-xs font-mono">
              <Server size={13} className="text-gray-500" />
              <select
                value={dnsServer}
                onChange={(e) => handleServerChange(e.target.value)}
                className="bg-gray-950 border border-gray-800 text-gray-300 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-sky-500 cursor-pointer"
              >
                {DNS_SERVERS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Results Metadata Bar */}
        <div className="px-6 py-2.5 bg-gray-900/50 border-b border-gray-800 flex items-center justify-between text-xs font-mono text-gray-400 shrink-0">
          <div className="flex items-center gap-3">
            <span>
              Query time: <strong className="text-gray-200">{data ? `${data.queryTime} ms` : '--'}</strong>
            </span>
            <span className="text-gray-700">•</span>
            <span className="truncate max-w-[200px]" title={data?.server}>
              Server: <strong className="text-gray-200">{data?.server || '--'}</strong>
            </span>
            <span className="text-gray-700">•</span>
            <span>
              Answers: <strong className="text-sky-400">{data?.answers ? data.answers.length : 0}</strong>
            </span>
          </div>

          <div className="flex items-center gap-1 bg-gray-950 p-0.5 rounded-lg border border-gray-800">
            <button
              onClick={() => setViewMode('visual')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition cursor-pointer ${
                viewMode === 'visual'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Visual
            </button>
            <button
              onClick={() => setViewMode('raw')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition cursor-pointer flex items-center gap-1 ${
                viewMode === 'raw'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Terminal size={11} />
              <span>Raw DiG</span>
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1 font-mono text-xs">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500 gap-3">
              <RefreshCw size={28} className="animate-spin text-sky-400" />
              <p className="text-sm">Querying DNS records for {target}...</p>
            </div>
          ) : viewMode === 'raw' ? (
            /* Raw Terminal View */
            <div className="relative">
              <pre className="p-4 rounded-xl bg-gray-950 border border-gray-800 text-gray-300 font-mono text-xs leading-relaxed overflow-x-auto selection:bg-sky-900 selection:text-white">
                {data?.rawOutput || '; No query executed yet'}
              </pre>
            </div>
          ) : (
            /* Visual Records View */
            <div className="flex flex-col gap-3">
              {data?.answers && data.answers.length > 0 ? (
                <div className="border border-gray-800 rounded-xl overflow-hidden bg-gray-950/80">
                  <div className="grid grid-cols-12 px-4 py-2 bg-gray-900/80 border-b border-gray-800 text-[11px] uppercase tracking-wider text-gray-400 font-semibold">
                    <div className="col-span-4">Name</div>
                    <div className="col-span-2 text-center">Type</div>
                    <div className="col-span-2 text-center">TTL</div>
                    <div className="col-span-4">Data / Value</div>
                  </div>

                  <div className="divide-y divide-gray-800/60">
                    {data.answers.map((rec, idx) => {
                      const rowId = `rec-${idx}`;
                      return (
                        <div 
                          key={idx} 
                          className="grid grid-cols-12 px-4 py-2.5 hover:bg-gray-900/50 transition-colors items-center text-xs group"
                        >
                          <div className="col-span-4 text-gray-300 truncate pr-2 font-mono" title={rec.name}>
                            {rec.name}
                          </div>
                          <div className="col-span-2 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                              rec.type === 'A' || rec.type === 'AAAA'
                                ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-400'
                                : rec.type === 'PTR'
                                ? 'bg-sky-950/80 border-sky-500/40 text-sky-400'
                                : rec.type === 'MX'
                                ? 'bg-purple-950/80 border-purple-500/40 text-purple-400'
                                : rec.type === 'TXT'
                                ? 'bg-amber-950/80 border-amber-500/40 text-amber-400'
                                : rec.type === 'NS' || rec.type === 'SOA'
                                ? 'bg-indigo-950/80 border-indigo-500/40 text-indigo-400'
                                : 'bg-gray-900 border-gray-800 text-gray-400'
                            }`}>
                              {rec.type}
                            </span>
                          </div>
                          <div className="col-span-2 text-center text-gray-500 font-mono">
                            {rec.ttl !== undefined ? `${rec.ttl}s` : '--'}
                          </div>
                          <div className="col-span-4 flex items-center justify-between text-gray-200 font-mono overflow-hidden">
                            <span className="truncate pr-2" title={rec.data}>
                              {rec.priority !== undefined && (
                                <span className="text-purple-400 font-bold mr-1">[{rec.priority}]</span>
                              )}
                              {rec.data}
                            </span>
                            <button
                              onClick={() => handleCopyField(rec.data, rowId)}
                              className="text-gray-500 hover:text-sky-400 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded shrink-0 cursor-pointer"
                              title="Copy record value"
                            >
                              {copiedField === rowId ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center p-6 bg-gray-950/60 rounded-xl border border-gray-800">
                  <div className="w-12 h-12 rounded-full bg-gray-900 border border-gray-800 flex items-center justify-center text-gray-500 mb-3">
                    <FileText size={22} />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-300 mb-1">
                    {data?.status === 'NXDOMAIN' ? 'No DNS Records Found (NXDOMAIN)' : 'No Records Returned'}
                  </h3>
                  <p className="text-xs text-gray-500 max-w-md mb-4">
                    {data?.status === 'NXDOMAIN' 
                      ? `The queried domain/address does not exist in DNS or has no reverse PTR record configured.`
                      : data?.errorMessage || `No ${queryType} records found for "${target}". Try querying a different record type or switching resolver.`}
                  </p>
                  <div className="flex items-center gap-2">
                    {queryType !== 'ALL' && (
                      <button
                        onClick={() => handleTypeChange('ALL')}
                        className="px-3 py-1.5 rounded-lg bg-sky-950 border border-sky-500/40 text-sky-400 hover:bg-sky-900 text-xs transition cursor-pointer"
                      >
                        Query ALL Types
                      </button>
                    )}
                    {queryType !== 'A' && !isIpAddress(target) && (
                      <button
                        onClick={() => handleTypeChange('A')}
                        className="px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-gray-300 hover:text-white text-xs transition cursor-pointer"
                      >
                        Query A Record
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
