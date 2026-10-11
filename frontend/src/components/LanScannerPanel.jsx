import React, { useState, useMemo } from 'react';
import {
  Network,
  RefreshCw,
  Search,
  Zap,
  Activity,
  ShieldCheck,
  Globe,
  Copy,
  Check,
  Router,
  Laptop,
  Smartphone,
  Cpu,
  Tv,
  Server,
  Wifi,
  Radio
} from 'lucide-react';

function getDeviceIcon(type) {
  switch (type) {
    case 'router':
      return Router;
    case 'desktop':
    case 'computer':
      return Laptop;
    case 'mobile':
      return Smartphone;
    case 'iot':
      return Cpu;
    case 'console':
      return Tv;
    case 'server':
      return Server;
    default:
      return Wifi;
  }
}

function getDeviceColor(type, isThisDevice, isGateway) {
  if (isGateway) return '#10b981'; // Emerald
  if (isThisDevice) return '#38bdf8'; // Sky blue
  switch (type) {
    case 'mobile':
      return '#ec4899'; // Pink / Apple / Mobile
    case 'iot':
      return '#f59e0b'; // Amber / Smart Home
    case 'console':
      return '#a855f7'; // Purple / Console
    case 'server':
      return '#6366f1'; // Indigo
    case 'computer':
      return '#06b6d4'; // Cyan
    default:
      return '#94a3b8'; // Slate
  }
}

