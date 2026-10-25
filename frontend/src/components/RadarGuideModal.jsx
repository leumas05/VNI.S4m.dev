import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X, HelpCircle, Radio, ShieldCheck, ShieldAlert, Lock, Eye,
  Activity, Terminal, Globe, Cpu, Layers, Copy, Download
} from 'lucide-react';

export default function RadarGuideModal({ onClose }) {
  const [activeTab, setActiveTab] = useState('how-it-works');

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150 font-sans"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      <div className="bg-gray-950 border border-gray-800 rounded-2xl w-full max-w-3xl max-h-[88vh] flex flex-col shadow-2xl shadow-black/90 overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-800 bg-gray-900/50 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-400">
              <Radio size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Live Connection Radar Guide
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/40 text-emerald-300">
                  Interactive Manual
                </span>
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Understand how real-time socket tracking, DNS cache correlation, and security badges work
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-400 hover:text-white transition cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 px-5 pt-3 border-b border-gray-800 bg-gray-900/20 text-xs overflow-x-auto shrink-0">
          {[
            { id: 'how-it-works', label: 'How Radar Works', icon: <Cpu size={13} /> },
            { id: 'badges', label: 'Protocols & Security Badges', icon: <ShieldCheck size={13} /> },
            { id: 'tools', label: 'Tools & Actions', icon: <Activity size={13} /> }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2.5 rounded-t-lg font-medium flex items-center gap-2 border-b-2 transition cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-emerald-400 text-emerald-300 bg-emerald-950/30 font-semibold'
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-900/40'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs text-gray-300 custom-scrollbar">
          {activeTab === 'how-it-works' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30">
                <h3 className="text-sm font-bold text-emerald-300 mb-1.5 flex items-center gap-2">
                  <Radio size={15} /> Real-Time OS Socket & Process Engine
                </h3>
                <p className="text-gray-300 leading-relaxed">
                  Live Connection Radar polls your operating system&apos;s active network stack (<code className="text-emerald-300 font-mono">netstat -ano</code> / <code className="text-emerald-300 font-mono">ss</code>) every 4 seconds and correlates every open socket with its owning application process (<code className="text-emerald-300 font-mono">PID</code>), local DNS resolver cache, and GeoIP coordinates.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-gray-900/60 border border-gray-800">
                  <div className="font-bold text-white mb-1 flex items-center gap-2">
                    <Globe size={14} className="text-sky-400" />
                    <span>DNS Cache & Reverse PTR Mapping</span>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Instead of showing raw CDN IP addresses, Radar inspects your OS DNS Resolver Cache (<code className="text-sky-300 font-mono">ipconfig /displaydns</code>) and performs asynchronous Reverse DNS (<code className="text-sky-300 font-mono">PTR</code>) lookups to reveal the exact domain name an application requested.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-gray-900/60 border border-gray-800">
                  <div className="font-bold text-white mb-1 flex items-center gap-2">
                    <Layers size={14} className="text-purple-400" />
                    <span>TCP + Connected UDP (QUIC / HTTP3)</span>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Modern browsers and voice apps use <span className="text-purple-300 font-semibold">UDP</span> for <span className="text-purple-300 font-semibold">QUIC / HTTP3</span> (port 443), WebRTC voice/video calls, and gaming. Radar captures both <code className="font-mono text-emerald-300">ESTABLISHED</code> TCP sockets and connected UDP endpoints.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-gray-900/60 border border-gray-800">
                  <div className="font-bold text-white mb-1 flex items-center gap-2">
                    <Activity size={14} className="text-emerald-400" />
                    <span>Session Duration & NEW Badges</span>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Radar tracks when each socket first appeared during your session, displaying a live duration timer (<code className="font-mono text-gray-200">⏱ 3m 12s</code>) and highlighting newly opened connections with a <span className="px-1.5 py-0.2 rounded bg-emerald-950 border border-emerald-500/40 text-emerald-300 font-mono text-[10px]">NEW</span> badge.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-gray-900/60 border border-gray-800">
                  <div className="font-bold text-white mb-1 flex items-center gap-2">
                    <ShieldCheck size={14} className="text-amber-400" />
                    <span>Self-Noise Filtering (Hide VNI)</span>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    By default, Radar hides VNI&apos;s own internal background connections so you only see external applications. You can toggle <span className="text-white font-semibold">Hide app connections (VNI)</span> anytime.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'badges' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-gray-900/60 border border-gray-800 space-y-2.5">
                <h4 className="font-bold text-white text-xs uppercase tracking-wider text-gray-400">
                  Security & Privacy Badges
                </h4>
                <div className="grid grid-cols-1 gap-2.5">
                  <div className="flex items-start gap-3 p-2.5 rounded-lg bg-gray-950/80 border border-emerald-500/20">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 flex items-center gap-1 shrink-0">
                      <Lock size={10} /> TLS / QUIC Encrypted
                    </span>
                    <p className="text-[11px] text-gray-400">
                      Traffic is encrypted using TLS (HTTPS on port 443/8443), QUIC/HTTP3 (UDP 443), SSH, or DNS-over-TLS. Payload contents cannot be read in transit.
                    </p>
                  </div>

                  <div className="flex items-start gap-3 p-2.5 rounded-lg bg-gray-950/80 border border-amber-500/20">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950/80 border border-amber-500/40 text-amber-300 flex items-center gap-1 shrink-0">
                      <Eye size={10} /> Telemetry / Analytics
                    </span>
                    <p className="text-[11px] text-gray-400">
                      The destination domain matches known OS, browser, or application telemetry, diagnostics, or ad-tracking endpoints (e.g. Microsoft Vortex, Google Analytics, Sentry).
                    </p>
                  </div>

                  <div className="flex items-start gap-3 p-2.5 rounded-lg bg-gray-950/80 border border-red-500/20">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-950/80 border border-red-500/40 text-red-300 flex items-center gap-1 shrink-0">
                      <ShieldAlert size={10} /> Unencrypted (Cleartext)
                    </span>
                    <p className="text-[11px] text-gray-400">
                      Connection uses unencrypted plaintext protocols such as port <code className="font-mono text-red-300">:80 (HTTP)</code>, <code className="font-mono text-red-300">:21 (FTP)</code>, or <code className="font-mono text-red-300">:23 (Telnet)</code>.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-gray-900/60 border border-gray-800 space-y-2">
                <h4 className="font-bold text-white text-xs uppercase tracking-wider text-gray-400">
                  Domain Resolution Indicators
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="p-2.5 rounded-lg bg-gray-950/80 border border-gray-800">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-sky-950/80 border border-sky-500/40 text-sky-300 font-bold">
                      DNS
                    </span>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Exact domain name matched directly from your local OS DNS resolver cache (<code className="font-mono">ipconfig /displaydns</code>).
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-gray-950/80 border border-gray-800">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-indigo-950/80 border border-indigo-500/40 text-indigo-300 font-bold">
                      PTR
                    </span>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Server hostname resolved via Reverse DNS (<code className="font-mono">in-addr.arpa</code> PTR record) when not present in the local DNS cache.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'tools' && (
            <div className="space-y-2.5">
              {[
                {
                  title: 'Trace Route (1-Click Route Visualization)',
                  badge: 'Trace',
                  color: 'text-amber-300 border-amber-500/40 bg-amber-950/60',
                  desc: 'Immediately switches to Traceroute mode and traces every intermediate router hop between your PC and the remote server or domain.'
                },
                {
                  title: 'View Mode: Flat List vs. Grouped by App',
                  badge: 'Grouped / List',
                  color: 'text-purple-300 border-purple-500/40 bg-purple-950/60',
                  desc: 'Group connections by application (e.g. chrome.exe, spotify.exe, discord.exe) to see total sockets, countries, and telemetry per app without list clutter.'
                },
                {
                  title: 'Live Latency Ping',
                  badge: 'Ping',
                  color: 'text-emerald-300 border-emerald-500/40 bg-emerald-950/60',
                  desc: 'Opens the real-time ICMP/TCP latency graph to measure round-trip time, jitter, and packet loss to the remote IP.'
                },
                {
                  title: 'DNS (DiG) & SSL Certificate Inspector',
                  badge: 'DiG / SSL',
                  color: 'text-sky-300 border-sky-500/40 bg-sky-950/60',
                  desc: 'Query authoritative DNS records or inspect the remote server’s X.509 TLS certificate chain, issuer, SANs, and expiration date.'
                },
                {
                  title: 'Copy Endpoint & Export Radar Snapshot',
                  badge: 'Copy / Export JSON',
                  color: 'text-gray-300 border-gray-700 bg-gray-900',
                  desc: 'Copy any IP/domain to your clipboard or download a complete JSON snapshot of all active connections for auditing.'
                }
              ].map((item, i) => (
                <div key={i} className="p-3 rounded-xl bg-gray-900/60 border border-gray-800 flex items-start justify-between gap-3">
                  <div>
                    <div className="font-bold text-white text-xs mb-0.5">{item.title}</div>
                    <p className="text-[11px] text-gray-400 leading-relaxed">{item.desc}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border shrink-0 ${item.color}`}>
                    {item.badge}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-800 bg-gray-900/50 flex items-center justify-between text-[11px] text-gray-400 shrink-0">
          <span>Tip: Click any connection card in Radar to highlight its arc on the 2D Map or 3D Globe.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition cursor-pointer"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

