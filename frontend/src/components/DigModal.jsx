import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { X, Terminal, Copy, Check, RefreshCw, Server, Search, Globe, FileText, ArrowRight, CornerDownLeft, Layers, ExternalLink, ChevronDown, ChevronUp, Info, ShieldCheck, ShieldAlert, Lock, Unlock, Calendar, Award, Hash, Clock, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';

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
    if (minutes === 0 && seconds === 0) return `${hours}h`;
    if (seconds === 0) return `${hours}h ${minutes}m`;
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  if (seconds === 0) return `${minutes}m`;
  return `${minutes}m ${seconds}s`;
}

// Convert DNS RNAME dot-notation email (e.g. "dns.cloudflare.com" or "hostmaster.example.com") to standard email ("dns@cloudflare.com")
function formatDnsEmail(rname) {
  if (!rname) return '--';
  let clean = rname.replace(/\.$/, '');
  if (clean.includes('\\.')) {
    const parts = clean.split(/(?<!\\)\./);
    if (parts.length > 1) {
      const mailbox = parts[0].replace(/\\\./g, '.');
      const domain = parts.slice(1).join('.');
      return `${mailbox}@${domain}`;
    }
  }
  const firstDot = clean.indexOf('.');
  if (firstDot > 0) {
    return `${clean.slice(0, firstDot)}@${clean.slice(firstDot + 1)}`;
  }
  return clean;
}

// Parse SOA record from structured object or raw RFC 1035 string
function parseSoa(dataStr, soaObj) {
  if (soaObj && typeof soaObj === 'object') {
    return {
      primaryNs: soaObj.primaryNs || '--',
      hostmaster: soaObj.hostmaster || '--',
      serial: soaObj.serial ?? '--',
      refresh: soaObj.refresh ?? '--',
      retry: soaObj.retry ?? '--',
      expire: soaObj.expire ?? '--',
      minttl: soaObj.minttl ?? '--'
    };
  }

  if (!dataStr || typeof dataStr !== 'string') return null;
  const parts = dataStr.trim().split(/\s+/);
  if (parts.length >= 7) {
    return {
      primaryNs: parts[0],
      hostmaster: parts[1],
      serial: Number(parts[2]) || parts[2],
      refresh: Number(parts[3]),
      retry: Number(parts[4]),
      expire: Number(parts[5]),
      minttl: Number(parts[6])
    };
  }
  return null;
}

