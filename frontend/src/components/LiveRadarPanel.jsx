import React, { useState, useMemo } from 'react';
import {
  Radio, RefreshCw, Search, ShieldCheck, ShieldAlert, Lock, Eye,
  Terminal, Activity, Play, Pause, X, HelpCircle, Layers, List,
  Copy, Check, Download, ChevronDown, ChevronRight, Navigation, Clock
} from 'lucide-react';
import RadarGuideModal from './RadarGuideModal';

function getCountryFlag(countryCode) {
  if (!countryCode || countryCode.length !== 2) return '🌐';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

function getProcessColor(processName) {
  const p = (processName || '').toLowerCase();
  if (p.includes('chrome') || p.includes('msedge') || p.includes('firefox') || p.includes('brave') || p.includes('opera')) {
    return 'text-emerald-400 border-emerald-500/30 bg-emerald-950/40';
  }
  if (p.includes('discord') || p.includes('spotify') || p.includes('steam') || p.includes('vlc')) {
    return 'text-purple-400 border-purple-500/30 bg-purple-950/40';
  }
  if (p.includes('code') || p.includes('node') || p.includes('git') || p.includes('electron') || p.includes('python')) {
    return 'text-sky-400 border-sky-500/30 bg-sky-950/40';
  }
  if (p.includes('onedrive') || p.includes('dropbox') || p.includes('googledrive')) {
    return 'text-amber-400 border-amber-500/30 bg-amber-950/40';
  }
  return 'text-indigo-400 border-indigo-500/30 bg-indigo-950/40';
}

function getSecurityBadge(security) {
  if (!security) return null;
  if (security.level === 'telemetry') {
    return {
      icon: <Eye size={9} />,
      label: security.badge || 'Telemetry',
      className: 'bg-amber-950/80 border-amber-500/40 text-amber-300'
    };
  }
  if (security.level === 'warning') {
    return {
      icon: <ShieldAlert size={9} />,
      label: security.badge || 'Cleartext',
      className: 'bg-red-950/80 border-red-500/40 text-red-300'
    };
  }
  if (security.encrypted) {
    return {
      icon: <Lock size={9} />,
      label: security.badge || 'Encrypted',
      className: 'bg-emerald-950/70 border-emerald-500/30 text-emerald-300'
    };
  }
  return {
    icon: <ShieldCheck size={9} />,
    label: security.badge || 'Standard',
    className: 'bg-gray-900 border-gray-700 text-gray-400'
  };
}

export default function LiveRadarPanel({
  radarData,
  loading,
  onRefresh,
  autoRefresh,
  setAutoRefresh,
  selectedConn,
  onSelectConn,
  onPing,
  onDig,
  onTrace,
  hideSelfConnections,
  onToggleHideSelf
}) {
  const [search, setSearch] = useState('');
  const [activeProcess, setActiveProcess] = useState('ALL');
  const [securityFilter, setSecurityFilter] = useState('ALL'); // 'ALL' | 'ENCRYPTED' | 'TELEMETRY' | 'UDP' | 'NEW'
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'grouped'
  const [expandedGroups, setExpandedGroups] = useState({});
  const [copiedId, setCopiedId] = useState(null);
  const [showGuideModal, setShowGuideModal] = useState(false);

  const connections = useMemo(() => radarData?.connections || [], [radarData]);

  const topProcesses = useMemo(() => {
    if (!radarData?.processCounts) return [];
    return Object.entries(radarData.processCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7);
  }, [radarData]);

  // Security & Protocol counts across current connections
  const stats = useMemo(() => {
    let encrypted = 0;
    let telemetry = 0;
    let udpCount = 0;
    let newCount = 0;
    connections.forEach(c => {
      if (c.security?.encrypted) encrypted++;
      if (c.security?.isTelemetry || c.security?.level === 'telemetry') telemetry++;
      if ((c.proto || '').toUpperCase() === 'UDP') udpCount++;
      if (c.isNew) newCount++;
    });
    return { encrypted, telemetry, udpCount, newCount };
  }, [connections]);

  const filteredConnections = useMemo(() => {
    return connections.filter(conn => {
      if (activeProcess !== 'ALL' && conn.process !== activeProcess) {
        return false;
      }
      if (securityFilter === 'ENCRYPTED' && !conn.security?.encrypted) return false;
      if (securityFilter === 'TELEMETRY' && !conn.security?.isTelemetry && conn.security?.level !== 'telemetry') return false;
      if (securityFilter === 'UDP' && (conn.proto || '').toUpperCase() !== 'UDP') return false;
      if (securityFilter === 'NEW' && !conn.isNew) return false;

      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchesProcess = (conn.process || '').toLowerCase().includes(q);
        const matchesIp = (conn.remoteIp || '').toLowerCase().includes(q);
        const matchesDomain = (conn.domain || '').toLowerCase().includes(q);
        const matchesService = (conn.serviceLabel || '').toLowerCase().includes(q);
        const matchesCategory = (conn.appCategory || '').toLowerCase().includes(q);
        const matchesPort = String(conn.remotePort || '').includes(q);
        const matchesCountry = (conn.geo?.country || '').toLowerCase().includes(q) || (conn.geo?.countryCode || '').toLowerCase().includes(q);
        const matchesCity = (conn.geo?.city || '').toLowerCase().includes(q);
        const matchesIsp = (conn.geo?.isp || '').toLowerCase().includes(q);
        return (
          matchesProcess || matchesIp || matchesDomain || matchesService ||
          matchesCategory || matchesPort || matchesCountry || matchesCity || matchesIsp
        );
      }
      return true;
    });
  }, [connections, activeProcess, securityFilter, search]);

  const groupedByProcess = useMemo(() => {
    const map = {};
    filteredConnections.forEach(conn => {
      const key = conn.process || 'Unknown Process';
      if (!map[key]) {
        map[key] = {
          process: key,
          appCategory: conn.appCategory || 'Application',
          connections: [],
          countries: new Set(),
          uniqueIps: new Set(),
          telemetryCount: 0,
          encryptedCount: 0
        };
      }
      map[key].connections.push(conn);
      if (conn.geo?.countryCode) map[key].countries.add(conn.geo.countryCode);
      if (conn.remoteIp) map[key].uniqueIps.add(conn.remoteIp);
      if (conn.security?.isTelemetry) map[key].telemetryCount++;
      if (conn.security?.encrypted) map[key].encryptedCount++;
    });
    return Object.values(map).sort((a, b) => b.connections.length - a.connections.length);
  }, [filteredConnections]);

  const toggleGroup = (procName) => {
    setExpandedGroups(prev => ({
      ...prev,
      [procName]: prev[procName] === undefined ? false : !prev[procName]
    }));
  };

  const handleCopy = (e, text, id) => {
    e.stopPropagation();
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleExportRadar = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      totalConnections: filteredConnections.length,
      connections: filteredConnections
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vni-radar-snapshot-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderConnectionCard = (conn, idx) => {
    const isSelected = selectedConn && selectedConn.remoteIp === conn.remoteIp && selectedConn.remotePort === conn.remotePort;
    const procClass = getProcessColor(conn.process);
    const flag = getCountryFlag(conn.geo?.countryCode);
    const secBadge = getSecurityBadge(conn.security);
    const cardId = `${conn.remoteIp}-${conn.remotePort}-${idx}`;

    return (
      <div
        key={cardId}
        onClick={() => onSelectConn && onSelectConn(isSelected ? null : conn)}
        className={`p-2.5 rounded-xl border transition-all cursor-pointer group ${
          isSelected
            ? 'bg-gray-900/95 border-emerald-500 shadow-md shadow-emerald-950/50 ring-1 ring-emerald-500/40'
            : 'bg-gray-950/75 border-gray-800/90 hover:border-gray-700 hover:bg-gray-900/50'
        }`}
      >
        {/* Top Row: Process + Category + Protocol/Service */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 truncate">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border truncate ${procClass}`}>
              {conn.process}
            </span>
            {conn.isNew && (
              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 animate-pulse">
                NEW
              </span>
            )}
            {conn.isSelf && (
              <span className="px-1 py-0.2 rounded text-[9px] font-mono font-bold border border-amber-500/40 text-amber-300 bg-amber-950/60 uppercase" title="This app (VNI / Engine)">
                VNI
              </span>
            )}
            {conn.pid && (
              <span className="text-[10px] text-gray-500 font-mono hidden sm:inline">
                PID:{conn.pid}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 text-[10px] font-mono shrink-0">
            {conn.serviceLabel && (
              <span className="px-1.5 py-0.2 rounded bg-gray-900 border border-gray-800 text-gray-300 font-semibold">
                {conn.serviceLabel}
              </span>
            )}
            <span className={`px-1 py-0.2 rounded font-bold ${
              (conn.proto || '').toUpperCase() === 'UDP'
                ? 'text-purple-300 bg-purple-950/60 border border-purple-500/30'
                : 'text-gray-400'
            }`}>
              {conn.proto}
            </span>
            <span className="text-emerald-400 font-bold">:{conn.remotePort}</span>
          </div>
        </div>

        {/* Middle Row: Domain / Hostname + Destination Geo & IP */}
        <div className="flex items-start justify-between gap-2 mb-2 font-mono">
          <div className="truncate flex-1">
            {/* Domain Name if resolved */}
            {conn.domain ? (
              <div className="flex items-center gap-1.5 truncate mb-0.5">
                <span className="text-emerald-300 font-bold text-xs truncate" title={conn.domain}>
                  {conn.domain}
                </span>
                {conn.domainSource && (
                  <span
                    className={`px-1 py-0.1 rounded text-[8px] font-mono uppercase border shrink-0 ${
                      conn.domainSource === 'DNS Cache'
                        ? 'bg-sky-950/80 border-sky-500/40 text-sky-300'
                        : 'bg-indigo-950/80 border-indigo-500/40 text-indigo-300'
                    }`}
                    title={conn.domainSource === 'DNS Cache' ? 'Matched from local OS DNS Resolver Cache' : 'Resolved via Reverse DNS (PTR)'}
                  >
                    {conn.domainSource === 'DNS Cache' ? 'DNS' : 'PTR'}
                  </span>
                )}
              </div>
            ) : null}

            {/* Geo Location */}
            <div className="text-gray-200 font-semibold text-[11px] flex items-center gap-1.5 truncate">
              <span>{flag}</span>
              <span className="truncate">
                {conn.geo?.city ? `${conn.geo.city}, ` : ''}{conn.geo?.country || 'Unknown Location'}
              </span>
            </div>

            {/* IP + ISP */}
            <div className="text-[10px] text-gray-400 truncate mt-0.5 flex items-center gap-1.5">
              <span className="text-gray-300">{conn.remoteIp}</span>
              {conn.geo?.isp && <span className="truncate text-gray-500">• {conn.geo.isp}</span>}
            </div>
          </div>

          {/* Right column: Security Badge & Session Duration */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            {secBadge && (
              <span
                className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold border flex items-center gap-1 ${secBadge.className}`}
                title={conn.security?.reason || secBadge.label}
              >
                {secBadge.icon}
                <span>{secBadge.label}</span>
              </span>
            )}
            {conn.durationFormatted && (
              <span className="text-[9px] font-mono text-gray-500 flex items-center gap-1" title="Active session duration">
                <Clock size={9} className="text-gray-600" />
                <span>{conn.durationFormatted}</span>
              </span>
            )}
          </div>
        </div>

        {/* Bottom Action Bar: Trace, Ping, DiG, SSL, Copy */}
        <div className="flex items-center justify-between pt-1.5 border-t border-gray-900/80 text-[10px]">
          <span className="text-[9px] text-gray-500 font-mono uppercase truncate max-w-[90px]" title={conn.appCategory || conn.state}>
            {conn.appCategory || conn.state}
          </span>

          <div className="flex items-center gap-1 flex-wrap justify-end">
            {onTrace && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onTrace(conn.domain || conn.remoteIp);
                }}
                className="px-1.5 py-0.5 rounded bg-amber-950/50 hover:bg-amber-900/70 border border-amber-500/30 hover:border-amber-400 text-amber-300 transition cursor-pointer flex items-center gap-1 font-medium"
                title={`Run full Traceroute to ${conn.domain || conn.remoteIp}`}
              >
                <Navigation size={9} />
                <span>Trace</span>
              </button>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPing && onPing({ ip: conn.remoteIp, hostname: conn.domain || conn.process, geo: conn.geo, isPrivate: false });
              }}
              className="px-1.5 py-0.5 rounded bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 text-gray-300 hover:text-emerald-400 transition cursor-pointer flex items-center gap-1"
              title={`Live Ping ${conn.remoteIp}`}
            >
              <Activity size={9} className="text-emerald-400" />
              <span>Ping</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDig && onDig({ ip: conn.remoteIp, hostname: conn.domain || conn.remoteIp, geo: conn.geo });
              }}
              className="px-1.5 py-0.5 rounded bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 text-gray-300 hover:text-sky-400 transition cursor-pointer flex items-center gap-1"
              title={`DNS (DiG) lookup for ${conn.domain || conn.remoteIp}`}
            >
              <Terminal size={9} className="text-sky-400" />
              <span>DiG</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDig && onDig({ ip: conn.remoteIp, hostname: conn.domain || conn.remoteIp, geo: conn.geo, initialTab: 'ssl' });
              }}
              className="px-1.5 py-0.5 rounded bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 text-gray-300 hover:text-emerald-400 transition cursor-pointer flex items-center gap-1"
              title={`Inspect SSL/TLS Certificate on ${conn.domain || conn.remoteIp}`}
            >
              <ShieldCheck size={9} className="text-emerald-400" />
              <span>SSL</span>
            </button>

            <button
              type="button"
              onClick={(e) => handleCopy(e, conn.domain || conn.remoteIp, cardId)}
              className="p-1 rounded bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-400 hover:text-white transition cursor-pointer"
              title={`Copy ${conn.domain || conn.remoteIp}`}
            >
              {copiedId === cardId ? <Check size={9} className="text-emerald-400" /> : <Copy size={9} />}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden font-sans text-xs">
      {/* Radar Stats Hero Card */}
      <div className="bg-gray-950/90 border border-emerald-500/30 rounded-xl p-3 mb-2.5 shadow-lg shadow-black/40">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              {autoRefresh ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-gray-500"></span>
              )}
            </span>
            <span className="font-bold text-white text-sm tracking-wide flex items-center gap-1.5">
              Live Connection Radar
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 border transition cursor-pointer ${
                autoRefresh
                  ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
                  : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-gray-200'
              }`}
              title={autoRefresh ? 'Pause auto-refresh' : 'Resume live updates (4s)'}
            >
              {autoRefresh ? <Pause size={10} /> : <Play size={10} />}
              <span>{autoRefresh ? 'Live (4s)' : 'Paused'}</span>
            </button>

            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="p-1.5 rounded bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-400 hover:text-white transition cursor-pointer disabled:opacity-50"
              title="Refresh connections now"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin text-emerald-400' : ''} />
            </button>

            <button
              type="button"
              onClick={handleExportRadar}
              disabled={filteredConnections.length === 0}
              className="p-1.5 rounded bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-400 hover:text-emerald-400 transition cursor-pointer disabled:opacity-40"
              title="Export current Radar snapshot as JSON"
            >
              <Download size={12} />
            </button>

            <button
              type="button"
              onClick={() => setShowGuideModal(true)}
              className="p-1.5 rounded bg-emerald-950/60 hover:bg-emerald-900/70 border border-emerald-500/30 text-emerald-300 transition cursor-pointer"
              title="How Live Connection Radar Works (Guide)"
            >
              <HelpCircle size={12} />
            </button>
          </div>
        </div>

        {/* Counters Grid (4 columns) */}
        <div className="grid grid-cols-4 gap-1.5 text-center pt-2 border-t border-gray-900">
          <div className="p-1.5 rounded bg-gray-900/60 border border-gray-800/80">
            <div className="text-[9px] text-gray-400 uppercase tracking-wider">Sockets</div>
            <div className="text-xs sm:text-sm font-bold font-mono text-emerald-400">
              {radarData?.internetCount || 0}
            </div>
          </div>
          <div className="p-1.5 rounded bg-gray-900/60 border border-gray-800/80">
            <div className="text-[9px] text-gray-400 uppercase tracking-wider">Unique IPs</div>
            <div className="text-xs sm:text-sm font-bold font-mono text-sky-400">
              {radarData?.uniqueIpsCount || 0}
            </div>
          </div>
          <div className="p-1.5 rounded bg-gray-900/60 border border-gray-800/80">
            <div className="text-[9px] text-gray-400 uppercase tracking-wider">Countries</div>
            <div className="text-xs sm:text-sm font-bold font-mono text-indigo-400">
              {Object.keys(radarData?.countryCounts || {}).length}
            </div>
          </div>
          <div className="p-1.5 rounded bg-gray-900/60 border border-gray-800/80">
            <div className="text-[9px] text-gray-400 uppercase tracking-wider">Encrypted</div>
            <div className="text-xs sm:text-sm font-bold font-mono text-emerald-300">
              {connections.length > 0 ? `${Math.round((stats.encrypted / connections.length) * 100)}%` : '0%'}
            </div>
          </div>
        </div>

        {/* Controls Bar: Hide VNI + View Mode Toggle (Flat vs Grouped) */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-900 text-[11px] gap-2">
          <div className="flex items-center gap-1.5 text-gray-400 truncate">
            <ShieldCheck size={12} className={hideSelfConnections ? 'text-emerald-400 shrink-0' : 'text-gray-500 shrink-0'} />
            <span className="truncate">Hide VNI traffic</span>
            {radarData?.hiddenSelfCount > 0 && hideSelfConnections && (
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 shrink-0">
                {radarData.hiddenSelfCount}
              </span>
            )}
            <button
              type="button"
              onClick={onToggleHideSelf}
              className={`px-1.5 py-0.2 rounded-full border text-[9px] font-mono transition cursor-pointer ${
                hideSelfConnections
                  ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-300 font-semibold'
                  : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-gray-200'
              }`}
            >
              {hideSelfConnections ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center bg-gray-900 p-0.5 rounded-lg border border-gray-800 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-2 py-0.5 rounded-md text-[10px] font-medium flex items-center gap-1 transition cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              title="Flat Connection List"
            >
              <List size={10} />
              <span>List</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grouped')}
              className={`px-2 py-0.5 rounded-md text-[10px] font-medium flex items-center gap-1 transition cursor-pointer ${
                viewMode === 'grouped'
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              title="Group Connections by Application"
            >
              <Layers size={10} />
              <span>By App</span>
            </button>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col gap-1.5 mb-2.5">
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search domain, process, IP, country, service..."
            className="w-full bg-gray-950 border border-gray-800 rounded-lg pl-8 pr-7 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-emerald-500 font-mono transition"
          />
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 cursor-pointer"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Security & Protocol Quick Filters */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar text-[10px] font-mono">
          {[
            { id: 'ALL', label: `All (${connections.length})` },
            { id: 'ENCRYPTED', label: `🔒 Encrypted (${stats.encrypted})` },
            { id: 'TELEMETRY', label: `👁 Telemetry (${stats.telemetry})` },
            { id: 'UDP', label: `⚡ UDP/QUIC (${stats.udpCount})` },
            { id: 'NEW', label: `✨ New (${stats.newCount})` }
          ].map(pill => (
            <button
              key={pill.id}
              type="button"
              onClick={() => setSecurityFilter(securityFilter === pill.id ? 'ALL' : pill.id)}
              className={`px-2 py-0.5 rounded-full shrink-0 border transition cursor-pointer ${
                securityFilter === pill.id
                  ? 'bg-emerald-950 border-emerald-500/60 text-emerald-300 font-semibold'
                  : 'bg-gray-900/90 border-gray-800 text-gray-400 hover:text-gray-200'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {/* Process Filter Pills */}
        {topProcesses.length > 0 && (
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar text-[10px] font-mono">
            <button
              type="button"
              onClick={() => setActiveProcess('ALL')}
              className={`px-2 py-0.5 rounded-full shrink-0 border transition cursor-pointer ${
                activeProcess === 'ALL'
                  ? 'bg-sky-950 border-sky-500/50 text-sky-300 font-semibold'
                  : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:text-gray-200'
              }`}
            >
              All Apps
            </button>
            {topProcesses.map(([procName, count]) => (
              <button
                key={procName}
                type="button"
                onClick={() => setActiveProcess(procName === activeProcess ? 'ALL' : procName)}
                className={`px-2 py-0.5 rounded-full shrink-0 border transition cursor-pointer truncate max-w-[130px] ${
                  activeProcess === procName
                    ? 'bg-sky-950 border-sky-500/50 text-sky-300 font-semibold'
                    : 'bg-gray-900/60 border-gray-800 text-gray-400 hover:text-gray-200'
                }`}
                title={`${procName} (${count} connections)`}
              >
                {procName.replace(/\.exe$/i, '')} ({count})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Connections Content: Flat List vs Grouped by Application */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-2 custom-scrollbar">
        {filteredConnections.length > 0 ? (
          viewMode === 'grouped' ? (
            groupedByProcess.map(group => {
              const isExpanded = expandedGroups[group.process] !== false; // default expanded
              const procClass = getProcessColor(group.process);
              return (
                <div
                  key={group.process}
                  className="rounded-xl border border-gray-800/90 bg-gray-950/60 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.process)}
                    className="w-full p-2.5 bg-gray-900/70 hover:bg-gray-900 flex items-center justify-between gap-2 text-left transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2 truncate">
                      {isExpanded ? (
                        <ChevronDown size={13} className="text-gray-400 shrink-0" />
                      ) : (
                        <ChevronRight size={13} className="text-gray-400 shrink-0" />
                      )}
                      <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border truncate ${procClass}`}>
                        {group.process}
                      </span>
                      <span className="text-[10px] text-gray-400 truncate hidden sm:inline">
                        {group.appCategory}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 font-mono text-[10px]">
                      {group.telemetryCount > 0 && (
                        <span className="px-1.5 py-0.2 rounded bg-amber-950/80 border border-amber-500/40 text-amber-300" title="Telemetry endpoints">
                          👁 {group.telemetryCount}
                        </span>
                      )}
                      <span className="px-1.5 py-0.2 rounded bg-gray-950 border border-gray-800 text-gray-300">
                        {group.countries.size} {group.countries.size === 1 ? 'country' : 'countries'}
                      </span>
                      <span className="px-1.5 py-0.2 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-bold">
                        {group.connections.length}
                      </span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="p-2 space-y-2 border-t border-gray-800/60">
                      {group.connections.map((conn, idx) => renderConnectionCard(conn, idx))}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            filteredConnections.map((conn, idx) => renderConnectionCard(conn, idx))
          )
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center p-4 bg-gray-950/60 rounded-xl border border-gray-800">
            <Radio size={24} className="text-gray-600 mb-2 animate-pulse" />
            <h4 className="text-xs font-semibold text-gray-300 mb-1">
              {search || activeProcess !== 'ALL' || securityFilter !== 'ALL'
                ? 'No matching connections'
                : 'No active connections right now'}
            </h4>
            <p className="text-[11px] text-gray-500 max-w-xs font-sans">
              {search || securityFilter !== 'ALL'
                ? 'Try clearing your active search or filter pills.'
                : 'Open a browser or application to see its real-time network traffic here.'}
            </p>
          </div>
        )}
      </div>

      {showGuideModal && <RadarGuideModal onClose={() => setShowGuideModal(false)} />}
    </div>
  );
}
