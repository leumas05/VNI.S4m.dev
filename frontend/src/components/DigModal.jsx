import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Terminal, Copy, Check, RefreshCw, Server, Search, Globe, FileText, ArrowRight, CornerDownLeft, Layers, ExternalLink } from 'lucide-react';

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

// Extract domain hierarchy: e.g. "gw40-no2330.tbcn.telia.com" -> ["tbcn.telia.com", "telia.com"]
function extractDomainLevels(hostname) {
  if (!hostname || isIpAddress(hostname)) return [];
  const clean = hostname.trim().toLowerCase().replace(/\.$/, '');
  const parts = clean.split('.').filter(Boolean);
  if (parts.length <= 1) return [];

  const levels = [];
  // For standard domain hierarchies, get intermediate subdomains and apex domain
  for (let i = 1; i < parts.length - 1; i++) {
    levels.push(parts.slice(i).join('.'));
  }
  return Array.from(new Set(levels));
}

function formatTtl(ttl) {
  if (ttl === undefined || ttl === null || isNaN(ttl)) return '--';
  const val = Number(ttl);
  if (val < 0) return '--';
  if (val < 60) return `${val}s`;

  const hours = Math.floor(val / 3600);
  const minutes = Math.floor((val % 3600) / 60);
  const seconds = val % 60;

  if (hours > 0) {
    if (minutes === 0 && seconds === 0) return `${hours} tim`;
    if (seconds === 0) return `${hours}h ${minutes}m`;
    return `${hours}h ${minutes}m`;
  }

  if (seconds === 0) return `${minutes} min`;
  return `${minutes}m ${seconds}s`;
}