function SoaDetailsCard({ soa, onCopy, copiedId, rowId }) {
  if (!soa) return null;

  const email = formatDnsEmail(soa.hostmaster);
  const fields = [
    {
      label: 'Start of authority',
      code: 'MNAME',
      desc: 'Primär namnserver med zonens auktoritativa master-kopia',
      value: soa.primaryNs,
      rawValue: soa.primaryNs,
      copyable: true
    },
    {
      label: 'Email',
      code: 'RNAME',
      desc: 'Zonadministratörens e-postadress (ansvarig för DNS-zonsfilen)',
      value: email,
      rawValue: email,
      copyable: true,
      isEmail: true
    },
    {
      label: 'Serial',
      code: 'SERIAL',
      desc: 'Zonens versionsnummer (ökas vid varje ändring så sekundära servrar vet att de ska synka)',
      value: typeof soa.serial === 'number' ? soa.serial.toLocaleString() : soa.serial,
      rawValue: String(soa.serial),
      copyable: true
    },
    {
      label: 'Refresh',
      code: 'REFRESH',
      desc: 'Hur ofta sekundära namnservrar frågar den primära servern efter uppdateringar',
      value: formatTtl(soa.refresh),
      extra: typeof soa.refresh === 'number' ? `(${soa.refresh.toLocaleString()} s)` : null
    },
    {
      label: 'Retry',
      code: 'RETRY',
      desc: 'Väntetid innan återförsök om primär server inte svarar vid uppdateringsförsök',
      value: formatTtl(soa.retry),
      extra: typeof soa.retry === 'number' ? `(${soa.retry.toLocaleString()} s)` : null
    },
    {
      label: 'Expire',
      code: 'EXPIRE',
      desc: 'Hur länge sekundära servrar fortsätter svara om primär server slutar svara helt',
      value: formatTtl(soa.expire),
      extra: typeof soa.expire === 'number' ? `(${Math.round(soa.expire / 86400)} dagar / ${soa.expire.toLocaleString()} s)` : null
    },
    {
      label: 'Negative cache TTL',
      code: 'MINIMUM',
      desc: 'Hur länge negativa DNS-svar (t.ex. NXDOMAIN för namn som inte finns) får sparas i cachen',
      value: formatTtl(soa.minttl),
      extra: typeof soa.minttl === 'number' ? `(${soa.minttl.toLocaleString()} s)` : null
    }
  ];

  return (
    <div className="mt-2 mb-3 mx-3 p-3.5 rounded-xl bg-gray-900/95 border border-indigo-500/30 shadow-lg shadow-black/50 text-xs font-sans">
      <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
          <span className="font-semibold text-gray-200">Start of Authority (SOA) — Detaljerad översikt</span>
        </div>
        <span className="text-[10px] text-gray-500 font-mono">RFC 1035 specifikation</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {fields.map((f, i) => {
          const fieldCopyId = `${rowId}-${f.code}`;
          return (
            <div 
              key={i} 
              className={`p-2.5 rounded-lg bg-gray-950/80 border border-gray-800 flex flex-col justify-between ${
                i === 0 || i === 1 ? 'md:col-span-2' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-200 font-semibold text-xs">{f.label}</span>
                    <span className="text-[10px] font-mono font-bold text-indigo-400 bg-indigo-950/70 border border-indigo-500/30 px-1.5 py-0.5 rounded">
                      {f.code}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-400 leading-snug mt-0.5 font-sans">
                    {f.desc}
                  </div>
                </div>
                {f.copyable && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCopy(f.rawValue, fieldCopyId);
                    }}
                    className="text-gray-500 hover:text-sky-400 p-1 rounded transition-colors cursor-pointer shrink-0"
                    title={`Kopiera ${f.label}`}
                  >
                    {copiedId === fieldCopyId ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  </button>
                )}
              </div>
              <div className="flex items-baseline gap-2 mt-1.5 pt-1.5 border-t border-gray-900 font-mono">
                <span className="text-white font-medium text-xs break-all">
                  {f.isEmail ? (
                    <a href={`mailto:${f.rawValue}`} className="text-sky-400 hover:underline">
                      {f.value}
                    </a>
                  ) : (
                    f.value
                  )}
                </span>
                {f.extra && (
                  <span className="text-[11px] text-gray-500 font-normal">
                    {f.extra}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatSslDate(dateStr) {
  if (!dateStr) return '--';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateStr;
  }
}

function SslCheckerView({ sslData, loading, onRefresh, target, port, setPort, onCopyField, copiedField }) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500 gap-3">
        <RefreshCw size={28} className="animate-spin text-emerald-400" />
        <p className="text-sm">
          Ansluter och hämtar SSL/TLS-certifikat för <span className="text-gray-200">{target}:{port || 443}</span>...
        </p>
        <span className="text-xs text-gray-600 font-sans">Utför TLS-handskakning och validerar certifikatkedjan...</span>
      </div>
    );
  }

  if (!sslData) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center p-6 bg-gray-950/60 rounded-xl border border-gray-800">
        <Lock size={28} className="text-gray-600 mb-3" />
        <h3 className="text-sm font-semibold text-gray-300 mb-1">Ingen SSL-kontroll utförd än</h3>
        <p className="text-xs text-gray-500 max-w-md mb-4 font-sans">
          Klicka på knappen nedan för att inspektera SSL/TLS-certifikatet för {target}.
        </p>
        <button
          type="button"
          onClick={() => onRefresh(target, port)}
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
        >
          <ShieldCheck size={14} />
          <span>Starta SSL-kontroll</span>
        </button>
      </div>
    );
  }

  if (!sslData.ok) {
    return (
      <div className="flex flex-col gap-4 font-sans">
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 flex items-start gap-3">
          <ShieldAlert size={22} className="text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <div className="font-semibold text-rose-300 text-sm mb-1">
              Inget giltigt SSL/TLS-certifikat hittades
            </div>
            <p className="text-gray-300 mb-2 font-sans">
              Kunde inte upprätta en säker TLS-anslutning till <strong className="text-white font-mono">{sslData.host}:{sslData.port}</strong>.
            </p>
            <div className="p-2.5 rounded bg-gray-950 border border-rose-900/40 font-mono text-rose-300 text-[11px] break-all">
              Fel: {sslData.error || sslData.code || 'Anslutningsfel'}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => onRefresh(target, port)}
                className="px-3 py-1.5 rounded-lg bg-gray-900 hover:bg-gray-800 text-gray-200 border border-gray-700 hover:border-gray-600 text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <RefreshCw size={12} />
                <span>Försök igen</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Calculate life progress percentage
  let lifePercent = 100;
  if (sslData.validFromMs && sslData.validToMs && sslData.validToMs > sslData.validFromMs) {
    const totalLife = sslData.validToMs - sslData.validFromMs;
    const elapsed = Date.now() - sslData.validFromMs;
    lifePercent = Math.min(100, Math.max(0, Math.round((elapsed / totalLife) * 100)));
  }

  const isTrusted = sslData.authorized && !sslData.isExpired;

  return (
    <div className="flex flex-col gap-4 font-sans text-xs">
      {/* Hero Banner */}
      <div className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 ${
        isTrusted
          ? 'bg-emerald-950/40 border-emerald-500/40'
          : sslData.isExpired
          ? 'bg-rose-950/40 border-rose-500/40'
          : 'bg-amber-950/40 border-amber-500/40'
      }`}>
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
            isTrusted
              ? 'bg-emerald-950 border-emerald-500/50 text-emerald-400'
              : sslData.isExpired
              ? 'bg-rose-950 border-rose-500/50 text-rose-400'
              : 'bg-amber-950 border-amber-500/50 text-amber-400'
          }`}>
            {isTrusted ? <ShieldCheck size={22} /> : sslData.isExpired ? <AlertCircle size={22} /> : <ShieldAlert size={22} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-wide">
                {isTrusted
                  ? 'Giltigt och betrott SSL/TLS-certifikat'
                  : sslData.isExpired
                  ? 'Certifikatet har gått ut!'
                  : 'Certifikatet är inte betrott'}
              </h3>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider border ${
                isTrusted
                  ? 'bg-emerald-950 border-emerald-500/40 text-emerald-400'
                  : sslData.isExpired
                  ? 'bg-rose-950 border-rose-500/40 text-rose-400'
                  : 'bg-amber-950 border-amber-500/40 text-amber-400'
              }`}>
                {isTrusted ? 'VALID' : sslData.isExpired ? 'EXPIRED' : 'UNTRUSTED'}
              </span>
            </div>
            <p className="text-gray-300 text-xs mt-0.5 font-mono">
              <span>{sslData.host}:{sslData.port}</span>
              <span className="text-gray-600 mx-1.5">•</span>
              <span className="text-emerald-400 font-semibold">{sslData.protocol}</span>
              <span className="text-gray-600 mx-1.5">•</span>
              <span className="text-gray-400">{sslData.cipher?.name || 'Cipher'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-gray-400">Handskakningstid</div>
            <div className="text-sm font-bold text-gray-200 font-mono">{sslData.handshakeTime} ms</div>
          </div>
          <button
            type="button"
            onClick={() => onRefresh(target, port)}
            className="p-2 rounded-lg bg-gray-900 hover:bg-gray-800 text-gray-300 hover:text-white border border-gray-800 transition cursor-pointer"
            title="Uppdatera SSL-kontroll"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Card 1: Giltighet */}
        <div className="p-3.5 rounded-xl bg-gray-950/80 border border-gray-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                <Calendar size={14} className="text-emerald-400" /> Giltighet & Återstående tid
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${
                sslData.daysRemaining > 30
                  ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-400'
                  : sslData.daysRemaining > 0
                  ? 'bg-amber-950/70 border-amber-500/40 text-amber-400'
                  : 'bg-rose-950/70 border-rose-500/40 text-rose-400'
              }`}>
                {sslData.daysRemaining > 0 ? `${sslData.daysRemaining} dagar kvar` : 'Utgånget'}
              </span>
            </div>

            {/* Life progress bar */}
            <div className="w-full bg-gray-900 rounded-full h-1.5 mb-3 overflow-hidden border border-gray-800">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  sslData.daysRemaining > 30 ? 'bg-emerald-500' : sslData.daysRemaining > 0 ? 'bg-amber-500' : 'bg-rose-500'
                }`}
                style={{ width: `${lifePercent}%` }}
                title={`${lifePercent}% av certifikatets livslängd har passerat`}
              />
            </div>

            <div className="space-y-1.5 text-xs font-mono">
              <div className="flex justify-between items-center text-gray-400">
                <span>Utfärdat:</span>
                <span className="text-gray-200">{formatSslDate(sslData.validFrom)}</span>
              </div>
              <div className="flex justify-between items-center text-gray-400">
                <span>Förfaller:</span>
                <span className={`font-semibold ${sslData.isExpired ? 'text-rose-400' : 'text-gray-200'}`}>
                  {formatSslDate(sslData.validTo)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Utfärdare & Ägare */}
        <div className="p-3.5 rounded-xl bg-gray-950/80 border border-gray-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                <Award size={14} className="text-sky-400" /> Certifikatutfärdare (CA)
              </span>
              <span className="text-[10px] text-gray-500 font-mono">Issuer</span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Primär domän (CN):</span>
                <span className="text-white font-mono font-semibold truncate max-w-[200px]" title={sslData.subject?.cn}>
                  {sslData.subject?.cn}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Utfärdare:</span>
                <span className="text-emerald-400 font-medium truncate max-w-[200px]" title={sslData.issuer?.o || sslData.issuer?.cn}>
                  {sslData.issuer?.o || sslData.issuer?.cn || 'Okänd'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Organisation (O):</span>
                <span className="text-gray-300 truncate max-w-[200px]" title={sslData.subject?.o || 'Ej angiven'}>
                  {sslData.subject?.o || 'Ej angiven'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: SANs (Subject Alternative Names) */}
        <div className="p-3.5 rounded-xl bg-gray-950/80 border border-gray-800 md:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
              <Globe size={14} className="text-indigo-400" /> Täckta domäner (SANs — Subject Alternative Names)
            </span>
            <span className="text-[10px] font-mono text-gray-500">
              {sslData.sans?.length || 0} st domäner
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
            {sslData.sans && sslData.sans.length > 0 ? (
              sslData.sans.map((name, i) => (
                <span 
                  key={i} 
                  className="px-2 py-0.5 rounded bg-gray-900 border border-gray-800 text-gray-300 font-mono text-[11px] hover:border-gray-700 transition"
                >
                  {name}
                </span>
              ))
            ) : (
              <span className="text-gray-500 italic">Inga alternativa namn listade</span>
            )}
          </div>
        </div>

        {/* Card 4: Certifikatkedja (Hierarchy) */}
        {sslData.chain && sslData.chain.length > 0 && (
          <div className="p-3.5 rounded-xl bg-gray-900/60 border border-gray-800 md:col-span-2">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                <Layers size={14} className="text-amber-400" /> Förtroendekedja (Certificate Chain)
              </span>
              <span className="text-[10px] text-gray-500 font-mono">
                {sslData.chain.length} nivåer
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {sslData.chain.map((c, i) => {
                const isLeaf = i === 0;
                const isRoot = c.isRoot || i === sslData.chain.length - 1;
                return (
                  <div 
                    key={i}
                    className="flex items-center gap-2 p-2 rounded-lg bg-gray-950/80 border border-gray-800/80 text-xs font-mono"
                  >
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 border ${
                      isLeaf
                        ? 'bg-sky-950/80 border-sky-500/40 text-sky-400'
                        : isRoot
                        ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-400'
                        : 'bg-purple-950/80 border-purple-500/40 text-purple-400'
                    }`}>
                      {isLeaf ? 'SERVER' : isRoot ? 'ROOT CA' : 'INTERMEDIATE'}
                    </span>
                    <span className="font-semibold text-gray-200 truncate flex-1" title={c.cn}>
                      {c.cn}
                    </span>
                    {c.o && (
                      <span className="text-gray-400 text-[11px] truncate hidden sm:inline" title={c.o}>
                        ({c.o})
                      </span>
                    )}
                    <span className="text-[10px] text-gray-500 shrink-0">
                      Giltigt till: {formatSslDate(c.validTo)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Card 5: Kryptografi & Fingeravtryck */}
        <div className="p-3.5 rounded-xl bg-gray-950/80 border border-gray-800 md:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
              <Hash size={14} className="text-gray-400" /> Tekniska specifikationer & Fingeravtryck
            </span>
            <span className="text-[10px] text-gray-500 font-mono">SHA-256</span>
          </div>

          <div className="space-y-2 font-mono text-xs">
            {sslData.fingerprint256 && (
              <div className="flex items-center justify-between gap-2 p-2 rounded bg-gray-900 border border-gray-800">
                <div className="truncate">
                  <span className="text-gray-500 mr-2 text-[11px]">SHA-256:</span>
                  <span className="text-gray-300 text-[11px] select-all">{sslData.fingerprint256}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onCopyField(sslData.fingerprint256, 'fp256')}
                  className="text-gray-500 hover:text-sky-400 p-1 rounded transition cursor-pointer shrink-0"
                  title="Kopiera SHA-256 fingeravtryck"
                >
                  {copiedField === 'fp256' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                </button>
              </div>
            )}
            {sslData.serialNumber && (
              <div className="flex items-center justify-between gap-2 p-2 rounded bg-gray-900 border border-gray-800">
                <div className="truncate">
                  <span className="text-gray-500 mr-2 text-[11px]">Serienummer:</span>
                  <span className="text-gray-300 text-[11px] select-all">{sslData.serialNumber}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onCopyField(sslData.serialNumber, 'serial')}
                  className="text-gray-500 hover:text-sky-400 p-1 rounded transition cursor-pointer shrink-0"
                  title="Kopiera serienummer"
                >
                  {copiedField === 'serial' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                </button>
              </div>
            )}
            <div className="flex items-center justify-between text-gray-400 pt-1 text-[11px]">
              <span>Asymmetrisk nyckel: <strong className="text-gray-200">{sslData.keyType || 'RSA/ECDSA'} {sslData.keyBits ? `(${sslData.keyBits} bitar)` : ''}</strong></span>
              <span>Protokoll: <strong className="text-emerald-400">{sslData.protocol}</strong></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DigModal({ hop, traceTarget, onClose, apiBase }) {
  const initialTarget = hop?.hostname && hop.hostname !== hop?.ip ? hop.hostname : (hop?.ip || '');
  const [target, setTarget] = useState(initialTarget);
  const [queryType, setQueryType] = useState(() => (isIpAddress(initialTarget) ? 'PTR' : 'ALL'));
  const [dnsServer, setDnsServer] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [viewMode, setViewMode] = useState('visual'); // 'visual' | 'raw' | 'ssl'
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [copiedField, setCopiedField] = useState(null);
  const [collapsedSoa, setCollapsedSoa] = useState({});
  const [sslData, setSslData] = useState(null);
  const [sslLoading, setSslLoading] = useState(false);
  const [sslPort, setSslPort] = useState('443');

  const targetRef = useRef(target);
  const queryTypeRef = useRef(queryType);
  const dnsServerRef = useRef(dnsServer);
  const activeReqIdRef = useRef(0);
  const sslReqIdRef = useRef(0);

  useEffect(() => { targetRef.current = target; }, [target]);
  useEffect(() => { queryTypeRef.current = queryType; }, [queryType]);
  useEffect(() => { dnsServerRef.current = dnsServer; }, [dnsServer]);

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
    const qTarget = (targetToQuery !== undefined ? targetToQuery : targetRef.current).trim();
    if (!qTarget) return;

    const isTargetAnIp = isIpAddress(qTarget);
    // If target is an IP, query type must be PTR. If target is domain and type is PTR, switch to ALL.
    let qType = typeToQuery !== undefined ? typeToQuery : queryTypeRef.current;
    if (isTargetAnIp) {
      qType = 'PTR';
    } else if (qType === 'PTR') {
      qType = 'ALL';
    }

    const qServer = serverToQuery !== undefined ? serverToQuery : dnsServerRef.current;
    const currentReqId = ++activeReqIdRef.current;

    setData(null);
    setLoading(true);
    const startTime = Date.now();

    try {
      // 1. Try local VNI Engine API if available
      let res = null;
      try {
        const queryParams = new URLSearchParams({
          target: qTarget,
          type: qType
        });
        if (qServer) queryParams.append('server', qServer);

        const response = await fetch(`${apiBase || ''}/api/dig?${queryParams.toString()}`, {
          cache: 'no-cache'
        });
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
          headers: { Accept: 'application/dns-json' },
          cache: 'no-cache'
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

      // Only apply data if this request is still the most recent one
      if (currentReqId === activeReqIdRef.current) {
        setData(res);
      }
    } catch (err) {
      if (currentReqId === activeReqIdRef.current) {
        const duration = Date.now() - startTime;
        setData({
          status: 'ERROR',
          statusCode: 2,
          queryTime: duration,
          server: qServer || 'Default',
          target: qTarget,
          type: qType,
          answers: [],
          errorMessage: err.message || 'Lookup failed',
          rawOutput: `; <<>> DiG (VNI Engine) <<>> ${qType} ${qTarget}\n;; ERROR: ${err.message || 'Lookup failed'}\n;; Query time: ${duration} msec`
        });
      }
    } finally {
      if (currentReqId === activeReqIdRef.current) {
        setLoading(false);
      }
    }
  }, [apiBase]);

  const executeSslCheck = useCallback(async (targetToCheck, portToCheck) => {
    const qTarget = (targetToCheck !== undefined ? targetToCheck : targetRef.current).trim();
    if (!qTarget) return;

    const qPort = portToCheck !== undefined ? portToCheck : sslPort;
    const currentReqId = ++sslReqIdRef.current;

    setSslLoading(true);
    setSslData(null);

    try {
      const queryParams = new URLSearchParams({
        target: qTarget,
        port: qPort || '443'
      });

      const response = await fetch(`${apiBase || ''}/api/ssl-check?${queryParams.toString()}`, {
        cache: 'no-cache'
      });

      let res;
      if (response.ok) {
        res = await response.json();
      } else {
        const errJson = await response.json().catch(() => ({}));
        res = {
          ok: false,
          host: qTarget,
          port: qPort,
          error: errJson.error || `HTTP ${response.status} error under SSL-kontroll`
        };
      }

      if (currentReqId === sslReqIdRef.current) {
        setSslData(res);
      }
    } catch (err) {
      if (currentReqId === sslReqIdRef.current) {
        setSslData({
          ok: false,
          host: qTarget,
          port: qPort,
          error: err.message || 'Kunde inte ansluta till VNI Engine för SSL-kontroll'
        });
      }
    } finally {
      if (currentReqId === sslReqIdRef.current) {
        setSslLoading(false);
      }
    }
  }, [apiBase, sslPort]);

  // Initial lookup once on open
  useEffect(() => {
    executeDig(initialTarget, isIpAddress(initialTarget) ? 'PTR' : 'ALL', dnsServerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleToggleSsl = () => {
    if (viewMode === 'ssl') {
      setViewMode('visual');
    } else {
      setViewMode('ssl');
      executeSslCheck(targetRef.current, sslPort);
    }
  };

  // Immediate search on clicking any quick target pill
  const handleSelectQuickTarget = (item) => {
    const val = item.value;
    const chosenType = item.type || (isIpAddress(val) ? 'PTR' : 'ALL');
    setTarget(val);
    setQueryType(chosenType);
    targetRef.current = val;
    queryTypeRef.current = chosenType;
    if (viewMode === 'ssl') {
      executeSslCheck(val, sslPort);
    } else {
      executeDig(val, chosenType, dnsServerRef.current);
    }
  };

  // Immediate search on changing record type
  const handleTypeChange = (t) => {
    setQueryType(t);
    queryTypeRef.current = t;
    if (viewMode === 'ssl') {
      setViewMode('visual');
    }
    executeDig(targetRef.current, t, dnsServerRef.current);
  };

  // Immediate search on changing resolver
  const handleServerChange = (s) => {
    setDnsServer(s);
    dnsServerRef.current = s;
    if (viewMode === 'ssl') {
      setViewMode('visual');
    }
    executeDig(targetRef.current, queryTypeRef.current, s);
  };

  // Immediate search on form submit (Enter / Dig button)
  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    const cleanTarget = target.trim();
    if (!cleanTarget) return;
    const isIp = isIpAddress(cleanTarget);
    const chosenType = isIp ? 'PTR' : (queryType === 'PTR' ? 'ALL' : queryType);
    setQueryType(chosenType);
    targetRef.current = cleanTarget;
    queryTypeRef.current = chosenType;
    if (viewMode === 'ssl') {
      executeSslCheck(cleanTarget, sslPort);
    } else {
      executeDig(cleanTarget, chosenType, dnsServerRef.current);
    }
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
              type="button"
              onClick={handleToggleSsl}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'ssl'
                  ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300 shadow-sm shadow-emerald-950'
                  : 'bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-emerald-400 border-gray-800'
              }`}
              title={viewMode === 'ssl' ? 'Tillbaka till DNS DiG' : 'Kontrollera målets SSL/TLS-certifikat'}
            >
              <ShieldCheck size={14} className={viewMode === 'ssl' ? 'text-emerald-400' : 'text-emerald-500'} />
              <span>SSL</span>
            </button>
            <button
              type="button"
              onClick={handleCopyRaw}
              className="px-2.5 py-1.5 rounded-lg bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white border border-gray-800 text-xs font-mono transition flex items-center gap-1.5 cursor-pointer"
              title="Copy Raw DiG CLI Output"
            >
              {copiedRaw ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              <span className="hidden sm:inline">Copy DiG</span>
            </button>
            <button
              type="button"
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
              disabled={(viewMode === 'ssl' ? sslLoading : loading) || !target.trim()}
              className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-sm flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer shadow-sm shadow-sky-950"
            >
              <RefreshCw size={14} className={(viewMode === 'ssl' ? sslLoading : loading) ? 'animate-spin' : ''} />
              <span>{viewMode === 'ssl' ? 'Check SSL' : 'Dig'}</span>
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

          {/* Record Type pills & Resolver selection (visible in DNS views) */}
          {viewMode !== 'ssl' && (
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
          )}
        </div>

        {/* Results Metadata Bar */}
        <div className="px-6 py-2.5 bg-gray-900/50 border-b border-gray-800 flex items-center justify-between text-xs font-mono text-gray-400 shrink-0">
          <div className="flex items-center gap-3">
            {viewMode === 'ssl' ? (
              <>
                <span>
                  Port: <strong className="text-gray-200">{sslPort || 443}</strong>
                </span>
                <span className="text-gray-700">•</span>
                <span>
                  Status: <strong className={sslData?.authorized && !sslData?.isExpired ? 'text-emerald-400' : sslData ? 'text-amber-400' : 'text-gray-400'}>
                    {sslData?.authorized && !sslData?.isExpired ? 'Verified' : sslData ? (sslData.isExpired ? 'Expired' : 'Untrusted') : (sslLoading ? 'Checking...' : '--')}
                  </strong>
                </span>
                <span className="text-gray-700">•</span>
                <span>
                  Handshake: <strong className="text-sky-400">{sslData?.handshakeTime !== undefined ? `${sslData.handshakeTime} ms` : (sslLoading ? '...' : '--')}</strong>
                </span>
              </>
            ) : (
              <>
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
              </>
            )}
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
            <button
              type="button"
              onClick={handleToggleSsl}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition cursor-pointer flex items-center gap-1 ${
                viewMode === 'ssl'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-emerald-400'
              }`}
            >
              <ShieldCheck size={12} />
              <span>SSL Checker</span>
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1 font-mono text-xs">
          {viewMode === 'ssl' ? (
            <SslCheckerView
              sslData={sslData}
              loading={sslLoading}
              onRefresh={executeSslCheck}
              target={target}
              port={sslPort}
              setPort={setSslPort}
              onCopyField={handleCopyField}
              copiedField={copiedField}
            />
          ) : loading ? (
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
                      const isSoa = rec.type === 'SOA';
                      const soaInfo = isSoa ? parseSoa(rec.data, rec.soa) : null;
                      const isCollapsed = Boolean(collapsedSoa[rowId]);

                      return (
                        <div key={idx} className="flex flex-col">
                          <div 
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
                                {isSoa && soaInfo ? (
                                  <span>
                                    <span className="text-indigo-300">{soaInfo.primaryNs}</span>
                                    <span className="text-gray-500 mx-1">•</span>
                                    <span className="text-gray-400">{formatDnsEmail(soaInfo.hostmaster)}</span>
                                  </span>
                                ) : (
                                  rec.data
                                )}
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                {isSoa && soaInfo && (
                                  <button
                                    type="button"
                                    onClick={() => setCollapsedSoa(prev => ({ ...prev, [rowId]: !prev[rowId] }))}
                                    className="text-indigo-400 hover:text-indigo-300 bg-indigo-950/70 hover:bg-indigo-900/70 border border-indigo-500/40 px-2 py-0.5 rounded text-[10px] font-sans flex items-center gap-1 transition cursor-pointer"
                                    title={isCollapsed ? 'Visa detaljerad SOA-översikt' : 'Dölj SOA-översikt'}
                                  >
                                    <span>{isCollapsed ? 'Visa SOA' : 'Dölj'}</span>
                                    {isCollapsed ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
                                  </button>
                                )}
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
                          </div>

                          {/* Expandable SOA Details Card */}
                          {isSoa && soaInfo && !isCollapsed && (
                            <SoaDetailsCard
                              soa={soaInfo}
                              rowId={rowId}
                              onCopy={handleCopyField}
                              copiedId={copiedField}
                            />
                          )}
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
