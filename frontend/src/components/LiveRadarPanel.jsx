import React, { useState, useMemo } from 'react';
import { Radio, RefreshCw, Search, ShieldCheck, Terminal, Activity, Globe, Play, Pause, ExternalLink, X } from 'lucide-react';

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
  onToggleHideSelf
}) {
  const [search, setSearch] = useState('');
  const [activeProcess, setActiveProcess] = useState('ALL');

  const connections = useMemo(() => radarData?.connections || [], [radarData]);

  const topProcesses = useMemo(() => {
    if (!radarData?.processCounts) return [];
    return Object.entries(radarData.processCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [radarData]);

  const filteredConnections = useMemo(() => {
    return connections.filter(conn => {
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
  }, [connections, activeProcess, search]);

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
            <button
              type="button"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 border transition cursor-pointer ${
                autoRefresh
                  ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
                  : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-gray-200'
              }`}
              title={autoRefresh ? 'Pausa automatisk uppdatering' : 'Starta live uppdatering (4s)'}
            >
              {autoRefresh ? <Pause size={10} /> : <Play size={10} />}
              <span>{autoRefresh ? 'Live (4s)' : 'Pausad'}</span>
            </button>

            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="p-1.5 rounded bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-400 hover:text-white transition cursor-pointer disabled:opacity-50"
              title="Uppdatera anslutningar nu"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin text-emerald-400' : ''} />
            </button>
          </div>
        </div>

        {/* Counters Grid */}
        <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-gray-900">
          <div className="p-1.5 rounded bg-gray-900/60 border border-gray-800/80">
            <div className="text-[10px] text-gray-400 uppercase tracking-wider">Aktiva</div>
            <div className="text-sm font-bold font-mono text-emerald-400">
              {radarData?.internetCount || 0}
            </div>
          </div>
          <div className="p-1.5 rounded bg-gray-900/60 border border-gray-800/80">
            <div className="text-[10px] text-gray-400 uppercase tracking-wider">Unika IP</div>
            <div className="text-sm font-bold font-mono text-sky-400">
              {radarData?.uniqueIpsCount || 0}
            </div>
          </div>
          <div className="p-1.5 rounded bg-gray-900/60 border border-gray-800/80">
            <div className="text-[10px] text-gray-400 uppercase tracking-wider">Länder</div>
            <div className="text-sm font-bold font-mono text-indigo-400">
              {Object.keys(radarData?.countryCounts || {}).length}
            </div>
          </div>
        </div>

        {/* Toggle Hide Self (VNI / Node / Electron) */}
        <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-gray-900 text-[11px]">
          <div className="flex items-center gap-1.5 text-gray-400">
            <ShieldCheck size={12} className={hideSelfConnections ? 'text-emerald-400' : 'text-gray-500'} />
            <span>Exkludera detta program (VNI)</span>
            {radarData?.hiddenSelfCount > 0 && hideSelfConnections && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-300">
                {radarData.hiddenSelfCount} dolda
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
            title={hideSelfConnections ? 'Klicka för att visa alla anslutningar inklusive VNIs egna (Node/Electron)' : 'Klicka för att dölja VNIs egna anslutningar'}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${hideSelfConnections ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`}></span>
            <span>{hideSelfConnections ? 'Dolt' : 'Visas'}</span>
          </button>
        </div>
      </div>

      {/* Search Input & Process Filter Chips */}
      <div className="flex flex-col gap-2 mb-3">
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Sök process, IP, land, stad, port..."
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
              Alla ({connections.length})
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
                title={`${procName} (${count} anslutningar)`}
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

            return (
              <div
                key={`${conn.remoteIp}-${conn.remotePort}-${idx}`}
                onClick={() => onSelectConn && onSelectConn(isSelected ? null : conn)}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer group ${
                  isSelected
                    ? 'bg-gray-900/90 border-emerald-500 shadow-md shadow-emerald-950/50 ring-1 ring-emerald-500/40'
                    : 'bg-gray-950/70 border-gray-800/90 hover:border-gray-700 hover:bg-gray-900/50'
                }`}
              >
                {/* Header: Process name + Remote Port */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border truncate ${procClass}`}>
                      {conn.process}
                    </span>
                    {conn.isSelf && (
                      <span className="px-1 py-0.2 rounded text-[9px] font-mono font-bold border border-amber-500/40 text-amber-300 bg-amber-950/60 uppercase" title="Detta program (VNI / Engine)">
                        VNI
                      </span>
                    )}
                    {conn.pid && (
                      <span className="text-[10px] text-gray-500 font-mono">
                        PID: {conn.pid}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] font-mono shrink-0">
                    <span className="text-gray-500 text-[10px]">{conn.proto}</span>
                    <span className="text-emerald-400 font-bold">:{conn.remotePort}</span>
                  </div>
                </div>

                {/* Destination Location & IP */}
                <div className="flex items-start justify-between gap-2 mb-2 font-mono">
                  <div className="truncate">
                    <div className="text-gray-200 font-semibold text-xs flex items-center gap-1.5 truncate">
                      <span>{flag}</span>
                      <span className="truncate">
                        {conn.geo?.city ? `${conn.geo.city}, ` : ''}{conn.geo?.country || 'Okänd plats'}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-400 truncate mt-0.5">
                      {conn.remoteIp} {conn.geo?.isp ? `• ${conn.geo.isp}` : ''}
                    </div>
                  </div>
                </div>

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
                      title={`DiG DNS-kontroll för ${conn.remoteIp}`}
                    >
                      <Terminal size={10} className="text-sky-400" />
                      <span>DiG</span>
                    </button>

                    {conn.remotePort === 443 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDig && onDig({ ip: conn.remoteIp, hostname: conn.process, geo: conn.geo, initialTab: 'ssl' });
                        }}
                        className="px-2 py-0.5 rounded bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 text-gray-300 hover:text-emerald-400 transition cursor-pointer flex items-center gap-1"
                        title={`SSL-kontroll för ${conn.remoteIp}`}
                      >
                        <ShieldCheck size={10} className="text-emerald-400" />
                        <span>SSL</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center p-4 bg-gray-950/60 rounded-xl border border-gray-800">
            <Radio size={24} className="text-gray-600 mb-2 animate-pulse" />
            <h4 className="text-xs font-semibold text-gray-300 mb-1">
              {search || activeProcess !== 'ALL' ? 'Inga matchande anslutningar' : 'Inga aktiva anslutningar just nu'}
            </h4>
            <p className="text-[11px] text-gray-500 max-w-xs font-sans">
              {search
                ? `Ingen anslutning matchade "${search}". Prova att rensa sökningen.`
                : 'Öppna en webbsida eller ett program för att se dess anslutningar här i realtid.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