export default function DigModal({ hop, traceTarget, onClose, apiBase }) {
  const initialTarget = hop?.hostname && hop.hostname !== hop?.ip ? hop.hostname : (hop?.ip || '');
  const [target, setTarget] = useState(initialTarget);
  const [queryType, setQueryType] = useState(() => (isIpAddress(initialTarget) ? 'PTR' : 'ALL'));
  const [dnsServer, setDnsServer] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [viewMode, setViewMode] = useState('visual'); // 'visual' | 'raw'
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  // Generate quick target pills (IP, Hostname, Subdomains, Base Domain, Trace Destination)
  const quickTargets = useMemo(() => {
    const list = [];
    const seen = new Set();

    // 1. Hop IP
    if (hop?.ip) {
      list.push({
        id: 'ip',
        label: `IP: ${hop.ip}`,
        value: hop.ip,
        badge: 'PTR',
        type: 'PTR'
      });
      seen.add(hop.ip.toLowerCase());
    }

    // 2. Full Hop Hostname
    if (hop?.hostname && !seen.has(hop.hostname.toLowerCase())) {
      list.push({
        id: 'host',
        label: `Host: ${hop.hostname}`,
        value: hop.hostname,
        badge: 'HOST',
        type: 'ALL'
      });
      seen.add(hop.hostname.toLowerCase());

      // 3. Subdomain and Domain hierarchy levels
      const levels = extractDomainLevels(hop.hostname);
      levels.forEach((lvl, idx) => {
        if (!seen.has(lvl)) {
          const isBase = idx === levels.length - 1;
          list.push({
            id: `lvl-${lvl}`,
            label: isBase ? `Domain: ${lvl}` : `Subdomain: ${lvl}`,
            value: lvl,
            badge: isBase ? 'DOMAIN' : 'SUB',
            type: 'ALL'
          });
          seen.add(lvl);
        }
      });
    }

    // 4. Trace Destination (what user initially traced)
    if (traceTarget && !seen.has(traceTarget.toLowerCase())) {
      const isDestIp = isIpAddress(traceTarget);
      list.push({
        id: 'dest',
        label: `Destination: ${traceTarget}`,
        value: traceTarget,
        badge: 'DEST',
        type: isDestIp ? 'PTR' : 'ALL'
      });
      seen.add(traceTarget.toLowerCase());

      if (!isDestIp) {
        const destLevels = extractDomainLevels(traceTarget);
        destLevels.forEach((lvl, idx) => {
          if (!seen.has(lvl)) {
            const isBase = idx === destLevels.length - 1;
            list.push({
              id: `dest-lvl-${lvl}`,
              label: isBase ? `Domain: ${lvl}` : `Subdomain: ${lvl}`,
              value: lvl,
              badge: isBase ? 'DOMAIN' : 'SUB',
              type: 'ALL'
            });
            seen.add(lvl);
          }
        });
      }
    }

    return list;
  }, [hop, traceTarget]);

  const executeDig = useCallback(async (targetToQuery, typeToQuery, serverToQuery) => {
    const qTarget = (targetToQuery !== undefined ? targetToQuery : target).trim();
    if (!qTarget) return;

    const isTargetAnIp = isIpAddress(qTarget);
    // If target is an IP, query type must be PTR. If target is domain and type is PTR, switch to ALL.
    let qType = typeToQuery || queryType;
    if (isTargetAnIp) {
      qType = 'PTR';
    } else if (qType === 'PTR') {
      qType = 'ALL';
    }

    const qServer = serverToQuery !== undefined ? serverToQuery : dnsServer;

    setData(null);
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
        console.warn('Backend /api/dig unavailable, falling back to DoH:', engineErr);
      }

      // 2. Client-side Cloudflare / Google DoH fallback
      if (!res) {
        const nameToQuery = isTargetAnIp ? toArpa(qTarget) : qTarget;
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
          server: '1.1.1.1#53 (Cloudflare DoH)',
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

  // Immediate search on clicking any quick target pill
  const handleSelectQuickTarget = (item) => {
    setTarget(item.value);
    const chosenType = item.type || (isIpAddress(item.value) ? 'PTR' : 'ALL');
    setQueryType(chosenType);
    executeDig(item.value, chosenType, dnsServer);
  };

  // Immediate search on changing record type
  const handleTypeChange = (t) => {
    setQueryType(t);
    executeDig(target, t, dnsServer);
  };

  // Immediate search on changing resolver
  const handleServerChange = (s) => {
    setDnsServer(s);
    executeDig(target, queryType, s);
  };

  // Immediate search on form submit (Enter / Dig button)
  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    const cleanTarget = target.trim();
    if (!cleanTarget) return;
    const isIp = isIpAddress(cleanTarget);
    const chosenType = isIp ? 'PTR' : (queryType === 'PTR' ? 'ALL' : queryType);
    setQueryType(chosenType);
    executeDig(cleanTarget, chosenType, dnsServer);
  };

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
                {hop?.hostname && hop.hostname !== hop?.ip && <span className="text-gray-500">({hop.hostname})</span>}
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
          {/* Target Input and Dig button */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="Domain or IP address (e.g. telia.com, s4m.dev or 1.1.1.1)"
                className="w-full bg-gray-950 border border-gray-700/80 focus:border-sky-500/80 rounded-lg pl-9 pr-8 py-1.5 text-sm text-gray-200 font-mono focus:outline-none transition"
              />
              {target && (
                <button
                  type="button"
                  onClick={() => setTarget('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 cursor-pointer"
                  title="Clear input"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            
            <button
              type="submit"
              disabled={loading || !target.trim()}
              className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-sm flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer shadow-sm shadow-sky-950"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Dig</span>
            </button>
          </form>

          {/* Quick Target Hierarchy Pills */}
          {quickTargets.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
              <span className="text-[11px] text-gray-500 flex items-center gap-1 mr-1">
                <Layers size={12} className="text-sky-400" /> Quick targets:
              </span>
              {quickTargets.map((item) => {
                const isActive = target.trim().toLowerCase() === item.value.toLowerCase();
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectQuickTarget(item)}
                    className={`px-2 py-0.5 rounded border transition cursor-pointer flex items-center gap-1 text-[11px] ${
                      isActive
                        ? 'bg-sky-950 border-sky-500 text-sky-300 font-bold shadow-sm shadow-sky-950'
                        : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'
                    }`}
                    title={`Instantly query ${item.value}`}
                  >
                    <span className="truncate max-w-[200px]">{item.label}</span>
                  </button>
                );
              })}
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
                  type="button"
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
              Query time: <strong className="text-gray-200">{data ? `${data.queryTime} ms` : (loading ? '...' : '--')}</strong>
            </span>
            <span className="text-gray-700">•</span>
            <span className="truncate max-w-[200px]" title={data?.server}>
              Server: <strong className="text-gray-200">{data?.server || (dnsServer || 'Default')}</strong>
            </span>
            <span className="text-gray-700">•</span>
            <span>
              Answers: <strong className="text-sky-400">{data?.answers ? data.answers.length : 0}</strong>
            </span>
          </div>

          <div className="flex items-center gap-1 bg-gray-950 p-0.5 rounded-lg border border-gray-800">
            <button
              type="button"
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
              type="button"
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
              <p className="text-sm">Querying DNS records for <span className="text-gray-200">{target}</span> ({queryType})...</p>
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
                          <div 
                            className="col-span-2 text-center text-gray-400 font-mono"
                            title={rec.ttl !== undefined ? `${Number(rec.ttl).toLocaleString()} sekunder` : undefined}
                          >
                            <span className="text-gray-300 font-medium">{formatTtl(rec.ttl)}</span>
                          </div>
                          <div className="col-span-4 flex items-center justify-between text-gray-200 font-mono overflow-hidden">
                            <span className="truncate pr-2" title={rec.data}>
                              {rec.priority !== undefined && (
                                <span className="text-purple-400 font-bold mr-1">[{rec.priority}]</span>
                              )}
                              {rec.data}
                            </span>
                            <button
                              type="button"
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
                      ? `The queried name or IP address has no configured ${queryType} DNS records.`
                      : data?.errorMessage || `No ${queryType} records found for "${target}". Try querying a different record type or switching resolver.`}
                  </p>
                  <div className="flex items-center gap-2">
                    {queryType !== 'ALL' && !isIpAddress(target) && (
                      <button
                        type="button"
                        onClick={() => handleTypeChange('ALL')}
                        className="px-3 py-1.5 rounded-lg bg-sky-950 border border-sky-500/40 text-sky-400 hover:bg-sky-900 text-xs transition cursor-pointer"
                      >
                        Query ALL Types
                      </button>
                    )}
                    {queryType !== 'A' && !isIpAddress(target) && (
                      <button
                        type="button"
                        onClick={() => handleTypeChange('A')}
                        className="px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-gray-300 hover:text-white text-xs transition cursor-pointer"
                      >
                        Query A Record
                      </button>
                    )}
                    {isIpAddress(target) && (
                      <button
                        type="button"
                        onClick={() => handleTypeChange('PTR')}
                        className="px-3 py-1.5 rounded-lg bg-sky-950 border border-sky-500/40 text-sky-400 hover:bg-sky-900 text-xs transition cursor-pointer"
                      >
                        Retry PTR Lookup
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
