import React, { useState } from 'react';
import { Network, Server, Globe2, AlertCircle, ArrowRight, Copy, Check } from 'lucide-react';

const CopyableRow = ({ label, value, copyText, mono = false, className = '', title = "Click to copy" }) => {
    const [copied, setCopied] = useState(false);
    const displayValue = value || 'N/A';
    const textToCopy = copyText !== undefined ? copyText : displayValue;
    
    if (!textToCopy || textToCopy === 'N/A') {
        return <div className={`py-0.5 px-2 -mx-2 ${className}`}><span className="text-gray-500">{label}:</span> N/A</div>;
    }
    
    const handleCopy = (e) => {
        e.preventDefault();
        e.stopPropagation();
        navigator.clipboard.writeText(textToCopy.toString());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className={`group flex justify-between items-start hover:bg-gray-800/80 -mx-2 px-2 py-0.5 rounded transition-colors cursor-pointer ${className}`} onClick={handleCopy} title={title}>
            <div className="flex-1">
                <span className="text-gray-500">{label}:</span>{' '}
                <span className={mono ? "font-mono text-gray-300" : "text-gray-300"}>{displayValue}</span>
            </div>
            <div className="text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2 mt-0.5">
                {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} className="hover:text-emerald-400" />}
            </div>
        </div>
    );
};

