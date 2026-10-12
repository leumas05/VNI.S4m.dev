import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  Router,
  Laptop,
  Smartphone,
  Cpu,
  Tv,
  Server,
  Wifi,
  Cloud,
  ZoomIn,
  ZoomOut,
  Compass,
  Activity,
  Copy,
  Check,
  Share2,
  CircleDot,
  ExternalLink,
  FileCode,
  Radio,
  Printer,
  Zap,
  Sun,
  Gamepad2,
  Globe
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
      return '#ec4899'; // Pink
    case 'printer':
      return '#0ea5e9'; // Sky Blue
    case 'ev_charger':
      return '#eab308'; // Amber / EV Charger
    case 'solar':
      return '#f59e0b'; // Amber / Solar
    case 'iot':
    case 'smart_home':
      return '#f59e0b'; // Amber
    case 'tv':
      return '#a855f7'; // Purple
    case 'console':
      return '#8b5cf6'; // Violet
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

export default function LanTopologyView({
  lanData,
  selectedDevice,
  setSelectedDevice,
  onPing,
  apiBase
}) {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 1000, height: 700 });
  const [layoutMode, setLayoutMode] = useState('tree'); // 'tree' | 'radial'
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [copiedId, setCopiedId] = useState(null);
  const [xmlModalDevice, setXmlModalDevice] = useState(null);
  const [mdnsModalDevice, setMdnsModalDevice] = useState(null);
  const [inspectModalDevice, setInspectModalDevice] = useState(null);
  const [nicknames, setNicknames] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('vni_lan_nicknames')) || {};
    } catch (e) {
      return {};
    }
  });

  // Listen for storage changes if nicknames are updated in sidebar panel
  useEffect(() => {
    const handleStorage = () => {
      try {
        setNicknames(JSON.parse(localStorage.getItem('vni_lan_nicknames')) || {});
      } catch (e) {}
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Auto-measure container dimensions
  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth || 1000,
          height: containerRef.current.clientHeight || 700
        });
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Pan interaction
  const handleMouseDown = (e) => {
    if (e.button !== 0) return; // Only left-click
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  }, [isDragging, dragStart]);

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1.12 : 0.88;
    setZoom((prev) => Math.min(2.5, Math.max(0.4, prev * delta)));
  };

  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const copyToClipboard = (text, id) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const gateway = lanData?.gateway;
  const thisDevice = lanData?.thisDevice;
  const clientDevices = useMemo(() => lanData?.devices || [], [lanData]);

  // Calculate layout coordinates for nodes
  const layoutNodes = useMemo(() => {
    const { width, height } = dimensions;
    const centerX = width / 2;
    const nodes = [];
    const links = [];

    if (!gateway) return { nodes: [], links: [] };

    if (layoutMode === 'tree') {
      // 1. WAN Cloud (Root Top)
      const wanY = 70;
      nodes.push({
        id: 'wan-cloud',
        x: centerX,
        y: wanY,
        type: 'cloud',
        title: 'Internet (WAN)',
        subtitle: 'Global Uplink',
        color: '#6366f1',
        icon: Cloud
      });

      // 2. Router / Gateway (Tier 1)
      const routerY = 175;
      nodes.push({
        ...gateway,
        x: centerX,
        y: routerY,
        isGateway: true
      });

      // Link: WAN -> Router
      links.push({
        from: { x: centerX, y: wanY + 25 },
        to: { x: centerX, y: routerY - 30 },
        color: '#6366f1',
        isMainTrunk: true,
        isAlive: true
      });

      // 3. All client devices connected directly to Router
      const allClients = [];
      if (thisDevice) allClients.push(thisDevice);
      clientDevices.forEach(d => allClients.push(d));

      const total = allClients.length;
      if (total > 0) {
        // Balanced columns so cards NEVER overlap
        // Target balanced rows with 4 to 5 cards per row
        const targetRowCount = Math.max(1, Math.ceil(total / 5));
        const cols = Math.ceil(total / targetRowCount);
        const rows = Math.ceil(total / cols);

        const CARD_WIDTH = 188;
        const MIN_GAP_X = 28;
        // Guaranteed minimum spacing (216px) ensures cards NEVER touch or overlap
        const colSpacing = Math.max(CARD_WIDTH + MIN_GAP_X, Math.min(240, (width - 120) / (cols || 1)));
        const startY = 320;
        const rowSpacing = 135;

        allClients.forEach((dev, idx) => {
          const row = Math.floor(idx / cols);
          const colInRow = idx % cols;
          const itemsInThisRow = (row === rows - 1 && total % cols !== 0) ? (total % cols) : cols;
          const rowStartX = centerX - ((itemsInThisRow - 1) * colSpacing) / 2;
          const nodeX = rowStartX + colInRow * colSpacing;
          const nodeY = startY + row * rowSpacing;

          nodes.push({
            ...dev,
            x: nodeX,
            y: nodeY
          });

          // Link: Router -> Client
          links.push({
            from: { x: centerX, y: routerY + 35 },
            to: { x: nodeX, y: nodeY - 35 },
            color: getDeviceColor(dev.deviceType, dev.isThisDevice, dev.isGateway),
            isThisDevice: dev.isThisDevice,
            isAlive: dev.isAlive
          });
        });
      }
    } else {
      // Radial Hub-and-Spoke Layout
      const centerY = height / 2;

      // Router in center
      nodes.push({
        ...gateway,
        x: centerX,
        y: centerY,
        isGateway: true
      });

      // WAN Cloud placed above
      const wanDist = 180;
      nodes.push({
        id: 'wan-cloud',
        x: centerX,
        y: centerY - wanDist,
        type: 'cloud',
        title: 'Internet (WAN)',
        subtitle: 'Global Uplink',
        color: '#6366f1',
        icon: Cloud
      });

      links.push({
        from: { x: centerX, y: centerY - 35 },
        to: { x: centerX, y: centerY - wanDist + 25 },
        color: '#6366f1',
        isMainTrunk: true,
        isAlive: true
      });

      const allClients = [];
      if (thisDevice) allClients.push(thisDevice);
      clientDevices.forEach(d => allClients.push(d));

      const total = allClients.length;
      const useDualOrbit = total > 8;
      const baseRadius = Math.max(260, Math.min(340, width * 0.28));

      allClients.forEach((dev, idx) => {
        const isOuter = useDualOrbit && (idx % 2 === 1);
        const radiusX = isOuter ? baseRadius + 160 : baseRadius;
        const radiusY = isOuter ? (baseRadius + 160) * 0.76 : baseRadius * 0.76;

        const angle = (idx / (total || 1)) * (2 * Math.PI) - Math.PI / 2 + 0.25;
        const nodeX = centerX + Math.cos(angle) * radiusX;
        const nodeY = centerY + Math.sin(angle) * radiusY;

        nodes.push({
          ...dev,
          x: nodeX,
          y: nodeY
        });

        links.push({
          from: { x: centerX, y: centerY },
          to: { x: nodeX, y: nodeY },
          color: getDeviceColor(dev.deviceType, dev.isThisDevice, dev.isGateway),
          isThisDevice: dev.isThisDevice,
          isAlive: dev.isAlive
        });
      });
    }

    return { nodes, links };
  }, [dimensions, layoutMode, gateway, thisDevice, clientDevices]);

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      className="relative w-full h-full bg-[#070b14] overflow-hidden select-none cursor-grab active:cursor-grabbing"
      style={{
        backgroundImage: `
          radial-gradient(circle at 50% 50%, rgba(16, 185, 129, 0.05) 0%, transparent 60%),
          linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px)
        `,
        backgroundSize: '100% 100%, 40px 40px, 40px 40px'
      }}
    >
      {/* SVG Canvas for Topology Graph */}
      <svg
        className="w-full h-full pointer-events-auto"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
          transition: isDragging ? 'none' : 'transform 0.1s ease-out'
        }}
      >
        <defs>
          <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Ambient radial rings if in radial mode */}
        {layoutMode === 'radial' && (
          <g opacity={0.15}>
            <circle cx={dimensions.width / 2} cy={dimensions.height / 2} r={120} fill="none" stroke="#10b981" strokeWidth="1" strokeDasharray="4 6" />
            <circle cx={dimensions.width / 2} cy={dimensions.height / 2} r={220} fill="none" stroke="#38bdf8" strokeWidth="1" strokeDasharray="6 8" />
            <circle cx={dimensions.width / 2} cy={dimensions.height / 2} r={320} fill="none" stroke="#6366f1" strokeWidth="1" strokeDasharray="8 10" />
          </g>
        )}

        {/* Connection Links */}
        {layoutNodes.links.map((link, idx) => {
          const isSelected = selectedDevice && (
            (link.from.devId === selectedDevice.id) ||
            (link.to.devId === selectedDevice.id)
          );

          const dx = link.to.x - link.from.x;
          const dy = link.to.y - link.from.y;
          const midY = (link.from.y + link.to.y) / 2;
          const pathD = layoutMode === 'tree'
            ? `M ${link.from.x} ${link.from.y} C ${link.from.x} ${midY}, ${link.to.x} ${midY}, ${link.to.x} ${link.to.y}`
            : `M ${link.from.x} ${link.from.y} Q ${link.from.x + dx * 0.5} ${link.from.y + dy * 0.5}, ${link.to.x} ${link.to.y}`;

          const linkColor = isSelected ? '#f59e0b' : (link.color || '#3b82f6');
          const strokeWidth = link.isMainTrunk ? 3 : (link.isThisDevice ? 2.5 : 1.8);

          return (
            <g key={`link-${idx}`}>
              {/* Outer soft glow line */}
              <path
                d={pathD}
                fill="none"
                stroke={linkColor}
                strokeWidth={strokeWidth + 3}
                strokeOpacity={isSelected ? 0.45 : (link.isAlive ? 0.18 : 0.08)}
              />
              {/* Crisp core line */}
              <path
                d={pathD}
                fill="none"
                stroke={linkColor}
                strokeWidth={strokeWidth}
                strokeOpacity={isSelected ? 0.95 : (link.isAlive ? 0.75 : 0.35)}
                strokeDasharray={link.isAlive ? 'none' : '4, 4'}
              />
            </g>
          );
        })}

        {/* Node Cards */}
        {layoutNodes.nodes.map((node) => {
          const isCloud = node.type === 'cloud';
          const isSelected = selectedDevice?.id === node.id;
          const IconComponent = isCloud ? Cloud : getDeviceIcon(node.deviceType);
          const devColor = isCloud ? '#6366f1' : getDeviceColor(node.deviceType, node.isThisDevice, node.isGateway);

          const cardWidth = isCloud ? 140 : (node.isGateway ? 204 : 188);
          const cardHeight = isCloud ? 50 : 70;
          const nodeNick = !isCloud ? (nicknames[node.mac] || nicknames[node.ip]) : null;
          const displaySubtitle = isCloud
            ? node.subtitle
            : (nodeNick || node.vendor || (node.isGateway ? 'Router' : 'Device')).slice(0, 19);

          return (
            <g
              key={node.id || `node-${node.ip}`}
              transform={`translate(${node.x}, ${node.y})`}
              onClick={(e) => {
                e.stopPropagation();
                if (!isCloud) {
                  setSelectedDevice && setSelectedDevice(isSelected ? null : node);
                }
              }}
              className="cursor-pointer group"
            >
              {/* Card Container Box */}
              <rect
                x={-cardWidth / 2}
                y={-cardHeight / 2}
                width={cardWidth}
                height={cardHeight}
                rx={10}
                fill="#0b1120"
                fillOpacity={0.94}
                stroke={isSelected ? '#f59e0b' : devColor}
                strokeWidth={isSelected ? 2 : (node.isThisDevice || node.isGateway ? 1.5 : 1)}
                strokeOpacity={isSelected ? 1 : (node.isAlive !== false ? 0.85 : 0.45)}
                filter={isSelected ? 'url(#neon-glow)' : undefined}
                className="transition-all duration-200 group-hover:stroke-white/80"
              />

              {/* Icon Disc */}
              <g transform={`translate(${-cardWidth / 2 + 18}, 0)`}>
                <circle
                  cx={0}
                  cy={0}
                  r={13}
                  fill={`${devColor}22`}
                  stroke={devColor}
                  strokeWidth={1}
                />
                <g transform="translate(-6.5, -6.5)">
                  <IconComponent size={13} color={devColor} />
                </g>
              </g>

              {/* Text Information */}
              <g transform={`translate(${-cardWidth / 2 + 38}, -11)`}>
                <text
                  x={0}
                  y={0}
                  fill="#ffffff"
                  fontSize={11}
                  fontWeight="700"
                  fontFamily="ui-monospace, monospace"
                >
                  {isCloud ? node.title : node.ip}
                  {node.isThisDevice && (
                    <tspan
                      fill="#38bdf8"
                      fontSize={8.5}
                      fontWeight="800"
                      fontFamily="system-ui, sans-serif"
                      dx={7}
                    >
                      ⭐ YOU
                    </tspan>
                  )}
                </text>
              </g>

              <text
                x={-cardWidth / 2 + 38}
                y={6}
                fill={nodeNick ? '#fbbf24' : devColor}
                fontSize={9.5}
                fontWeight="600"
                fontFamily="system-ui, sans-serif"
              >
                {displaySubtitle}
              </text>

              {/* Full Clear MAC & Latency */}
              {!isCloud && node.mac && (
                <text
                  x={-cardWidth / 2 + 38}
                  y={21}
                  fill="#94a3b8"
                  fontSize={8.5}
                  fontWeight="600"
                  fontFamily="ui-monospace, monospace"
                >
                  {node.mac}
                </text>
              )}

              {/* Top-Right Badge: ROUTER */}
              {!isCloud && node.isGateway && (
                <g transform={`translate(${cardWidth / 2 - 8}, ${-cardHeight / 2 + 15})`}>
                  <rect x={-52} y={-8} width={52} height={16} rx={4} fill="#064e3b" stroke="#10b981" strokeWidth={0.8} />
                  <text x={-26} y={3.5} textAnchor="middle" fill="#34d399" fontSize={8} fontWeight="700" fontFamily="system-ui">
                    ROUTER
                  </text>
                </g>
              )}

              {/* Latency badge on bottom right */}
              {!isCloud && node.latency !== null && (
                <text
                  x={cardWidth / 2 - 8}
                  y={21}
                  textAnchor="end"
                  fill="#34d399"
                  fontSize={8.5}
                  fontWeight="700"
                  fontFamily="ui-monospace, monospace"
                >
                  {node.latency}ms
                </text>
              )}

              {/* Pulsing indicator if alive */}
              {!isCloud && node.isAlive && (
                <circle
                  cx={cardWidth / 2 - 8}
                  cy={-cardHeight / 2 + 10}
                  r={3.5}
                  fill="#10b981"
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* Top HUD Status Banner */}
      <div className="absolute top-6 left-6 z-20 flex flex-col gap-1.5 pointer-events-none select-none">
        <div className="flex items-center gap-2 bg-gray-900/90 border border-emerald-500/40 rounded-xl px-3.5 py-2 backdrop-blur-md shadow-2xl text-xs font-mono pointer-events-auto">
          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span className="font-bold">LAN TOPOLOGY</span>
          </div>
          <span className="text-gray-600">•</span>
          <div className="flex items-center gap-1.5 text-sky-400 font-semibold">
            <span className="w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_8px_#38bdf8]"></span>
            <span>{lanData?.network?.subnetPrefix || 'Subnet'}</span>
          </div>
          <span className="text-gray-500 font-bold">➔</span>
          <span className="text-emerald-300 px-1.5 py-0.5 bg-emerald-950/80 border border-emerald-500/30 rounded text-[11px] font-bold">
            {lanData?.totalDevices || 0} devices
          </span>
          <span className="text-gray-400 text-[11px] hidden sm:inline">
            (Gateway: {lanData?.gateway?.ip || '192.168.1.1'})
          </span>
        </div>

        {/* Selected Device Floating Card */}
        {selectedDevice && (
          <div className="flex items-center justify-between gap-3 bg-gray-950/95 border border-amber-500/70 rounded-xl px-3.5 py-2 backdrop-blur-md shadow-2xl text-xs font-mono pointer-events-auto max-w-lg animate-in slide-in-from-top-1">
            <div className="flex items-center gap-2 truncate">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
              <div className="truncate">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-amber-400">{selectedDevice.ip}</span>
                  <span className="text-gray-300 font-semibold text-[11px] truncate max-w-[150px]">
                    {nicknames[selectedDevice.mac] || nicknames[selectedDevice.ip] || selectedDevice.hostname || selectedDevice.vendor || 'Device'}
                  </span>
                  {selectedDevice.isThisDevice && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-sky-950 border border-sky-500/40 text-sky-300">
                      THIS PC (YOU)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="flex items-center gap-1 font-mono text-[10px] bg-gray-900 border border-gray-700/80 px-1.5 py-0.2 rounded text-gray-200">
                    <span className="text-[9px] text-gray-500 font-bold">MAC:</span>
                    <span className="font-bold tracking-wider text-amber-300">{selectedDevice.mac}</span>
                  </div>
                  {selectedDevice.osFingerprint?.osName && (
                    <span className="text-[10px] text-cyan-400 font-medium ml-1">
                      • {formatOsName(selectedDevice.osFingerprint.osName)}
                    </span>
                  )}
                  {selectedDevice.latency !== null && (
                    <span className="text-[10px] text-emerald-400 font-mono font-bold">
                      {selectedDevice.latency === 1 ? '<1 ms' : `${selectedDevice.latency} ms`}
                    </span>
                  )}
                </div>
                {selectedDevice.mdns?.services?.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1 mt-1">
                    {selectedDevice.mdns.services.map((srv, sIdx) => (
                      <button
                        key={sIdx}
                        type="button"
                        onClick={() => setMdnsModalDevice(selectedDevice)}
                        className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-indigo-950/90 hover:bg-indigo-900 border border-indigo-500/40 hover:border-indigo-500/70 text-indigo-300 hover:text-indigo-200 transition cursor-pointer flex items-center gap-1"
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

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setInspectModalDevice(selectedDevice)}
                className="px-2 py-0.5 rounded bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-500/30 hover:border-cyan-400/60 text-cyan-300 hover:text-cyan-100 transition text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                title="Run deep device inspection & fingerprinting (12/12 features: OS, SNMP, Uptime, Ports, etc.)"
              >
                <Cpu size={12} className="text-cyan-400" />
                <span>Inspect</span>
              </button>

              {selectedDevice.mdns && (
                <button
                  type="button"
                  onClick={() => setMdnsModalDevice(selectedDevice)}
                  className="px-1.5 py-0.5 rounded bg-gray-800 hover:bg-indigo-950 border border-transparent hover:border-indigo-500/40 text-gray-300 hover:text-indigo-300 transition text-[11px] font-mono flex items-center gap-1 cursor-pointer"
                  title="View mDNS / Bonjour information (TXT records, port, services)"
                >
                  <Radio size={11} className="text-indigo-400" />
                  <span className="text-[10px]">mDNS</span>
                </button>
              )}
              {selectedDevice.ssdp && (
                <button
                  type="button"
                  onClick={() => setXmlModalDevice(selectedDevice)}
                  className="px-1.5 py-0.5 rounded bg-gray-800 hover:bg-sky-950 border border-transparent hover:border-sky-500/40 text-gray-300 hover:text-sky-300 transition text-[11px] font-mono flex items-center gap-1 cursor-pointer"
                  title="View UPnP / SSDP XML description"
                >
                  <FileCode size={11} className="text-sky-400" />
                  <span className="text-[10px]">XML</span>
                </button>
              )}
              {(selectedDevice.webPortal || (selectedDevice.isGateway && `http://${selectedDevice.ip}`)) && (
                <a
                  href={selectedDevice.webPortal || `http://${selectedDevice.ip}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-0.5 rounded bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 hover:border-emerald-400 text-emerald-300 hover:text-emerald-100 transition text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                  title={`Open device web portal (${selectedDevice.webPortal || `http://${selectedDevice.ip}`})`}
                >
                  <Globe size={11} className="text-emerald-400" />
                  <span>Web Portal</span>
                  <ExternalLink size={9} className="opacity-70" />
                </a>
              )}
              <button
                type="button"
                onClick={() => copyToClipboard(selectedDevice.ip, `pop-${selectedDevice.id}`)}
                className="px-1.5 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition text-[11px] font-mono flex items-center gap-1"
                title="Copy IP"
              >
                {copiedId === `pop-${selectedDevice.id}` ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                <span className="text-[10px]">IP</span>
              </button>
              <button
                type="button"
                onClick={() => copyToClipboard(selectedDevice.mac, `pop-mac-${selectedDevice.id}`)}
                className="px-1.5 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition text-[11px] font-mono flex items-center gap-1"
                title="Copy MAC Address"
              >
                {copiedId === `pop-mac-${selectedDevice.id}` ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                <span className="text-[10px]">MAC</span>
              </button>
              {onPing && (
                <button
                  type="button"
                  onClick={() => onPing({
                    ip: selectedDevice.ip,
                    hostname: nicknames[selectedDevice.mac] || nicknames[selectedDevice.ip] || selectedDevice.hostname || selectedDevice.vendor,
                    isPrivate: true
                  })}
                  className="px-2 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-emerald-400 hover:text-emerald-300 transition text-[11px] font-bold flex items-center gap-1"
                  title="Live Ping test"
                >
                  <Activity size={12} />
                  <span>Ping</span>
                </button>
              )}
              {selectedDevice.isGateway && (
                <button
                  type="button"
                  onClick={() => window.open(`http://${selectedDevice.ip}`, '_blank', 'noopener,noreferrer')}
                  className="px-2 py-0.5 rounded bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 hover:text-emerald-200 transition text-[11px] font-semibold flex items-center gap-1"
                  title="Open Router Web Admin"
                >
                  <ExternalLink size={12} />
                  <span>Admin</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedDevice && setSelectedDevice(null)}
                className="text-gray-500 hover:text-white p-1 ml-0.5 cursor-pointer text-sm"
                title="Deselect"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Floating Canvas Controls (Layout Toggle & Zoom) */}
      <div className="absolute bottom-6 right-6 z-20 flex flex-col gap-2">
        {/* Layout Switcher (Tree vs Radial) */}
        <div className="flex flex-col bg-gray-900/90 border border-gray-700 rounded-xl p-1 backdrop-blur-sm shadow-xl">
          <button
            type="button"
            onClick={() => setLayoutMode('tree')}
            className={`p-2 rounded-lg transition-all ${
              layoutMode === 'tree'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-gray-400 hover:text-emerald-400'
            }`}
            title="Tree Hierarchy Layout"
          >
            <Share2 size={16} />
          </button>
          <button
            type="button"
            onClick={() => setLayoutMode('radial')}
            className={`p-2 rounded-lg transition-all ${
              layoutMode === 'radial'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-gray-400 hover:text-emerald-400'
            }`}
            title="Radial Hub-and-Spoke Layout"
          >
            <CircleDot size={16} />
          </button>
        </div>

        {/* Zoom Controls */}
        <button
          onClick={handleResetView}
          className="p-2.5 rounded-full bg-gray-900/90 text-gray-400 hover:text-emerald-400 border border-gray-700 backdrop-blur-sm transition-all shadow-xl"
          title="Reset View"
        >
          <Compass size={18} />
        </button>

        <button
          onClick={() => setZoom(prev => Math.min(2.5, prev * 1.2))}
          className="p-2.5 rounded-full bg-gray-900/90 text-gray-400 hover:text-emerald-400 border border-gray-700 backdrop-blur-sm transition-all shadow-xl"
          title="Zoom In"
        >
          <ZoomIn size={18} />
        </button>

        <button
          onClick={() => setZoom(prev => Math.max(0.4, prev * 0.8))}
          className="p-2.5 rounded-full bg-gray-900/90 text-gray-400 hover:text-emerald-400 border border-gray-700 backdrop-blur-sm transition-all shadow-xl"
          title="Zoom Out"
        >
          <ZoomOut size={18} />
        </button>
      </div>

      {/* Subtle atmospheric vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          boxShadow: 'inset 0 0 120px rgba(0,0,0,0.85)'
        }}
      ></div>

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
