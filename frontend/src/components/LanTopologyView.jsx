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
  Globe,
  Power,
  ShieldAlert,
  HelpCircle
} from 'lucide-react';
import XmlViewerModal from './XmlViewerModal';
import MdnsViewerModal from './MdnsViewerModal';
import DeviceInspectModal from './DeviceInspectModal';
import LanGuideModal from './LanGuideModal';
import { formatOsName } from '../utils/formatters';
import {
  getDeviceIcon,
  getDeviceColor,
  resolveEffectiveDeviceType
} from '../utils/deviceIcons';

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
  const [wolState, setWolState] = useState(null);
  const [xmlModalDevice, setXmlModalDevice] = useState(null);
  const [mdnsModalDevice, setMdnsModalDevice] = useState(null);
  const [inspectModalDevice, setInspectModalDevice] = useState(null);
  const [guideModalOpen, setGuideModalOpen] = useState(false);

  const triggerWakeOnLan = async (dev) => {
    if (!dev?.mac || dev.mac === 'Unknown' || dev.mac === 'Internal') return;
    setWolState(dev.id || dev.ip);
    try {
      await fetch(`${apiBase || ''}/api/wol`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mac: dev.mac, ip: dev.ip })
      });
      setTimeout(() => setWolState(null), 2500);
    } catch (e) {
      setTimeout(() => setWolState(null), 2500);
    }
  };
  const [nicknames, setNicknames] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('vni_lan_nicknames')) || {};
    } catch (e) {
      return {};
    }
  });
  const [customIcons, setCustomIcons] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('vni_lan_icons')) || {};
    } catch (e) {
      return {};
    }
  });

  // Listen for storage changes if nicknames or custom icons are updated in sidebar panel
  useEffect(() => {
    const handleStorage = () => {
      try {
        setNicknames(JSON.parse(localStorage.getItem('vni_lan_nicknames')) || {});
        setCustomIcons(JSON.parse(localStorage.getItem('vni_lan_icons')) || {});
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
      const wanY = 65;
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
      const routerY = 170;
      nodes.push({
        ...gateway,
        x: centerX,
        y: routerY,
        isGateway: true
      });

      // Link: WAN -> Router
      links.push({
        from: { x: centerX, y: wanY + 26, devId: 'wan-cloud' },
        to: { x: centerX, y: routerY - 46, devId: gateway.id },
        color: '#6366f1',
        isMainTrunk: true,
        isAlive: true,
        activeTraffic: true
      });

      // Separate Mesh Nodes (Tier 2), THIS PC (Verified Uplink), and Other Clients (Unverified Node Assignment)
      const isMeshDevice = (d) =>
        !d.isThisDevice &&
        !d.isGateway &&
        (d.deviceType === 'mesh_node' ||
          (d.vendor && d.vendor.toLowerCase().includes('mesh')) ||
          (d.hostname && d.hostname.toLowerCase().includes('mesh')));

      const meshNodes = clientDevices.filter(isMeshDevice);
      const unassignedClients = clientDevices.filter(d => !isMeshDevice(d) && !d.isThisDevice);

      const CARD_WIDTH = 216;
      const MIN_GAP_X = 22;
      const positionedMesh = [];
      const routerNode = nodes[nodes.length - 1]; // gateway node at (centerX, routerY)

      if (meshNodes.length > 0) {
        const meshY = 305;
        const meshSpacing = Math.max(CARD_WIDTH + 30, Math.min(280, (width - 80) / meshNodes.length));
        const meshStartX = centerX - ((meshNodes.length - 1) * meshSpacing) / 2;

        meshNodes.forEach((mDev, mIdx) => {
          const mx = meshStartX + mIdx * meshSpacing;
          const mNode = { ...mDev, x: mx, y: meshY, isMeshTier: true };
          nodes.push(mNode);
          positionedMesh.push(mNode);

          links.push({
            from: { x: centerX, y: routerY + 46, devId: gateway.id },
            to: { x: mx, y: meshY - 46, devId: mDev.id },
            color: '#14b8a6',
            isMainTrunk: true,
            isAlive: mDev.isAlive !== false,
            activeTraffic: (mDev.activeConnectionsCount || 0) > 0
          });
        });
      }

      // 3. Place THIS PC (YOU) connected to the exact node (Router or Mesh Satellite) with the lowest ping / RTT
      let lowestBottomY = positionedMesh.length > 0 ? 305 : routerY;
      if (thisDevice) {
        const candidates = [routerNode, ...positionedMesh];
        let bestParent = routerNode;

        if (thisDevice.connectedToId || thisDevice.connectedToIp) {
          const matched = candidates.find(
            c => (thisDevice.connectedToId && c.id === thisDevice.connectedToId) ||
                 (thisDevice.connectedToIp && c.ip === thisDevice.connectedToIp)
          );
          if (matched) bestParent = matched;
        } else if (positionedMesh.length > 0) {
          // Compare ping latencies: if a Mesh Satellite has the lowest ping (or ties the router at <= 2ms),
          // THIS PC is physically connected to that Mesh Satellite (since traffic to the Router passes through it)
          let bestScore = routerNode.preciseLatencyMs ?? routerNode.latency ?? 999;
          const gwIcmp = routerNode.latency ?? 999;

          for (const mNode of positionedMesh) {
            const mScore = mNode.preciseLatencyMs ?? mNode.latency ?? 999;
            const mIcmp = mNode.latency ?? 999;
            if (mScore < bestScore || (mIcmp <= gwIcmp && mIcmp <= 2 && mScore <= bestScore + 0.4)) {
              bestParent = mNode;
              bestScore = mScore;
            }
          }
        }

        const pcX = bestParent.x;
        const pcY = bestParent.y + 138;
        lowestBottomY = Math.max(lowestBottomY, pcY);

        nodes.push({
          ...thisDevice,
          x: pcX,
          y: pcY
        });

        const rttVal = bestParent.preciseLatencyMs ?? bestParent.latency;
        links.push({
          from: { x: bestParent.x, y: bestParent.y + 46, devId: bestParent.id },
          to: { x: pcX, y: pcY - 46, devId: thisDevice.id },
          color: '#38bdf8',
          isThisDevice: true,
          isAlive: true,
          activeTraffic: true,
          linkLabel: rttVal !== null && rttVal !== undefined ? `BEST PING (${rttVal}ms)` : 'DIRECT UPLINK'
        });
      }

      // 4. Unassigned Subnet Clients (We do NOT guess which Mesh Node they connect to)
      let subnetBus = null;
      const total = unassignedClients.length;
      if (total > 0) {
        const maxColsByWidth = Math.max(2, Math.min(5, Math.floor((width - 48) / (CARD_WIDTH + MIN_GAP_X))));
        const cols = Math.min(total, maxColsByWidth);
        const rows = Math.ceil(total / cols);

        const colSpacing = Math.max(CARD_WIDTH + MIN_GAP_X, Math.min(256, (width - 64) / (cols || 1)));
        const busY = lowestBottomY + 82;
        const startY = busY + 104;
        const rowSpacing = 128;

        const busHalfWidth = Math.max(220, ((cols - 1) * colSpacing) / 2 + CARD_WIDTH / 2);
        subnetBus = {
          y: busY,
          x1: centerX - busHalfWidth,
          x2: centerX + busHalfWidth,
          centerX,
          label: `SHARED SUBNET CLIENTS (${lanData?.network?.subnetPrefix || 'LAN'} • Exact Mesh Node / AP Unknown)`
        };

        unassignedClients.forEach((dev, idx) => {
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

          // Only draw a live socket link if THIS PC has active TCP/UDP sockets to this specific client
          if ((dev.activeConnectionsCount || 0) > 0 && thisDevice) {
            const pcNode = nodes.find(n => n.isThisDevice);
            if (pcNode) {
              links.push({
                from: { x: pcNode.x, y: pcNode.y + 46, devId: pcNode.id },
                to: { x: nodeX, y: nodeY - 46, devId: dev.id },
                color: '#10b981',
                isAlive: true,
                activeTraffic: true,
                labelX: nodeX,
                labelY: nodeY - 62,
                linkLabel: `⚡${dev.activeConnectionsCount} SOCKET${dev.activeConnectionsCount > 1 ? 'S' : ''}`
              });
            }
          }
        });
      }

      return { nodes, links, subnetBus };
    } else {
      // Radial Hub-and-Spoke Layout (Zero-Collision Dynamic Rings)
      const centerY = height / 2;

      // Router in center
      nodes.push({
        ...gateway,
        x: centerX,
        y: centerY,
        isGateway: true
      });

      // WAN Cloud placed directly above Router on inner dedicated clearance
      const wanDist = 175;
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
        from: { x: centerX, y: centerY - 46, devId: gateway.id },
        to: { x: centerX, y: centerY - wanDist + 26, devId: 'wan-cloud' },
        color: '#6366f1',
        isMainTrunk: true,
        isAlive: true,
        activeTraffic: true
      });

      const allClients = [];
      if (thisDevice) allClients.push(thisDevice);
      clientDevices.forEach(d => allClients.push(d));

      const total = allClients.length;
      if (total > 0) {
        // Leave an angular gap around the top (-PI/2) so client cards never collide with the WAN Cloud node
        const topGapRad = 0.56; // ~32 deg clearance on each side of top vertical axis
        const usableArc = 2 * Math.PI - topGapRad * 2;
        const startArc = -Math.PI / 2 + topGapRad;

        // Place up to 8 cards on Ring 1, and remaining cards on Ring 2 (or Ring 3 for huge networks)
        const ring1Max = 8;
        const ring1Items = allClients.slice(0, ring1Max);
        const ring2Items = allClients.slice(ring1Max);

        const placeRing = (items, ringIndex) => {
          const count = items.length;
          if (count === 0) return;

          // Ensure circumference is wide enough so 216x92 cards never overlap horizontally or vertically
          const minRadiusByCount = (count * 195) / usableArc;
          const baseR = ringIndex === 0 ? Math.max(330, minRadiusByCount) : Math.max(580, minRadiusByCount);
          const radiusX = baseR * 1.12;
          const radiusY = baseR * 0.88;

          items.forEach((dev, idx) => {
            const frac = count === 1 ? 0.5 : idx / (count - 1);
            const angle = startArc + frac * usableArc;
            const nodeX = centerX + Math.cos(angle) * radiusX;
            const nodeY = centerY + Math.sin(angle) * radiusY;

            nodes.push({
              ...dev,
              x: nodeX,
              y: nodeY
            });

            links.push({
              from: { x: centerX, y: centerY, devId: gateway.id },
              to: { x: nodeX, y: nodeY, devId: dev.id },
              color: getDeviceColor(dev.deviceType, dev.isThisDevice, dev.isGateway),
              isThisDevice: dev.isThisDevice,
              isAlive: dev.isAlive,
              activeTraffic: dev.isThisDevice || (dev.activeConnectionsCount || 0) > 0
            });
          });
        };

        placeRing(ring1Items, 0);
        placeRing(ring2Items, 1);

        // Final iterative bounding-box relaxation pass to guarantee zero card overlap in radial mode
        const CARD_W = 232; // 216 + 16px margin
        const CARD_H = 108; // 92 + 16px margin
        for (let iter = 0; iter < 12; iter++) {
          for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
              const a = nodes[i];
              const b = nodes[j];
              const dx = b.x - a.x;
              const dy = b.y - a.y;
              const overlapX = CARD_W - Math.abs(dx);
              const overlapY = CARD_H - Math.abs(dy);
              if (overlapX > 0 && overlapY > 0) {
                const pushX = (overlapX / 2 + 2) * (dx >= 0 ? 1 : -1);
                const pushY = (overlapY / 2 + 2) * (dy >= 0 ? 1 : -1);
                // Keep router and wan-cloud anchored, push client nodes outward
                const aFixed = a.isGateway || a.type === 'cloud';
                const bFixed = b.isGateway || b.type === 'cloud';
                if (overlapX < overlapY) {
                  if (!aFixed) a.x -= pushX;
                  if (!bFixed) b.x += pushX;
                } else {
                  if (!aFixed) a.y -= pushY;
                  if (!bFixed) b.y += pushY;
                }
              }
            }
          }
        }

        // Sync radial link endpoints with relaxed node positions
        links.forEach(l => {
          const targetNode = nodes.find(n => n.id === l.to.devId);
          if (targetNode && targetNode.type !== 'cloud') {
            l.to.x = targetNode.x;
            l.to.y = targetNode.y;
          }
        });
      }
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
      <svg className="w-full h-full pointer-events-auto overflow-visible">
        <defs>
          <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: `${dimensions.width / 2}px ${dimensions.height / 2}px`,
            transition: isDragging ? 'none' : 'transform 0.1s ease-out'
          }}
        >
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
                {/* Animated Live Traffic Particles (when active sockets or main trunk) */}
                {(link.activeTraffic || isSelected) && link.isAlive !== false && (
                  <circle r={link.isMainTrunk ? 3 : 2.5} fill={isSelected ? '#fbbf24' : '#38bdf8'}>
                    <animateMotion
                      dur={link.isMainTrunk ? '1.8s' : '2.4s'}
                      repeatCount="indefinite"
                      path={pathD}
                    />
                  </circle>
                )}
                {/* Optional Link Label Pill (e.g. BEST PING for THIS PC, or SOCKET badge above target card) */}
                {link.linkLabel && (
                  <g
                    transform={`translate(${
                      link.labelX !== undefined ? link.labelX : (link.from.x + link.to.x) / 2
                    }, ${
                      link.labelY !== undefined ? link.labelY : (link.from.y + link.to.y) / 2
                    })`}
                  >
                    <rect
                      x={-54}
                      y={-9}
                      width={108}
                      height={18}
                      rx={9}
                      fill={link.labelX !== undefined ? '#064e3b' : '#082f49'}
                      stroke={link.labelX !== undefined ? '#10b981' : '#38bdf8'}
                      strokeWidth={1}
                    />
                    <text
                      x={0}
                      y={3}
                      textAnchor="middle"
                      fill={link.labelX !== undefined ? '#6ee7b7' : '#7dd3fc'}
                      fontSize="8.5"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      {link.linkLabel}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Shared Subnet Bus Divider (for clients whose specific Mesh Node / AP cannot be verified on Layer 2) */}
          {layoutMode === 'tree' && layoutNodes.subnetBus && (
            <g>
              {/* Horizontal dashed distribution bar */}
              <line
                x1={layoutNodes.subnetBus.x1}
                y1={layoutNodes.subnetBus.y}
                x2={layoutNodes.subnetBus.x2}
                y2={layoutNodes.subnetBus.y}
                stroke="#334155"
                strokeWidth="1.5"
                strokeDasharray="6 6"
              />
              {/* Center Pill Header */}
              <g transform={`translate(${layoutNodes.subnetBus.centerX}, ${layoutNodes.subnetBus.y})`}>
                <rect
                  x={-225}
                  y={-13}
                  width={450}
                  height={26}
                  rx={13}
                  fill="#0f172a"
                  stroke="#334155"
                  strokeWidth="1.2"
                />
                <text
                  x={0}
                  y={3.5}
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize="9.5"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  {layoutNodes.subnetBus.label}
                </text>
              </g>
            </g>
          )}

          {/* Node Cards */}
          {layoutNodes.nodes.map((node) => {
            const isCloud = node.type === 'cloud';
            const isSelected = selectedDevice?.id === node.id;
            const nodeNick = !isCloud ? (nicknames[node.mac] || nicknames[node.ip]) : null;
            const effectiveType = !isCloud ? resolveEffectiveDeviceType(node, nodeNick, customIcons) : 'cloud';
            const IconComponent = isCloud ? Cloud : getDeviceIcon(effectiveType);
            const devColor = isCloud ? '#6366f1' : getDeviceColor(effectiveType, node.isThisDevice, node.isGateway);

            const cardWidth = isCloud ? 150 : 216;
            const cardHeight = isCloud ? 52 : 92;

            const cleanHostname = (!isCloud && node.hostname && node.hostname !== node.ip && !node.hostname.includes('Default Gateway') && !node.hostname.includes('This Computer'))
              ? node.hostname
              : null;

            const primaryTitle = isCloud
              ? node.subtitle
              : (nodeNick || node.friendlyName || node.netbiosName || cleanHostname || node.vendor || (node.isGateway ? 'Router' : 'Device'));

            const secondaryVendor = !isCloud
              ? (node.modelName ? `Model: ${node.modelName}` : (node.vendor && node.vendor !== primaryTitle ? node.vendor.replace(' (Randomized)', '') : null))
              : null;

            const osText = (!isCloud && node.osFingerprint?.osName)
              ? formatOsName(node.osFingerprint.osName)
              : null;

            const trunc = (str, len = 25) => (!str ? '' : (str.length > len ? `${str.slice(0, len - 1)}…` : str));

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
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (!isCloud) {
                    setSelectedDevice && setSelectedDevice(node);
                    setInspectModalDevice(node);
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
                  fillOpacity={0.95}
                  stroke={isSelected ? '#f59e0b' : devColor}
                  strokeWidth={isSelected ? 2 : (node.isThisDevice || node.isGateway ? 1.5 : 1)}
                  strokeOpacity={isSelected ? 1 : (node.isAlive !== false ? 0.85 : 0.45)}
                  filter={isSelected ? 'url(#neon-glow)' : undefined}
                  className="transition-all duration-200 group-hover:stroke-white/80"
                />

                {/* Icon Disc */}
                <g transform={`translate(${-cardWidth / 2 + 18}, ${isCloud ? 0 : -10})`}>
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

                {isCloud ? (
                  <>
                    <text
                      x={-cardWidth / 2 + 38}
                      y={-5}
                      fill="#ffffff"
                      fontSize={11}
                      fontWeight="700"
                      fontFamily="ui-monospace, monospace"
                    >
                      {node.title}
                    </text>
                    <text
                      x={-cardWidth / 2 + 38}
                      y={10}
                      fill={devColor}
                      fontSize={9.5}
                      fontWeight="600"
                      fontFamily="system-ui, sans-serif"
                    >
                      {node.subtitle}
                    </text>
                  </>
                ) : (
                  <>
                    {/* Row 1: IP + YOU / ROUTER badge */}
                    <text
                      x={-cardWidth / 2 + 38}
                      y={-25}
                      fill="#ffffff"
                      fontSize={11}
                      fontWeight="700"
                      fontFamily="ui-monospace, monospace"
                    >
                      {node.ip}
                      {node.isThisDevice && (
                        <tspan
                          fill="#38bdf8"
                          fontSize={8.5}
                          fontWeight="800"
                          fontFamily="system-ui, sans-serif"
                          dx={6}
                        >
                          ⭐ YOU
                        </tspan>
                      )}
                    </text>

                    {/* Row 2: Primary Name (Nickname / FriendlyName / Hostname / Vendor) */}
                    <text
                      x={-cardWidth / 2 + 38}
                      y={-10}
                      fill={nodeNick ? '#fbbf24' : '#f1f5f9'}
                      fontSize={9.5}
                      fontWeight="700"
                      fontFamily="system-ui, sans-serif"
                    >
                      {trunc(primaryTitle, 25)}
                    </text>

                    {/* Row 3: Hardware Vendor / Model OR OS */}
                    <text
                      x={-cardWidth / 2 + 38}
                      y={4}
                      fill={secondaryVendor ? '#94a3b8' : '#22d3ee'}
                      fontSize={8.5}
                      fontWeight="600"
                      fontFamily="system-ui, sans-serif"
                    >
                      {trunc(secondaryVendor || (osText ? `⚙ ${osText}` : `Type: ${node.deviceType || 'device'}`), 27)}
                    </text>

                    {/* Row 4: OS Fingerprint (when Row 3 had Vendor/Model) or mDNS services */}
                    <text
                      x={-cardWidth / 2 + 38}
                      y={18}
                      fill="#22d3ee"
                      fontSize={8.5}
                      fontWeight="600"
                      fontFamily="system-ui, sans-serif"
                    >
                      {trunc(
                        secondaryVendor && osText
                          ? `⚙ ${osText}`
                          : (node.mdns?.services?.length ? `📡 ${node.mdns.services.join(', ')}` : (node.webPortal ? '🌐 Web Portal Available' : '')),
                        27
                      )}
                    </text>

                    {/* Row 5 (Bottom): Full MAC Address on left + Latency on right */}
                    {node.mac && (
                      <text
                        x={-cardWidth / 2 + 12}
                        y={35}
                        fill="#94a3b8"
                        fontSize={8.5}
                        fontWeight="600"
                        fontFamily="ui-monospace, monospace"
                      >
                        {node.mac}
                      </text>
                    )}

                    {/* Top-Right Badge: ROUTER / MESH / NEW */}
                    {node.isGateway && (
                      <g transform={`translate(${cardWidth / 2 - 8}, ${-cardHeight / 2 + 15})`}>
                        <rect x={-48} y={-8} width={48} height={15} rx={4} fill="#064e3b" stroke="#10b981" strokeWidth={0.8} />
                        <text x={-24} y={3} textAnchor="middle" fill="#34d399" fontSize={7.5} fontWeight="700" fontFamily="system-ui">
                          ROUTER
                        </text>
                      </g>
                    )}
                    {!node.isGateway && node.isMeshTier && (
                      <g transform={`translate(${cardWidth / 2 - 20}, ${-cardHeight / 2 + 15})`}>
                        <rect x={-38} y={-8} width={38} height={15} rx={4} fill="#042f2e" stroke="#14b8a6" strokeWidth={0.8} />
                        <text x={-19} y={3} textAnchor="middle" fill="#2dd4bf" fontSize={7.5} fontWeight="700" fontFamily="system-ui">
                          MESH
                        </text>
                      </g>
                    )}
                    {!node.isGateway && !node.isMeshTier && node.isNew && (
                      <g transform={`translate(${cardWidth / 2 - 20}, ${-cardHeight / 2 + 15})`}>
                        <rect x={-32} y={-8} width={32} height={15} rx={4} fill="#451a03" stroke="#f59e0b" strokeWidth={0.8} />
                        <text x={-16} y={3} textAnchor="middle" fill="#fbbf24" fontSize={7.5} fontWeight="700" fontFamily="system-ui">
                          NEW
                        </text>
                      </g>
                    )}

                    {/* Latency or silent badge on bottom right */}
                    <text
                      x={cardWidth / 2 - 10}
                      y={35}
                      textAnchor="end"
                      fill={node.latency !== null ? '#34d399' : '#64748b'}
                      fontSize={8.5}
                      fontWeight="700"
                      fontFamily="ui-monospace, monospace"
                    >
                      {node.activeConnectionsCount > 0
                        ? `⚡${node.activeConnectionsCount} • ${node.latency !== null ? `${node.latency}ms` : 'active'}`
                        : (node.latency !== null ? `${node.latency}ms` : 'silent')}
                    </text>

                    {/* Alive status dot on top right (for non-gateway) */}
                    {!node.isGateway && (
                      <circle
                        cx={cardWidth / 2 - 10}
                        cy={-cardHeight / 2 + 12}
                        r={3.5}
                        fill={node.isAlive ? '#10b981' : '#475569'}
                      />
                    )}
                  </>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Top HUD Status Banner */}
      <div className="absolute top-6 left-6 z-20 flex flex-col gap-2 pointer-events-none select-none">
        <div className="flex items-center gap-2 bg-gray-900/90 border border-emerald-500/40 rounded-xl px-3.5 py-2 backdrop-blur-md shadow-2xl text-xs font-mono pointer-events-auto w-fit">
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
          <span className="text-gray-700">|</span>
          <button
            type="button"
            onClick={() => setGuideModalOpen(true)}
            className="px-2 py-0.5 rounded bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 hover:text-white transition flex items-center gap-1 cursor-pointer text-[11px] font-sans font-semibold"
            title="Open LAN Topology & Scanner Guide"
          >
            <HelpCircle size={12} className="text-emerald-400" />
            <span>Guide</span>
          </button>
        </div>

        {/* ARP Spoofing / Security Alerts Banner */}
        {lanData?.securityAlerts?.length > 0 && (
          <div className="flex flex-col gap-1 bg-rose-950/95 border border-rose-500/70 rounded-xl px-3.5 py-2 backdrop-blur-md shadow-2xl text-xs font-mono pointer-events-auto max-w-xl">
            {lanData.securityAlerts.map((al, aIdx) => (
              <div key={aIdx} className="flex items-center gap-2 text-rose-200">
                <ShieldAlert size={14} className="text-rose-400 shrink-0" />
                <div>
                  <span className="font-bold text-rose-300">{al.title}: </span>
                  <span className="text-[11px] text-rose-200/90">{al.description}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Selected Device Floating Card */}
        {selectedDevice && (
          <div className="flex flex-col gap-2 bg-gray-950/95 border border-amber-500/70 rounded-xl px-3.5 py-2.5 backdrop-blur-md shadow-2xl text-xs font-mono pointer-events-auto min-w-[320px] max-w-xl animate-in slide-in-from-top-1">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse mt-1 shrink-0"></span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-bold text-amber-400 shrink-0">{selectedDevice.ip}</span>
                    <span className="text-gray-200 font-semibold text-[11px] truncate max-w-[200px]">
                      {nicknames[selectedDevice.mac] || nicknames[selectedDevice.ip] || selectedDevice.friendlyName || selectedDevice.hostname || selectedDevice.vendor || 'Device'}
                    </span>
                    {selectedDevice.isGateway && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-950 border border-emerald-500/40 text-emerald-300 shrink-0">
                        ROUTER
                      </span>
                    )}
                    {selectedDevice.isThisDevice && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-sky-950 border border-sky-500/40 text-sky-300 shrink-0">
                        THIS PC (YOU)
                      </span>
                    )}
                    {selectedDevice.latency !== null && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 font-mono font-bold shrink-0">
                        {selectedDevice.latency === 1 ? '<1 ms' : `${selectedDevice.latency} ms`}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <div className="flex items-center gap-1 font-mono text-[10px] bg-gray-900 border border-gray-700/80 px-1.5 py-0.2 rounded text-gray-200 shrink-0">
                      <span className="text-[9px] text-gray-500 font-bold">MAC:</span>
                      <span className="font-bold tracking-wider text-amber-300">{selectedDevice.mac}</span>
                    </div>
                    {selectedDevice.osFingerprint?.osName && (
                      <span className="text-[10px] text-cyan-400 font-medium truncate">
                        • {formatOsName(selectedDevice.osFingerprint.osName)}
                      </span>
                    )}
                  </div>
                  {selectedDevice.mdns?.services?.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 mt-1.5">
                      {selectedDevice.mdns.services.map((srv, sIdx) => (
                        <button
                          key={sIdx}
                          type="button"
                          onClick={() => setMdnsModalDevice(selectedDevice)}
                          className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-indigo-950/90 hover:bg-indigo-900 border border-indigo-500/40 hover:border-indigo-500/70 text-indigo-300 hover:text-indigo-200 transition cursor-pointer flex items-center gap-1 whitespace-nowrap"
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

              <button
                type="button"
                onClick={() => setSelectedDevice && setSelectedDevice(null)}
                className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-800/80 transition cursor-pointer text-xs shrink-0"
                title="Deselect"
              >
                ✕
              </button>
            </div>

            <div className="pt-2 border-t border-gray-800/80 flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setInspectModalDevice(selectedDevice)}
                className="px-2 py-0.5 rounded bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-500/30 hover:border-cyan-400/60 text-cyan-300 hover:text-cyan-100 transition text-[11px] font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                title="Run deep device inspection & fingerprinting (12/12 features: OS, SNMP, Uptime, Ports, etc.)"
              >
                <Cpu size={12} className="text-cyan-400" />
                <span>Inspect</span>
              </button>

              {selectedDevice.mdns && (
                <button
                  type="button"
                  onClick={() => setMdnsModalDevice(selectedDevice)}
                  className="px-1.5 py-0.5 rounded bg-gray-800 hover:bg-indigo-950 border border-transparent hover:border-indigo-500/40 text-gray-300 hover:text-indigo-300 transition text-[11px] font-mono flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
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
                  className="px-1.5 py-0.5 rounded bg-gray-800 hover:bg-sky-950 border border-transparent hover:border-sky-500/40 text-gray-300 hover:text-sky-300 transition text-[11px] font-mono flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
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
                  className="px-2 py-0.5 rounded bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 hover:border-emerald-400 text-emerald-300 hover:text-emerald-100 transition text-[11px] font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
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
                className="px-1.5 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition text-[11px] font-mono flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                title="Copy IP"
              >
                {copiedId === `pop-${selectedDevice.id}` ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                <span className="text-[10px]">IP</span>
              </button>
              <button
                type="button"
                onClick={() => copyToClipboard(selectedDevice.mac, `pop-mac-${selectedDevice.id}`)}
                className="px-1.5 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition text-[11px] font-mono flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
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
                    hostname: nicknames[selectedDevice.mac] || nicknames[selectedDevice.ip] || selectedDevice.friendlyName || selectedDevice.hostname || selectedDevice.vendor,
                    isPrivate: true
                  })}
                  className="px-2 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-emerald-400 hover:text-emerald-300 transition text-[11px] font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                  title="Live Ping test"
                >
                  <Activity size={12} />
                  <span>Ping</span>
                </button>
              )}
              {selectedDevice.mac && selectedDevice.mac !== 'Unknown' && selectedDevice.mac !== 'Internal' && !selectedDevice.isThisDevice && (
                <button
                  type="button"
                  onClick={() => triggerWakeOnLan(selectedDevice)}
                  className="px-2 py-0.5 rounded bg-amber-950/70 hover:bg-amber-900 border border-amber-500/30 text-amber-300 hover:text-amber-100 transition text-[11px] font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                  title={`Send Wake-on-LAN Magic Packet to ${selectedDevice.mac}`}
                >
                  <Power size={11} className="text-amber-400" />
                  <span>{wolState === (selectedDevice.id || selectedDevice.ip) ? 'WoL Sent!' : 'Wake'}</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom-Left Visual Legend & Quick Help */}
      <div className="absolute bottom-6 left-6 z-20 hidden md:flex items-center gap-3 bg-gray-900/85 border border-gray-800 rounded-xl px-3.5 py-2 backdrop-blur-md shadow-xl text-[10px] text-gray-400">
        <div className="flex items-center gap-1.5" title="Device responded to ICMP Ping or active probe">
          <span className="w-2.5 h-0.5 bg-emerald-400 rounded-full"></span>
          <span>Active Link</span>
        </div>
        <div className="flex items-center gap-1.5" title="Device is in ARP/multicast cache but blocks ICMP Ping">
          <span className="w-2.5 h-0.5 border-b border-dashed border-gray-400"></span>
          <span>Silent / Firewall</span>
        </div>
        <div className="flex items-center gap-1.5" title="Animated packets indicate live TCP/UDP sockets between your PC and this device">
          <span className="w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_6px_#38bdf8]"></span>
          <span>Live Socket Traffic</span>
        </div>
        <button
          type="button"
          onClick={() => setGuideModalOpen(true)}
          className="ml-1 pl-2 border-l border-gray-800 text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 cursor-pointer"
        >
          <HelpCircle size={11} />
          <span>How It Works</span>
        </button>
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

      {/* LAN Guide & Reference Modal */}
      <LanGuideModal
        isOpen={guideModalOpen}
        initialTab="topology"
        onClose={() => setGuideModalOpen(false)}
      />
    </div>
  );
}