export default function HopCard({ hop, isSelected, onClick, pastHop, compareMode, onMouseEnter, onMouseLeave }) {
  const isPrivate = hop.isPrivate;
  const isDropped = hop.dropped;
  
  let statusColor = "text-emerald-500";
  let borderColor = "border-gray-800";
  let bgColor = "bg-gray-800";
  
  if (isDropped) {
      statusColor = "text-red-500";
      borderColor = "border-red-900";
      bgColor = "bg-red-950/40";
  } else if (isPrivate) {
      statusColor = "text-yellow-500";
      borderColor = "border-yellow-900";
      bgColor = "bg-yellow-950/20";
  }

  if (isSelected) {
      borderColor = "border-emerald-500";
      bgColor = "bg-gray-800";
  }

  const getAvg = (rtts) => {
      if (!rtts || rtts.length === 0) return 0;
      const valid = rtts.filter(x => x !== '*');
      if (valid.length === 0) return 0;
      return Math.round(valid.reduce((a, b) => a + Number(b), 0) / valid.length);
  }

  const avgLatency = !isDropped ? getAvg(hop.rtt) : 0;
  
  let changedRoute = false;
  let latencyDiff = 0;
  if (compareMode && pastHop && !isDropped && !pastHop.dropped) {
      if (pastHop.ip !== hop.ip) {
          changedRoute = true;
          borderColor = "border-indigo-600 border-dashed";
      }
      latencyDiff = avgLatency - getAvg(pastHop.rtt);
  }

  const getRegistryUrl = (registry, ip) => {
      const r = (registry || '').toLowerCase();
      if (r === 'arin') return `https://search.arin.net/rdap/?query=${ip}`;
      if (r === 'apnic') return `https://wq.apnic.net/apnic-bin/whois.pl?searchtext=${ip}`;
      if (r === 'lacnic') return `https://query.milacnic.lacnic.net/search?id=${ip}`;
      if (r === 'afrinic') return `https://stat.ripe.net/${ip}`;
      return `https://apps.db.ripe.net/db-web-ui/query?bflag=false&dflag=false&rflag=true&searchtext=${ip}&source=RIPE`;
  }

  const getIpCount = (rangeStr) => {
      if (!rangeStr) return null;
      
      if (rangeStr.includes('/')) {
          const parts = rangeStr.split('/');
          if (parts.length === 2) {
              const bits = parseInt(parts[1], 10);
              if (!isNaN(bits) && bits >= 0 && bits <= 32) {
                  return Math.pow(2, 32 - bits).toLocaleString();
              }
          }
      }

      const parts = rangeStr.split(/\s*-\s*/);
      if (parts.length !== 2) return null;
      
      const ipToNum = (ip) => {
          const p = ip.trim().split('.');
          if (p.length !== 4) return NaN;
          return (p[0] * Math.pow(2, 24)) + (p[1] * Math.pow(2, 16)) + (p[2] * Math.pow(2, 8)) + Number(p[3]);
      };
      
      const start = ipToNum(parts[0]);
      const end = ipToNum(parts[1]);
      if (isNaN(start) || isNaN(end) || end < start) return null;
      
      return (end - start + 1).toLocaleString();
  };

  const formatRange = (rangeStr) => {
      if (!rangeStr) return 'N/A';
      const parts = rangeStr.split(/\s*-\s*/);
      if (parts.length === 2) {
          return `${parts[0]} - ${parts[1]}`;
      }
      return rangeStr;
  };

  const formatAsnLink = (asn) => {
      if (!asn) return null;
      const cleanAsn = asn.toString().replace(/\D/g, '');
      if (!cleanAsn) return null;
      return (
         <a 
            href={`https://dnschecker.org/asn-whois-lookup.php?query=${cleanAsn}`}
            target="_blank"
            rel="noreferrer"
            className="text-emerald-400 hover:text-emerald-300 hover:underline transition-colors"
            onClick={(e) => e.stopPropagation()}
            title={`View AS${cleanAsn} routing details on dnschecker.org`}
         >
            AS{cleanAsn}
         </a>
      );
  };

  const formatNetnameLink = (netname) => {
      if (!netname) return null;
      const safeNetname = encodeURIComponent(netname.trim());
      return (
         <a 
            href={`https://networksdb.io/network/${safeNetname}`}
            target="_blank"
            rel="noreferrer"
            className="text-emerald-400 hover:text-emerald-300 hover:underline transition-colors"
            onClick={(e) => e.stopPropagation()}
            title={`View ${netname} on networksdb.io`}
         >
            {netname}
         </a>
      );
  };

  const hasExpandableInfo = !isPrivate || isDropped || (compareMode && pastHop && changedRoute);

  return (
    <div className="flex flex-col mb-1.5 transition-all duration-300" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <div 
         onClick={hasExpandableInfo ? onClick : undefined}
         className={`px-3 py-2 rounded border ${hasExpandableInfo ? 'cursor-pointer hover:border-gray-600' : 'cursor-default'} transition flex items-center justify-between ${borderColor} ${bgColor}`}
      >
         <div className="flex items-center gap-2 overflow-hidden">
            <div className={`min-w-6 h-6 px-1 rounded-full flex items-center justify-center bg-gray-900 font-bold text-[10px] ${statusColor}`}>
               {hop.hop}
            </div>
            <div className="flex flex-col overflow-hidden">
               {isDropped ? (
                  <span className="font-semibold text-sm text-red-400">
                      {hop.errorMsg ? hop.errorMsg : 'Hidden Gateway / Firewall Enforced'}
                  </span>
               ) : (
                  <>
                    <span className="font-semibold text-sm truncate" title={hop.hostname || hop.ip}>
                       {hop.hostname || hop.ip}
                    </span>
                    <span className="text-[11px] text-gray-400 font-mono leading-tight">
                       {hop.ip} {isPrivate && `(${hop.privateType || 'Internal'})`}
                    </span>
                  </>
               )}
            </div>
         </div>
         <div className="flex flex-col items-end gap-0.5">
            {!isDropped && (
                <div className="text-[11px] font-mono bg-gray-900 px-1.5 py-0.5 rounded text-gray-300 flex items-center">
                    {isNaN(avgLatency) ? '-' : avgLatency} ms
                </div>
            )}
            {compareMode && !isDropped && (
                <div className={`text-[9px] font-mono ${changedRoute ? 'text-indigo-400' : (latencyDiff > 10 ? 'text-red-400' : 'text-emerald-400')}`}>
                    {changedRoute ? 'Route Changed' : (latencyDiff > 0 ? `+${latencyDiff}ms` : `${latencyDiff}ms`)}
                </div>
            )}
         </div>
      </div>

      {isSelected && !isDropped && (!isPrivate || (compareMode && pastHop && changedRoute)) && (
          <div className="mt-2 p-4 bg-gray-900 border border-gray-700 rounded shadow-inner text-sm animate-in slide-in-from-top-2">
              {!isPrivate && (
                  <h3 className="font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                      <Network size={16} /> WHOIS & Registry Insights
                  </h3>
              )}
              
              {hop.geo ? (
                 <div className="flex flex-col text-gray-300 text-sm mb-4">
                    <CopyableRow label="IP Address" value={hop.ip} mono />
                    <CopyableRow label="Country" value={hop.geo.country} />
                    {hop.geo.countryCode && <CopyableRow label="Country ISO" value={hop.geo.countryCode} mono />}
                    {hop.geo.region && <CopyableRow label="State/Region" value={hop.geo.region} />}
                    <CopyableRow label="City" value={hop.geo.city} />
                    {hop.geo.zip && <CopyableRow label="Postal Code" value={hop.geo.zip} />}
                    {hop.geo.lat && hop.geo.lon && <CopyableRow label="Coordinates" value={`${hop.geo.lat}, ${hop.geo.lon}`} copyText={`${hop.geo.lat}, ${hop.geo.lon}`} />}
                    <CopyableRow label="ISP" value={hop.geo.isp} className="pt-2 mt-1 border-t border-gray-800/50" />
                    {hop.hop === 'Me' && hop.geo.asn && (
                        <CopyableRow label="ASN" value={formatAsnLink(hop.geo.asn)} copyText={hop.geo.asn} />
                    )}
                 </div>
              ) : null}

              {hop.registry ? (
                 <div className="bg-gray-950 p-3 rounded border border-gray-800 text-gray-300 text-xs font-mono">
                    <div className="flex flex-col mb-3">
                        <CopyableRow label="NetName" value={formatNetnameLink(hop.registry.netname)} copyText={hop.registry.netname} />
                        <CopyableRow label="Descr" value={hop.registry.descr} />
                        <CopyableRow label="ASN" value={formatAsnLink(hop.registry.asn)} copyText={hop.registry.asn} />
                        <CopyableRow 
                            label="Range" 
                            value={formatRange(hop.registry.netblock)} 
                            copyText={formatRange(hop.registry.netblock)} 
                            title={getIpCount(hop.registry.netblock) ? `Total IPs in this block: ${getIpCount(hop.registry.netblock)} (Click to copy)` : 'Click to copy'}
                        />
                        {hop.registry.authoritative && (
                            <CopyableRow label="Registry" value={hop.registry.authoritative} />
                        )}
                    </div>
                    {hop.registry.authoritative && (
                        <a 
                           href={getRegistryUrl(hop.registry.authoritative, hop.ip)} 
                           target="_blank" 
                           rel="noreferrer"
                           className="inline-flex items-center gap-1 bg-gray-800 hover:bg-gray-700 text-emerald-400 border border-gray-700 px-3 py-1.5 rounded transition"
                           onClick={(e) => e.stopPropagation()}
                        >
                           Open in {hop.registry.authoritative.toUpperCase()} <ArrowRight size={12} />
                        </a>
                    )}
                 </div>
              ) : (
                  !isPrivate && hop.hop !== 'Me' && <div className="text-gray-500 italic text-xs">No extended registry data available.</div>
              )}
              
              {compareMode && pastHop && changedRoute && (
                  <div className="mt-3 bg-indigo-950/30 p-2 rounded border border-indigo-900 text-indigo-300 text-xs flex flex-col gap-1">
                      <span className="font-semibold">Previous Route:</span>
                      <span className="font-mono">{pastHop.ip} ({pastHop.hostname || 'Unknown'})</span>
                  </div>
              )}
          </div>
      )}

      {isSelected && isDropped && (
          <div className="mt-2 p-4 bg-gray-900 border border-red-900/30 rounded shadow-inner text-sm animate-in slide-in-from-top-2">
              <h3 className="font-semibold text-red-400 mb-2 flex items-center gap-2">
                  <AlertCircle size={16} /> Why is this hop hidden?
              </h3>
              <p className="text-gray-300 text-xs leading-relaxed mb-2">
                  This router successfully forwarded your data, but was configured not to identify itself. This is completely normal and usually happens because:
              </p>
              <ul className="list-disc list-outside ml-4 text-gray-400 text-xs space-y-1">
                  <li>The network admin configured the router to ignore ICMP tracking for security (Firewall).</li>
                  <li>The router deprioritizes generating "Time Exceeded" messages to save CPU power.</li>
                  <li>An intermediate firewall blocked the returning ICMP response.</li>
              </ul>
              <p className="text-gray-500 text-xs italic mt-3">
                  The trace continues seamlessly because your packets are still being routed towards the destination.
              </p>
          </div>
      )}
    </div>
  );
}
