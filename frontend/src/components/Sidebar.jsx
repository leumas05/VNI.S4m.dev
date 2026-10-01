import React, { useState, useEffect } from 'react';
import { Activity, Download, Play, History as HistoryIcon, ArrowRightLeft, X, MapPin, Globe, Hash, Map, Building, Mail, AlignJustify, Briefcase, Radio } from 'lucide-react';
import HopCard from './HopCard';

export default function Sidebar({ startTrace, tracing, hops, selectedHop, setSelectedHop, setHoveredHop, history, loadHistoryTrace, compareMode, compareHops, myLocation, openPrivacy }) {
  const [input, setInput] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showMyInfo, setShowMyInfo] = useState(false);

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
    <div className="h-full flex flex-col p-6 overflow-hidden relative">
      <div className="flex justify-between items-center mb-6">
        <a href="https://vni.s4m.dev/" className="text-2xl font-bold text-emerald-400 tracking-wider flex items-center gap-2 hover:text-emerald-300 transition-colors">
          <Activity className="text-emerald-500" /> VNI.S4m.dev
        </a>
        <div className="flex gap-2">
            {myLocation && (
                <button 
                   onClick={() => setShowMyInfo(!showMyInfo)}
                   className="text-gray-400 text-xs flex items-center bg-gray-800 px-3 py-1.5 hover:text-emerald-400 hover:border-emerald-500 rounded border border-gray-700 font-mono transition-colors"
                   title="View my IP details"
                >
                   IP: {myLocation.query}
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
          <div className="mb-4 animate-in slide-in-from-top-2 relative">
             <div className="flex justify-between items-center mb-2 px-1">
                 <h3 className="text-gray-500 uppercase text-[10px] font-bold tracking-wider">Your Connection</h3>
                 <button onClick={() => setShowMyInfo(false)} className="text-gray-500 hover:text-gray-300 transition">
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
                      lon: myLocation.lon
                   }
                }}
                isSelected={true}
                onClick={() => {}}
                onMouseEnter={() => {}}
                onMouseLeave={() => {}}
             />
          </div>
      )}

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

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-1.5">
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
                 />
             )
         })}
      </div>

      <div className="text-center text-[10px] text-gray-500 font-mono border-t border-gray-800 mt-3 pt-3 flex flex-col items-center gap-1 shrink-0">
         <span>
             &copy; {new Date().getFullYear() === 2026 ? '2026' : `2026 - ${new Date().getFullYear()}`}{' '}
             <a href="https://vni.s4m.dev/" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition-colors">VNI.S4m.dev</a> &amp;{' '}
             <a href="https://www.s4m.dev/" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition-colors">S4M.dev</a>
         </span>
         <button onClick={openPrivacy} className="hover:text-gray-300 underline transition-colors cursor-pointer">
             Privacy Policy
         </button>
      </div>
    </div>
  );
}
