import React, { useState, useMemo } from 'react';
import { Radio, RefreshCw, Search, ShieldCheck, Terminal, Activity, Globe, Play, Pause, ExternalLink, X, Circle, Square, Download, Trash2, Clock } from 'lucide-react';

function getCountryFlag(countryCode) {
  if (!countryCode || countryCode.length !== 2) return '🌐';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatTimestamp(ts) {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '';
  }
}

function getProcessColor(processName) {
  const p = (processName || '').toLowerCase();
  if (p.includes('chrome') || p.includes('msedge') || p.includes('firefox') || p.includes('brave')) {
    return 'text-emerald-400 border-emerald-500/30 bg-emerald-950/40';
  }
  if (p.includes('discord') || p.includes('spotify') || p.includes('steam')) {
    return 'text-purple-400 border-purple-500/30 bg-purple-950/40';
  }
  if (p.includes('code') || p.includes('node') || p.includes('git') || p.includes('electron')) {
    return 'text-sky-400 border-sky-500/30 bg-sky-950/40';
  }
  if (p.includes('onedrive') || p.includes('dropbox') || p.includes('googledrive')) {
    return 'text-amber-400 border-amber-500/30 bg-amber-950/40';
  }
  return 'text-indigo-400 border-indigo-500/30 bg-indigo-950/40';
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
  hideSelfConnections,
  onToggleHideSelf,
  isRecording = false,
  onStartRecording,
  onStopRecording,
  onClearRecording,
  onExportRecording,
  recordingElapsed = 0,
  radarViewTab = 'live',
  onSetRadarViewTab
}) {
  const [search, setSearch] = useState('');
  const [activeProcess, setActiveProcess] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const connections = useMemo(() => radarData?.connections || [], [radarData]);

  const topProcesses = useMemo(() => {
    if (!radarData?.processCounts) return [];
    return Object.entries(radarData.processCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [radarData]);

  const filteredConnections = useMemo(() => {
    return connections.filter(conn => {
      // Status filter in recorded view
      if (radarViewTab === 'recorded' && statusFilter !== 'ALL') {
        if (statusFilter === 'ACTIVE' && conn.isActive === false) return false;
        if (statusFilter === 'CLOSED' && conn.isActive !== false) return false;
      }
      // Process filter
      if (activeProcess !== 'ALL' && conn.process !== activeProcess) {
        return false;
      }
      // Search filter
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchesProcess = (conn.process || '').toLowerCase().includes(q);
        const matchesIp = (conn.remoteIp || '').toLowerCase().includes(q);
        const matchesPort = String(conn.remotePort || '').includes(q);
        const matchesCountry = (conn.geo?.country || '').toLowerCase().includes(q) || (conn.geo?.countryCode || '').toLowerCase().includes(q);
        const matchesCity = (conn.geo?.city || '').toLowerCase().includes(q);
        const matchesIsp = (conn.geo?.isp || '').toLowerCase().includes(q);
        return matchesProcess || matchesIp || matchesPort || matchesCountry || matchesCity || matchesIsp;
      }
      return true;
    });
  }, [connections, activeProcess, search, radarViewTab, statusFilter]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden font-sans text-xs">
      {/* Radar Stats Hero Card */}
      <div className="bg-gray-950/90 border border-emerald-500/30 rounded-xl p-3.5 mb-3 shadow-lg shadow-black/40">
        <div className="flex items-center justify-between mb-2.5">
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

          <div className="flex items-center gap-1.5">
            {/* Record Session Button */}
            {isRecording ? (
              <button
                type="button"
                onClick={onStopRecording}
                className="px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1.5 border border-red-500/60 bg-red-950/90 text-red-300 shadow-[0_0_10px_rgba(239,68,68,0.35)] transition cursor-pointer hover:bg-red-900"
                title="Stop active connection recording"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                <span className="font-mono">REC {formatTime(recordingElapsed)}</span>
                <Square size={9} className="fill-red-400 text-red-400 ml-0.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onStartRecording}
                className="px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1.5 border border-gray-800 bg-gray-900 hover:border-red-500/50 hover:bg-red-950/40 text-gray-300 hover:text-red-400 transition cursor-pointer"
                title="Start recording connections over time"
              >
                <Circle size={9} className="fill-red-500 text-red-500" />
                <span>Record</span>
              </button>
            )}

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
          </div>
        </div>

        {/* Counters Grid */}
        <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-gray-900">
          <div className="p-1.5 rounded bg-gray-900/60 border border-gray-800/80">
            <div className="text-[10px] text-gray-400 uppercase tracking-wider">
              {radarViewTab === 'recorded' ? 'Total Recorded' : 'Active'}
            </div>
            <div className="text-sm font-bold font-mono text-emerald-400">
              {radarData?.internetCount || 0}
            </div>
          </div>
          <div className="p-1.5 rounded bg-gray-900/60 border border-gray-800/80">
            <div className="text-[10px] text-gray-400 uppercase tracking-wider">Unique IPs</div>
            <div className="text-sm font-bold font-mono text-sky-400">
              {radarData?.uniqueIpsCount || 0}
            </div>
          </div>
          <div className="p-1.5 rounded bg-gray-900/60 border border-gray-800/80">
            <div className="text-[10px] text-gray-400 uppercase tracking-wider">Countries</div>
            <div className="text-sm font-bold font-mono text-indigo-400">
              {Object.keys(radarData?.countryCounts || {}).length}
            </div>
          </div>
        </div>

        {/* View Switcher Pills: Live vs Recorded */}
        {(radarData?.totalRecordedCount > 0 || isRecording) && (
          <div className="grid grid-cols-2 gap-1 p-1 bg-gray-900/90 rounded-lg border border-gray-800 mt-2.5">
            <button
              type="button"
              onClick={() => onSetRadarViewTab && onSetRadarViewTab('live')}
              className={`py-1 rounded text-[11px] font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                radarViewTab === 'live'
                  ? 'bg-emerald-600 text-white shadow-sm font-bold'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Activity size={12} />
              <span>Live</span>
            </button>
            <button
              type="button"
              onClick={() => onSetRadarViewTab && onSetRadarViewTab('recorded')}
              className={`py-1 rounded text-[11px] font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer relative ${
                radarViewTab === 'recorded'
                  ? 'bg-emerald-600 text-white shadow-sm font-bold'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Clock size={12} />
              <span>Recorded</span>
              <span className={`text-[10px] font-mono px-1 rounded ${
                radarViewTab === 'recorded' ? 'bg-emerald-950/90 text-emerald-200' : 'bg-gray-800 text-gray-300'
              }`}>
                {radarData?.totalRecordedCount || 0}
              </span>
              {isRecording && (
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping"></span>
              )}
            </button>
          </div>
        )}

        {/* Toggle Hide Self (VNI / Node / Electron) */}
        <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-gray-900 text-[11px]">
          <div className="flex items-center gap-1.5 text-gray-400">
            <ShieldCheck size={12} className={hideSelfConnections ? 'text-emerald-400' : 'text-gray-500'} />
            <span>Hide app connections (VNI)</span>
            {radarData?.hiddenSelfCount > 0 && hideSelfConnections && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-300">
                {radarData.hiddenSelfCount} hidden
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onToggleHideSelf}
            className={`px-2 py-0.5 rounded-full border text-[10px] font-mono transition cursor-pointer flex items-center gap-1.5 ${
              hideSelfConnections
                ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-300 font-semibold shadow-sm'
                : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-gray-200'
            }`}
            title={hideSelfConnections ? 'Show all connections including VNI internal (Node/Electron)' : 'Hide VNI internal connections'}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${hideSelfConnections ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`}></span>
            <span>{hideSelfConnections ? 'Hidden' : 'Visible'}</span>
          </button>
        </div>
      </div>

      {/* Recorded View Toolbar (Active/Closed filters & JSON Export / Clear) */}
      {radarViewTab === 'recorded' && (
        <div className="flex items-center justify-between gap-1 p-2 rounded-xl bg-gray-950/80 border border-emerald-500/30 mb-3 text-[11px] font-mono">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-2 py-0.5 rounded text-[10px] transition cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-emerald-950 border border-emerald-500/50 text-emerald-300 font-bold'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              All ({connections.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('ACTIVE')}
              className={`px-2 py-0.5 rounded text-[10px] transition cursor-pointer ${
                statusFilter === 'ACTIVE'
                  ? 'bg-emerald-950 border border-emerald-500/50 text-emerald-300 font-bold'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Active ({radarData?.activeCount || 0})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('CLOSED')}
              className={`px-2 py-0.5 rounded text-[10px] transition cursor-pointer ${
                statusFilter === 'CLOSED'
                  ? 'bg-gray-800 border border-gray-700 text-gray-200 font-bold'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Closed ({Math.max(0, (connections.length) - (radarData?.activeCount || 0))})
            </button>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={onExportRecording}
              className="px-2 py-0.5 rounded bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 text-gray-300 hover:text-emerald-400 transition cursor-pointer flex items-center gap-1"
              title="Export recorded session as JSON"
            >
              <Download size={11} className="text-emerald-400" />
              <span>JSON</span>
            </button>
            <button
              type="button"
              onClick={onClearRecording}
              className="p-1 rounded bg-gray-900 hover:bg-red-950/50 border border-gray-800 hover:border-red-500/40 text-gray-400 hover:text-red-400 transition cursor-pointer"
              title="Clear recording"
            >
              <Trash2 size={11} />
            </button>
          </div>
        </div>
      )}

      {/* Search Input & Process Filter Chips */}
      <div className="flex flex-col gap-2 mb-3">
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search process, IP, country, city, port..."
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

        {/* Process Filter Pills */}
        {topProcesses.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-[11px] font-mono">
            <button
              type="button"
              onClick={() => setActiveProcess('ALL')}
              className={`px-2 py-0.5 rounded-full shrink-0 border transition cursor-pointer ${
                activeProcess === 'ALL'
                  ? 'bg-emerald-950 border-emerald-500/50 text-emerald-300 font-semibold'
                  : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-gray-200'
              }`}
            >
              All ({connections.length})
            </button>
            {topProcesses.map(([procName, count]) => (
              <button
                key={procName}
                type="button"
                onClick={() => setActiveProcess(procName === activeProcess ? 'ALL' : procName)}
                className={`px-2 py-0.5 rounded-full shrink-0 border transition cursor-pointer truncate max-w-[140px] ${
                  activeProcess === procName
                    ? 'bg-emerald-950 border-emerald-500/50 text-emerald-300 font-semibold'
                    : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-gray-200'
                }`}
                title={`${procName} (${count} connections)`}
              >
                {procName.replace(/\.exe$/i, '')} ({count})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Connections List */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-2 custom-scrollbar">
        {filteredConnections.length > 0 ? (
          filteredConnections.map((conn, idx) => {
            const isSelected = selectedConn && selectedConn.remoteIp === conn.remoteIp && selectedConn.remotePort === conn.remotePort;
            const procClass = getProcessColor(conn.process);
            const flag = getCountryFlag(conn.geo?.countryCode);

            const isInactive = conn.isActive === false;

            return (
              <div
                key={`${conn.remoteIp}-${conn.remotePort}-${idx}`}
                onClick={() => onSelectConn && onSelectConn(isSelected ? null : conn)}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer group ${
                  isSelected
                    ? 'bg-gray-900/90 border-emerald-500 shadow-md shadow-emerald-950/50 ring-1 ring-emerald-500/40'
                    : isInactive
                      ? 'bg-gray-950/50 border-gray-800/60 opacity-80 hover:opacity-100 hover:border-gray-700 hover:bg-gray-900/40'
                      : 'bg-gray-950/70 border-gray-800/90 hover:border-gray-700 hover:bg-gray-900/50'
                }`}
              >
                {/* Header: Process name + Remote Port */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border truncate ${isInactive ? 'text-gray-400 border-gray-800 bg-gray-900' : procClass}`}>
                      {conn.process}
                    </span>
                    {conn.isSelf && (
                      <span className="px-1 py-0.2 rounded text-[9px] font-mono font-bold border border-amber-500/40 text-amber-300 bg-amber-950/60 uppercase" title="This app (VNI / Engine)">
                        VNI
                      </span>
                    )}
                    {isInactive ? (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold border border-gray-700 text-gray-400 bg-gray-900/90" title="This connection closed during the session">
                        Closed
                      </span>
                    ) : (radarViewTab === 'recorded' || conn.firstSeen) ? (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold border border-emerald-500/40 text-emerald-300 bg-emerald-950/60 flex items-center gap-1" title="Active connection right now">
                        <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse"></span>
                        Active
                      </span>
                    ) : null}
                    {conn.pid && (
                      <span className="text-[10px] text-gray-500 font-mono">
                        PID: {conn.pid}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] font-mono shrink-0">
                    <span className="text-gray-500 text-[10px]">{conn.proto}</span>
                    <span className={isInactive ? 'text-gray-400 font-bold' : 'text-emerald-400 font-bold'}>:{conn.remotePort}</span>
                  </div>
                </div>

                {/* Destination Location & IP */}
                <div className="flex items-start justify-between gap-2 mb-2 font-mono">
                  <div className="truncate">
                    <div className="text-gray-200 font-semibold text-xs flex items-center gap-1.5 truncate">
                      <span>{flag}</span>
                      <span className="truncate">
                        {conn.geo?.city ? `${conn.geo.city}, ` : ''}{conn.geo?.country || 'Unknown Location'}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-400 truncate mt-0.5">
                      {conn.remoteIp} {conn.geo?.isp ? `• ${conn.geo.isp}` : ''}
                    </div>
                  </div>
                </div>

                {/* Recording Session Timestamps */}
                {(conn.firstSeen || conn.lastSeen) && (
                  <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono mb-2 bg-gray-900/50 px-2 py-1 rounded border border-gray-800/80">
                    <span>Seen: {formatTimestamp(conn.firstSeen)}{conn.lastSeen && conn.lastSeen !== conn.firstSeen ? ` ➔ ${formatTimestamp(conn.lastSeen)}` : ''}</span>
                    {conn.seenCount ? <span>{conn.seenCount} {conn.seenCount === 1 ? 'poll' : 'polls'}</span> : null}
                  </div>
                )}

                {/* Quick Action Tools: Ping, DiG, SSL */}
                <div className="flex items-center justify-between pt-1.5 border-t border-gray-900/80 text-[11px]">
                  <span className="text-[10px] text-gray-500 font-mono uppercase">
                    {conn.state}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPing && onPing({ ip: conn.remoteIp, hostname: conn.process, geo: conn.geo });
                      }}
                      className="px-2 py-0.5 rounded bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 text-gray-300 hover:text-emerald-400 transition cursor-pointer flex items-center gap-1"
                      title={`Ping ${conn.remoteIp}`}
                    >
                      <Activity size={10} className="text-emerald-400" />
                      <span>Ping</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDig && onDig({ ip: conn.remoteIp, hostname: conn.process, geo: conn.geo });
                      }}
                      className="px-2 py-0.5 rounded bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 text-gray-300 hover:text-sky-400 transition cursor-pointer flex items-center gap-1"
                      title={`DiG DNS lookup for ${conn.remoteIp}`}
                    >
                      <Terminal size={10} className="text-sky-400" />
                      <span>DiG</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDig && onDig({ ip: conn.remoteIp, hostname: conn.process, geo: conn.geo, initialTab: 'ssl' });
                      }}
                      className="px-2 py-0.5 rounded bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 text-gray-300 hover:text-emerald-400 transition cursor-pointer flex items-center gap-1"
                      title={`SSL certificate check for ${conn.remoteIp}`}
                    >
                      <ShieldCheck size={10} className="text-emerald-400" />
                      <span>SSL</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center p-4 bg-gray-950/60 rounded-xl border border-gray-800">
            <Radio size={24} className="text-gray-600 mb-2 animate-pulse" />
            <h4 className="text-xs font-semibold text-gray-300 mb-1">
              {search || activeProcess !== 'ALL' ? 'No matching connections' : 'No active connections right now'}
            </h4>
            <p className="text-[11px] text-gray-500 max-w-xs font-sans">
              {search
                ? `No connection matched "${search}". Try clearing search.`
                : 'Open a browser or application to see its real-time network traffic here.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
