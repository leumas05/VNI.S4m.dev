import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Activity, Play, Pause, RotateCcw, Copy, Check, Clock } from 'lucide-react';

export default function PingModal({ hop, onClose, apiBase }) {
  const [pings, setPings] = useState([]);
  const [isPaused, setIsPaused] = useState(false);
  const [intervalMs, setIntervalMs] = useState(1000);
  const [status, setStatus] = useState('connecting'); // 'connecting' | 'active' | 'paused' | 'error'
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [copied, setCopied] = useState(false);
  
  const eventSourceRef = useRef(null);

  const targetIp = hop?.ip;
  const targetHost = hop?.hostname && hop?.hostname !== hop?.ip ? hop.hostname : null;

  // Setup EventSource for continuous real-time pinging
  useEffect(() => {
    if (!targetIp || isPaused) return;

    setStatus('connecting');
    const url = `${apiBase}/api/ping-stream?target=${encodeURIComponent(targetIp)}&interval=${intervalMs}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      setStatus('active');
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setStatus('active');
        setPings(prev => {
          // Keep the last 60 ping samples for smooth real-time visualization
          const updated = [...prev, data];
          return updated.length > 60 ? updated.slice(updated.length - 60) : updated;
        });
      } catch (err) {
        console.error('Error parsing ping message', err);
      }
    };

    es.onerror = (err) => {
      console.warn('Ping stream error, retrying...', err);
      setStatus('error');
    };

    return () => {
      if (es) {
        es.close();
      }
    };
  }, [targetIp, isPaused, intervalMs, apiBase]);

  // Handle Escape key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const togglePause = () => {
    if (!isPaused) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      setIsPaused(true);
      setStatus('paused');
    } else {
      setIsPaused(false);
      setStatus('connecting');
    }
  };

  const handleClear = () => {
    setPings([]);
    setHoveredPoint(null);
  };

  const handleCopyIp = () => {
    if (!targetIp) return;
    navigator.clipboard.writeText(targetIp);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Statistics calculation
  const stats = useMemo(() => {
    const total = pings.length;
    const successes = pings.filter(p => p.status === 'success' && typeof p.time === 'number');
    const timeouts = pings.filter(p => p.status === 'timeout' || p.time === null);
    
    if (successes.length === 0) {
      return {
        total,
        successCount: 0,
        timeoutCount: timeouts.length,
        lossRate: total > 0 ? 100 : 0,
        min: null,
        max: null,
        avg: null,
        current: total > 0 && timeouts.length > 0 ? 'Timeout' : null
      };
    }

    const times = successes.map(p => p.time);
    const min = Math.min(...times);
    const max = Math.max(...times);
    const sum = times.reduce((acc, val) => acc + val, 0);
    const avg = Math.round(sum / times.length);
    const lossRate = Math.round((timeouts.length / total) * 100);
    const lastPing = pings[pings.length - 1];
    const current = lastPing.status === 'success' ? `${lastPing.time} ms` : 'Timeout';

    return {
      total,
      successCount: successes.length,
      timeoutCount: timeouts.length,
      lossRate,
      min: `${min} ms`,
      max: `${max} ms`,
      avg: `${avg} ms`,
      current
    };
  }, [pings]);

  // Chart coordinates & geometry
  const chartGeometry = useMemo(() => {
    const width = 640;
    const height = 240;
    const padLeft = 45;
    const padRight = 20;
    const padTop = 25;
    const padBottom = 35;

    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    if (pings.length === 0) {
      return { width, height, padLeft, padRight, padTop, padBottom, plotW, plotH, points: [], pathD: '', areaD: '', yMax: 50, gridLines: [] };
    }

    // Determine Y-axis max
    const validTimes = pings.filter(p => p.status === 'success' && typeof p.time === 'number').map(p => p.time);
    const maxObserved = validTimes.length > 0 ? Math.max(...validTimes) : 40;
    const yMax = Math.max(50, Math.ceil((maxObserved * 1.3) / 20) * 20);

    const totalSlots = Math.max(pings.length, 15);
    const points = pings.map((p, idx) => {
      const x = padLeft + (idx / (totalSlots - 1)) * plotW;
      const isSuccess = p.status === 'success' && typeof p.time === 'number';
      const y = isSuccess 
        ? padTop + plotH - (Math.min(p.time, yMax) / yMax) * plotH 
        : padTop + plotH; // At bottom line for timeouts
      return {
        ...p,
        idx,
        x,
        y,
        isSuccess
      };
    });

    // Build SVG path
    let pathD = '';
    let areaD = '';

    const successPoints = points.filter(p => p.isSuccess);

    if (successPoints.length > 0) {
      // Connect sequential points
      points.forEach((pt, i) => {
        if (i === 0) {
          pathD += `M ${pt.x} ${pt.y}`;
        } else {
          pathD += ` L ${pt.x} ${pt.y}`;
        }
      });

      const firstPt = points[0];
      const lastPt = points[points.length - 1];
      const bottomY = padTop + plotH;

      areaD = `${pathD} L ${lastPt.x} ${bottomY} L ${firstPt.x} ${bottomY} Z`;
    }

    // Y-axis grid ticks (4 intervals)
    const gridLines = [0, 0.25, 0.5, 0.75, 1].map(factor => {
      const val = Math.round(yMax * factor);
      const y = padTop + plotH - (val / yMax) * plotH;
      return { val, y };
    });

    return {
      width,
      height,
      padLeft,
      padRight,
      padTop,
      padBottom,
      plotW,
      plotH,
      points,
      pathD,
      areaD,
      yMax,
      gridLines
    };
  }, [pings]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div 
        className="bg-gray-950 border border-emerald-500/30 rounded-2xl w-full max-w-2xl shadow-2xl shadow-black/80 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 bg-gray-900/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-mono font-bold text-sm shadow-[0_0_12px_rgba(16,185,129,0.3)]">
              #{hop.hop}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Real-Time Ping Monitor
                </h2>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider bg-gray-900 border border-gray-800">
                  {status === 'active' && (
                    <>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span className="text-emerald-400">Live</span>
                    </>
                  )}
                  {status === 'connecting' && (
                    <>
                      <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping"></span>
                      <span className="text-sky-400">Connecting</span>
                    </>
                  )}
                  {status === 'paused' && (
                    <>
                      <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                      <span className="text-amber-400">Paused</span>
                    </>
                  )}
                  {status === 'error' && (
                    <>
                      <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                      <span className="text-rose-400">Offline</span>
                    </>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2 text-xs font-mono text-gray-400 mt-0.5">
                <span className="text-gray-200 font-semibold">{targetIp}</span>
                {targetHost && <span className="text-gray-500">({targetHost})</span>}
                {hop.geo?.city && (
                  <>
                    <span className="text-gray-600">•</span>
                    <span className="text-emerald-400/90">{hop.geo.city}, {hop.geo.countryCode || hop.geo.country || ''}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCopyIp}
              className="p-2 rounded-lg bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white border border-gray-800 transition"
              title="Copy IP Address"
            >
              {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-gray-900 hover:bg-rose-950/40 text-gray-400 hover:text-rose-400 border border-gray-800 hover:border-rose-900/50 transition"
              title="Close (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 px-6 py-3.5 bg-gray-900/40 border-b border-gray-800/80 text-center">
          <div className="p-2 rounded-xl bg-gray-950/70 border border-gray-800/80">
            <div className="text-[10px] uppercase font-mono tracking-wider text-gray-400">Current</div>
            <div className={`text-lg font-mono font-bold mt-0.5 ${
              stats.current === 'Timeout' ? 'text-rose-400' : (stats.current ? 'text-emerald-400' : 'text-gray-500')
            }`}>
              {stats.current || '--'}
            </div>
          </div>

          <div className="p-2 rounded-xl bg-gray-950/70 border border-gray-800/80">
            <div className="text-[10px] uppercase font-mono tracking-wider text-gray-400">Min</div>
            <div className="text-lg font-mono font-semibold text-sky-400 mt-0.5">
              {stats.min || '--'}
            </div>
          </div>

          <div className="p-2 rounded-xl bg-gray-950/70 border border-gray-800/80">
            <div className="text-[10px] uppercase font-mono tracking-wider text-gray-400">Avg</div>
            <div className="text-lg font-mono font-semibold text-emerald-300 mt-0.5">
              {stats.avg || '--'}
            </div>
          </div>

          <div className="p-2 rounded-xl bg-gray-950/70 border border-gray-800/80">
            <div className="text-[10px] uppercase font-mono tracking-wider text-gray-400">Max</div>
            <div className="text-lg font-mono font-semibold text-amber-400 mt-0.5">
              {stats.max || '--'}
            </div>
          </div>

          <div className="col-span-2 sm:col-span-1 p-2 rounded-xl bg-gray-950/70 border border-gray-800/80">
            <div className="text-[10px] uppercase font-mono tracking-wider text-gray-400">Loss</div>
            <div className={`text-lg font-mono font-bold mt-0.5 ${
              stats.lossRate > 0 ? 'text-rose-400' : 'text-emerald-400'
            }`}>
              {stats.lossRate}%
            </div>
          </div>
        </div>

        {/* Diagram / Chart Section */}
        <div className="p-6 flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs font-mono text-gray-400">
              <Activity size={14} className="text-emerald-400" />
              <span>Latency Timeline ({pings.length} samples)</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center bg-gray-900 border border-gray-800 rounded-lg p-0.5 text-xs font-mono">
                <span className="text-gray-500 pl-2 pr-1 flex items-center gap-1 text-[11px]">
                  <Clock size={11} className="text-gray-400" />
                  <span className="hidden sm:inline">Interval:</span>
                </span>
                {[
                  { label: '0.2s', val: 200 },
                  { label: '0.5s', val: 500 },
                  { label: '1s', val: 1000 },
                  { label: '2s', val: 2000 },
                  { label: '5s', val: 5000 },
                ].map(({ label, val }) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setIntervalMs(val)}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
                      intervalMs === val
                        ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                    }`}
                    title={`Set ping interval to ${label}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <button
                onClick={togglePause}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-medium border transition ${
                  isPaused 
                    ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-400 hover:bg-emerald-900/60' 
                    : 'bg-gray-900 border-gray-800 text-gray-300 hover:text-white hover:bg-gray-850'
                }`}
              >
                {isPaused ? <Play size={12} className="fill-current" /> : <Pause size={12} className="fill-current" />}
                <span>{isPaused ? 'Resume' : 'Pause'}</span>
              </button>

              <button
                onClick={handleClear}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-900 hover:bg-gray-850 text-gray-400 hover:text-gray-200 border border-gray-800 text-xs font-mono transition"
                title="Reset Chart"
              >
                <RotateCcw size={12} />
                <span>Clear</span>
              </button>
            </div>
          </div>

          {/* SVG Latency Graph */}
          <div className="relative w-full bg-gray-900/40 border border-gray-800/80 rounded-xl overflow-hidden p-2 select-none">
            {pings.length === 0 ? (
              <div className="h-56 flex flex-col items-center justify-center text-gray-500 font-mono text-xs gap-3">
                <Activity className="animate-spin text-emerald-500" size={24} />
                <span>Pinging {targetIp}... Waiting for replies</span>
              </div>
            ) : (
              <svg 
                viewBox={`0 0 ${chartGeometry.width} ${chartGeometry.height}`} 
                className="w-full h-56 overflow-visible"
              >
                <defs>
                  {/* Neon Area Fill Gradient */}
                  <linearGradient id="pingAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                    <stop offset="60%" stopColor="#10b981" stopOpacity="0.08" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                  </linearGradient>

                  {/* Glow filter */}
                  <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="2" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Horizontal Grid Lines */}
                {chartGeometry.gridLines.map((gl, i) => (
                  <g key={i}>
                    <line 
                      x1={chartGeometry.padLeft} 
                      y1={gl.y} 
                      x2={chartGeometry.width - chartGeometry.padRight} 
                      y2={gl.y} 
                      stroke="#1e293b" 
                      strokeDasharray="4 4" 
                      strokeWidth="1"
                    />
                    <text 
                      x={chartGeometry.padLeft - 8} 
                      y={gl.y + 3.5} 
                      fill="#64748b" 
                      fontSize="10" 
                      fontFamily="ui-monospace, monospace" 
                      textAnchor="end"
                    >
                      {gl.val}ms
                    </text>
                  </g>
                ))}

                {/* Shaded Area Under Curve */}
                {chartGeometry.areaD && (
                  <path d={chartGeometry.areaD} fill="url(#pingAreaGrad)" />
                )}

                {/* Neon Latency Line */}
                {chartGeometry.pathD && (
                  <path 
                    d={chartGeometry.pathD} 
                    fill="none" 
                    stroke="#10b981" 
                    strokeWidth="2.2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    filter="url(#neonGlow)"
                  />
                )}

                {/* Interactive Points */}
                {chartGeometry.points.map((pt) => {
                  const isHovered = hoveredPoint?.idx === pt.idx;
                  
                  if (!pt.isSuccess) {
                    // Timeout / Dropped Packet Indicator
                    return (
                      <g key={pt.idx} onMouseEnter={() => setHoveredPoint(pt)} onMouseLeave={() => setHoveredPoint(null)}>
                        <line 
                          x1={pt.x} 
                          y1={chartGeometry.padTop} 
                          x2={pt.x} 
                          y2={chartGeometry.padTop + chartGeometry.plotH} 
                          stroke="#ef4444" 
                          strokeWidth="1.5" 
                          strokeDasharray="3 3"
                          opacity={0.7}
                        />
                        <circle 
                          cx={pt.x} 
                          cy={pt.y} 
                          r={isHovered ? 5 : 3.5} 
                          fill="#ef4444" 
                          stroke="#7f1d1d" 
                          strokeWidth="1.5" 
                          className="cursor-pointer"
                        />
                      </g>
                    );
                  }

                  const dotColor = pt.time < 50 ? '#10b981' : (pt.time < 100 ? '#f59e0b' : '#ef4444');

                  return (
                    <circle
                      key={pt.idx}
                      cx={pt.x}
                      cy={pt.y}
                      r={isHovered ? 5.5 : 2.5}
                      fill={dotColor}
                      stroke="#0f172a"
                      strokeWidth={isHovered ? 2 : 1}
                      className="cursor-pointer transition-all duration-150"
                      onMouseEnter={() => setHoveredPoint(pt)}
                      onMouseLeave={() => setHoveredPoint(null)}
                    />
                  );
                })}

                {/* Hover Tooltip Box */}
                {hoveredPoint && (
                  <g pointerEvents="none">
                    <line 
                      x1={hoveredPoint.x} 
                      y1={chartGeometry.padTop} 
                      x2={hoveredPoint.x} 
                      y2={chartGeometry.padTop + chartGeometry.plotH} 
                      stroke="#475569" 
                      strokeWidth="1" 
                      strokeDasharray="2 2"
                    />
                    <circle 
                      cx={hoveredPoint.x} 
                      cy={hoveredPoint.y} 
                      r="6" 
                      fill="none" 
                      stroke="#38bdf8" 
                      strokeWidth="2" 
                    />
                  </g>
                )}
              </svg>
            )}

            {/* Hover Floating Details Pill */}
            {hoveredPoint && (
              <div 
                className="absolute top-3 right-3 bg-gray-950/90 border border-gray-700/80 rounded-lg px-3 py-1.5 backdrop-blur-md shadow-xl text-xs font-mono pointer-events-none flex items-center gap-3 animate-in fade-in"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-400">Seq #{hoveredPoint.seq}:</span>
                  <span className={`font-bold ${
                    hoveredPoint.isSuccess ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {hoveredPoint.isSuccess ? `${hoveredPoint.time} ms` : 'Request Timed Out'}
                  </span>
                </div>
                {hoveredPoint.ttl && (
                  <span className="text-gray-500 text-[11px]">TTL: {hoveredPoint.ttl}</span>
                )}
              </div>
            )}
          </div>

          {/* Footer Diagnostic Info */}
          <div className="mt-4 pt-3 border-t border-gray-800/80 flex flex-wrap items-center justify-between text-xs font-mono text-gray-500 gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>ICMP Echo Request (32 bytes)</span>
              <span>•</span>
              <span>Interval: {intervalMs >= 1000 ? `${intervalMs / 1000}s` : `${intervalMs}ms`}</span>
            </div>

            <div>
              {hop.geo?.isp && <span>ISP: {hop.geo.isp}</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

