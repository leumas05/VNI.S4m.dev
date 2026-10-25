import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  HelpCircle,
  Network,
  Zap,
  RefreshCw,
  Radio,
  Cpu,
  Power,
  Globe,
  FileCode,
  Activity,
  Edit2,
  ShieldCheck,
  ShieldAlert,
  Lock,
  GitFork,
  Disc,
  Clock,
  Sparkles,
  CheckCircle2,
  Layers
} from 'lucide-react';

export default function LanGuideModal({ isOpen, onClose, initialTab = 'discovery' }) {
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const tabs = [
    { id: 'discovery', label: 'How Scanning Works', icon: Radio },
    { id: 'actions', label: 'Buttons & Tools', icon: Zap },
    { id: 'badges', label: 'Badges & Security', icon: ShieldCheck },
    { id: 'topology', label: 'Topology Map', icon: GitFork }
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-emerald-500/30 rounded-2xl max-w-4xl w-full max-h-[88vh] flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.9)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950/90 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              <HelpCircle size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  LAN Intelligence & Scanner Guide
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-950 border border-emerald-500/40 text-emerald-300">
                  REFERENCE MANUAL
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Complete guide to discovery protocols, active network tools, security scoring, and topology controls
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-red-950/60 text-slate-400 hover:text-red-300 border border-slate-700 hover:border-red-500/40 transition cursor-pointer"
            title="Close Guide (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 px-6 py-2.5 bg-slate-950/60 border-b border-slate-800/80 overflow-x-auto shrink-0">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                <Icon size={14} className={active ? 'text-emerald-400' : 'text-slate-400'} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar text-slate-300 text-xs leading-relaxed">
          {/* TAB 1: HOW SCANNING WORKS */}
          {activeTab === 'discovery' && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-cyan-950/30 border border-emerald-500/30">
                <div className="flex items-start gap-3">
                  <Sparkles size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-bold text-white mb-1">
                      Multi-Layer Local Network Discovery Engine
                    </h3>
                    <p className="text-slate-300 text-xs leading-relaxed">
                      Modern operating systems (Windows 11, iOS, Android) often block traditional ping requests or randomize their Wi-Fi MAC addresses. VNI combines <strong>active subnet probing</strong> with a <strong>24/7 passive multicast listener</strong> to uncover every device and identify its true hardware, OS, and services.
                    </p>
                  </div>
                </div>
              </div>

              {/* Top Toolbar Buttons Explained */}
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                  <Layers size={13} className="text-emerald-400" />
                  <span>Top Scanner Controls</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-[11px] inline-flex items-center gap-1.5">
                          <RefreshCw size={12} className="text-emerald-400" /> Scan
                        </span>
                        <span className="text-[10px] font-mono text-emerald-400">~200–800 ms</span>
                      </div>
                      <p className="text-slate-400 text-[11px]">
                        <strong>Quick ARP & Cache Scan:</strong> Reads your computer&apos;s existing ARP table (<code className="text-slate-200">arp -a</code>) and merges all background multicast data without flooding the network. Ideal for instant refreshes.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950/80 border border-emerald-500/30 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-1 rounded-lg bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 font-bold text-[11px] inline-flex items-center gap-1.5">
                          <Zap size={12} className="text-emerald-400" /> Deep Sweep
                        </span>
                        <span className="text-[10px] font-mono text-sky-400">~3–9 sec</span>
                      </div>
                      <p className="text-slate-400 text-[11px]">
                        <strong>Full Subnet Active Sweep:</strong> Actively pings all 254 IPs (<code className="text-slate-200">.1</code> to <code className="text-slate-200">.254</code>), performs TCP port knocking, and fires mDNS, SSDP, and WS-Discovery multicast bursts to wake up silent phones, TVs, and IoT devices.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 font-semibold text-[11px] inline-flex items-center gap-1.5">
                          <Radio size={12} /> Auto-Refresh
                        </span>
                        <span className="text-[10px] font-mono text-amber-400">Every 10s</span>
                      </div>
                      <p className="text-slate-400 text-[11px]">
                        <strong>Live Continuous Monitor:</strong> Automatically rescans the LAN every 10 seconds. Keeping this enabled builds a rolling latency history and unlocks the <strong>Live Sparkline &amp; Jitter (±ms)</strong> graph on every device card.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Background Protocols Table */}
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                  <Network size={13} className="text-cyan-400" />
                  <span>Permanent Background Discovery Protocols (Always Listening)</span>
                </h4>
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900/90 text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                        <th className="py-2.5 px-4">Protocol</th>
                        <th className="py-2.5 px-4">Port / Multicast</th>
                        <th className="py-2.5 px-4">What It Discovers</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-[11px]">
                      <tr>
                        <td className="py-2.5 px-4 font-bold text-indigo-300">mDNS / Bonjour</td>
                        <td className="py-2.5 px-4 font-mono text-slate-400">UDP 5353 (224.0.0.251)</td>
                        <td className="py-2.5 px-4 text-slate-300">Apple iPhones/Macs, Google Cast, Android TV, Spotify Connect, AirPlay, HomeKit, Printers</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-4 font-bold text-sky-300">SSDP / UPnP</td>
                        <td className="py-2.5 px-4 font-mono text-slate-400">UDP 1900 (239.255.255.250)</td>
                        <td className="py-2.5 px-4 text-slate-300">Routers, Smart TVs, Sonos/Media Renderers, Game Consoles, XML Device Descriptions</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-4 font-bold text-cyan-300">WS-Discovery (WSD)</td>
                        <td className="py-2.5 px-4 font-mono text-slate-400">UDP 3702 (239.255.255.250)</td>
                        <td className="py-2.5 px-4 text-slate-300">Modern Windows 10/11 Laptops (Surface, PCs), Network Scanners, ONVIF Security Cameras</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-4 font-bold text-emerald-300">LLMNR &amp; NetBIOS</td>
                        <td className="py-2.5 px-4 font-mono text-slate-400">UDP 5355 &amp; UDP 137</td>
                        <td className="py-2.5 px-4 text-slate-300">Windows Workgroup names, Computer hostnames, Linux Samba servers, NAS units</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-4 font-bold text-amber-300">Passive DHCP</td>
                        <td className="py-2.5 px-4 font-mono text-slate-400">UDP 67 / 68 Broadcast</td>
                        <td className="py-2.5 px-4 text-slate-300">Captures Option 12 (Hostname) and Option 60 (Vendor Class e.g. <code className="text-amber-200">android-dhcp</code>, <code className="text-amber-200">MSFT 5.0</code>) when devices join Wi-Fi</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-4 font-bold text-purple-300">TLS / X.509 Probe</td>
                        <td className="py-2.5 px-4 font-mono text-slate-400">TCP 443, 8443, 8009</td>
                        <td className="py-2.5 px-4 text-slate-300">Extracts hardware serials, Common Names (CN), and Organization from local HTTPS &amp; Cast SSL certificates</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: BUTTONS & ACTIVE TOOLS */}
          {activeTab === 'actions' && (
            <div className="space-y-4">
              <p className="text-slate-400 text-xs">
                Every device card in the list and on the topology map provides one-click diagnostic buttons. Here is what each action does:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Inspect */}
                <div className="p-4 rounded-xl bg-slate-950/80 border border-cyan-500/30 flex gap-3">
                  <div className="shrink-0 mt-0.5">
                    <span className="px-2 py-1 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-semibold text-[11px] inline-flex items-center gap-1">
                      <Cpu size={12} className="text-cyan-400" /> Inspect
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white mb-1">Deep Device Inspector &amp; Port Scanner</h4>
                    <p className="text-[11px] text-slate-400">
                      Runs an intensive 12-method live audit on the target IP: queries SNMP v1/v2c OIDs, NetBIOS node status, SMB2 dialect, HTTP/SSH banners, OS TTL signature, and TLS certificates. Also includes an interactive <strong>Top 100 / Custom Range TCP Port Scanner</strong> under the <em>Open Ports</em> tab.
                    </p>
                  </div>
                </div>

                {/* Wake-on-LAN */}
                <div className="p-4 rounded-xl bg-slate-950/80 border border-amber-500/30 flex gap-3">
                  <div className="shrink-0 mt-0.5">
                    <span className="px-2 py-1 rounded bg-amber-950/80 border border-amber-500/40 text-amber-300 font-semibold text-[11px] inline-flex items-center gap-1">
                      <Power size={12} className="text-amber-400" /> Wake
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white mb-1">Wake-on-LAN (WoL Magic Packet)</h4>
                    <p className="text-[11px] text-slate-400">
                      Broadcasts an IEEE 802.3 Magic Packet (<code className="text-slate-300">6x 0xFF</code> followed by 16 repetitions of the device&apos;s MAC address) over UDP ports 9 and 7. Wakes up sleeping desktop PCs, NAS servers, and media boxes that support WoL.
                    </p>
                  </div>
                </div>

                {/* Web Portal */}
                <div className="p-4 rounded-xl bg-slate-950/80 border border-emerald-500/30 flex gap-3">
                  <div className="shrink-0 mt-0.5">
                    <span className="px-2 py-1 rounded bg-emerald-950 border border-emerald-500/40 text-emerald-300 font-semibold text-[11px] inline-flex items-center gap-1">
                      <Globe size={12} className="text-emerald-400" /> Web Portal
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white mb-1">Open Local Admin / Web UI</h4>
                    <p className="text-[11px] text-slate-400">
                      Appears automatically whenever VNI detects an open HTTP/HTTPS web interface on the device (e.g. ports <code className="text-slate-300">80, 443, 8080, 8443, 5000, 8123, 32400</code>). Clicking it opens the device&apos;s dashboard in a new browser tab.
                    </p>
                  </div>
                </div>

                {/* mDNS */}
                <div className="p-4 rounded-xl bg-slate-950/80 border border-indigo-500/30 flex gap-3">
                  <div className="shrink-0 mt-0.5">
                    <span className="px-2 py-1 rounded bg-indigo-950 border border-indigo-500/40 text-indigo-300 font-semibold text-[11px] inline-flex items-center gap-1">
                      <Radio size={12} className="text-indigo-400" /> mDNS
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white mb-1">mDNS / Bonjour Service Inspector</h4>
                    <p className="text-[11px] text-slate-400">
                      Opens a modal displaying all Zeroconf / Bonjour services advertised by the device (such as Google Cast, Spotify Connect, AirPlay, HomeKit), including their TCP/UDP ports and raw DNS TXT key-value records.
                    </p>
                  </div>
                </div>

                {/* XML */}
                <div className="p-4 rounded-xl bg-slate-950/80 border border-sky-500/30 flex gap-3">
                  <div className="shrink-0 mt-0.5">
                    <span className="px-2 py-1 rounded bg-sky-950 border border-sky-500/40 text-sky-300 font-semibold text-[11px] inline-flex items-center gap-1">
                      <FileCode size={12} className="text-sky-400" /> XML
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white mb-1">UPnP / SSDP XML Manifest Viewer</h4>
                    <p className="text-[11px] text-slate-400">
                      Fetches and formats the raw UPnP XML description file from devices that respond to SSDP discovery (routers, smart TVs, media speakers), revealing exact model numbers, firmware versions, and service endpoints.
                    </p>
                  </div>
                </div>

                {/* Ping & Name */}
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex gap-3">
                  <div className="shrink-0 mt-0.5 flex flex-col gap-1.5">
                    <span className="px-2 py-1 rounded bg-slate-800 text-emerald-400 font-semibold text-[11px] inline-flex items-center gap-1">
                      <Activity size={12} /> Ping
                    </span>
                    <span className="px-2 py-1 rounded bg-slate-800 text-amber-300 font-semibold text-[11px] inline-flex items-center gap-1">
                      <Edit2 size={12} /> Name
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white mb-1">Live Ping Stream &amp; Custom Nicknames</h4>
                    <p className="text-[11px] text-slate-400">
                      <strong>Ping:</strong> Opens a real-time continuous ICMP ping chart to measure micro-spikes and packet loss.<br />
                      <strong>Name:</strong> Saves a custom friendly label (tied to the device&apos;s MAC address) in local storage so you always recognize your devices.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: BADGES, SECURITY & TELEMETRY */}
          {activeTab === 'badges' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-950 border border-emerald-500/40 text-emerald-300">
                      SEC A+
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-950 border border-amber-500/40 text-amber-300">
                      SEC B
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-950 border border-red-500/50 text-red-300">
                      SEC D
                    </span>
                    <span className="text-xs font-bold text-white ml-1">Automated Security Grade</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Each device is scored from <strong>0 to 100</strong> (<code className="text-slate-300">A+</code> down to <code className="text-slate-300">D</code>) based on exposed services. Risky open ports like <strong>Telnet (23)</strong>, <strong>FTP (21)</strong>, <strong>SMB (445)</strong>, <strong>RDP (3389)</strong>, or unencrypted <strong>HTTP (80)</strong> reduce the score. Click <strong>Inspect ➔ Security &amp; TLS</strong> for full remediation details.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-950/80 border border-purple-500/40 text-purple-300">
                      PRIVATE MAC
                    </span>
                    <span className="text-xs font-bold text-white ml-1">Randomized Wi-Fi MAC Address</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Modern iPhones, Samsung Galaxy phones, and Windows laptops use <em>Locally Administered MAC Addresses</em> (where the 2nd hex character is <code className="text-purple-300">2, 6, A, or E</code>) to hide the hardware manufacturer. VNI detects this automatically and uses OS TTL, DHCP, mDNS, and WSD to identify the device anyway.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-950/80 border border-emerald-500/40 text-emerald-300">
                      ⚡3
                    </span>
                    <span className="text-xs font-bold text-white ml-1">Active Local Sockets (Live Traffic)</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Cross-references your computer&apos;s live socket table (<code className="text-slate-300">netstat</code>) with LAN IPs. Shows how many active TCP/UDP connections your PC currently has open to that device, and animates glowing green packets along its link in the Topology Map.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-950 border border-amber-400/50 text-amber-300">
                      NEW
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-slate-900 border border-slate-700 text-slate-400">
                      OFFLINE
                    </span>
                    <span className="text-xs font-bold text-white ml-1">Presence History &amp; Offline Devices</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    VNI remembers every MAC address seen on your LAN. Newly discovered devices get a <strong>NEW</strong> badge, while previously seen devices that are currently powered off appear in the collapsible <strong>Offline Known Devices</strong> drawer at the bottom of the scanner list (ready for Wake-on-LAN).
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 border border-slate-700 text-emerald-400">
                      📈 ±2ms • 11 ms
                    </span>
                    <span className="text-xs font-bold text-white ml-1">Latency Sparkline &amp; Jitter</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    After 2 or more scans (or when <strong>Auto-Refresh</strong> is enabled), a mini sparkline graph appears next to the ping time showing rolling latency stability and <strong>Jitter (`±ms`)</strong>. High jitter on Wi-Fi devices indicates weak signal strength or channel congestion.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-red-950/30 border border-red-500/40 space-y-2">
                  <div className="flex items-center gap-2">
                    <ShieldAlert size={15} className="text-red-400" />
                    <span className="text-xs font-bold text-red-200">ARP Spoofing &amp; MITM Protection</span>
                  </div>
                  <p className="text-[11px] text-red-200/80">
                    VNI monitors your Default Gateway&apos;s hardware MAC address across scans. If another device on the LAN impersonates the router (<code className="text-red-300">GATEWAY_MAC_CHANGED</code>) or two IPs claim the same MAC (<code className="text-red-300">DUPLICATE_MAC</code>), a high-priority security alert banner is displayed immediately.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: TOPOLOGY MAP */}
          {activeTab === 'topology' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                    <GitFork size={15} />
                    <span>Tree View (Multi-Tier Mesh Hierarchy)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Organizes your network into up to <strong>4 logical tiers</strong> from top to bottom:
                  </p>
                  <ol className="list-decimal list-inside text-[11px] text-slate-300 space-y-1 pt-1">
                    <li><strong className="text-indigo-300">Internet (WAN):</strong> External global uplink.</li>
                    <li><strong className="text-emerald-300">Primary Gateway Router:</strong> Your main router / firewall (e.g. <code className="text-slate-400">.1</code>).</li>
                    <li><strong className="text-teal-300">Mesh Nodes / Access Points:</strong> Automatically groups Wi-Fi mesh satellites (e.g. TP-Link Deco units) into an intermediate distribution layer.</li>
                    <li><strong className="text-sky-300">Endpoint Clients:</strong> PCs, phones, TVs, and IoT devices arranged in clean multi-row grids.</li>
                  </ol>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs">
                    <Disc size={15} />
                    <span>Radial View (360° Star Topology)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Places your Default Gateway Router at the exact center of the canvas and arranges all connected client devices in a 360-degree orbit around it.
                  </p>
                  <ul className="list-disc list-inside text-[11px] text-slate-300 space-y-1 pt-1">
                    <li><strong>Solid Colored Lines:</strong> Active / responding devices.</li>
                    <li><strong>Dashed Lines:</strong> Silent / firewall-filtered devices in ARP cache.</li>
                    <li><strong>Animated Green Dots:</strong> Live TCP/UDP socket traffic flowing between your PC and that node.</li>
                  </ul>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                <h4 className="text-xs font-bold text-white mb-2 flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-400" />
                  <span>Canvas Navigation &amp; Shortcuts</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] text-slate-400">
                  <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800/80">
                    <strong className="text-slate-200 block mb-0.5">Pan Canvas</strong>
                    Click and drag anywhere on the dark background grid to move around large networks.
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800/80">
                    <strong className="text-slate-200 block mb-0.5">Zoom In / Out</strong>
                    Scroll your mouse wheel anywhere on the map (35% to 250%) or use the top-right <code className="text-slate-300">+</code> / <code className="text-slate-300">-</code> buttons.
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800/80">
                    <strong className="text-slate-200 block mb-0.5">Inspect from Node</strong>
                    Click any node card to open its quick-action bar, or click the cyan <strong className="text-cyan-300">Inspect</strong> badge directly inside the node card.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Tip: Hover over any button or badge in the interface to see a quick tooltip summary.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer"
          >
            Got It
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

