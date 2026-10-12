import React, { useState, useEffect } from 'react';
import {
  X,
  RefreshCw,
  Copy,
  Check,
  Cpu,
  Activity,
  ShieldCheck,
  Server,
  Printer,
  Tv,
  Radio,
  Music,
  Terminal,
  Globe,
  Folder,
  Layers,
  Clock,
  Zap,
  Info,
  ExternalLink,
  Sliders,
  HardDrive
} from 'lucide-react';

function formatConfidence(val) {
  if (!val) return 'Estimated';
  const v = String(val).trim().toLowerCase();
  if (v === 'hög' || v === 'high') return 'High';
  if (v === 'medel' || v === 'med' || v === 'medium') return 'Medium';
  if (v === 'låg' || v === 'low') return 'Low';
  return val;
}

function formatBasis(basis) {
  if (!basis) return 'No specific heuristics confirmed';
  return basis
    .replace(/\bstandardmässig för\b/gi, 'standard default for')
    .replace(/\bIdentifierad via\b/gi, 'Identified via')
    .replace(/\bHårdvaru-OUI\b/gi, 'Hardware OUI')
    .replace(/\bverifierad\b/gi, 'verified')
    .replace(/\baktiv\b/gi, 'active');
}

export default function DeviceInspectModal({ isOpen, onClose, device, apiBase = '' }) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'os' | 'ports' | 'hardware' | 'raw'
  const [loading, setLoading] = useState(false);
  const [inspectData, setInspectData] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const fetchInspection = async () => {
    if (!device?.ip) return;
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({
        ip: device.ip,
        mac: device.mac || '',
        vendor: device.vendor || ''
      });
      const res = await fetch(`${apiBase}/api/device-inspect?${q.toString()}`);
      const data = await res.json();
      if (data.ok && data.inspection) {
        setInspectData(data.inspection);
      } else {
        setError(data.error || 'Failed to complete deep inspection');
      }
    } catch (err) {
      setError(err.message || 'Network error during device inspection');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && device?.ip) {
      setActiveTab('overview');
      fetchInspection();
    } else {
      setInspectData(null);
      setError(null);
    }
  }, [isOpen, device?.ip]);

  if (!isOpen || !device) return null;

  const data = inspectData || {};
  const os = data.osFingerprint || device.osFingerprint || {};
  const ping = data.ping || { alive: device.isAlive, latency: device.latency, ttl: device.ttl };
  const ports = data.ports || { all: [], open: [], openCount: 0 };
  const names = data.names || {
    mdns: device.mdns?.name,
    netbios: device.netbiosName,
    workgroup: device.workgroup,
    hostname: device.hostname
  };
  const uptime = data.uptime || null;
  const banners = data.banners || {};
  const devSpec = data.deviceSpecific || {};
  const capabilities = data.networkCapabilities || (device.networkCapabilities ? device.networkCapabilities.map(c => ({ id: c.toLowerCase(), label: c })) : []);

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(inspectData || device, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5"
      style={{ backgroundColor: 'rgba(3, 7, 18, 0.82)', backdropFilter: 'blur(10px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl border border-cyan-500/30 shadow-2xl overflow-hidden text-slate-100"
        style={{
          background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(9, 14, 28, 0.99) 100%)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(6, 182, 212, 0.15)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Cpu className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-100 tracking-wide">
                  {names.mdns || names.netbios || device.friendlyName || device.hostname || device.ip}
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-mono rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  {device.ip}
                </span>
                {ping.alive && (
                  <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    Active ({ping.latency != null ? (ping.latency === 1 ? '<1 ms' : `${ping.latency} ms`) : 'Online'})
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                {device.vendor} • MAC: <span className="font-mono text-slate-300">{device.mac}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchInspection}
              disabled={loading}
              title="Re-run device inspection"
              className="p-2 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-300 hover:text-cyan-400 hover:border-cyan-500/40 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
            <button
              onClick={handleCopyJson}
              title="Copy diagnostics as JSON"
              className="p-2 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-300 hover:text-cyan-400 hover:border-cyan-500/40 transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              title="Close"
              className="p-2 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-400 hover:text-rose-400 hover:border-rose-500/40 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center px-6 border-b border-slate-800/80 bg-slate-950/40 gap-1 overflow-x-auto text-xs font-medium">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-3.5 border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-cyan-400 text-cyan-300 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Overview
          </button>
          <button
            onClick={() => setActiveTab('os')}
            className={`py-3 px-3.5 border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'os'
                ? 'border-cyan-400 text-cyan-300 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            OS & Kernel
          </button>
          <button
            onClick={() => setActiveTab('ports')}
            className={`py-3 px-3.5 border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'ports'
                ? 'border-cyan-400 text-cyan-300 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Open Ports ({ports.openCount || ports.open?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('hardware')}
            className={`py-3 px-3.5 border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'hardware'
                ? 'border-cyan-400 text-cyan-300 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Hardware & Uptime
          </button>
          <button
            onClick={() => setActiveTab('raw')}
            className={`py-3 px-3.5 border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'raw'
                ? 'border-cyan-400 text-cyan-300 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            Diagnostic Raw Data
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin" />
                <div className="absolute inset-2 rounded-full border-2 border-cyan-400/30 border-b-cyan-300 animate-spin" style={{ animationDirection: 'reverse' }} />
                <Cpu className="absolute inset-0 m-auto w-6 h-6 text-cyan-400 animate-pulse" />
              </div>
              <p className="text-sm text-cyan-300 font-medium tracking-wide">
                Running deep inspection on {device.ip}...
              </p>
              <p className="text-xs text-slate-400">
                Querying SNMP, NetBIOS, mDNS, ICMP TTL, banner grabbing, and scanning open ports
              </p>
            </div>
          )}

          {!loading && error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center justify-between">
              <div>
                <p className="font-semibold">Error during device inspection</p>
                <p className="text-xs text-rose-400 mt-1">{error}</p>
              </div>
              <button
                onClick={fetchInspection}
                className="px-3 py-1.5 text-xs bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 rounded-lg text-rose-200 transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && activeTab === 'overview' && (
            <div className="space-y-6">
              {/* 4 Hero Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* OS */}
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-cyan-500/30 transition-all">
                  <div className="flex items-center justify-between text-slate-400 mb-1.5">
                    <span className="text-xs uppercase tracking-wider font-semibold">Operating System</span>
                    <Cpu className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="text-base font-bold text-slate-100 truncate" title={os.osName}>
                    {os.osName || 'Embedded OS'}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono text-[10px]">
                      TTL={os.ttl || ping.ttl || '–'}
                    </span>
                    <span>Confidence: {formatConfidence(os.confidence)}</span>
                  </div>
                </div>

                {/* Uptime */}
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-cyan-500/30 transition-all">
                  <div className="flex items-center justify-between text-slate-400 mb-1.5">
                    <span className="text-xs uppercase tracking-wider font-semibold">Uptime</span>
                    <Clock className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-base font-bold text-emerald-300 truncate">
                    {uptime?.formatted || 'Not Available'}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 truncate" title={uptime?.source}>
                    Source: {uptime?.source ? uptime.source.split(' ')[0] : 'SNMP / ICMP'}
                  </div>
                </div>

                {/* Latency / Ping */}
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-cyan-500/30 transition-all">
                  <div className="flex items-center justify-between text-slate-400 mb-1.5">
                    <span className="text-xs uppercase tracking-wider font-semibold">Latency (Ping)</span>
                    <Zap className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-base font-bold text-amber-300">
                    {ping.latency != null ? (ping.latency === 1 ? '<1 ms' : `${ping.latency} ms`) : 'Offline'}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    ICMP Echo • {ping.alive ? 'Online & Responding' : 'No Response'}
                  </div>
                </div>

                {/* Ports Count */}
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-cyan-500/30 transition-all">
                  <div className="flex items-center justify-between text-slate-400 mb-1.5">
                    <span className="text-xs uppercase tracking-wider font-semibold">Open Ports</span>
                    <Layers className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="text-base font-bold text-purple-300">
                    {ports.openCount || ports.open?.length || 0} active
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 truncate">
                    {ports.open?.slice(0, 3).map(p => p.port).join(', ') || 'No open ports'}
                  </div>
                </div>
              </div>

              {/* Special Hardware Highlight (e.g. Printer Toner, Cast Info) */}
              {devSpec.printer && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-950/40 to-slate-900/80 border border-cyan-500/30">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Printer className="w-5 h-5 text-cyan-400" />
                      <h3 className="text-sm font-semibold text-slate-100">
                        Printer Status & Consumables
                      </h3>
                    </div>
                    {devSpec.printer.tonerLevel && (
                      <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        Toner Level: {devSpec.printer.tonerLevel}
                      </span>
                    )}
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-slate-800/80 rounded-full h-2.5 mb-2 overflow-hidden border border-slate-700/50">
                    <div
                      className="bg-gradient-to-r from-cyan-500 to-emerald-400 h-2.5 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, Math.max(5, parseInt(devSpec.printer.tonerLevel, 10) || 20))}%`
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-slate-400 mt-3 pt-2 border-t border-slate-800">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Cartridge Serial:</span>
                      <span className="font-mono text-slate-200">{devSpec.printer.cartridgeSerial || '–'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Hardware Model:</span>
                      <span className="text-slate-200">{banners.webTitle || devSpec.snmp?.model || 'HP LaserJet'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Firmware Datecode:</span>
                      <span className="font-mono text-slate-200">{banners.firmware || '–'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Network Capabilities (DNS-SD / Zeroconf) */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="flex items-center gap-2 mb-3">
                  <Radio className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-xs uppercase font-bold text-slate-300 tracking-wider">
                    Discovered Network Features & Protocols (mDNS / Zeroconf)
                  </h3>
                </div>
                {capabilities.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {capabilities.map((cap, i) => (
                      <span
                        key={i}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-slate-800 border border-cyan-500/20 text-cyan-300"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                        {cap.label || cap}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">
                    No mDNS Zeroconf services (AirPlay/Cast/Spotify) actively advertised during scan.
                  </p>
                )}
              </div>

              {/* Hostname & Network Identity */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5 text-xs">
                  <div className="flex items-center gap-2 mb-2">
                    <Globe className="w-4 h-4 text-cyan-400" />
                    <span className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">
                      Hostnames & Name Resolution
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">NetBIOS Name:</span>
                    <span className="font-mono font-bold text-cyan-300">{names.netbios || '–'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Workgroup / Domain:</span>
                    <span className="font-mono text-slate-200">{names.workgroup || '–'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">mDNS Bonjour Name:</span>
                    <span className="text-slate-200">{names.mdns || '–'}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Web Page Title:</span>
                    <span className="text-slate-200 truncate max-w-[200px]" title={names.webTitle}>
                      {names.webTitle || '–'}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5 text-xs">
                  <div className="flex items-center gap-2 mb-2">
                    <HardDrive className="w-4 h-4 text-cyan-400" />
                    <span className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">
                      Hardware Identity
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Physical MAC:</span>
                    <span className="font-mono text-slate-200">{device.mac}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Hardware Vendor:</span>
                    <span className="text-slate-200 font-semibold">{device.vendor}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Serial Number (SNMP):</span>
                    <span className="font-mono text-cyan-300">{devSpec.snmp?.serialNumber || banners.serialNumber || '–'}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Web Server (Banner):</span>
                    <span className="font-mono text-slate-300 truncate max-w-[200px]" title={banners.httpServer}>
                      {banners.httpServer || '–'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!loading && activeTab === 'os' && (
            <div className="space-y-5">
              <div className="p-5 rounded-xl bg-slate-900/80 border border-cyan-500/30">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs text-cyan-400 font-mono uppercase tracking-wider">
                      Identified Operating System
                    </span>
                    <h3 className="text-xl font-bold text-slate-100 mt-1">
                      {os.osName || 'Unknown Operating System'}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Kernel Family: <span className="font-semibold text-slate-200">{os.osFamily || 'Unknown'}</span> • Confidence: <span className="font-semibold text-emerald-400">{formatConfidence(os.confidence)}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-mono text-sm font-bold inline-block">
                      TTL = {os.ttl || ping.ttl || '–'}
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
                  <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
                    Detection Basis & Heuristics
                  </h4>
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-300 font-mono leading-relaxed">
                    {formatBasis(os.basis)}
                  </div>
                </div>
              </div>

              {/* TTL Fingerprint Reference Card */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs space-y-3">
                <h4 className="font-semibold text-slate-200 uppercase tracking-wider text-[11px]">
                  About ICMP TTL Fingerprinting in VNI
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className={`p-3 rounded-lg border ${ping.ttl <= 64 ? 'bg-cyan-500/10 border-cyan-500/40' : 'bg-slate-950/40 border-slate-800'}`}>
                    <div className="font-bold text-cyan-300 mb-1">TTL ≈ 64</div>
                    <p className="text-slate-400 text-[11px]">
                      Linux, Unix, Android, macOS, iOS, or Raspberry Pi RTOS kernels.
                    </p>
                  </div>
                  <div className={`p-3 rounded-lg border ${ping.ttl > 64 && ping.ttl <= 128 ? 'bg-cyan-500/10 border-cyan-500/40' : 'bg-slate-950/40 border-slate-800'}`}>
                    <div className="font-bold text-cyan-300 mb-1">TTL ≈ 128</div>
                    <p className="text-slate-400 text-[11px]">
                      Microsoft Windows NT kernel (Windows 10, Windows 11, Windows Server).
                    </p>
                  </div>
                  <div className={`p-3 rounded-lg border ${ping.ttl > 128 ? 'bg-cyan-500/10 border-cyan-500/40' : 'bg-slate-950/40 border-slate-800'}`}>
                    <div className="font-bold text-cyan-300 mb-1">TTL ≈ 255</div>
                    <p className="text-slate-400 text-[11px]">
                      Cisco IOS, network switches, or embedded protocol microstacks (e.g. Virata / JetDirect).
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!loading && activeTab === 'ports' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Scanned Diagnostic Ports ({ports.all?.length || 0} total)</span>
                <span className="font-semibold text-cyan-400">
                  {ports.openCount || ports.open?.length || 0} open ports identified
                </span>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 text-[11px] uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="py-2.5 px-4">Port</th>
                      <th className="py-2.5 px-4">Service</th>
                      <th className="py-2.5 px-4">Category</th>
                      <th className="py-2.5 px-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {ports.all?.map((p, i) => (
                      <tr key={i} className={p.open ? 'bg-cyan-500/5' : 'opacity-60'}>
                        <td className="py-2.5 px-4 font-bold text-slate-200">
                          {p.port}
                        </td>
                        <td className="py-2.5 px-4 font-sans text-slate-300 font-medium">
                          {p.service}
                        </td>
                        <td className="py-2.5 px-4 font-sans text-slate-400">
                          {p.category}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          {p.open ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              Open
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] text-slate-500 bg-slate-800/40">
                              Closed
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!loading && activeTab === 'hardware' && (
            <div className="space-y-4">
              {/* SNMP System Description */}
              {devSpec.snmp && (
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Server className="w-4 h-4 text-cyan-400" />
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                      SNMP MIB-II Description (Community: public)
                    </h4>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950 font-mono text-xs text-slate-300 break-all border border-slate-800">
                    {devSpec.snmp.sysDescr}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-xs">
                    <div>
                      <span className="text-slate-500 text-[10px] block">Model:</span>
                      <span className="font-semibold text-slate-200">{devSpec.snmp.model || '–'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Serial Number:</span>
                      <span className="font-mono text-cyan-300">{devSpec.snmp.serialNumber || '–'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Firmware Code:</span>
                      <span className="font-mono text-slate-200">{devSpec.snmp.firmware || '–'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">SNMP Uptime:</span>
                      <span className="font-semibold text-emerald-300">{uptime?.formatted || '–'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Web Banner Details */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="w-4 h-4 text-cyan-400" />
                  <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">
                    Web Server & Banner Grabbing
                  </h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-400 block mb-1">Server: Header</span>
                    <div className="p-2 rounded bg-slate-950 font-mono text-slate-300 border border-slate-800">
                      {banners.httpServer || 'No Server header returned'}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-1">HTML Page Title</span>
                    <div className="p-2 rounded bg-slate-950 font-mono text-slate-300 border border-slate-800">
                      {banners.webTitle || 'No title tag found'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Cast / Google details if present */}
              {devSpec.cast && (
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center gap-2 mb-2">
                    <Tv className="w-4 h-4 text-cyan-400" />
                    <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">
                      Google Cast / Eureka API Specification
                    </h4>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div>
                      <span className="text-slate-500 text-[10px] block">Cast Model:</span>
                      <span className="text-slate-200 font-semibold">{devSpec.cast.modelName || '–'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Build Version:</span>
                      <span className="font-mono text-cyan-300">{devSpec.cast.buildVersion || '–'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Release Track:</span>
                      <span className="font-mono text-slate-200">{devSpec.cast.releaseTrack || '–'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Wi-Fi Network (SSID):</span>
                      <span className="text-slate-200">{devSpec.cast.ssid || '–'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {!loading && activeTab === 'raw' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Full JSON diagnostic object for {device.ip}
                </span>
                <button
                  onClick={handleCopyJson}
                  className="flex items-center gap-1.5 px-3 py-1 text-xs rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied!' : 'Copy JSON'}
                </button>
              </div>
              <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 font-mono text-[11px] text-cyan-300/90 overflow-x-auto max-h-[500px]">
                {JSON.stringify(inspectData || device, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800/80 bg-slate-900/60 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>VNI Deep Device Profiler • 12/12 Standard Methods</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
