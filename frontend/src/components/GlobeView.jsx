import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
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
        const angle = count * 2.2;
        // Subtle offset radius so co-located nodes fan out into a clean cluster
        const radius = 0.08 + (count * 0.04);
        copy.geo.lat += Math.sin(angle) * radius;
        copy.geo.lon += Math.cos(angle) * radius;
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

  // HTML Elements for Nodes: 100% visible, crisp, glowing circular pins (like 2D Leaflet!)
  const htmlElementsData = useMemo(() => {
    const list = [];
    
    if (myLocation?.lat && myLocation?.lon) {
      list.push({
        lat: myLocation.lat,
        lng: myLocation.lon,
        isMe: true,
        hopNum: 0,
        isSelected: false,
        title: `My Location: ${myLocation.city || 'Local'}, ${myLocation.country || ''}`,
        onSelect: null
      });
    }

    processedHops.forEach(hop => {
      const isSelected = (selectedHop && selectedHop.hop === hop.hop) || (hoveredHop && hoveredHop.hop === hop.hop);
      list.push({
        lat: hop.geo.lat,
        lng: hop.geo.lon,
        isMe: false,
        hopNum: hop.hop,
        isSelected,
        hopData: hop,
        title: `Hop #${hop.hop}: ${hop.geo.city || 'Unknown'}, ${hop.geo.country || ''} (${hop.geo.isp || ''})${hop.rtt ? ` - ${hop.rtt}ms` : ''}`,
        onSelect: () => setSelectedHop(hop)
      });
    });

    return list;
  }, [processedHops, selectedHop, hoveredHop, myLocation, setSelectedHop]);

  // Node marker DOM renderer: Beautiful glowing circular pins with amber/emerald/blue themes
  const createNodeMarker = useCallback((d) => {
    const el = document.createElement('div');
    el.className = 'globe-node-pin';
    el.style.position = 'relative';
    el.style.cursor = 'pointer';
    el.style.pointerEvents = 'auto';
    el.style.userSelect = 'none';

    // Outer ambient glowing halo
    const halo = document.createElement('div');
    halo.style.position = 'absolute';
    halo.style.top = '50%';
    halo.style.left = '50%';
    halo.style.transform = 'translate(-50%, -50%)';
    halo.style.borderRadius = '50%';
    halo.style.width = d.isSelected ? '28px' : (d.isMe ? '24px' : '20px');
    halo.style.height = d.isSelected ? '28px' : (d.isMe ? '24px' : '20px');
    halo.style.backgroundColor = d.isMe 
      ? 'rgba(56, 189, 248, 0.28)' 
      : (d.isSelected ? 'rgba(251, 191, 36, 0.35)' : 'rgba(16, 185, 129, 0.28)');
    halo.style.boxShadow = d.isMe 
      ? '0 0 14px #38bdf8' 
      : (d.isSelected ? '0 0 16px #fbbf24' : '0 0 12px #10b981');
    halo.style.transition = 'all 0.2s ease-out';

    // Solid crisp center jewel dot
    const dot = document.createElement('div');
    dot.style.position = 'absolute';
    dot.style.top = '50%';
    dot.style.left = '50%';
    dot.style.transform = 'translate(-50%, -50%)';
    dot.style.borderRadius = '50%';
    dot.style.width = d.isSelected ? '14px' : (d.isMe ? '12px' : '10px');
    dot.style.height = d.isSelected ? '14px' : (d.isMe ? '12px' : '10px');
    dot.style.backgroundColor = d.isMe ? '#38bdf8' : (d.isSelected ? '#fbbf24' : '#10b981');
    dot.style.border = d.isMe 
      ? '2px solid #0369a1' 
      : (d.isSelected ? '2px solid #78350f' : '2px solid #064e3b');
    dot.style.boxShadow = d.isMe 
      ? '0 0 8px #38bdf8' 
      : (d.isSelected ? '0 0 10px #fbbf24' : '0 0 6px #10b981');
    dot.style.transition = 'all 0.2s ease-out';

    el.appendChild(halo);
    el.appendChild(dot);

    // Native browser hover tooltip
    el.title = d.title;

    // Hover effect
    el.onmouseenter = () => {
      dot.style.transform = 'translate(-50%, -50%) scale(1.35)';
      halo.style.transform = 'translate(-50%, -50%) scale(1.4)';
    };
    el.onmouseleave = () => {
      dot.style.transform = 'translate(-50%, -50%) scale(1)';
      halo.style.transform = 'translate(-50%, -50%) scale(1)';
    };

    el.onclick = (e) => {
      e.stopPropagation();
      if (d.onSelect) d.onSelect();
    };

    return el;
  }, []);

  // Trace Arcs: Pure WebGL glowing laser lines (stroke=null uses THREE.Line!)
  const arcsData = useMemo(() => {
    const arcs = [];
    let prevPoint = null;

    if (myLocation?.lat && myLocation?.lon && processedHops.length > 0) {
      prevPoint = { lat: myLocation.lat, lng: myLocation.lon };
    }

    processedHops.forEach(hop => {
      const currentPoint = { lat: hop.geo.lat, lng: hop.geo.lon };
      if (prevPoint) {
        const distKm = getDistanceKm(prevPoint.lat, prevPoint.lng, currentPoint.lat, currentPoint.lng);
        // Dynamic arc height: even short hops arch gracefully above the surface
        const arcAlt = Math.max(0.045, Math.min(0.28, distKm * 0.000045));

        arcs.push({
          startLat: prevPoint.lat,
          startLng: prevPoint.lng,
          endLat: currentPoint.lat,
          endLng: currentPoint.lng,
          altitude: arcAlt,
          color: ['rgba(16, 185, 129, 0.45)', 'rgba(52, 211, 153, 0.95)'],
          name: `Hop ${hop.hop}`
        });
      }
      prevPoint = currentPoint;
    });

    return arcs;
  }, [processedHops, myLocation]);

  // Subtle pulsing radar ripples for user, destination, and selected hop
  const ringsData = useMemo(() => {
    const rings = [];
    
    if (myLocation?.lat && myLocation?.lon) {
      rings.push({
        lat: myLocation.lat,
        lng: myLocation.lon,
        color: () => (t) => `rgba(56, 189, 248, ${Math.max(0, 0.7 * (1 - t))})`,
        maxR: 2.2,
        propagationSpeed: 1.2,
        repeatPeriod: 2000,
        altitude: 0.012
      });
    }

    if (selectedHop?.geo?.lat && selectedHop?.geo?.lon) {
      const matched = processedHops.find(h => h.hop === selectedHop.hop) || selectedHop;
      rings.push({
        lat: matched.geo.lat,
        lng: matched.geo.lon,
        color: () => (t) => `rgba(251, 191, 36, ${Math.max(0, 0.85 * (1 - t))})`,
        maxR: 3.2,
        propagationSpeed: 1.8,
        repeatPeriod: 1200,
        altitude: 0.012
      });
    } else if (processedHops.length > 0) {
      const last = processedHops[processedHops.length - 1];
      rings.push({
        lat: last.geo.lat,
        lng: last.geo.lon,
        color: () => (t) => `rgba(16, 185, 129, ${Math.max(0, 0.8 * (1 - t))})`,
        maxR: 3.2,
        propagationSpeed: 1.4,
        repeatPeriod: 1500,
        altitude: 0.012
      });
    }

    return rings;
  }, [processedHops, selectedHop, myLocation]);

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
    if (count > 0 && count !== prevCountRef.current) {
      prevCountRef.current = count;
      const latest = processedHops[count - 1];
      globeRef.current.pointOfView({
        lat: latest.geo.lat,
        lng: latest.geo.lon,
        altitude: 2.0
      }, 700);
    }
  }, [processedHops.length]);

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
  }, [selectedHop]);

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

          /* 100% visible glowing HTML node markers */
          htmlElementsData={htmlElementsData}
          htmlLat="lat"
          htmlLng="lng"
          htmlAltitude={0.018}
          htmlElement={createNodeMarker}
          htmlTransitionDuration={0}

          /* Razor-thin glowing laser lines (THREE.Line) updating in real-time */
          arcsData={arcsData}
          arcStartLat="startLat"
          arcStartLng="startLng"
          arcEndLat="endLat"
          arcEndLng="endLng"
          arcAltitude="altitude"
          arcColor="color"
          arcDashLength={0.4}
          arcDashGap={0.2}
          arcDashInitialGap={0}
          arcDashAnimateTime={1600}
          arcStroke={null}
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
