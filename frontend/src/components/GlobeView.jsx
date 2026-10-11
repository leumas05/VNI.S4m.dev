import React, { useRef, useEffect, useState, useMemo } from 'react';
import Globe from 'react-globe.gl';
import { RotateCw, Compass, ZoomIn, ZoomOut } from 'lucide-react';
import earthDarkUrl from '../assets/earth-dark.jpg';

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

  // Points / Markers
  const pointsData = useMemo(() => {
    const list = [];
    
    if (myLocation?.lat && myLocation?.lon) {
      list.push({
        lat: myLocation.lat,
        lng: myLocation.lon,
        isMe: true,
        hopNum: 0,
        color: '#3b82f6',
        size: 0.65,
        altitude: 0.02,
        label: `
          <div style="background: rgba(17, 24, 39, 0.95); border: 1px solid #1e3a8a; padding: 8px 12px; border-radius: 8px; color: #f3f4f6; font-family: ui-sans-serif, system-ui, sans-serif; font-size: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.6); pointer-events: none;">
            <div style="color: #60a5fa; font-weight: bold; margin-bottom: 2px;">📍 My Location</div>
            <div>${myLocation.city || 'Local'}, ${myLocation.country || ''}</div>
            <div style="color: #9ca3af; font-size: 11px; margin-top: 2px;">IP: ${myLocation.query || 'Internal'}</div>
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
        size: isSelected ? 0.95 : 0.55,
        altitude: 0.02,
        label: `
          <div style="background: rgba(17, 24, 39, 0.95); border: 1px solid ${isSelected ? '#b45309' : '#065f46'}; padding: 8px 12px; border-radius: 8px; color: #f3f4f6; font-family: ui-sans-serif, system-ui, sans-serif; font-size: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.6); pointer-events: none;">
            <div style="color: ${isSelected ? '#fbbf24' : '#34d399'}; font-weight: bold; margin-bottom: 2px;">Hop #${hop.hop}</div>
            <div>${hop.geo.city || 'Unknown City'}, ${hop.geo.country || ''}</div>
            <div style="color: #9ca3af; font-size: 11px; margin-top: 2px;">${hop.geo.isp || 'Unknown ISP'}</div>
            ${hop.rtt ? `<div style="color: #10b981; font-weight: 600; font-size: 11px; margin-top: 2px;">Ping: ${hop.rtt} ms</div>` : ''}
          </div>
        `
      });
    });

    return list;
  }, [validHops, selectedHop, hoveredHop, myLocation]);

  // Arcs connecting hops
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
          color: ['#10b981', '#34d399'],
          name: `Hop ${hop.hop}`
        });
      }
      prevPoint = currentPoint;
    });

    return arcs;
  }, [validHops, myLocation]);

  // Rings for selected hop or destination
  const ringsData = useMemo(() => {
    const rings = [];
    if (selectedHop?.geo?.lat && selectedHop?.geo?.lon) {
      rings.push({
        lat: selectedHop.geo.lat,
        lng: selectedHop.geo.lon,
        color: '#f59e0b',
        maxR: 3.5,
        propagationSpeed: 2,
        repeatPeriod: 1200
      });
    } else if (validHops.length > 0) {
      const last = validHops[validHops.length - 1];
      rings.push({
        lat: last.geo.lat,
        lng: last.geo.lon,
        color: '#10b981',
        maxR: 3.5,
        propagationSpeed: 1.5,
        repeatPeriod: 1500
      });
    }
    return rings;
  }, [validHops, selectedHop]);

  // Labels for hop numbers
  const labelsData = useMemo(() => {
    return validHops.map(hop => ({
      lat: hop.geo.lat,
      lng: hop.geo.lon,
      text: `${hop.hop}`,
      color: '#ffffff',
      size: 0.8,
      altitude: 0.035
    }));
  }, [validHops]);

  // Setup globe controls and orientation
  useEffect(() => {
    if (!globeRef.current) return;
    const controls = globeRef.current.controls();
    if (controls) {
      controls.autoRotate = autoRotate;
      controls.autoRotateSpeed = 0.6;
      controls.enableDamping = true;
      controls.dampingFactor = 0.1;
    }
  }, [autoRotate]);

  // Smoothly rotate globe to selected hop
  useEffect(() => {
    if (!globeRef.current) return;
    if (selectedHop?.geo?.lat && selectedHop?.geo?.lon) {
      globeRef.current.pointOfView({
        lat: selectedHop.geo.lat,
        lng: selectedHop.geo.lon,
        altitude: 1.8
      }, 1000);
      setAutoRotate(false);
    } else if (validHops.length > 0) {
      const center = validHops[Math.floor(validHops.length / 2)];
      globeRef.current.pointOfView({
        lat: center.geo.lat,
        lng: center.geo.lon,
        altitude: 2.2
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
      ? { lat: validHops[0].geo.lat, lng: validHops[0].geo.lon, altitude: 2.2 }
      : (myLocation?.lat ? { lat: myLocation.lat, lng: myLocation.lon, altitude: 2.2 } : { lat: 20, lng: 0, altitude: 2.5 });
    globeRef.current.pointOfView(target, 1000);
  };

  const handleZoom = (delta) => {
    if (!globeRef.current) return;
    const current = globeRef.current.pointOfView();
    globeRef.current.pointOfView({
      ...current,
      altitude: Math.max(0.6, Math.min(4.5, current.altitude + delta))
    }, 400);
  };

  return (
    <div ref={containerRef} className="w-full h-full relative bg-gray-950 overflow-hidden select-none">
      {dimensions.width > 0 && dimensions.height > 0 && (
        <Globe
          ref={globeRef}
          width={dimensions.width}
          height={dimensions.height}
          globeImageUrl={earthDarkUrl}
          backgroundColor="#030712"
          atmosphereColor="#10b981"
          atmosphereAltitude={0.18}
          
          pointsData={pointsData}
          pointLat="lat"
          pointLng="lng"
          pointColor="color"
          pointAltitude="altitude"
          pointRadius="size"
          pointLabel="label"
          onPointClick={(point) => {
            if (point.hopData) {
              setSelectedHop(point.hopData);
            }
          }}

          arcsData={arcsData}
          arcStartLat="startLat"
          arcStartLng="startLng"
          arcEndLat="endLat"
          arcEndLng="endLng"
          arcColor="color"
          arcDashLength={0.6}
          arcDashGap={0.3}
          arcDashInitialGap={() => Math.random()}
          arcDashAnimateTime={2000}
          arcStroke={1.8}
          arcAltitudeAutoScale={0.4}

          ringsData={ringsData}
          ringLat="lat"
          ringLng="lng"
          ringColor="color"
          ringMaxRadius="maxR"
          ringPropagationSpeed="propagationSpeed"
          ringRepeatPeriod="repeatPeriod"

          labelsData={labelsData}
          labelLat="lat"
          labelLng="lng"
          labelText="text"
          labelSize="size"
          labelColor="color"
          labelAltitude="altitude"
          labelDotRadius={0}
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
