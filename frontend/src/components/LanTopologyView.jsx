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
  Globe,
  Copy,
  Check,
  Share2,
  CircleDot,
  ExternalLink
} from 'lucide-react';

function getDeviceIcon(type) {
  switch (type) {
    case 'router':
    case 'mesh_node':
      return Router;
    case 'desktop':
    case 'computer':
      return Laptop;
    case 'mobile':
      return Smartphone;
    case 'iot':
    case 'ev_charger':
    case 'solar':
      return Cpu;
    case 'console':
    case 'tv':
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
  if (type === 'mesh_node') return '#818cf8'; // Indigo Deco Mesh
  switch (type) {
    case 'mobile':
      return '#ec4899'; // Pink
    case 'iot':
    case 'ev_charger':
    case 'solar':
      return '#f59e0b'; // Amber
    case 'console':
    case 'tv':
      return '#a855f7'; // Purple
    case 'server':
      return '#6366f1'; // Indigo
    case 'computer':
    case 'desktop':
      return '#06b6d4'; // Cyan
    default:
      return '#94a3b8'; // Slate
  }
}

function getMediumColor(med) {
  switch (med) {
    case 'cable': return '#10b981'; // Emerald
    case 'wifi_5g': return '#38bdf8'; // Sky
    case 'wifi_24g': return '#f59e0b'; // Amber
    case 'mesh_trunk': return '#818cf8'; // Indigo Mesh
    case 'wan_trunk': return '#6366f1'; // Indigo WAN
    default: return '#38bdf8';
  }
}

function getMediumDash(med) {
  switch (med) {
    case 'cable': return 'none';
    case 'wifi_5g': return '6, 4';
    case 'wifi_24g': return '3, 3';
    case 'mesh_trunk': return 'none';
    case 'wan_trunk': return 'none';
    default: return 'none';
  }
}

export default function LanTopologyView({
  lanData,
  selectedDevice,
  setSelectedDevice,
  onPing,
  onDig,
  onSslCheck
}) {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 1000, height: 700 });
  const [layoutMode, setLayoutMode] = useState('tree'); // 'tree' | 'radial'
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [copiedId, setCopiedId] = useState(null);
  const [nicknames, setNicknames] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('vni_lan_nicknames')) || {};
    } catch (e) {
      return {};
    }
  });
  const [topologyLinks, setTopologyLinks] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('vni_lan_topology_links')) || {};
    } catch (e) {
      return {};
    }
  });

  // Listen for storage changes if nicknames or links are updated in sidebar panel
  useEffect(() => {
    const handleStorage = () => {
      try {
        setNicknames(JSON.parse(localStorage.getItem('vni_lan_nicknames')) || {});
        setTopologyLinks(JSON.parse(localStorage.getItem('vni_lan_topology_links')) || {});
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

  // Identify Mesh satellite nodes
  const meshNodes = useMemo(() => {
    return clientDevices.filter(d =>
      d.isMeshNode ||
      d.deviceType === 'mesh_node' ||
      (d.vendor && d.vendor.includes('Deco Mesh Node')) ||
      (d.hostname && d.hostname.includes('Deco'))
    );
  }, [clientDevices]);

  // List of all Access Point Hubs (Gateway + Mesh nodes)
  const apHubs = useMemo(() => {
    const list = [];
    if (gateway) {
      const gNick = nicknames[gateway.mac] || nicknames[gateway.ip];
      list.push({
        ip: gateway.ip,
        mac: gateway.mac,
        name: gNick || gateway.vendor || 'Deco Huvudrouter (.1)',
        isGateway: true
      });
    }
    meshNodes.forEach(m => {
      const mNick = nicknames[m.mac] || nicknames[m.ip];
      list.push({
        ip: m.ip,
        mac: m.mac,
        name: mNick || `Deco Nod (${m.ip})`,
        isMeshNode: true
      });
    });
    return list;
  }, [gateway, meshNodes, nicknames]);

  const getEffectiveParentIp = useCallback((dev) => {
    if (!dev || dev.isGateway) return null;
    const key = dev.mac || dev.ip;
    if (topologyLinks[key]?.parentIp) {
      return topologyLinks[key].parentIp;
    }
    // Host PC: user requested placing under Deco .249!
    if (dev.isThisDevice || dev.ip === '192.168.68.100') {
      const deco249 = meshNodes.find(m => m.ip === '192.168.68.249');
      if (deco249) return deco249.ip;
    }
    if (dev.isMeshNode) {
      return gateway?.ip;
    }
    return gateway?.ip;
  }, [topologyLinks, meshNodes, gateway]);

  const getEffectiveMedium = useCallback((dev) => {
    if (!dev) return 'cable';
    const key = dev.mac || dev.ip;
    if (topologyLinks[key]?.medium) {
      return topologyLinks[key].medium;
    }
    if (dev.medium) return dev.medium;
    if (dev.isThisDevice) return 'cable';
    if (dev.isMeshNode) return 'cable';
    return 'wifi_5g';
  }, [topologyLinks]);

  const updateDeviceLink = (dev, newParentIp, newMedium) => {
    if (!dev) return;
    const key = dev.mac || dev.ip;
    setTopologyLinks(prev => {
      const existing = prev[key] || {};
      const currentParent = existing.parentIp || getEffectiveParentIp(dev);
      const currentMed = existing.medium || getEffectiveMedium(dev);
      const updated = {
        ...prev,
        [key]: {
          parentIp: newParentIp !== undefined ? newParentIp : currentParent,
          medium: newMedium !== undefined ? newMedium : currentMed
        }
      };
      try {
        localStorage.setItem('vni_lan_topology_links', JSON.stringify(updated));
        window.dispatchEvent(new Event('storage'));
      } catch (e) {}
      return updated;
    });
  };

  // Calculate layout coordinates for nodes
  const layoutNodes = useMemo(() => {
    const { width, height } = dimensions;
    const centerX = width / 2;
    const nodes = [];
    const links = [];

    if (!gateway) return { nodes: [], links: [] };

    if (layoutMode === 'tree') {
      // 1. WAN Cloud (Root Top)
      const wanY = 55;
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
      const routerY = 150;
      nodes.push({
        ...gateway,
        x: centerX,
        y: routerY,
        isGateway: true
      });

      // Link: WAN -> Router
      links.push({
        from: { x: centerX, y: wanY + 25 },
        to: { x: centerX, y: routerY - 32 },
        color: '#6366f1',
        medium: 'wan_trunk',
        strokeDasharray: 'none',
        isMainTrunk: true,
        isAlive: true
      });

      // 3. Client devices & This Device arrayed in tiers
      const allClients = [];
      if (thisDevice) allClients.push(thisDevice);
      clientDevices.forEach(d => allClients.push(d));

      if (meshNodes.length > 0) {
        // Deco Mesh Satellite Architecture
        const nonHubClients = allClients.filter(d => !d.isGateway && !meshNodes.some(m => m.ip === d.ip));

        const clientsByAp = new Map();
        clientsByAp.set(gateway.ip, []);
        meshNodes.forEach(m => clientsByAp.set(m.ip, []));

        nonHubClients.forEach(dev => {
          const parentIp = getEffectiveParentIp(dev) || gateway.ip;
          if (!clientsByAp.has(parentIp)) {
            clientsByAp.set(parentIp, []);
          }
          clientsByAp.get(parentIp).push(dev);
        });

        // Build columns for AP hubs
        const gwClients = clientsByAp.get(gateway.ip) || [];
        const columns = [];
        if (gwClients.length > 0) {
          columns.push({
            id: 'col-gw',
            ap: gateway,
            isGatewayDirect: true,
            clients: gwClients
          });
        }
        meshNodes.forEach(m => {
          columns.push({
            id: `col-${m.ip}`,
            ap: m,
            isGatewayDirect: false,
            clients: clientsByAp.get(m.ip) || []
          });
        });

        const numCols = columns.length;
        const colWidth = Math.max(260, Math.min(380, (width - 100) / (numCols || 1)));
        const startX = centerX - ((numCols - 1) * colWidth) / 2;

        columns.forEach((col, colIdx) => {
          const colX = startX + colIdx * colWidth;

          if (col.isGatewayDirect) {
            // Direct router clients
            col.clients.forEach((cDev, k) => {
              let cx = colX;
              let cy = 280 + k * 85;
              if (col.clients.length > 4) {
                const subCol = k % 2;
                const subRow = Math.floor(k / 2);
                cx = colX + (subCol === 0 ? -92 : 92);
                cy = 280 + subRow * 85;
              }
              const med = getEffectiveMedium(cDev);
              nodes.push({
                ...cDev,
                x: cx,
                y: cy,
                parentIp: gateway.ip,
                effectiveMedium: med
              });
              links.push({
                from: { x: centerX, y: routerY + 32 },
                to: { x: cx, y: cy - 32 },
                color: getMediumColor(med),
                medium: med,
                strokeDasharray: getMediumDash(med),
                isThisDevice: cDev.isThisDevice,
                isAlive: cDev.isAlive
              });
            });
          } else {
            // Mesh Satellite Node at y = 270
            const m = col.ap;
            const meshY = 270;
            nodes.push({
              ...m,
              x: colX,
              y: meshY,
              isMeshNode: true,
              effectiveMedium: 'cable'
            });

            // Link: Gateway -> Mesh Node (Deco Mesh Backhaul Trunk)
            links.push({
              from: { x: centerX, y: routerY + 32 },
              to: { x: colX, y: meshY - 32 },
              color: '#818cf8',
              medium: 'mesh_trunk',
              strokeDasharray: 'none',
              isMainTrunk: true,
              isAlive: m.isAlive
            });

            // Clients under this Mesh Node starting at y = 390
            col.clients.forEach((cDev, k) => {
              let cx = colX;
              let cy = 390 + k * 85;
              if (col.clients.length > 4) {
                const subCol = k % 2;
                const subRow = Math.floor(k / 2);
                cx = colX + (subCol === 0 ? -92 : 92);
                cy = 390 + subRow * 85;
              }
              const med = getEffectiveMedium(cDev);
              nodes.push({
                ...cDev,
                x: cx,
                y: cy,
                parentIp: m.ip,
                effectiveMedium: med
              });
              links.push({
                from: { x: colX, y: meshY + 32 },
                to: { x: cx, y: cy - 32 },
                color: getMediumColor(med),
                medium: med,
                strokeDasharray: getMediumDash(med),
                isThisDevice: cDev.isThisDevice,
                isAlive: cDev.isAlive
              });
            });
          }
        });
      } else {
        // Fallback: Standard flat distribution if no mesh nodes
        const total = allClients.length;
        if (total > 0) {
          const cols = Math.min(total, total <= 6 ? total : (total <= 12 ? Math.ceil(total / 2) : Math.ceil(total / 3)));
          const rows = Math.ceil(total / cols);
          const colSpacing = Math.min(180, Math.max(140, (width - 160) / (cols || 1)));
          const startY = 330;
          const rowSpacing = 135;

          allClients.forEach((dev, idx) => {
            const row = Math.floor(idx / cols);
            const colInRow = idx % cols;
            const itemsInThisRow = (row === rows - 1 && total % cols !== 0) ? (total % cols) : cols;
            const rowStartX = centerX - ((itemsInThisRow - 1) * colSpacing) / 2;
            const nodeX = rowStartX + colInRow * colSpacing;
            const nodeY = startY + row * rowSpacing;
            const med = getEffectiveMedium(dev);

            nodes.push({
              ...dev,
              x: nodeX,
              y: nodeY,
              effectiveMedium: med
            });

            links.push({
              from: { x: centerX, y: routerY + 30 },
              to: { x: nodeX, y: nodeY - 26 },
              color: getMediumColor(med),
              medium: med,
              strokeDasharray: getMediumDash(med),
              isThisDevice: dev.isThisDevice,
              isAlive: dev.isAlive
            });
          });
        }
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
        from: { x: centerX, y: centerY - 30 },
        to: { x: centerX, y: centerY - wanDist + 25 },
        color: '#6366f1',
        medium: 'wan_trunk',
        strokeDasharray: 'none',
        isMainTrunk: true
      });

      const allClients = [];
      if (thisDevice) allClients.push(thisDevice);
      clientDevices.forEach(d => allClients.push(d));

      const total = allClients.length;
      const radius = Math.min(width * 0.38, Math.max(190, 240 + total * 4));

      allClients.forEach((dev, idx) => {
        const angle = (idx / (total || 1)) * (2 * Math.PI) + 0.35;
        const nodeX = centerX + Math.cos(angle) * radius;
        const nodeY = centerY + Math.sin(angle) * (radius * 0.75);
        const med = getEffectiveMedium(dev);

        nodes.push({
          ...dev,
          x: nodeX,
          y: nodeY,
          effectiveMedium: med
        });

        links.push({
          from: { x: centerX, y: centerY },
          to: { x: nodeX, y: nodeY },
          color: getMediumColor(med),
          medium: med,
          strokeDasharray: getMediumDash(med),
          isThisDevice: dev.isThisDevice,
          isAlive: dev.isAlive
        });
      });
    }

    return { nodes, links };
  }, [dimensions, layoutMode, gateway, thisDevice, clientDevices, meshNodes, getEffectiveParentIp, getEffectiveMedium]);

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
          {/* Glowing filters */}
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

        {/* Connection Links (Cables / Wi-Fi / Mesh Backhaul) */}
        {layoutNodes.links.map((link, idx) => {
          const isSelected = selectedDevice && (
            (link.from.devId === selectedDevice.id) ||
            (link.to.devId === selectedDevice.id)
          );

          // Calculate cubic bezier control curve
          const dx = link.to.x - link.from.x;
          const dy = link.to.y - link.from.y;
          const midY = (link.from.y + link.to.y) / 2;
          const pathD = layoutMode === 'tree'
            ? `M ${link.from.x} ${link.from.y} C ${link.from.x} ${midY}, ${link.to.x} ${midY}, ${link.to.x} ${link.to.y}`
            : `M ${link.from.x} ${link.from.y} Q ${link.from.x + dx * 0.5} ${link.from.y + dy * 0.5}, ${link.to.x} ${link.to.y}`;

          const linkColor = isSelected ? '#f59e0b' : (link.color || '#3b82f6');
          const strokeWidth = link.isMainTrunk ? 3 : (link.isThisDevice ? 2.5 : (link.medium === 'cable' ? 2.2 : 1.8));
          const dashPattern = isSelected ? 'none' : (link.strokeDasharray || (link.isAlive ? 'none' : '4, 4'));

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
              {/* Crisp core line with cable / 5G / 2.4G style */}
              <path
                d={pathD}
                fill="none"
                stroke={linkColor}
                strokeWidth={strokeWidth}
                strokeOpacity={isSelected ? 0.95 : (link.isAlive ? 0.82 : 0.35)}
                strokeDasharray={dashPattern}
              />
            </g>
          );
        })}

        {/* Node Cards / Jewels */}
        {layoutNodes.nodes.map((node) => {
          const isCloud = node.type === 'cloud';
          const isSelected = selectedDevice?.id === node.id;
          const IconComponent = isCloud ? Cloud : getDeviceIcon(node.deviceType);
          const devColor = isCloud ? '#6366f1' : getDeviceColor(node.deviceType, node.isThisDevice, node.isGateway);

          const cardWidth = isCloud ? 140 : 186;
          const cardHeight = isCloud ? 50 : 72;
          const nodeNick = !isCloud ? (nicknames[node.mac] || nicknames[node.ip]) : null;
          const displaySubtitle = isCloud
            ? node.subtitle
            : (nodeNick || node.vendor || (node.isGateway ? 'Router' : 'Device')).slice(0, 20);

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
                fillOpacity={0.95}
                stroke={isSelected ? '#f59e0b' : devColor}
                strokeWidth={isSelected ? 2 : (node.isThisDevice || node.isGateway || node.isMeshNode ? 1.5 : 1)}
                strokeOpacity={isSelected ? 1 : (node.isAlive !== false ? 0.85 : 0.45)}
                filter={isSelected ? 'url(#neon-glow)' : undefined}
                className="transition-all duration-200 group-hover:stroke-white/80"
              />

              {/* Icon Disc */}
              <g transform={`translate(${-cardWidth / 2 + 20}, 0)`}>
                <circle
                  cx={0}
                  cy={0}
                  r={14}
                  fill={`${devColor}22`}
                  stroke={devColor}
                  strokeWidth={1}
                />
                <g transform="translate(-7, -7)">
                  <IconComponent size={14} color={devColor} />
                </g>
              </g>

              {/* Text Information: IP Address & Host PC marker */}
              <g transform={`translate(${-cardWidth / 2 + 42}, -11)`}>
                <text
                  x={0}
                  y={0}
                  fill="#ffffff"
                  fontSize={11}
                  fontWeight="700"
                  fontFamily="ui-monospace, monospace"
                >
                  {isCloud ? node.title : node.ip}
                </text>
                {node.isThisDevice && (
                  <text
                    x={88}
                    y={-1}
                    fill="#38bdf8"
                    fontSize={8}
                    fontWeight="800"
                    fontFamily="system-ui, sans-serif"
                  >
                    ⭐ DU
                  </text>
                )}
              </g>

              {/* Subtitle / Friendly Name */}
              <text
                x={-cardWidth / 2 + 42}
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
                  x={-cardWidth / 2 + 42}
                  y={22}
                  fill="#94a3b8"
                  fontSize={9}
                  fontWeight="600"
                  fontFamily="ui-monospace, monospace"
                >
                  {node.mac}
                </text>
              )}

              {/* Top-Right Medium / Role Badge */}
              {!isCloud && (
                <g transform={`translate(${cardWidth / 2 - 8}, ${-cardHeight / 2 + 15})`}>
                  {node.isGateway ? (
                    <g>
                      <rect x={-52} y={-8} width={52} height={16} rx={4} fill="#064e3b" stroke="#10b981" strokeWidth={0.8} />
                      <text x={-26} y={3.5} textAnchor="middle" fill="#34d399" fontSize={8} fontWeight="700" fontFamily="system-ui">
                        ROUTER
                      </text>
                    </g>
                  ) : node.isMeshNode ? (
                    <g>
                      <rect x={-64} y={-8} width={64} height={16} rx={4} fill="#1e1b4b" stroke="#818cf8" strokeWidth={0.8} />
                      <text x={-32} y={3.5} textAnchor="middle" fill="#a5b4fc" fontSize={8} fontWeight="700" fontFamily="system-ui">
                        DECO MESH
                      </text>
                    </g>
                  ) : node.effectiveMedium === 'cable' ? (
                    <g>
                      <rect x={-52} y={-8} width={52} height={16} rx={4} fill="#064e3b" stroke="#10b981" strokeWidth={0.8} />
                      <text x={-26} y={3.5} textAnchor="middle" fill="#34d399" fontSize={8} fontWeight="700" fontFamily="system-ui">
                        🔌 Kabel
                      </text>
                    </g>
                  ) : node.effectiveMedium === 'wifi_5g' ? (
                    <g>
                      <rect x={-48} y={-8} width={48} height={16} rx={4} fill="#082f49" stroke="#38bdf8" strokeWidth={0.8} />
                      <text x={-24} y={3.5} textAnchor="middle" fill="#7dd3fc" fontSize={8} fontWeight="700" fontFamily="system-ui">
                        📶 5 GHz
                      </text>
                    </g>
                  ) : (
                    <g>
                      <rect x={-52} y={-8} width={52} height={16} rx={4} fill="#451a03" stroke="#f59e0b" strokeWidth={0.8} />
                      <text x={-26} y={3.5} textAnchor="middle" fill="#fcd34d" fontSize={8} fontWeight="700" fontFamily="system-ui">
                        📶 2,4 GHz
                      </text>
                    </g>
                  )}
                </g>
              )}

              {/* Latency badge bottom right */}
              {!isCloud && node.latency !== null && (
                <text
                  x={cardWidth / 2 - 10}
                  y={22}
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
                  cy={cardHeight / 2 - 8}
                  r={3.5}
                  fill="#10b981"
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* Top HUD Status Banner */}
      <div className="absolute top-6 left-6 z-20 flex flex-col gap-2 pointer-events-none select-none max-w-2xl">
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
          {meshNodes.length > 0 && (
            <span className="text-indigo-300 px-1.5 py-0.5 bg-indigo-950/80 border border-indigo-500/30 rounded text-[11px] font-bold hidden sm:inline">
              {meshNodes.length} Deco Mesh Nodes
            </span>
          )}
        </div>

        {/* Selected Device Floating Card with Uplink and Medium controls */}
        {selectedDevice && (
          <div className="flex flex-col gap-2 bg-gray-950/95 border border-amber-500/70 rounded-xl p-3 backdrop-blur-md shadow-2xl text-xs font-mono pointer-events-auto animate-in slide-in-from-top-1">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 truncate">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0"></span>
                <div className="truncate">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-amber-400 text-sm">{selectedDevice.ip}</span>
                    <span className="text-gray-200 font-semibold text-xs truncate max-w-[180px]">
                      {nicknames[selectedDevice.mac] || nicknames[selectedDevice.ip] || selectedDevice.hostname || selectedDevice.vendor || 'Device'}
                    </span>
                    {selectedDevice.isThisDevice && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-sky-950 border border-sky-500/40 text-sky-300">
                        DIN DATOR
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex items-center gap-1 font-mono text-[10px] bg-gray-900 border border-gray-700/80 px-1.5 py-0.5 rounded text-gray-200">
                      <span className="text-[9px] text-gray-500 font-bold">MAC:</span>
                      <span className="font-bold tracking-wider text-amber-300">{selectedDevice.mac}</span>
                    </div>
                    {selectedDevice.latency !== null && (
                      <span className="text-[10px] text-emerald-400 font-mono font-bold">
                        {selectedDevice.latency} ms
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
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

            {/* Topology assignment controls (Parent AP & Medium) */}
            {!selectedDevice.isGateway && (
              <div className="pt-2 border-t border-gray-800 flex flex-wrap items-center justify-between gap-2">
                {/* Uplink AP Selector */}
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-400 text-[10px] font-semibold">Kopplad till:</span>
                  <select
                    value={getEffectiveParentIp(selectedDevice) || ''}
                    onChange={(e) => updateDeviceLink(selectedDevice, e.target.value, undefined)}
                    className="bg-gray-900 border border-gray-700 hover:border-emerald-500/60 rounded px-2 py-0.5 text-[11px] text-emerald-300 font-mono focus:outline-none cursor-pointer"
                  >
                    {apHubs.map(hub => (
                      <option key={hub.ip} value={hub.ip}>
                        {hub.isGateway ? `🌐 ${hub.name} (${hub.ip})` : `📡 ${hub.name}`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Connection Medium Selector */}
                <div className="flex items-center gap-1 bg-gray-900 p-0.5 rounded-lg border border-gray-800">
                  <button
                    type="button"
                    onClick={() => updateDeviceLink(selectedDevice, undefined, 'cable')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition flex items-center gap-1 ${
                      getEffectiveMedium(selectedDevice) === 'cable'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-gray-400 hover:text-white'
                    }`}
                    title="Kabel / Fast Ethernet"
                  >
                    <span>🔌</span>
                    <span>Kabel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateDeviceLink(selectedDevice, undefined, 'wifi_5g')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition flex items-center gap-1 ${
                      getEffectiveMedium(selectedDevice) === 'wifi_5g'
                        ? 'bg-sky-600 text-white shadow-sm'
                        : 'text-gray-400 hover:text-white'
                    }`}
                    title="Wi-Fi 5 GHz (Snabb)"
                  >
                    <span>📶</span>
                    <span>5 GHz</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateDeviceLink(selectedDevice, undefined, 'wifi_24g')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition flex items-center gap-1 ${
                      getEffectiveMedium(selectedDevice) === 'wifi_24g'
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'text-gray-400 hover:text-white'
                    }`}
                    title="Wi-Fi 2,4 GHz (IoT / Smart enhet)"
                  >
                    <span>📶</span>
                    <span>2,4 GHz</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Topology Legend Bar */}
      <div className="absolute bottom-6 left-6 z-20 hidden md:flex items-center gap-3 bg-gray-950/90 border border-gray-800 rounded-xl px-3.5 py-1.5 backdrop-blur-md text-[11px] font-mono shadow-2xl">
        <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
          <span className="w-3.5 h-0.5 bg-emerald-400 inline-block rounded"></span>
          <span>🔌 Kabel</span>
        </div>
        <span className="text-gray-700">•</span>
        <div className="flex items-center gap-1.5 text-sky-400 font-semibold">
          <span className="w-3.5 h-0.5 border-b-2 border-dashed border-sky-400 inline-block"></span>
          <span>📶 5 GHz</span>
        </div>
        <span className="text-gray-700">•</span>
        <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
          <span className="w-3.5 h-0.5 border-b-2 border-dotted border-amber-400 inline-block"></span>
          <span>📶 2,4 GHz</span>
        </div>
        {meshNodes.length > 0 && (
          <>
            <span className="text-gray-700">•</span>
            <div className="flex items-center gap-1.5 text-indigo-400 font-semibold">
              <span className="w-3.5 h-1 bg-indigo-500 inline-block rounded"></span>
              <span>📡 Deco Mesh Backhaul</span>
            </div>
          </>
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
    </div>
  );
}

