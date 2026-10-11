import React, { useRef, useEffect, useState, useMemo } from 'react';
import Globe from 'react-globe.gl';
import * as THREE from 'three';
import { RotateCw, Compass, ZoomIn, ZoomOut } from 'lucide-react';
import countries from '../assets/countries.json';

// Helper to calculate great-circle distance between coordinates in km
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Static accessors outside component to prevent three-globe from re-digesting 177 polygons on every render
const getPolygonCapColor = () => '#18202c';
const getPolygonSideColor = () => '#0f141c';
const getPolygonStrokeColor = () => '#374151';
const getPolygonLabel = ({ properties: d }) => `
  <div style="background: rgba(15, 23, 42, 0.9); border: 1px solid #374151; padding: 4px 8px; border-radius: 6px; color: #cbd5e1; font-family: ui-sans-serif, system-ui, sans-serif; font-size: 11px; pointer-events: none; backdrop-filter: blur(4px);">
    ${d.ADMIN || d.NAME || ''}
  </div>
`;

export default function GlobeView({ hops, selectedHop, setSelectedHop, hoveredHop, myLocation }) {
  const globeRef = useRef();
  const containerRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [autoRotate, setAutoRotate] = useState(hops.length === 0);

  // Resize handling
  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Filter valid hops and de-cluster co-located hops (so Stockholm hops don't overlap into a blob!)
  const processedHops = useMemo(() => {
    const valid = hops.filter(h => h && h.geo && h.geo.lat && h.geo.lon);
    
    // Count coordinates
    const coordCounts = {};
    valid.forEach(h => {
      const key = `${h.geo.lat.toFixed(3)},${h.geo.lon.toFixed(3)}`;
      coordCounts[key] = (coordCounts[key] || 0) + 1;
    });

    const seenCoords = {};
    return valid.map(h => {
      const copy = { ...h, geo: { ...h.geo } };
      const key = `${h.geo.lat.toFixed(3)},${h.geo.lon.toFixed(3)}`;
      
      if (coordCounts[key] > 1) {
        seenCoords[key] = (seenCoords[key] || 0) + 1;
        const count = seenCoords[key];
        const total = coordCounts[key];
        // Distribute evenly in a radial orbit around the hub
        const angle = ((count - 1) / total) * (2 * Math.PI) + 0.35;
        // Balanced spread: ~22-25 km radius so dots sit cleanly apart
        const spreadRadius = 0.20 + (total > 4 ? 0.05 : 0);
        // Correct for latitude distortion so circles don't turn into squashed ovals
        const cosLat = Math.max(0.25, Math.cos(copy.geo.lat * Math.PI / 180));
        copy.geo.lat += Math.sin(angle) * spreadRadius;
        copy.geo.lon += (Math.cos(angle) * spreadRadius) / cosLat;
        copy.isClustered = true;
      }
      return copy;
    });
  }, [hops]);

  // Deep obsidian oceanic material for the globe base
  const globeMaterial = useMemo(() => {
    return new THREE.MeshPhongMaterial({
      color: '#070a12',
      emissive: '#03050a',
      specular: '#1e293b',
      shininess: 12,
    });
  }, []);

  // 100% True 3D WebGL Node Markers: Firmly anchored to globe terrain (Zero Parallax Drift!)
  const pointsData = useMemo(() => {
    const list = [];

    // Helper to generate sleek dark HUD tooltip HTML
    const getTooltip = ({ title, subtitle, info, latency, color }) => `
      <div style="background: rgba(10, 15, 29, 0.95); border: 1px solid ${color}; padding: 7px 11px; border-radius: 8px; color: #f8fafc; font-family: ui-sans-serif, system-ui, sans-serif; font-size: 11px; box-shadow: 0 10px 25px rgba(0,0,0,0.85); backdrop-filter: blur(6px); pointer-events: none;">
        <div style="color: ${color}; font-weight: 700; margin-bottom: 2px; display: flex; align-items: center; gap: 6px;">
          <span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:${color}; box-shadow:0 0 8px ${color};"></span>
          ${title}
        </div>
        <div style="font-weight: 500; color: #e2e8f0;">${subtitle}</div>
        ${info ? `<div style="color: #94a3b8; font-size: 10px; margin-top: 2px;">${info}</div>` : ''}
        ${latency ? `<div style="color: #34d399; font-weight: 600; font-size: 10px; margin-top: 2px;">Latency: ${latency} ms</div>` : ''}
      </div>
    `;

    // User Location Node
    if (myLocation?.lat && myLocation?.lon) {
      const tooltip = getTooltip({
        title: 'My Location (Gateway)',
        subtitle: `${myLocation.city || 'Local'}, ${myLocation.country || ''}`,
        info: `IP: ${myLocation.query || 'Internal'}`,
        color: '#38bdf8'
      });

      // Outer ambient glow halo disc
      list.push({
        lat: myLocation.lat,
        lng: myLocation.lon,
        color: 'rgba(56, 189, 248, 0.28)',
        radius: 0.35,
        altitude: 0.006,
        label: tooltip,
        hopData: null
      });

      // Solid crisp center cyan jewel
      list.push({
        lat: myLocation.lat,
        lng: myLocation.lon,
        color: '#38bdf8',
        radius: 0.16,
        altitude: 0.009,
        label: tooltip,
        hopData: null
      });
    }

    // Trace Hops
    processedHops.forEach((hop, idx) => {
      const isSelected = (selectedHop && selectedHop.hop === hop.hop) || (hoveredHop && hoveredHop.hop === hop.hop);
      const isLast = idx === processedHops.length - 1;

      const themeColor = isSelected ? '#fbbf24' : (isLast ? '#34d399' : '#10b981');
      const haloColor = isSelected ? 'rgba(251, 191, 36, 0.45)' : (isLast ? 'rgba(52, 211, 153, 0.35)' : 'rgba(16, 185, 129, 0.25)');

      const tooltip = getTooltip({
        title: `Hop #${hop.hop}`,
        subtitle: `${hop.geo.city || 'Unknown City'}, ${hop.geo.country || ''}`,
        info: hop.geo.isp || 'Unknown ISP',
        latency: hop.rtt,
        color: themeColor
      });

      // Outer ambient glowing halo
      list.push({
        lat: hop.geo.lat,
        lng: hop.geo.lon,
        color: haloColor,
        radius: isSelected ? 0.48 : (isLast ? 0.38 : 0.28),
        altitude: 0.006,
        label: tooltip,
        hopData: hop
      });

      // Solid crisp neon core jewel
      list.push({
        lat: hop.geo.lat,
        lng: hop.geo.lon,
        color: themeColor,
        radius: isSelected ? 0.22 : (isLast ? 0.18 : 0.13),
        altitude: 0.009,
        label: tooltip,
        hopData: hop
      });
    });

    return list;
  }, [processedHops, selectedHop, hoveredHop, myLocation]);

  // Trace Arcs: Pure WebGL glowing laser lines with dynamic directional pulses
  const arcsData = useMemo(() => {
    const arcs = [];
    let prevPoint = null;

    if (myLocation?.lat && myLocation?.lon && processedHops.length > 0) {
      prevPoint = { lat: myLocation.lat, lng: myLocation.lon, isMe: true };
    }

    processedHops.forEach((hop, idx) => {
      const currentPoint = { lat: hop.geo.lat, lng: hop.geo.lon, hop };
      if (prevPoint) {
        const distKm = getDistanceKm(prevPoint.lat, prevPoint.lng, currentPoint.lat, currentPoint.lng);
        // Dynamic arc height: smooth power curve so local hops don't shoot into orbit, but long hops arch gracefully
        const arcAlt = Math.max(0.012, Math.min(0.28, Math.pow(distKm / 10000, 0.55) * 0.24));

        const isCurrentSelected = (selectedHop && selectedHop.hop === hop.hop) || (hoveredHop && hoveredHop.hop === hop.hop);
        const isPrevSelected = prevPoint.hop && ((selectedHop && selectedHop.hop === prevPoint.hop.hop) || (hoveredHop && hoveredHop.hop === prevPoint.hop.hop));
        const isHighlight = isCurrentSelected || isPrevSelected;
        const isFirst = !!prevPoint.isMe;
        const isLast = idx === processedHops.length - 1;

        // Visual progression: Gateway (cyan) -> Hop 1 -> ... -> Destination (mint)
        let strokeColor;
        if (isHighlight) {
          strokeColor = isPrevSelected 
            ? ['rgba(251, 191, 36, 0.95)', 'rgba(52, 211, 153, 0.85)'] 
            : ['rgba(16, 185, 129, 0.85)', 'rgba(251, 191, 36, 0.95)'];
        } else if (isFirst) {
          strokeColor = ['rgba(56, 189, 248, 0.95)', 'rgba(16, 185, 129, 0.95)'];
        } else if (isLast) {
          strokeColor = ['rgba(16, 185, 129, 0.7)', 'rgba(52, 211, 153, 1)'];
        } else {
          // Forward gradient pointing in direction of network packets
          strokeColor = ['rgba(16, 185, 129, 0.45)', 'rgba(52, 211, 153, 0.95)'];
        }

        arcs.push({
          startLat: prevPoint.lat,
          startLng: prevPoint.lng,
          endLat: currentPoint.lat,
          endLng: currentPoint.lng,
          altitude: arcAlt,
          color: strokeColor,
          stroke: isHighlight ? 0.26 : 0.14,
          name: `Hop ${hop.hop}`
        });
      }
      prevPoint = currentPoint;
    });

    return arcs;
  }, [processedHops, myLocation, selectedHop, hoveredHop]);

  // 3D WebGL Vector Labels: Mark Start, Destination, and Selected Waypoint clearly
  const labelsData = useMemo(() => {
    const list = [];
    if (myLocation?.lat && myLocation?.lon && processedHops.length > 0) {
      list.push({
        lat: myLocation.lat,
        lng: myLocation.lon,
        text: 'START',
        color: '#38bdf8',
        size: 0.36,
        altitude: 0.016,
      });
    }

    if (processedHops.length > 0) {
      const last = processedHops[processedHops.length - 1];
      list.push({
        lat: last.geo.lat,
        lng: last.geo.lon,
        text: 'TARGET',
        color: '#34d399',
        size: 0.36,
        altitude: 0.016,
      });
    }

    if (selectedHop?.geo?.lat && selectedHop?.geo?.lon) {
      const matched = processedHops.find(h => h.hop === selectedHop.hop) || selectedHop;
      const isLast = processedHops.length > 0 && matched.hop === processedHops[processedHops.length - 1].hop;
      if (!isLast) {
        list.push({
          lat: matched.geo.lat,
          lng: matched.geo.lon,
          text: `#${matched.hop}`,
          color: '#fbbf24',
          size: 0.40,
          altitude: 0.02,
        });
      }
    }

    return list;
  }, [processedHops, myLocation, selectedHop]);

  // Subtle pulsing radar ripples for user, destination, and selected hop
  const ringsData = useMemo(() => {
    const rings = [];
    
    if (myLocation?.lat && myLocation?.lon) {
      rings.push({
        lat: myLocation.lat,
        lng: myLocation.lon,
        color: () => (t) => `rgba(56, 189, 248, ${Math.max(0, 0.75 * (1 - t))})`,
        maxR: 1.5,
        propagationSpeed: 1.0,
        repeatPeriod: 2200,
        altitude: 0.007
      });
    }

    if (selectedHop?.geo?.lat && selectedHop?.geo?.lon) {
      const matched = processedHops.find(h => h.hop === selectedHop.hop) || selectedHop;
      rings.push({
        lat: matched.geo.lat,
        lng: matched.geo.lon,
        color: () => (t) => `rgba(251, 191, 36, ${Math.max(0, 0.85 * (1 - t))})`,
        maxR: 2.0,
        propagationSpeed: 1.5,
        repeatPeriod: 1200,
        altitude: 0.007
      });
    } else if (processedHops.length > 0) {
      const last = processedHops[processedHops.length - 1];
      rings.push({
        lat: last.geo.lat,
        lng: last.geo.lon,
        color: () => (t) => `rgba(52, 211, 153, ${Math.max(0, 0.8 * (1 - t))})`,
        maxR: 1.8,
        propagationSpeed: 1.2,
        repeatPeriod: 1800,
        altitude: 0.007
      });
    }

    return rings;
  }, [processedHops, selectedHop, myLocation]);

  // Explicitly sync layers on real-time streaming updates
  useEffect(() => {
    if (!globeRef.current) return;
    if (typeof globeRef.current.pointsData === 'function') {
      globeRef.current.pointsData(pointsData);
    }
    if (typeof globeRef.current.arcsData === 'function') {
      globeRef.current.arcsData(arcsData);
    }
    if (typeof globeRef.current.ringsData === 'function') {
      globeRef.current.ringsData(ringsData);
    }
    if (typeof globeRef.current.labelsData === 'function') {
      globeRef.current.labelsData(labelsData);
    }
  }, [pointsData, arcsData, ringsData, labelsData]);

  // Setup globe controls and orientation
  useEffect(() => {
    if (!globeRef.current) return;
    const controls = globeRef.current.controls();
    if (controls) {
      controls.autoRotate = autoRotate;
      controls.autoRotateSpeed = 0.5;
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
    }
  }, [autoRotate]);

  // Follow trace packets in real-time as they stream in!
  const prevCountRef = useRef(0);
  useEffect(() => {
    if (!globeRef.current) return;
    const count = processedHops.length;
    if (count === 0) {
      prevCountRef.current = 0;
      return;
    }
    if (count !== prevCountRef.current) {
      prevCountRef.current = count;
      const latest = processedHops[count - 1];
      globeRef.current.pointOfView({
        lat: latest.geo.lat,
        lng: latest.geo.lon,
        altitude: 2.0
      }, 700);
    }
  }, [processedHops]);

  // Smooth camera movements when selecting a hop
  useEffect(() => {
    if (!globeRef.current) return;
    if (selectedHop?.geo?.lat && selectedHop?.geo?.lon) {
      const matched = processedHops.find(h => h.hop === selectedHop.hop) || selectedHop;
      globeRef.current.pointOfView({
        lat: matched.geo.lat,
        lng: matched.geo.lon,
        altitude: 1.6
      }, 900);
      setAutoRotate(false);
    }
  }, [selectedHop, processedHops]);

  const handleResetCamera = () => {
    if (!globeRef.current) return;
    const target = processedHops.length > 0 
      ? { lat: processedHops[0].geo.lat, lng: processedHops[0].geo.lon, altitude: 2.0 }
      : (myLocation?.lat ? { lat: myLocation.lat, lng: myLocation.lon, altitude: 2.2 } : { lat: 20, lng: 0, altitude: 2.5 });
    globeRef.current.pointOfView(target, 1000);
  };

  const handleZoom = (delta) => {
    if (!globeRef.current) return;
    const current = globeRef.current.pointOfView();
    globeRef.current.pointOfView({
      ...current,
      altitude: Math.max(0.6, Math.min(4.5, current.altitude + delta))
    }, 350);
  };

  return (
    <div ref={containerRef} className="w-full h-full relative bg-gray-950 overflow-hidden select-none">
      {dimensions.width > 0 && dimensions.height > 0 && (
        <Globe
          ref={globeRef}
          width={dimensions.width}
          height={dimensions.height}
          
          /* Dark Obsidian Base & Cybernetic Atmosphere */
          backgroundColor="#030712"
          globeMaterial={globeMaterial}
          showGlobe={true}
          showAtmosphere={true}
          atmosphereColor="#10b981"
          atmosphereAltitude={0.16}
          showGraticules={true}

          /* Crisp Vector Continents & Country Borders */
          polygonsData={countries.features}
          polygonCapColor={getPolygonCapColor}
          polygonSideColor={getPolygonSideColor}
          polygonStrokeColor={getPolygonStrokeColor}
          polygonAltitude={0.005}
          polygonCapCurvatureResolution={2}
          polygonLabel={getPolygonLabel}
          polygonsTransitionDuration={0}

          /* 100% True 3D WebGL Nodes (Anchored to surface, ZERO parallax shift!) */
          pointsData={pointsData}
          pointLat="lat"
          pointLng="lng"
          pointColor="color"
          pointRadius="radius"
          pointAltitude="altitude"
          pointResolution={32}
          pointLabel="label"
          pointsTransitionDuration={0}
          onPointClick={(point) => {
            if (point && point.hopData) {
              setSelectedHop(point.hopData);
            }
          }}

          /* 3D WebGL Vector Labels for Start, Target, and Selected Waypoint */
          labelsData={labelsData}
          labelLat="lat"
          labelLng="lng"
          labelText="text"
          labelColor="color"
          labelSize="size"
          labelAltitude="altitude"
          labelIncludeDot={false}
          labelResolution={2}
          labelsTransitionDuration={0}

          /* Glowing laser tubes with directional pulsing energy packets */
          arcsData={arcsData}
          arcStartLat="startLat"
          arcStartLng="startLng"
          arcEndLat="endLat"
          arcEndLng="endLng"
          arcAltitude="altitude"
          arcColor="color"
          arcStroke="stroke"
          arcDashLength={0.35}
          arcDashGap={0.2}
          arcDashInitialGap={0}
          arcDashAnimateTime={1200}
          arcsTransitionDuration={0}

          /* Pulsing radar ripples */
          ringsData={ringsData}
          ringLat="lat"
          ringLng="lng"
          ringColor="color"
          ringMaxRadius="maxR"
          ringPropagationSpeed="propagationSpeed"
          ringRepeatPeriod="repeatPeriod"
          ringAltitude="altitude"
        />
      )}

      {/* Route Flow HUD Status */}
      {processedHops.length > 0 && (
        <div className="absolute top-6 left-6 z-20 flex flex-col gap-1.5 pointer-events-none select-none">
          <div className="flex items-center gap-2 bg-gray-900/85 border border-gray-700/80 rounded-xl px-3.5 py-2 backdrop-blur-md shadow-2xl text-xs font-mono pointer-events-auto">
            <div className="flex items-center gap-1.5 text-sky-400 font-semibold" title={myLocation?.city}>
              <span className="w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_8px_#38bdf8]"></span>
              <span>{myLocation?.city || 'Gateway'}</span>
            </div>
            <span className="text-gray-500 font-bold">➔</span>
            <span className="text-gray-400 px-1 py-0.5 bg-gray-800/80 rounded text-[11px]">
              {processedHops.length} {processedHops.length === 1 ? 'hop' : 'hops'}
            </span>
            <span className="text-gray-500 font-bold">➔</span>
            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold" title={processedHops[processedHops.length - 1].geo.city}>
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981]"></span>
              <span>{processedHops[processedHops.length - 1].geo.city || processedHops[processedHops.length - 1].geo.country || 'Target'}</span>
            </div>
          </div>

          {selectedHop && (
            <div className="flex items-center gap-2 bg-amber-950/70 border border-amber-500/40 rounded-lg px-3 py-1.5 backdrop-blur-md shadow-xl text-xs font-mono text-amber-300 pointer-events-auto">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
              <span className="font-bold">Hop #{selectedHop.hop}:</span>
              <span>{selectedHop.geo?.city || 'Unknown'}, {selectedHop.geo?.country || ''}</span>
              {selectedHop.rtt && <span className="text-amber-400/80 font-semibold">({selectedHop.rtt}ms)</span>}
            </div>
          )}
        </div>
      )}

      {/* Globe Floating Controls */}
      <div className="absolute bottom-6 right-6 z-20 flex flex-col gap-2">
        <button
          onClick={() => setAutoRotate(prev => !prev)}
          className={`p-2.5 rounded-full border backdrop-blur-sm transition-all shadow-lg ${
            autoRotate 
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-emerald-500/20' 
              : 'bg-gray-900/80 text-gray-400 hover:text-emerald-400 border-gray-700'
          }`}
          title={autoRotate ? "Pause Auto-Rotation" : "Start Auto-Rotation"}
        >
          <RotateCw size={18} className={autoRotate ? "animate-spin" : ""} style={{ animationDuration: '6s' }} />
        </button>

        <button
          onClick={handleResetCamera}
          className="p-2.5 rounded-full bg-gray-900/80 text-gray-400 hover:text-emerald-400 border border-gray-700 backdrop-blur-sm transition-all shadow-lg"
          title="Reset View"
        >
          <Compass size={18} />
        </button>

        <button
          onClick={() => handleZoom(-0.5)}
          className="p-2.5 rounded-full bg-gray-900/80 text-gray-400 hover:text-emerald-400 border border-gray-700 backdrop-blur-sm transition-all shadow-lg"
          title="Zoom In"
        >
          <ZoomIn size={18} />
        </button>

        <button
          onClick={() => handleZoom(0.5)}
          className="p-2.5 rounded-full bg-gray-900/80 text-gray-400 hover:text-emerald-400 border border-gray-700 backdrop-blur-sm transition-all shadow-lg"
          title="Zoom Out"
        >
          <ZoomOut size={18} />
        </button>
      </div>

      {/* Atmospheric vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{
        boxShadow: 'inset 0 0 100px rgba(0,0,0,0.9)'
      }}></div>
    </div>
  );
}