export default function LanScannerPanel({
  lanData,
  loading = false,
  sweepLoading = false,
  onRefresh,
  onDeepSweep,
  autoRefresh = false,
  setAutoRefresh,
  selectedDevice,
  onSelectDevice,
  onPing,
  onDig,
  onSslCheck
}) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [copiedId, setCopiedId] = useState(null);

  const copyToClipboard = (text, id) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const devices = useMemo(() => lanData?.devices || [], [lanData]);
  const gateway = lanData?.gateway;
  const thisDevice = lanData?.thisDevice;

  // Filter client devices
  const filteredDevices = useMemo(() => {
    return devices.filter(dev => {
      if (filterType !== 'all' && dev.deviceType !== filterType) {
        return false;
      }
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      return (
        (dev.ip || '').toLowerCase().includes(s) ||
        (dev.mac || '').toLowerCase().includes(s) ||
        (dev.vendor || '').toLowerCase().includes(s) ||
        (dev.hostname || '').toLowerCase().includes(s) ||
        (dev.deviceType || '').toLowerCase().includes(s)
      );
    });
  }, [devices, filterType, search]);

  const activeCount = useMemo(() => {
    let count = 0;
    if (gateway?.isAlive) count++;
    if (thisDevice) count++;
    devices.forEach(d => {
      if (d.isAlive) count++;
    });
    return count;
  }, [gateway, thisDevice, devices]);

  return (
    <div className="flex flex-col h-full overflow-hidden text-gray-200">
      {/* Top Controls & Metrics */}
      <div className="bg-gray-900/95 border border-gray-800 rounded-xl p-3 mb-3 shadow-lg shrink-0">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
              <Network size={18} />
            </div>
            <div>
              <div className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
                <span>LAN Scanner (ARP)</span>
                {autoRefresh && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" title="Auto-scan active"></span>
                )}
              </div>
              <div className="text-[10px] text-gray-400 font-mono">
                {lanData?.network?.subnetPrefix || 'Local Subnet'} • {lanData?.network?.interface || 'Ethernet'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onRefresh && onRefresh(false)}
              disabled={loading || sweepLoading}
              className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition cursor-pointer ${
                loading
                  ? 'bg-gray-800 border-gray-700 text-gray-500'
                  : 'bg-gray-800/80 hover:bg-gray-800 border-gray-700 hover:border-emerald-500/50 text-gray-300 hover:text-emerald-400'
              }`}
              title="Quick Scan (Read ARP cache in ~200ms)"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin text-emerald-400' : ''} />
              <span className="text-[11px] font-semibold hidden sm:inline">Scan</span>
            </button>

            <button
              type="button"
              onClick={() => onDeepSweep && onDeepSweep()}
              disabled={loading || sweepLoading}
              className={`px-2 py-1.5 rounded-lg border text-xs flex items-center gap-1 transition cursor-pointer ${
                sweepLoading
                  ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                  : 'bg-emerald-600/20 hover:bg-emerald-600/30 border-emerald-500/40 text-emerald-300 hover:text-emerald-200'
              }`}
              title="Deep Subnet Sweep (Pings all 254 IPs to discover hidden/silent devices)"
            >
              <Zap size={13} className={sweepLoading ? 'animate-bounce text-emerald-400' : ''} />
              <span className="text-[11px] font-bold">{sweepLoading ? 'Sweeping...' : 'Deep Sweep'}</span>
            </button>

            <button
              type="button"
              onClick={() => setAutoRefresh && setAutoRefresh(!autoRefresh)}
              className={`p-1.5 rounded-lg border text-xs transition cursor-pointer ${
                autoRefresh
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-sm shadow-emerald-950'
                  : 'bg-gray-800/80 hover:bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200'
              }`}
              title={autoRefresh ? 'Auto-refresh active (every 10s)' : 'Enable auto-refresh'}
            >
              <Radio size={13} className={autoRefresh ? 'animate-pulse text-emerald-400' : ''} />
            </button>
          </div>
        </div>

        {/* Quick Summary Grid */}
        <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] font-mono">
          <div className="bg-gray-950/80 border border-gray-800/80 rounded-lg p-1.5">
            <span className="text-gray-500 block text-[9px] uppercase tracking-wider">Total</span>
            <span className="text-sm font-bold text-white">{lanData?.totalDevices || 0}</span>
          </div>
          <div className="bg-gray-950/80 border border-gray-800/80 rounded-lg p-1.5">
            <span className="text-gray-500 block text-[9px] uppercase tracking-wider">Active</span>
            <span className="text-sm font-bold text-emerald-400">{activeCount}</span>
          </div>
          <div className="bg-gray-950/80 border border-gray-800/80 rounded-lg p-1.5">
            <span className="text-gray-500 block text-[9px] uppercase tracking-wider">Duration</span>
            <span className="text-sm font-bold text-sky-400">{lanData?.durationMs || 0}ms</span>
          </div>
        </div>
      </div>

      {/* Search Bar & Filter Pills */}
      <div className="flex flex-col gap-2 mb-3 shrink-0">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search IP, MAC, Vendor or Type..."
            className="w-full bg-gray-900 border border-gray-800 focus:border-emerald-500/60 rounded-xl pl-9 pr-8 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none transition-all"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 p-0.5 text-xs cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px] font-medium custom-scrollbar">
          {[
            { id: 'all', label: 'All' },
            { id: 'mobile', label: 'Mobile' },
            { id: 'computer', label: 'PC' },
            { id: 'iot', label: 'IoT' },
            { id: 'console', label: 'Media' },
            { id: 'server', label: 'Server' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterType(tab.id)}
              className={`px-2.5 py-1 rounded-lg transition-all shrink-0 cursor-pointer ${
                filterType === tab.id
                  ? 'bg-emerald-600 text-white font-bold shadow-sm'
                  : 'bg-gray-900/80 text-gray-400 hover:text-gray-200 border border-gray-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Device List (Scrollable) */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
        {/* Gateway Device (Always Pinned) */}
        {gateway && (
          <div
            onClick={() => onSelectDevice && onSelectDevice(selectedDevice?.id === gateway.id ? null : gateway)}
            className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
              selectedDevice?.id === gateway.id
                ? 'bg-emerald-950/40 border-emerald-500/80 shadow-[0_0_15px_rgba(16,185,129,0.25)] ring-1 ring-emerald-500/50'
                : 'bg-gray-900/80 hover:bg-gray-850 border-gray-800 hover:border-emerald-500/40'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                  <Router size={15} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs text-emerald-300 font-mono">{gateway.ip}</span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-950 border border-emerald-500/40 text-emerald-300">
                      ROUTER
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-300 font-medium truncate">
                    {gateway.vendor || 'Default Gateway'}
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                  gateway.latency !== null
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                    : 'bg-gray-800 text-gray-400'
                }`}>
                  {gateway.latency !== null ? `${gateway.latency} ms` : 'offline'}
                </span>
                <span className="text-[10px] text-gray-500 font-mono">{gateway.mac}</span>
              </div>
            </div>

            {/* Quick action bar */}
            <div className="mt-2 pt-2 border-t border-gray-800/80 flex items-center justify-between text-[11px]">
              <span className="text-gray-500 text-[10px]">Gateway • Subnet Hub</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    copyToClipboard(gateway.ip, `ip-${gateway.id}`);
                  }}
                  className="px-1.5 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition flex items-center gap-1"
                  title="Copy IP"
                >
                  {copiedId === `ip-${gateway.id}` ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                  <span className="text-[10px]">IP</span>
                </button>
                {onPing && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPing(gateway.ip);
                    }}
                    className="px-1.5 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-emerald-400 hover:text-emerald-300 transition flex items-center gap-1"
                    title="Live Ping"
                  >
                    <Activity size={11} />
                    <span className="text-[10px]">Ping</span>
                  </button>
                )}
                {onSslCheck && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSslCheck(gateway.ip, 443);
                    }}
                    className="px-1.5 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-sky-400 hover:text-sky-300 transition flex items-center gap-1"
                    title="Check Web Admin Port (SSL 443)"
                  >
                    <ShieldCheck size={11} />
                    <span className="text-[10px]">SSL</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* This Device (Host PC Running VNI) */}
        {thisDevice && (
          <div
            onClick={() => onSelectDevice && onSelectDevice(selectedDevice?.id === thisDevice.id ? null : thisDevice)}
            className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
              selectedDevice?.id === thisDevice.id
                ? 'bg-sky-950/40 border-sky-500/80 shadow-[0_0_15px_rgba(56,189,248,0.25)] ring-1 ring-sky-500/50'
                : 'bg-gray-900/80 hover:bg-gray-850 border-gray-800 hover:border-sky-500/40'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400 shrink-0">
                  <Laptop size={15} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs text-sky-300 font-mono">{thisDevice.ip}</span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-sky-950 border border-sky-500/40 text-sky-300">
                      THIS PC (YOU)
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-300 font-medium truncate">
                    {thisDevice.vendor || thisDevice.hostname}
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1">
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-950 text-sky-400 border border-sky-500/30">
                  0 ms
                </span>
                <span className="text-[10px] text-gray-500 font-mono">{thisDevice.mac}</span>
              </div>
            </div>

            <div className="mt-2 pt-2 border-t border-gray-800/80 flex items-center justify-between text-[11px]">
              <span className="text-gray-500 text-[10px]">Local Host Adapter</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    copyToClipboard(thisDevice.ip, `ip-${thisDevice.id}`);
                  }}
                  className="px-1.5 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition flex items-center gap-1"
                >
                  {copiedId === `ip-${thisDevice.id}` ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                  <span className="text-[10px]">IP</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Separator / Count indicator */}
        <div className="flex items-center justify-between px-1 pt-1 text-[11px] text-gray-500">
          <span className="uppercase text-[10px] font-bold tracking-wider">
            Connected Clients ({filteredDevices.length})
          </span>
          {search && (
            <span className="text-emerald-400 text-[10px]">Filtered by &quot;{search}&quot;</span>
          )}
        </div>

        {/* Client Devices */}
        {filteredDevices.length === 0 ? (
          <div className="bg-gray-900/40 border border-gray-800/60 rounded-xl p-6 text-center text-gray-500 text-xs">
            {search ? 'No devices match your search query.' : 'No other devices currently discovered in ARP cache. Click "Deep Sweep" to discover all active devices on your WiFi/LAN!'}
          </div>
        ) : (
          filteredDevices.map(dev => {
            const IconComponent = getDeviceIcon(dev.deviceType);
            const devColor = getDeviceColor(dev.deviceType, false, false);
            const isSelected = selectedDevice?.id === dev.id;

            return (
              <div
                key={dev.id}
                onClick={() => onSelectDevice && onSelectDevice(isSelected ? null : dev)}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-amber-950/40 border-amber-500/80 shadow-[0_0_15px_rgba(245,158,11,0.25)] ring-1 ring-amber-500/50'
                    : 'bg-gray-900/70 hover:bg-gray-850 border-gray-800 hover:border-gray-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 truncate">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border"
                      style={{
                        backgroundColor: `${devColor}18`,
                        borderColor: `${devColor}40`,
                        color: devColor
                      }}
                    >
                      <IconComponent size={15} />
                    </div>
                    <div className="truncate">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-white font-mono">{dev.ip}</span>
                        {dev.isRandomized && (
                          <span className="px-1 py-0.2 rounded text-[8px] bg-purple-950/80 border border-purple-500/40 text-purple-300" title="Private MAC (Apple / Android privacy feature)">
                            PRIVATE MAC
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-400 font-medium truncate">
                        {dev.vendor}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                      dev.latency !== null
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                        : 'bg-gray-800 text-gray-500'
                    }`}>
                      {dev.latency !== null ? `${dev.latency} ms` : (dev.isAlive ? 'online' : 'silent')}
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono">{dev.mac}</span>
                  </div>
                </div>

                {/* Bottom Action strip */}
                <div className="mt-2 pt-2 border-t border-gray-800/80 flex items-center justify-between text-[11px]">
                  <span className="text-gray-500 text-[10px] capitalize">
                    {dev.deviceType} • {dev.type}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(dev.ip, `ip-${dev.id}`);
                      }}
                      className="px-1.5 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition flex items-center gap-1"
                      title="Copy IP"
                    >
                      {copiedId === `ip-${dev.id}` ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                      <span className="text-[10px]">IP</span>
                    </button>
                    {onPing && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPing(dev.ip);
                        }}
                        className="px-1.5 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-emerald-400 hover:text-emerald-300 transition flex items-center gap-1"
                        title="Live Ping test"
                      >
                        <Activity size={11} />
                        <span className="text-[10px]">Ping</span>
                      </button>
                    )}
                    {onDig && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDig(dev.ip);
                        }}
                        className="px-1.5 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-purple-400 hover:text-purple-300 transition flex items-center gap-1"
                        title="Reverse DNS Lookup"
                      >
                        <Globe size={11} />
                        <span className="text-[10px]">PTR</span>
                      </button>
                    )}
                    {onSslCheck && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSslCheck(dev.ip, 443);
                        }}
                        className="px-1.5 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-sky-400 hover:text-sky-300 transition flex items-center gap-1"
                        title="Check HTTPS Web Service"
                      >
                        <ShieldCheck size={11} />
                        <span className="text-[10px]">SSL</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

