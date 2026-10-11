import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function ZoomTracker({ setZoomLevel }) {
  const map = useMapEvents({
    zoomend: () => setZoomLevel(map.getZoom())
  });
  useEffect(() => {
    setZoomLevel(map.getZoom());
  }, [map, setZoomLevel]);
  return null;
}

function MapBounds({ positions, myLocation }) {
  const map = useMap();
  const positionsHash = JSON.stringify(positions);
  
  useEffect(() => {
    if (positions.length > 0) {
      const bounds = L.latLngBounds(positions);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
    } else if (myLocation && myLocation.lat && myLocation.lon) {
      map.setView([myLocation.lat, myLocation.lon], 5);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionsHash, myLocation, map]);
  return null;
}

function formatTimer(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getCurvedPoints(p1, p2, offsetMultiplier) {
    const [lat1, lon1] = p1;
    const [lat2, lon2] = p2;
    
    if (lat1 === lat2 && lon1 === lon2) {
        const loopPoints = [];
        const steps = 32;
        const radius = 0.2 + (offsetMultiplier * 0.8);
        const centerLat = lat1 + radius;
        const centerLon = lon1;
        
        for (let i = 0; i <= steps; i++) {
            const angle = (i / steps) * Math.PI * 2;
            const a = angle - (Math.PI / 2);
            loopPoints.push([
                centerLat + Math.sin(a) * radius,
                centerLon + Math.cos(a) * radius
            ]);
        }
        return loopPoints;
    }

    const midLat = (lat1 + lat2) / 2;
    const dLon = lon2 - lon1;
    const midLon = (lon1 + lon2) / 2;
    const dLat = lat2 - lat1;
    
    const length = Math.sqrt(dLat*dLat + dLon*dLon);
    
    const perpLat = -dLon / length;
    const perpLon = dLat / length;
    
    const curveDepth = length * offsetMultiplier;
    
    const ctrlLat = midLat + perpLat * curveDepth;
    const ctrlLon = midLon + perpLon * curveDepth;
    
    const points = [];
    const steps = 32;
    
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const u = 1 - t;
        const bLat = (u * u * lat1) + (2 * u * t * ctrlLat) + (t * t * lat2);
        const bLon = (u * u * lon1) + (2 * u * t * ctrlLon) + (t * t * lon2);
        points.push([bLat, bLon]);
    }
    return points;
}

export default function MapView({
  hops = [],
  selectedHop,
  setSelectedHop,
  hoveredHop,
  myLocation,
  activeMode = 'traceroute',
  radarData,
  selectedRadarConn,
  setSelectedRadarConn,
  isRecordingRadar = false,
  recordingElapsed = 0
}) {
  const [zoomLevel, setZoomLevel] = useState(2);
  const isRadar = activeMode === 'radar';

  const validHops = (hops || []).filter(h => h && h.geo && !isNaN(Number(h.geo.lat)) && !isNaN(Number(h.geo.lon)));
  const radarConnections = (radarData?.connections || []).filter(c => c && c.geo && !isNaN(Number(c.geo.lat)) && !isNaN(Number(c.geo.lon)));
  
  let myDisplayLat = myLocation?.lat;
  let myDisplayLon = myLocation?.lon;

  if (myDisplayLat && myDisplayLon) {
      while (validHops.some(h => h.geo.lat === myDisplayLat && h.geo.lon === myDisplayLon)) {
          myDisplayLat -= 0.002;
          myDisplayLon -= 0.002;
      }
  }

  const unwrappedHops = [];
  let currentLonOffset = 0;
  let prevLon = null;

  for (let i = 0; i < validHops.length; i++) {
      const hop = { ...validHops[i], geo: { ...validHops[i].geo } };
      let lon = hop.geo.lon;
      
      if (prevLon !== null) {
          let dLon = lon - prevLon;
          if (dLon > 180) currentLonOffset -= 360;
          else if (dLon < -180) currentLonOffset += 360;
      }
      
      hop.geo.lon = lon + currentLonOffset;
      prevLon = lon;
      unwrappedHops.push(hop);
  }

  const originalCoordCounts = {};
  unwrappedHops.forEach(h => {
      const key = `${h.geo.lat},${h.geo.lon}`;
      originalCoordCounts[key] = (originalCoordCounts[key] || 0) + 1;
  });

  const hopCoordMap = {};
  for (let i = 0; i < unwrappedHops.length; i++) {
      const hop = unwrappedHops[i];
      const key = `${hop.geo.lat},${hop.geo.lon}`;
      
      hop.isClustered = originalCoordCounts[key] > 1;
      
      if (hopCoordMap[key] === undefined) {
          hopCoordMap[key] = 0;
      } else {
          hopCoordMap[key]++;
          const count = hopCoordMap[key];
          const angle = count * 2.4; 
          const radius = 0.005 + (count * 0.002);
          hop.geo.lat += Math.sin(angle) * radius;
          hop.geo.lon += Math.cos(angle) * radius;
      }
  }

  const positions = isRadar 
    ? radarConnections.map(c => [c.geo.lat, c.geo.lon])
    : unwrappedHops.map(h => [h.geo.lat, h.geo.lon]);

  const segments = [];
  const segmentCounts = {};
  
  if (isRadar) {
    if (myDisplayLat && myDisplayLon) {
      radarConnections.forEach((conn) => {
        const isSelected = selectedRadarConn && selectedRadarConn.remoteIp === conn.remoteIp && selectedRadarConn.remotePort === conn.remotePort;
        const isInactive = conn.isActive === false;
        segments.push({
          points: getCurvedPoints([myDisplayLat, myDisplayLon], [conn.geo.lat, conn.geo.lon], 0.12),
          isSelected,
          color: isSelected ? '#f59e0b' : (isInactive ? '#64748b' : '#10b981'),
          weight: isSelected ? 3 : (isInactive ? 1.5 : 2),
          opacity: isInactive ? 0.35 : (isSelected ? 0.9 : 0.6)
        });
      });
    }
  } else {
    if (myDisplayLat && myDisplayLon && positions.length > 0) {
        segments.push({
            points: getCurvedPoints([myDisplayLat, myDisplayLon], positions[0], 0.15),
            hopNum: 0,
            isClustered: false
        });
    }

    if (positions.length > 1) {
        for (let i = 0; i < positions.length - 1; i++) {
            const p1 = positions[i];
            const p2 = positions[i+1];
            const key = `${p1[0]},${p1[1]}->${p2[0]},${p2[1]}`;
            if (!segmentCounts[key]) segmentCounts[key] = 0;
            segmentCounts[key]++;
            
            const multiplier = segmentCounts[key] * 0.15;
            segments.push({
                points: getCurvedPoints(p1, p2, multiplier),
                hopNum: unwrappedHops[i].hop,
                isClustered: unwrappedHops[i].isClustered
            });
        }
    }
  }

  const getIcon = (hopNum, isSelected, isZoomedIn, isClustered) => {
      let color = '#10b981';
      let border = '#064e3b';
      let size = 12;
      
      if (isSelected) {
          color = '#f59e0b';
          border = '#78350f';
          size = 16;
      } else if (isZoomedIn && isClustered) {
          const palette = [
              { bg: '#ef4444', border: '#7f1d1d' }, // Red
              { bg: '#3b82f6', border: '#1e3a8a' }, // Blue
              { bg: '#f97316', border: '#7c2d12' }, // Orange
              { bg: '#8b5cf6', border: '#4c1d95' }, // Purple
              { bg: '#eab308', border: '#713f12' }, // Yellow
              { bg: '#ec4899', border: '#831843' }, // Pink
              { bg: '#06b6d4', border: '#164e63' }, // Cyan
              { bg: '#6366f1', border: '#312e81' }  // Indigo
          ];
          const theme = palette[hopNum % palette.length];
          color = theme.bg;
          border = theme.border;
      }
      
      return new L.DivIcon({
          className: isSelected ? 'custom-marker-selected' : 'custom-marker',
          html: `<div style="background-color: ${color}; width: ${size}px; height: ${size}px; border-radius: 50%; border: 2px solid ${border}; box-shadow: 0 0 10px ${color};"></div>`,
          iconSize: [size, size],
          iconAnchor: [size/2, size/2]
      });
  };

  return (
    <div className="w-full h-full relative bg-gray-900 z-0">
      <MapContainer 
        center={[20, 0]} 
        zoom={2} 
        style={{ height: '100%', width: '100%', background: '#0a0a0a' }}
        zoomControl={false}
      >
        <ZoomTracker setZoomLevel={setZoomLevel} />
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
          attribution='Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ'
        />
        
        <MapBounds positions={positions} myLocation={myLocation} />
        
        {segments.map((segment, idx) => {
           return (
             <Polyline 
               key={idx}
               positions={segment.points} 
               color={segment.color || '#10b981'} 
               weight={segment.weight || 2}
               opacity={segment.isSelected ? 0.9 : 0.6}
               dashArray="5, 10"
               className="animated-trace-line"
             />
           );
        })}
        
        {isRadar ? (
          radarConnections.map((conn, idx) => {
            const isSelected = selectedRadarConn && selectedRadarConn.remoteIp === conn.remoteIp && selectedRadarConn.remotePort === conn.remotePort;
            const isInactive = conn.isActive === false;
            const p = (conn.process || '').toLowerCase();
            let color = '#6366f1';
            let border = '#312e81';
            if (isSelected) {
              color = '#f59e0b';
              border = '#78350f';
            } else if (isInactive) {
              color = '#64748b';
              border = '#334155';
            } else if (p.includes('chrome') || p.includes('edge') || p.includes('firefox') || p.includes('brave')) {
              color = '#10b981';
              border = '#064e3b';
            } else if (p.includes('discord') || p.includes('spotify') || p.includes('steam')) {
              color = '#a855f7';
              border = '#581c87';
            } else if (p.includes('code') || p.includes('node') || p.includes('git') || p.includes('electron')) {
              color = '#38bdf8';
              border = '#0369a1';
            } else if (p.includes('onedrive') || p.includes('dropbox') || p.includes('googledrive')) {
              color = '#f59e0b';
              border = '#78350f';
            }
            const size = isSelected ? 16 : (isInactive ? 10 : 12);
            const icon = new L.DivIcon({
              className: isSelected ? 'custom-marker-selected' : 'custom-marker',
              html: `<div style="background-color: ${color}; width: ${size}px; height: ${size}px; border-radius: 50%; border: 2px solid ${border}; box-shadow: 0 0 ${isInactive ? '3px' : '10px'} ${color}; opacity: ${isInactive ? 0.65 : 1};"></div>`,
              iconSize: [size, size],
              iconAnchor: [size / 2, size / 2]
            });

            return (
              <Marker
                key={`radar-${conn.remoteIp}-${conn.remotePort}-${idx}`}
                position={[conn.geo.lat, conn.geo.lon]}
                icon={icon}
                zIndexOffset={isSelected ? 500 : (isInactive ? -50 : 0)}
                eventHandlers={{
                  click: () => setSelectedRadarConn && setSelectedRadarConn(isSelected ? null : conn)
                }}
              >
                <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                  <div className="text-gray-900 font-sans text-sm">
                    <strong>{conn.process || 'Process'} (:{conn.remotePort || ''}){isInactive ? ' [Closed]' : ''}</strong><br/>
                    <span className="text-gray-600 text-xs font-mono">{conn.remoteIp}</span><br/>
                    <span className="text-gray-500 text-xs">
                      {conn.geo?.city ? `${conn.geo.city}, ` : ''}{conn.geo?.country} {conn.geo?.isp ? `• ${conn.geo.isp}` : ''}
                    </span>
                  </div>
                </Tooltip>
              </Marker>
            );
          })
        ) : (
          unwrappedHops.map((hop) => {
            const isSelected = (selectedHop && selectedHop.hop === hop.hop) || (hoveredHop && hoveredHop.hop === hop.hop);
            return (
              <Marker 
                key={hop.hop} 
                position={[hop.geo.lat, hop.geo.lon]}
                icon={getIcon(hop.hop, isSelected, zoomLevel >= 10, hop.isClustered)}
                zIndexOffset={isSelected ? 500 : 0}
                eventHandlers={{
                  click: () => setSelectedHop(hop)
                }}
              >
                <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                  <div className="text-gray-900 font-sans text-sm">
                    <strong>{hop.geo.city || 'Unknown City'}, {hop.geo.country}</strong><br/>
                    <span className="text-gray-500 text-xs">{hop.geo.isp} (Hop {hop.hop})</span>
                  </div>
                </Tooltip>
              </Marker>
            );
          })
        )}
        
        {myDisplayLat && myDisplayLon && (
             <Marker 
               position={[myDisplayLat, myDisplayLon]}
               zIndexOffset={1000}
               icon={new L.DivIcon({
                 className: 'user-marker',
                 html: `<div style="background-color: #3b82f6; width: 14px; height: 14px; border-radius: 50%; border: 2px solid #1e3a8a; box-shadow: 0 0 15px #3b82f6;"></div>`,
                 iconSize: [14, 14],
                 iconAnchor: [7, 7]
               })}
             >
               <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                 <div className="text-gray-900 font-sans text-sm">
                   <strong>{isRadar ? 'Radar Gateway (This Device)' : 'My Location'}</strong><br/>
                   <span className="text-gray-500 text-xs">{myLocation?.city}, {myLocation?.country}</span>
                 </div>
               </Tooltip>
             </Marker>
        )}
      </MapContainer>

      {/* 2D Live Radar HUD Banner */}
      {isRadar && (
        <div className="absolute top-6 left-6 z-[1000] flex flex-col gap-1.5 pointer-events-none select-none">
          <div className="flex items-center gap-2 bg-gray-900/85 border border-emerald-500/40 rounded-xl px-3.5 py-2 backdrop-blur-md shadow-2xl text-xs font-mono pointer-events-auto">
            {(isRecordingRadar || radarData?.isRecording) ? (
              <div className="flex items-center gap-1.5 text-red-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-red-400 animate-ping"></span>
                <span className="font-bold">REC {formatTimer(recordingElapsed || radarData?.recordingElapsed || 0)}</span>
              </div>
            ) : radarData?.isRecordedView ? (
              <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <span className="font-bold">RECORDED</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span className="font-bold">LIVE RADAR</span>
              </div>
            )}
            <span className="text-gray-600">•</span>
            <div className="flex items-center gap-1.5 text-sky-400 font-semibold" title={myLocation?.city}>
              <span className="w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_8px_#38bdf8]"></span>
              <span>{myLocation?.city || 'Gateway'}</span>
            </div>
            <span className="text-gray-500 font-bold">➔</span>
            <span className="text-emerald-300 px-1.5 py-0.5 bg-emerald-950/80 border border-emerald-500/30 rounded text-[11px] font-bold">
              {radarData?.isRecordedView
                ? `${radarData?.internetCount || 0} recorded (${radarData?.activeCount || 0} active)`
                : `${radarData?.internetCount || 0} active connections`}
            </span>
          </div>

          {selectedRadarConn && (
            <div className="flex items-center justify-between gap-2 bg-gray-950/90 border border-amber-500/60 rounded-lg px-3 py-1.5 backdrop-blur-md shadow-xl text-xs font-mono pointer-events-auto">
              <div className="flex items-center gap-2 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                <span className="font-bold text-amber-400">{selectedRadarConn.process || 'Process'}:</span>
                <span className="text-gray-200">{selectedRadarConn.remoteIp}:{selectedRadarConn.remotePort}</span>
                <span className="text-gray-400 truncate">({selectedRadarConn.geo?.city || ''}, {selectedRadarConn.geo?.country || ''})</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRadarConn && setSelectedRadarConn(null)}
                className="text-gray-500 hover:text-white p-0.5 ml-2 cursor-pointer"
                title="Clear selection"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      )}
      
      <div className="absolute inset-0 pointer-events-none" style={{
         boxShadow: 'inset 0 0 100px rgba(0,0,0,0.9)'
      }}></div>
    </div>
  );
}
