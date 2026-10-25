import React, { useState, useMemo } from 'react';
import {
  Network,
  RefreshCw,
  Search,
  Zap,
  Activity,
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
  Radio,
  Edit2,
  ExternalLink,
  FileCode,
  Printer,
  Sun,
  Gamepad2,
  Power,
  ShieldAlert,
  ShieldCheck,
  Lock,
  Clock,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import XmlViewerModal from './XmlViewerModal';
import MdnsViewerModal from './MdnsViewerModal';
import DeviceInspectModal from './DeviceInspectModal';
import { formatOsName } from '../utils/formatters';

function getDeviceIcon(type) {
  switch (type) {
    case 'router':
      return Router;
    case 'desktop':
    case 'computer':
      return Laptop;
    case 'mobile':
      return Smartphone;
    case 'printer':
      return Printer;
    case 'ev_charger':
      return Zap;
    case 'solar':
      return Sun;
    case 'tv':
      return Tv;
    case 'console':
      return Gamepad2;
    case 'server':
    case 'nas':
      return Server;
    case 'mesh_node':
    case 'network':
      return Wifi;
    case 'iot':
    case 'smart_home':
      return Cpu;
    default:
      return Wifi;
  }
}

function getDeviceColor(type, isThisDevice, isGateway) {
  if (isGateway) return '#10b981'; // Emerald
  if (isThisDevice) return '#38bdf8'; // Sky blue
  switch (type) {
    case 'mobile':
      return '#ec4899'; // Pink / Mobile
    case 'printer':
      return '#0ea5e9'; // Sky Blue / Printer
    case 'ev_charger':
      return '#eab308'; // Amber / EV Charger
    case 'solar':
      return '#f59e0b'; // Amber / Solar
    case 'iot':
    case 'smart_home':
      return '#f59e0b'; // Amber / Smart Home
    case 'tv':
      return '#a855f7'; // Purple / Smart TV
    case 'console':
      return '#8b5cf6'; // Violet / Console
    case 'server':
    case 'nas':
      return '#6366f1'; // Indigo
    case 'computer':
    case 'desktop':
      return '#06b6d4'; // Cyan
    case 'mesh_node':
    case 'network':
      return '#14b8a6'; // Teal
    default:
      return '#94a3b8'; // Slate
  }
}

function formatDeviceType(type) {
  const map = {
    'router': 'Router',
    'computer': 'PC / Laptop',
    'desktop': 'Desktop PC',
    'mobile': 'Mobile',
    'printer': 'Printer',
    'ev_charger': 'EV Charger',
    'solar': 'Solar / Battery',
    'iot': 'Smart Home IoT',
    'tv': 'Smart TV',
    'console': 'Game Console',
    'server': 'Server / NAS',
    'mesh_node': 'Mesh Node',
    'network': 'Network Device',
    'device': 'Client Device'
  };
  return map[type] || (type ? type.replace(/_/g, ' ') : 'Device');
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
  onSslCheck,
  apiBase
}) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [copiedId, setCopiedId] = useState(null);
  const [nicknames, setNicknames] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('vni_lan_nicknames')) || {};
    } catch (e) {
      return {};
    }
  });
  const [editingKey, setEditingKey] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [xmlModalDevice, setXmlModalDevice] = useState(null);
  const [mdnsModalDevice, setMdnsModalDevice] = useState(null);
  const [inspectModalDevice, setInspectModalDevice] = useState(null);
  const [wolStatus, setWolStatus] = useState({});
  const [showOffline, setShowOffline] = useState(false);
  const latencyHistoryRef = React.useRef({});

  // Sync nicknames across components
  React.useEffect(() => {
    const handleStorage = () => {
      try {
        setNicknames(JSON.parse(localStorage.getItem('vni_lan_nicknames')) || {});
      } catch (e) {}
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Track rolling latency history across scans for sparkline & jitter calculation
  React.useEffect(() => {
    if (!lanData) return;
    const allDevs = [
      ...(lanData.gateway ? [lanData.gateway] : []),
      ...(lanData.devices || [])
    ];
    allDevs.forEach(d => {
      if (!d?.ip || d.latency === null || d.latency === undefined) return;
      const prev = latencyHistoryRef.current[d.ip] || [];
      const next = [...prev, Number(d.latency)].slice(-12);
      latencyHistoryRef.current[d.ip] = next;
    });
  }, [lanData]);

  const getLatencyStats = (ip) => {
    const hist = latencyHistoryRef.current[ip] || [];
    if (hist.length < 2) return null;
    let diffSum = 0;
    for (let i = 1; i < hist.length; i++) {
      diffSum += Math.abs(hist[i] - hist[i - 1]);
    }
    const jitter = Math.round(diffSum / (hist.length - 1));
    return { history: hist, jitter };
  };

  const sendWol = async (dev, e) => {
    if (e) e.stopPropagation();
    if (!dev?.mac) return;
    const key = dev.mac;
    setWolStatus(prev => ({ ...prev, [key]: 'sending' }));
    try {
      const baseUrl = apiBase || 'http://localhost:3001';
      await fetch(`${baseUrl}/api/wol?mac=${encodeURIComponent(dev.mac)}&ip=${encodeURIComponent(dev.ip || '')}`);
      setWolStatus(prev => ({ ...prev, [key]: 'sent' }));
    } catch (err) {
      setWolStatus(prev => ({ ...prev, [key]: 'error' }));
    }
    setTimeout(() => {
      setWolStatus(prev => ({ ...prev, [key]: null }));
    }, 2800);
  };

  const saveNickname = (key, val) => {
    const trimmed = (val || '').trim();
    setNicknames(prev => {
      const next = { ...prev };
      if (trimmed) {
        next[key] = trimmed;
      } else {
        delete next[key];
      }
      localStorage.setItem('vni_lan_nicknames', JSON.stringify(next));
      window.dispatchEvent(new Event('storage'));
      return next;
    });
    setEditingKey(null);
  };

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
      if (filterType !== 'all') {
        const t = dev.deviceType || '';
        if (filterType === 'mobile' && t !== 'mobile') return false;
        if (filterType === 'computer' && t !== 'computer' && t !== 'desktop') return false;
        if (filterType === 'iot' && !['iot', 'ev_charger', 'solar', 'smart_home', 'printer'].includes(t)) return false;
        if (filterType === 'console' && !['console', 'tv'].includes(t)) return false;
        if (filterType === 'server' && !['server', 'nas'].includes(t)) return false;
      }
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      const customName = nicknames[dev.mac] || nicknames[dev.ip] || '';
      return (
        customName.toLowerCase().includes(s) ||
        (dev.ip || '').toLowerCase().includes(s) ||
        (dev.mac || '').toLowerCase().includes(s) ||
        (dev.vendor || '').toLowerCase().includes(s) ||
        (dev.hostname || '').toLowerCase().includes(s) ||
        (dev.deviceType || '').toLowerCase().includes(s)
      );
    });
  }, [devices, filterType, search, nicknames]);

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
        {/* ARP Spoofing / Security Alerts Banner */}
        {lanData?.securityAlerts?.length > 0 && (
          <div className="p-2.5 rounded-xl bg-red-950/80 border border-red-500/60 text-red-200 space-y-1 shadow-lg">
            {lanData.securityAlerts.map((alert, aIdx) => (
              <div key={aIdx} className="flex items-start gap-2 text-[11px]">
                <ShieldAlert size={14} className="text-red-400 shrink-0 mt-0.5 animate-pulse" />
                <div>
                  <span className="font-bold text-red-300 uppercase tracking-wide mr-1.5">{alert.type}:</span>
                  <span>{alert.message}</span>
                </div>
              </div>
            ))}
          </div>
        )}

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

              <div className="flex flex-col items-end gap-1.5">
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  gateway.latency !== null
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                    : 'bg-gray-800 text-gray-400'
                }`}>
                  {gateway.latency !== null ? `${gateway.latency} ms` : 'offline'}
                </span>
                <div className="flex items-center gap-1 font-mono text-[10px] bg-gray-950/90 border border-gray-700/80 px-2 py-0.5 rounded text-gray-200">
                  <span className="text-[9px] text-gray-400 font-bold">MAC:</span>
                  <span className="font-bold tracking-wider text-emerald-400">{gateway.mac}</span>
                </div>
              </div>
            </div>

            {/* Quick action bar */}
            <div className="mt-2.5 pt-2 border-t border-gray-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <span className="text-gray-500 text-[10px] whitespace-nowrap shrink-0">Gateway • Subnet Hub</span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setInspectModalDevice(gateway);
                  }}
                  className="px-1.5 py-0.5 rounded bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-500/30 hover:border-cyan-400/50 text-cyan-300 hover:text-cyan-100 transition flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                  title="Run deep device inspection & fingerprinting"
                >
                  <Cpu size={11} className="text-cyan-400" />
                  <span className="text-[10px] font-semibold">Inspect</span>
                </button>
                {gateway.mdns && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMdnsModalDevice(gateway);
                    }}
                    className="px-1.5 py-0.5 rounded bg-gray-800 hover:bg-indigo-950 border border-transparent hover:border-indigo-500/40 text-gray-300 hover:text-indigo-300 transition flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                    title="View mDNS / Bonjour information"
                  >
                    <Radio size={11} className="text-indigo-400" />
                    <span className="text-[10px]">mDNS</span>
                  </button>
                )}
                {gateway.ssdp && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setXmlModalDevice(gateway);
                    }}
                    className="px-1.5 py-0.5 rounded bg-gray-800 hover:bg-sky-950 border border-transparent hover:border-sky-500/40 text-gray-300 hover:text-sky-300 transition flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                    title="View UPnP / SSDP XML description"
                  >
                    <FileCode size={11} className="text-sky-400" />
                    <span className="text-[10px]">XML</span>
                  </button>
                )}
                {(gateway.webPortal || gateway.ip) && (
                  <a
                    href={gateway.webPortal || `http://${gateway.ip}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="px-2 py-0.5 rounded bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 hover:border-emerald-400 text-emerald-300 hover:text-emerald-100 transition flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                    title={`Open Router Web Portal (${gateway.webPortal || `http://${gateway.ip}`})`}
                  >
                    <Globe size={11} className="text-emerald-400" />
                    <span className="text-[10px] font-semibold">Web Portal</span>
                    <ExternalLink size={9} className="opacity-70" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    copyToClipboard(gateway.ip, `ip-${gateway.id}`);
                  }}
                  className="px-1.5 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition flex items-center gap-1 whitespace-nowrap shrink-0"
                  title="Copy IP Address"
                >
                  {copiedId === `ip-${gateway.id}` ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                  <span className="text-[10px]">IP</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    copyToClipboard(gateway.mac, `mac-${gateway.id}`);
                  }}
                  className="px-1.5 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition flex items-center gap-1 whitespace-nowrap shrink-0"
                  title="Copy MAC Address"
                >
                  {copiedId === `mac-${gateway.id}` ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                  <span className="text-[10px]">MAC</span>
                </button>
                {onPing && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPing({ ip: gateway.ip, hostname: 'Default Gateway (Router)', isPrivate: true });
                    }}
                    className="px-1.5 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-emerald-400 hover:text-emerald-300 transition flex items-center gap-1 whitespace-nowrap shrink-0"
                    title="Live Ping"
                  >
                    <Activity size={11} />
                    <span className="text-[10px]">Ping</span>
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
                  <div className="text-[11px] text-gray-300 font-medium truncate mt-0.5">
                    {thisDevice.vendor || thisDevice.hostname}
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-950 text-sky-400 border border-sky-500/30">
                  0 ms
                </span>
                <div className="flex items-center gap-1 font-mono text-[10px] bg-gray-950/90 border border-gray-700/80 px-2 py-0.5 rounded text-gray-200">
                  <span className="text-[9px] text-gray-400 font-bold">MAC:</span>
                  <span className="font-bold tracking-wider text-sky-400">{thisDevice.mac}</span>
                </div>
              </div>
            </div>

            <div className="mt-2.5 pt-2 border-t border-gray-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <span className="text-gray-500 text-[10px] whitespace-nowrap shrink-0">Local Host Adapter</span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setInspectModalDevice(thisDevice);
                  }}
                  className="px-1.5 py-0.5 rounded bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-500/30 hover:border-cyan-400/50 text-cyan-300 hover:text-cyan-100 transition flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                  title="Run deep device inspection & fingerprinting"
                >
                  <Cpu size={11} className="text-cyan-400" />
                  <span className="text-[10px] font-semibold">Inspect</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    copyToClipboard(thisDevice.ip, `ip-${thisDevice.id}`);
                  }}
                  className="px-1.5 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition flex items-center gap-1 whitespace-nowrap shrink-0"
                  title="Copy IP Address"
                >
                  {copiedId === `ip-${thisDevice.id}` ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                  <span className="text-[10px]">IP</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    copyToClipboard(thisDevice.mac, `mac-${thisDevice.id}`);
                  }}
                  className="px-1.5 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition flex items-center gap-1 whitespace-nowrap shrink-0"
                  title="Copy MAC Address"
                >
                  {copiedId === `mac-${thisDevice.id}` ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                  <span className="text-[10px]">MAC</span>
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
            const customName = nicknames[dev.mac] || nicknames[dev.ip];
            const devTitle = customName || dev.hostname || dev.friendlyName || dev.vendor || dev.ip;
            const isEditing = editingKey === dev.mac || editingKey === dev.ip;

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
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-bold text-xs text-white font-mono">{dev.ip}</span>
                        {dev.isNew && (
                          <span className="px-1 py-0.2 rounded text-[8px] font-bold bg-amber-950 border border-amber-400/50 text-amber-300" title="First time seen on this LAN">
                            NEW
                          </span>
                        )}
                        {dev.deviceType === 'mesh_node' && (
                          <span className="px-1 py-0.2 rounded text-[8px] font-bold bg-teal-950 border border-teal-500/40 text-teal-300" title="Wi-Fi Mesh Satellite / Access Point">
                            MESH
                          </span>
                        )}
                        {dev.isRandomized && (
                          <span className="px-1 py-0.2 rounded text-[8px] bg-purple-950/80 border border-purple-500/40 text-purple-300" title="Private MAC (Apple / Android privacy feature)">
                            PRIVATE MAC
                          </span>
                        )}
                        {customName && (
                          <span className="px-1 py-0.2 rounded text-[8px] bg-amber-950/80 border border-amber-500/40 text-amber-300">
                            NICKNAME
                          </span>
                        )}
                        {dev.securityAudit?.grade && (
                          <span
                            className={`px-1 py-0.2 rounded text-[8px] font-bold border ${
                              dev.securityAudit.score >= 85
                                ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
                                : dev.securityAudit.score >= 65
                                  ? 'bg-amber-950/80 border-amber-500/40 text-amber-300'
                                  : 'bg-red-950/80 border-red-500/50 text-red-300'
                            }`}
                            title={`Security Score: ${dev.securityAudit.score}/100 (${dev.securityAudit.status})`}
                          >
                            SEC {dev.securityAudit.grade}
                          </span>
                        )}
                        {dev.activeConnectionsCount > 0 && (
                          <span className="px-1 py-0.2 rounded text-[8px] font-mono font-bold bg-emerald-950/80 border border-emerald-500/40 text-emerald-300" title={`${dev.activeConnectionsCount} active local socket(s) with this PC`}>
                            ⚡{dev.activeConnectionsCount}
                          </span>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="flex items-center gap-1 mt-1" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            autoFocus
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveNickname(dev.mac || dev.ip, editValue);
                              if (e.key === 'Escape') setEditingKey(null);
                            }}
                            placeholder="Enter device nickname..."
                            className="px-1.5 py-0.5 rounded bg-gray-950 border border-amber-500 text-xs text-white focus:outline-none w-36 font-sans"
                          />
                          <button
                            type="button"
                            onClick={() => saveNickname(dev.mac || dev.ip, editValue)}
                            className="p-1 rounded bg-amber-600 hover:bg-amber-500 text-white"
                            title="Save Nickname"
                          >
                            <Check size={11} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingKey(null)}
                            className="p-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-400"
                            title="Cancel"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] text-gray-300 font-medium truncate max-w-[160px]" title={devTitle}>
                            {devTitle}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingKey(dev.mac || dev.ip);
                              setEditValue(customName || dev.hostname || '');
                            }}
                            className="text-gray-500 hover:text-amber-400 transition p-0.5"
                            title="Set custom nickname"
                          >
                            <Edit2 size={10} />
                          </button>
                        </div>
                      )}

                      {customName && !isEditing && (
                        <div className="text-[10px] text-gray-500 truncate">
                          {dev.vendor}
                        </div>
                      )}

                      {/* Model & TLS Certificate CN */}
                      {dev.modelName && dev.modelName !== devTitle && (
                        <div className="text-[10px] text-gray-400 truncate mt-0.5">
                          Model: {dev.modelName}
                        </div>
                      )}
                      {dev.tlsCertificate?.commonName && (
                        <div className="text-[10px] text-indigo-300/90 truncate mt-0.5 flex items-center gap-1" title={`TLS Certificate Issuer: ${dev.tlsCertificate.issuerName || 'Self-Signed'}`}>
                          <Lock size={9} className="text-indigo-400 shrink-0" />
                          <span>TLS: {dev.tlsCertificate.commonName}</span>
                        </div>
                      )}

                      {/* OS Fingerprint */}
                      {dev.osFingerprint?.osName && (
                        <div className="text-[10px] text-cyan-400/90 truncate mt-0.5 flex items-center gap-1">
                          <Cpu size={10} className="text-cyan-400 shrink-0" />
                          <span className="font-medium">{formatOsName(dev.osFingerprint.osName)}</span>
                          {dev.ttl && <span className="text-[9px] text-slate-500 font-mono">(TTL={dev.ttl})</span>}
                        </div>
                      )}

                      {dev.mdns?.services?.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 mt-1">
                          {dev.mdns.services.map((srv, sIdx) => (
                            <button
                              key={sIdx}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMdnsModalDevice(dev);
                              }}
                              className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-500/30 hover:border-indigo-500/60 text-indigo-300 hover:text-indigo-200 transition cursor-pointer flex items-center gap-1"
                              title="Click to view mDNS & Bonjour details"
                            >
                              <Radio size={9} />
                              <span>{srv}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <div className="flex items-center gap-1.5">
                      {/* Rolling Latency Sparkline & Jitter */}
                      {(() => {
                        const stats = getLatencyStats(dev.ip);
                        if (!stats) return null;
                        const maxVal = Math.max(...stats.history, 10);
                        const minVal = Math.min(...stats.history, 0);
                        const range = Math.max(maxVal - minVal, 1);
                        const points = stats.history.map((v, i) => {
                          const x = (i / (stats.history.length - 1)) * 36;
                          const y = 12 - ((v - minVal) / range) * 10;
                          return `${x.toFixed(1)},${y.toFixed(1)}`;
                        }).join(' ');
                        return (
                          <div className="flex items-center gap-1 bg-gray-950/80 border border-gray-800 px-1.5 py-0.5 rounded" title={`Jitter: ±${stats.jitter}ms (${stats.history.length} samples)`}>
                            <svg width="36" height="14" className="overflow-visible">
                              <polyline
                                fill="none"
                                stroke="#10b981"
                                strokeWidth="1.4"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                points={points}
                              />
                            </svg>
                            <span className="text-[8px] font-mono text-gray-400">±{stats.jitter}ms</span>
                          </div>
                        );
                      })()}
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        dev.latency !== null
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                          : 'bg-gray-800 text-gray-500'
                      }`}>
                        {dev.latency !== null ? (dev.latency === 1 ? '<1 ms' : `${dev.latency} ms`) : (dev.isAlive ? 'online' : 'silent')}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 font-mono text-[10px] bg-gray-950/90 border border-gray-700/80 px-2 py-0.5 rounded text-gray-200">
                      <span className="text-[9px] text-gray-400 font-bold">MAC:</span>
                      <span className="font-bold tracking-wider text-amber-300/90">{dev.mac}</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Action strip */}
                <div className="mt-2.5 pt-2 border-t border-gray-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <span className="text-gray-500 text-[10px] whitespace-nowrap shrink-0">
                    {formatDeviceType(dev.deviceType)} • {dev.type}
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setInspectModalDevice(dev);
                      }}
                      className="px-1.5 py-0.5 rounded bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-500/30 hover:border-cyan-400/50 text-cyan-300 hover:text-cyan-100 transition flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                      title="Run deep device inspection & fingerprinting (OS, SNMP, Uptime, Ports, Security, TLS)"
                    >
                      <Cpu size={11} className="text-cyan-400" />
                      <span className="text-[10px] font-semibold">Inspect</span>
                    </button>
                    {dev.mac && dev.mac !== '00-00-00-00-00-00' && (
                      <button
                        type="button"
                        onClick={(e) => sendWol(dev, e)}
                        className={`px-1.5 py-0.5 rounded border transition flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${
                          wolStatus[dev.mac] === 'sent'
                            ? 'bg-emerald-950 border-emerald-500/50 text-emerald-300'
                            : 'bg-amber-950/60 hover:bg-amber-900/70 border-amber-500/30 hover:border-amber-400/60 text-amber-300'
                        }`}
                        title="Send Wake-on-LAN (WoL) Magic Packet"
                      >
                        <Power size={10} />
                        <span className="text-[10px] font-semibold">
                          {wolStatus[dev.mac] === 'sent' ? 'WoL Sent!' : 'Wake'}
                        </span>
                      </button>
                    )}
                    {dev.mdns && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMdnsModalDevice(dev);
                        }}
                        className="px-1.5 py-0.5 rounded bg-gray-800 hover:bg-indigo-950 border border-transparent hover:border-indigo-500/40 text-gray-300 hover:text-indigo-300 transition flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                        title="View mDNS / Bonjour information (TXT records, port, services)"
                      >
                        <Radio size={11} className="text-indigo-400" />
                        <span className="text-[10px]">mDNS</span>
                      </button>
                    )}
                    {dev.ssdp && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setXmlModalDevice(dev);
                        }}
                        className="px-1.5 py-0.5 rounded bg-gray-800 hover:bg-sky-950 border border-transparent hover:border-sky-500/40 text-gray-300 hover:text-sky-300 transition flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                        title="View UPnP / SSDP XML description"
                      >
                        <FileCode size={11} className="text-sky-400" />
                        <span className="text-[10px]">XML</span>
                      </button>
                    )}
                    {dev.webPortal && (
                      <a
                        href={dev.webPortal}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="px-1.5 py-0.5 rounded bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 hover:border-emerald-400 text-emerald-300 hover:text-emerald-100 transition flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                        title={`Open device web portal (${dev.webPortal})`}
                      >
                        <Globe size={11} className="text-emerald-400" />
                        <span className="text-[10px] font-semibold">Web Portal</span>
                        <ExternalLink size={9} className="opacity-70" />
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(dev.ip, `ip-${dev.id}`);
                      }}
                      className="px-1.5 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition flex items-center gap-1 whitespace-nowrap shrink-0"
                      title="Copy IP Address"
                    >
                      {copiedId === `ip-${dev.id}` ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                      <span className="text-[10px]">IP</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(dev.mac, `mac-${dev.id}`);
                      }}
                      className="px-1.5 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition flex items-center gap-1 whitespace-nowrap shrink-0"
                      title="Copy MAC Address"
                    >
                      {copiedId === `mac-${dev.id}` ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                      <span className="text-[10px]">MAC</span>
                    </button>
                    {onPing && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPing({ ip: dev.ip, hostname: devTitle, isPrivate: true });
                        }}
                        className="px-1.5 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-emerald-400 hover:text-emerald-300 transition flex items-center gap-1 whitespace-nowrap shrink-0"
                        title="Live Ping test"
                      >
                        <Activity size={11} />
                        <span className="text-[10px]">Ping</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingKey(dev.mac || dev.ip);
                        setEditValue(customName || dev.hostname || '');
                      }}
                      className="px-1.5 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-amber-300 transition flex items-center gap-1 whitespace-nowrap shrink-0"
                      title="Set custom nickname"
                    >
                      <Edit2 size={11} />
                      <span className="text-[10px]">Name</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Offline Known Devices Section (from persistent history) */}
        {lanData?.offlineDevices?.length > 0 && (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowOffline(!showOffline)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-gray-900/70 hover:bg-gray-900 border border-gray-800 text-[10px] font-bold text-gray-400 hover:text-gray-200 transition cursor-pointer"
            >
              <div className="flex items-center gap-1.5 uppercase tracking-wider">
                <Clock size={12} className="text-gray-500" />
                <span>Offline Known Devices ({lanData.offlineDevices.length})</span>
              </div>
              {showOffline ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>

            {showOffline && (
              <div className="mt-2 space-y-1.5">
                {lanData.offlineDevices.map(offDev => {
                  const customName = nicknames[offDev.mac] || nicknames[offDev.ip];
                  const title = customName || offDev.hostname || offDev.vendor || offDev.ip;
                  const lastSeenStr = offDev.lastSeen ? new Date(offDev.lastSeen).toLocaleString() : 'Previously seen';
                  return (
                    <div
                      key={offDev.id}
                      className="p-2 rounded-xl bg-gray-950/60 border border-gray-800/70 opacity-75 hover:opacity-100 transition flex items-center justify-between gap-2"
                    >
                      <div className="truncate">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-mono font-bold text-gray-400">{offDev.ip}</span>
                          <span className="px-1 py-0.2 rounded text-[8px] font-mono bg-gray-900 border border-gray-700 text-gray-500">
                            OFFLINE
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-300 truncate">{title}</div>
                        <div className="text-[9px] text-gray-500 font-mono">
                          MAC: {offDev.mac} • Last seen: {lastSeenStr}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => sendWol(offDev, e)}
                          className="px-2 py-1 rounded bg-amber-950/70 hover:bg-amber-900 border border-amber-500/40 text-amber-300 text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                          title="Wake sleeping/offline device via Wake-on-LAN (Magic Packet)"
                        >
                          <Power size={10} />
                          <span>{wolStatus[offDev.mac] === 'sent' ? 'WoL Sent!' : 'Wake (WoL)'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* UPnP / SSDP XML Viewer Modal */}
      <XmlViewerModal
        isOpen={!!xmlModalDevice}
        onClose={() => setXmlModalDevice(null)}
        device={xmlModalDevice}
        apiBase={apiBase}
      />

      {/* mDNS / Bonjour Viewer Modal */}
      <MdnsViewerModal
        isOpen={!!mdnsModalDevice}
        onClose={() => setMdnsModalDevice(null)}
        device={mdnsModalDevice}
      />

      {/* Deep Device Inspector Modal */}
      <DeviceInspectModal
        isOpen={!!inspectModalDevice}
        onClose={() => setInspectModalDevice(null)}
        device={inspectModalDevice}
        apiBase={apiBase}
      />
    </div>
  );
}

