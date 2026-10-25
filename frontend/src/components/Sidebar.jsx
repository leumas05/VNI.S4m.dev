import React, { useState, useEffect } from 'react';
import { Activity, Download, Play, History as HistoryIcon, ArrowRightLeft, X, MapPin, Globe, Hash, Map, Building, Mail, AlignJustify, Briefcase, Radio, Network, Clock, Trash2, Copy, Check } from 'lucide-react';
import HopCard from './HopCard';
import LiveRadarPanel from './LiveRadarPanel';
import LanScannerPanel from './LanScannerPanel';

function formatDurationRange(startMs, endMs) {
  if (!startMs) return '';
  const diffSec = Math.max(1, Math.floor(((endMs || Date.now()) - startMs) / 1000));
  if (diffSec < 60) return `${diffSec}s`;
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m ${diffSec % 60}s`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m`;
  const days = Math.floor(hrs / 24);
  return `${days}d ${hrs % 24}h`;
}

export default function Sidebar({
  startTrace,
  tracing,
  hops,
  selectedHop,
  setSelectedHop,
  setHoveredHop,
  history,
  loadHistoryTrace,
  compareMode,
  compareHops,
  myLocation,
  ipHistory = [],
  onClearIpHistory,
  openPrivacy,
  onPing,
  onDig,
  onSslCheck,
  activeMode = 'traceroute',
  setActiveMode,
  radarData,
  radarLoading,
  onRefreshRadar,
  radarAutoRefresh,
  setRadarAutoRefresh,
  selectedRadarConn,
  setSelectedRadarConn,
  hideSelfConnections,
  onToggleHideSelf,
  lanData,
  lanLoading,
  lanSweepLoading,
  onRefreshLan,
  onDeepSweepLan,
  lanAutoRefresh,
  setLanAutoRefresh,
  selectedLanDevice,
  setSelectedLanDevice,
  apiBase
}) {
  const [input, setInput] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showMyInfo, setShowMyInfo] = useState(false);
  const [copiedIpId, setCopiedIpId] = useState(null);

  const onSubmit = (e) => {
    e.preventDefault();
    if (input.trim() && !tracing) {
      startTrace(input.trim());
      setShowHistory(false);
    }
  };

  const totalHops = hops.length;
  const droppedHops = hops.filter(h => h.dropped).length;
  const packetLoss = totalHops > 0 ? Math.round((droppedHops / totalHops) * 100) : 0;

  const getHopLatency = (hop) => {
      if (!hop || hop.dropped || !hop.rtt || hop.rtt.length === 0) return null;
      const valid = hop.rtt.filter(v => v !== '*');
      if (valid.length === 0) return null;
      return Math.round(valid.reduce((sum, val) => sum + Number(val), 0) / valid.length);
  };

  const getDestinationLatency = () => {
      if (hops.length === 0) return 0;
      for (let i = hops.length - 1; i >= 0; i--) {
          const lat = getHopLatency(hops[i]);
          if (lat !== null) return lat;
      }
      return 0;
  };

  const targetLatency = getDestinationLatency();

  const exportData = () => {
     const blob = new Blob([JSON.stringify(hops, null, 2)], {type: 'application/json'});
     const url = URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     a.download = `trace-report-${new Date().getTime()}.json`;
     a.click();
     URL.revokeObjectURL(url);
  };

  const renderPrivacyText = (text) => {
      if (!text) return 'Loading...';
      const parts = text.split(/(Google Ads Settings|home@s4m\.dev)/g);
      return parts.map((part, index) => {
          if (part === 'Google Ads Settings') {
              return <a key={index} href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">Google Ads Settings</a>;
          }
          if (part === 'home@s4m.dev') {
              return <a key={index} href="mailto:home@s4m.dev" className="text-emerald-400 hover:underline">home@s4m.dev</a>;
          }
          return <span key={index}>{part}</span>;
      });
  };

  return (
    <div className="h-full flex flex-col p-4 lg:p-6 overflow-y-auto lg:overflow-hidden relative custom-scrollbar">
      <div className="flex justify-between items-center mb-6">
        <a href="https://vni.s4m.dev/" className="text-2xl font-bold text-emerald-400 tracking-wider flex items-center gap-2 hover:text-emerald-300 transition-colors">
          <Activity className="text-emerald-500" /> VNI.S4m.dev
        </a>
        <div className="flex gap-2">
            {myLocation && (
                <button
                   onClick={() => setShowMyInfo(!showMyInfo)}
                   className="text-gray-400 text-xs flex items-center gap-1.5 bg-gray-800 px-3 py-1.5 hover:text-emerald-400 hover:border-emerald-500 rounded border border-gray-700 font-mono transition-colors cursor-pointer"
                   title="View my IP details & IP History"
                >
                   <span>IP: {myLocation.query}</span>
                   {ipHistory.length > 1 && (
                     <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-emerald-950 border border-emerald-500/40 text-emerald-300 font-bold" title={`${ipHistory.length} recorded public IPs in history`}>
                       {ipHistory.length}
                     </span>
                   )}
                </button>
            )}
            <button
               onClick={() => setShowHistory(!showHistory)}
               className="text-gray-400 hover:text-white transition flex items-center gap-1 text-sm bg-gray-800 px-3 py-1.5 rounded border border-gray-700"
            >
               <HistoryIcon size={16} /> {showHistory ? 'Hide History' : 'History'}
            </button>
        </div>
      </div>

      {showMyInfo && myLocation && (
          <div className="mb-4 animate-in slide-in-from-top-2 relative max-h-[55vh] overflow-y-auto pr-1 custom-scrollbar">
             <div className="flex justify-between items-center mb-2 px-1">
                 <h3 className="text-gray-500 uppercase text-[10px] font-bold tracking-wider">Your Connection</h3>
                 <button onClick={() => setShowMyInfo(false)} className="text-gray-500 hover:text-gray-300 transition cursor-pointer">
                    <X size={14} />
                 </button>
             </div>
             <HopCard
                hop={{
                   hop: 'Me',
                   ip: myLocation.query,
                   hostname: myLocation.isp,
                   rtt: ['0 ms'],
                   isPrivate: false,
                   geo: {
                      country: myLocation.country,
                      countryCode: myLocation.countryCode,
                      region: myLocation.regionName,
                      city: myLocation.city,
                      zip: myLocation.zip,
                      isp: myLocation.isp,
                      asn: myLocation.as,
                      lat: myLocation.lat,
                      lon: myLocation.lon,
                      ...(myLocation.consensus || {})
                   }
                }}
                isSelected={true}
                onClick={() => {}}
                onMouseEnter={() => {}}
                onMouseLeave={() => {}}
                onPing={onPing}
                onDig={onDig}
             />

             {/* User Public IP Address History Log (localStorage) */}
             {ipHistory && ipHistory.length > 0 && (
               <div className="mt-2.5 p-3 bg-gray-950/90 border border-gray-800 rounded-xl text-xs font-mono">
                 <div className="flex items-center justify-between mb-2">
                   <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-[11px] uppercase tracking-wider">
                     <Clock size={12} />
                     <span>Your Public IP History ({ipHistory.length})</span>
                   </div>
                   {ipHistory.length > 1 && onClearIpHistory && (
                     <button
                       type="button"
                       onClick={onClearIpHistory}
                       className="text-[10px] text-gray-500 hover:text-red-400 flex items-center gap-1 transition cursor-pointer"
                       title="Clear past IP history"
                     >
                       <Trash2 size={11} />
                       <span>Clear Past</span>
                     </button>
                   )}
                 </div>

                 <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1 custom-scrollbar">
                   {ipHistory.map((item, idx) => {
                     const isCurrent = idx === 0 && !item.endedAt;
                     const startStr = item.firstSeen ? new Date(item.firstSeen).toLocaleString() : 'Unknown';
                     const endStr = item.endedAt
                       ? new Date(item.endedAt).toLocaleString()
                       : 'Active Now';
                     const durationStr = formatDurationRange(item.firstSeen, item.endedAt || Date.now());

                     return (
                       <div
                         key={item.id || `${item.ip}-${idx}`}
                         className={`p-2 rounded-lg border flex flex-col gap-1 transition ${
                           isCurrent
                             ? 'bg-emerald-950/25 border-emerald-500/40'
                             : 'bg-gray-900/60 border-gray-800/80'
                         }`}
                       >
                         <div className="flex items-center justify-between gap-2">
                           <div className="flex items-center gap-1.5 truncate">
                             <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isCurrent ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`}></span>
                             <span className="font-bold text-white text-xs">{item.ip}</span>
                             {isCurrent && (
                               <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-950 border border-emerald-500/40 text-emerald-300 uppercase">
                                 Current
                               </span>
                             )}
                           </div>

                           <div className="flex items-center gap-1.5 shrink-0">
                             {durationStr && (
                               <span className="text-[10px] px-1.5 py-0.2 rounded bg-gray-900 border border-gray-800 text-sky-300" title="Duration this IP was held">
                                 ⏱ {durationStr}
                               </span>
                             )}
                             <button
                               type="button"
                               onClick={() => {
                                 navigator.clipboard.writeText(item.ip);
                                 setCopiedIpId(item.id || idx);
                                 setTimeout(() => setCopiedIpId(null), 1500);
                               }}
                               className="p-1 rounded bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-400 hover:text-white transition cursor-pointer"
                               title={`Copy ${item.ip}`}
                             >
                               {copiedIpId === (item.id || idx) ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                             </button>
                           </div>
                         </div>

                         <div className="flex items-center justify-between text-[10px] text-gray-400 gap-2">
                           <span className="truncate">
                             {item.city ? `${item.city}, ` : ''}{item.countryCode || item.country || ''}
                             {item.isp ? ` • ${item.isp}` : ''}
                           </span>
                         </div>

                         <div className="text-[10px] text-gray-500 flex items-center justify-between border-t border-gray-800/60 pt-1 mt-0.5">
                           <span>From: <span className="text-gray-300">{startStr}</span></span>
                           <span>To: <span className={isCurrent ? 'text-emerald-400 font-semibold' : 'text-gray-300'}>{endStr}</span></span>
                         </div>
                       </div>
                     );
                   })}
                 </div>
               </div>
             )}
          </div>
      )}

      {/* Mode Switcher: Traceroute vs Live Radar vs LAN Scanner */}
      <div className="grid grid-cols-3 bg-gray-950 p-1 rounded-xl border border-gray-800 mb-4 text-xs font-semibold shrink-0 gap-1">
        <button
          type="button"
          onClick={() => setActiveMode && setActiveMode('traceroute')}
          className={`py-1.5 px-1 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
            activeMode === 'traceroute'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950 font-bold'
              : 'text-gray-400 hover:text-gray-200'
          }`}
          title="Internet Traceroute Analysis"
        >
          <Activity size={13} />
          <span className="truncate">Traceroute</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveMode && setActiveMode('radar')}
          className={`py-1.5 px-1 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer relative ${
            activeMode === 'radar'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950 font-bold'
              : 'text-gray-400 hover:text-emerald-400'
          }`}
          title="Real-Time Network Connections"
        >
          <Radio size={13} className={activeMode === 'radar' ? 'animate-pulse text-emerald-300' : ''} />
          <span className="truncate">Radar</span>
          {radarData?.internetCount > 0 && (
            <span className="px-1 py-0.2 rounded-full text-[9px] font-mono bg-emerald-950 border border-emerald-500/40 text-emerald-300 hidden sm:inline">
              {radarData.internetCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveMode && setActiveMode('lan')}
          className={`py-1.5 px-1 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer relative ${
            activeMode === 'lan'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950 font-bold'
              : 'text-gray-400 hover:text-emerald-400'
          }`}
          title="Local Area Network Scanner & Topology"
        >
          <Network size={13} className={activeMode === 'lan' ? 'text-emerald-300' : ''} />
          <span className="truncate">LAN</span>
          {lanData?.totalDevices > 0 && (
            <span className="px-1 py-0.2 rounded-full text-[9px] font-mono bg-emerald-950 border border-emerald-500/40 text-emerald-300 hidden sm:inline">
              {lanData.totalDevices}
            </span>
          )}
        </button>
      </div>

      {activeMode === 'lan' ? (
        <LanScannerPanel
          lanData={lanData}
          loading={lanLoading}
          sweepLoading={lanSweepLoading}
          onRefresh={onRefreshLan}
          onDeepSweep={onDeepSweepLan}
          autoRefresh={lanAutoRefresh}
          setAutoRefresh={setLanAutoRefresh}
          selectedDevice={selectedLanDevice}
          onSelectDevice={setSelectedLanDevice}
          onPing={onPing}
          onDig={onDig}
          onSslCheck={onSslCheck}
          apiBase={apiBase}
        />
      ) : activeMode === 'radar' ? (
        <LiveRadarPanel
          radarData={radarData}
          loading={radarLoading}
          onRefresh={onRefreshRadar}
          autoRefresh={radarAutoRefresh}
          setAutoRefresh={setRadarAutoRefresh}
          selectedConn={selectedRadarConn}
          onSelectConn={setSelectedRadarConn}
          onPing={onPing}
          onDig={onDig}
          onTrace={(targetHost) => {
            if (!targetHost) return;
            setInput(targetHost);
            if (setActiveMode) setActiveMode('traceroute');
            startTrace(targetHost);
          }}
          hideSelfConnections={hideSelfConnections}
          onToggleHideSelf={onToggleHideSelf}
        />
      ) : (
        <>
          <form onSubmit={onSubmit} className="flex gap-2 mb-4">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Domain or IP (e.g. s4m.dev)"
              className="flex-1 bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
              disabled={tracing}
            />
            <button
              type="submit"
              disabled={tracing || !input}
              className={`px-4 py-2 rounded font-semibold flex items-center gap-2 transition-all ${tracing ? 'bg-gray-700 text-gray-500' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.5)]'}`}
            >
              {tracing ? 'Tracing...' : <><Play size={16}/> Analyze</>}
            </button>
          </form>

          {showHistory && history.length > 0 && (
              <div className="mb-4 bg-gray-950 border border-gray-800 rounded p-3 text-sm max-h-40 overflow-y-auto custom-scrollbar">
                 <h3 className="text-gray-500 uppercase text-xs mb-2 font-semibold">Saved Traces</h3>
                 {history.map(h => (
                     <div key={h.id} className="flex justify-between items-center py-2 border-b border-gray-800 last:border-0 hover:bg-gray-900 px-2 rounded cursor-pointer transition" onClick={() => loadHistoryTrace(h)}>
                         <span className="font-mono text-emerald-400">{h.target}</span>
                         <span className="text-gray-500 text-xs">{h.date} - {h.hops.length} hops</span>
                     </div>
                 ))}
              </div>
          )}

          {compareMode && (
             <div className="mb-4 bg-indigo-950/30 border border-indigo-900 text-indigo-300 px-3 py-2 rounded flex items-center gap-2 text-sm">
                <ArrowRightLeft size={16} className="text-indigo-400" />
                Comparing against previous trace of same target
             </div>
          )}

          <div className="grid grid-cols-2 gap-3 mb-4">
             <div className="bg-gray-800 p-2.5 rounded border border-gray-700">
                <p className="text-[10px] text-gray-400 uppercase">Total Hops</p>
                <p className="text-lg font-mono leading-none mt-1">{totalHops}</p>
             </div>
             <div className="bg-gray-800 p-2.5 rounded border border-gray-700">
                <p className="text-[10px] text-gray-400 uppercase">Target Ping</p>
                <p className="text-lg font-mono leading-none mt-1">{targetLatency} ms</p>
             </div>
             <div className="bg-gray-800 p-2.5 rounded border border-gray-700">
                <p className="text-[10px] text-gray-400 uppercase">Packet Loss</p>
                <p className={`text-lg font-mono leading-none mt-1 ${packetLoss > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{packetLoss}%</p>
             </div>
             <button
                 className={`w-full bg-gray-800 p-2.5 rounded border border-gray-700 flex items-center justify-center transition ${tracing || hops.length === 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-700'}`}
                 onClick={tracing || hops.length === 0 ? undefined : exportData}
                 disabled={tracing || hops.length === 0}
             >
                <Download size={16} className={tracing || hops.length === 0 ? 'text-gray-500' : 'text-emerald-400'} />
                <span className="ml-1.5 text-xs font-semibold text-gray-300">Export JSON</span>
             </button>
          </div>

          <div className="flex-none lg:flex-1 lg:overflow-y-auto pr-2 space-y-1.5 lg:custom-scrollbar">
             {hops.map((hop, idx) => {
                 const pastHop = compareHops.find(h => h.hop === hop.hop);
                 return (
                     <HopCard
                       key={idx}
                       hop={hop}
                       pastHop={pastHop}
                       compareMode={compareMode}
                       isSelected={selectedHop && selectedHop.hop === hop.hop}
                       onClick={() => setSelectedHop(hop.hop === selectedHop?.hop ? null : hop)}
                       onMouseEnter={() => setHoveredHop(hop)}
                       onMouseLeave={() => setHoveredHop(null)}
                       onPing={onPing}
                       onDig={onDig}
                     />
                 )
             })}
          </div>
        </>
      )}

      <div className="text-center text-[10px] text-gray-500 font-mono border-t border-gray-800 mt-3 pt-3 flex flex-col items-center gap-1 shrink-0">
         <span>
             &copy; {new Date().getFullYear() === 2026 ? '2026' : `2026 - ${new Date().getFullYear()}`}{' '}
             <a href="https://vni.s4m.dev/" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition-colors">VNI.S4m.dev</a> &amp;{' '}
             <a href="https://www.s4m.dev/" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition-colors">S4m.dev</a>
         </span>
          <div className="flex items-center gap-2">
              <a href="https://github.com/leumas05/VNI.S4m.dev" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 text-gray-400 transition-colors inline-flex items-center gap-1">
                  GitHub
              </a>
              <span>•</span>
              <button onClick={openPrivacy} className="hover:text-gray-300 underline transition-colors cursor-pointer">
                  Privacy Policy
              </button>
          </div>
      </div>
    </div>
  );
}

