import React, { useRef, useEffect, useState, useMemo } from 'react';
import Globe from 'react-globe.gl';
import * as THREE from 'three';
import { RotateCw, Compass, ZoomIn, ZoomOut } from 'lucide-react';
import countries from '../assets/countries.json';

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

  const validHops = useMemo(() => {
    return hops.filter(h => h && h.geo && h.geo.lat && h.geo.lon);
  }, [hops]);

  // Deep obsidian oceanic material for the globe base
  const globeMaterial = useMemo(() => {
    return new THREE.MeshPhongMaterial({
      color: '#070a12',
      emissive: '#03050a',
      specular: '#111827',
      shininess: 8,
    });
  }, []);

  // Points / Markers (sleek glowing pinpoints, not bloated dots)
  const pointsData = useMemo(() => {
    const list = [];
    
    if (myLocation?.lat && myLocation?.lon) {
      list.push({
        lat: myLocation.lat,
        lng: myLocation.lon,
        isMe: true,
        hopNum: 0,
        color: '#3b82f6',
        size: 0.38,
        altitude: 0.015,
        label: `
          <div style="background: rgba(15, 23, 42, 0.95); border: 1px solid #1d4ed8; padding: 8px 12px; border-radius: 8px; color: #f8fafc; font-family: ui-sans-serif, system-ui, sans-serif; font-size: 12px; box-shadow: 0 12px 30px rgba(0,0,0,0.8); backdrop-filter: blur(8px); pointer-events: none;">
            <div style="color: #60a5fa; font-weight: 700; margin-bottom: 3px; display: flex; align-items: center; gap: 4px;">
              <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#3b82f6; box-shadow:0 0 8px #3b82f6;"></span>
              My Location
            </div>
            <div style="font-weight: 500;">${myLocation.city || 'Local'}, ${myLocation.country || ''}</div>
            <div style="color: #94a3b8; font-size: 11px; margin-top: 3px;">IP: ${myLocation.query || 'Internal'}</div>
          </div>
        `
      });
    }

    validHops.forEach(hop => {
      const isSelected = (selectedHop && selectedHop.hop === hop.hop) || (hoveredHop && hoveredHop.hop === hop.hop);
      list.push({
        lat: hop.geo.lat,
        lng: hop.geo.lon,
        isMe: false,
        hopNum: hop.hop,
        hopData: hop,
        color: isSelected ? '#f59e0b' : '#10b981',
        size: isSelected ? 0.55 : 0.32,
        altitude: 0.015,
        label: `
          <div style="background: rgba(15, 23, 42, 0.95); border: 1px solid ${isSelected ? '#d97706' : '#059669'}; padding: 8px 12px; border-radius: 8px; color: #f8fafc; font-family: ui-sans-serif, system-ui, sans-serif; font-size: 12px; box-shadow: 0 12px 30px rgba(0,0,0,0.8); backdrop-filter: blur(8px); pointer-events: none;">
            <div style="color: ${isSelected ? '#fbbf24' : '#34d399'}; font-weight: 700; margin-bottom: 3px; display: flex; align-items: center; gap: 4px;">
              <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${isSelected ? '#f59e0b' : '#10b981'}; box-shadow:0 0 8px ${isSelected ? '#f59e0b' : '#10b981'};"></span>
              Hop #${hop.hop}
            </div>
            <div style="font-weight: 500;">${hop.geo.city || 'Unknown City'}, ${hop.geo.country || ''}</div>
            <div style="color: #94a3b8; font-size: 11px; margin-top: 3px;">${hop.geo.isp || 'Unknown ISP'}</div>
            ${hop.rtt ? `<div style="color: #34d399; font-weight: 600; font-size: 11px; margin-top: 3px;">Latency: ${hop.rtt} ms</div>` : ''}
          </div>
        `
      });
    });

    return list;
  }, [validHops, selectedHop, hoveredHop, myLocation]);

  // Arcs: delicate, luminous fiber-optic pulses (NOT fat ribbons!)
  const arcsData = useMemo(() => {
    const arcs = [];
    let prevPoint = null;

    if (myLocation?.lat && myLocation?.lon && validHops.length > 0) {
      prevPoint = { lat: myLocation.lat, lng: myLocation.lon };
    }

    validHops.forEach(hop => {
      const currentPoint = { lat: hop.geo.lat, lng: hop.geo.lon };
      if (prevPoint) {
        arcs.push({
          startLat: prevPoint.lat,
          startLng: prevPoint.lng,
          endLat: currentPoint.lat,
          endLng: currentPoint.lng,
          color: ['rgba(16, 185, 129, 0.75)', 'rgba(52, 211, 153, 0.95)'],
          name: `Hop ${hop.hop}`
        });
      }
      prevPoint = currentPoint;
    });

    return arcs;
  }, [validHops, myLocation]);

  // Subtle pulsing radar rings for selected hop, destination, and user location
  const ringsData = useMemo(() => {
    const rings = [];
    
    if (myLocation?.lat && myLocation?.lon) {
      rings.push({
        lat: myLocation.lat,
        lng: myLocation.lon,
        color: () => (t) => `rgba(59, 130, 246, ${Math.max(0, 0.8 * (1 - t))})`,
        maxR: 2.2,
        propagationSpeed: 1.2,
        repeatPeriod: 1800,
        altitude: 0.012
      });
    }

    if (selectedHop?.geo?.lat && selectedHop?.geo?.lon) {
      rings.push({
        lat: selectedHop.geo.lat,
        lng: selectedHop.geo.lon,
        color: () => (t) => `rgba(245, 158, 11, ${Math.max(0, 0.9 * (1 - t))})`,
        maxR: 3.2,
        propagationSpeed: 1.8,
        repeatPeriod: 1200,
        altitude: 0.012
      });
    } else if (validHops.length > 0) {
      const last = validHops[validHops.length - 1];
      rings.push({
        lat: last.geo.lat,
        lng: last.geo.lon,
        color: () => (t) => `rgba(16, 185, 129, ${Math.max(0, 0.85 * (1 - t))})`,
        maxR: 3.2,
        propagationSpeed: 1.4,
        repeatPeriod: 1400,
        altitude: 0.012
      });
    }

    return rings;
  }, [validHops, selectedHop, myLocation]);

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

  // Smooth camera movements
  useEffect(() => {
    if (!globeRef.current) return;
    if (selectedHop?.geo?.lat && selectedHop?.geo?.lon) {
      globeRef.current.pointOfView({
        lat: selectedHop.geo.lat,
        lng: selectedHop.geo.lon,
        altitude: 1.7
      }, 1000);
      setAutoRotate(false);
    } else if (validHops.length > 0) {
      const center = validHops[Math.floor(validHops.length / 2)];
      globeRef.current.pointOfView({
        lat: center.geo.lat,
        lng: center.geo.lon,
        altitude: 2.1
      }, 1200);
    } else if (myLocation?.lat && myLocation?.lon) {
      globeRef.current.pointOfView({
        lat: myLocation.lat,
        lng: myLocation.lon,
        altitude: 2.2
      }, 1000);
    }
  }, [selectedHop, validHops.length === 1]);

  const handleResetCamera = () => {
    if (!globeRef.current) return;
    const target = validHops.length > 0 
      ? { lat: validHops[0].geo.lat, lng: validHops[0].geo.lon, altitude: 2.1 }
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

          /* Crisp Vector Continents & Country Borders (matching 2D Esri dark canvas) */
          polygonsData={countries.features}
          polygonCapColor={() => '#18202c'}
          polygonSideColor={() => '#0f141c'}
          polygonStrokeColor={() => '#374151'}
          polygonAltitude={0.006}
          polygonCapCurvatureResolution={2}
          polygonLabel={({ properties: d }) => `
            <div style="background: rgba(15, 23, 42, 0.9); border: 1px solid #374151; padding: 4px 8px; border-radius: 6px; color: #cbd5e1; font-family: ui-sans-serif, system-ui, sans-serif; font-size: 11px; pointer-events: none; backdrop-filter: blur(4px);">
              ${d.ADMIN || d.NAME || ''}
            </div>
          `}

          /* Sleek glowing hop markers */
          pointsData={pointsData}
          pointLat="lat"
          pointLng="lng"
          pointColor="color"
          pointAltitude="altitude"
          pointRadius="size"
          pointResolution={24}
          pointLabel="label"
          onPointClick={(point) => {
            if (point.hopData) {
              setSelectedHop(point.hopData);
            }
          }}

          /* Luminous, razor-thin fiber-optic trace arcs */
          arcsData={arcsData}
          arcStartLat="startLat"
          arcStartLng="startLng"
          arcEndLat="endLat"
          arcEndLng="endLng"
          arcColor="color"
          arcDashLength={0.45}
          arcDashGap={0.18}
          arcDashInitialGap={() => Math.random()}
          arcDashAnimateTime={2000}
          arcStroke={0.5}
          arcAltitudeAutoScale={0.28}

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
