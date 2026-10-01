import React, { useState, useEffect } from 'react';
import { Info, X, Activity } from 'lucide-react';
import Sidebar from './components/Sidebar';
import MapView from './components/Map';

function App() {
  const [hops, setHops] = useState([]);
  const [tracing, setTracing] = useState(false);
  const [target, setTarget] = useState('');
  const [selectedHop, setSelectedHop] = useState(null);
  const [hoveredHop, setHoveredHop] = useState(null);
  const [history, setHistory] = useState([]);
  const [compareMode, setCompareMode] = useState(false);
  const [compareHops, setCompareHops] = useState([]);
  const [showInfo, setShowInfo] = useState(false);
  const [myLocation, setMyLocation] = useState(null);
  const [backendStatus, setBackendStatus] = useState('checking');
  
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [privacyText, setPrivacyText] = useState('');
  
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isElectron = navigator.userAgent.includes('Electron');

  const openPrivacy = (e) => {
      if (e) e.preventDefault();
      setShowPrivacy(true);
      if (!privacyText) {
          fetch('https://assets.s4m.dev/assets/txt/Privacy_Policy.txt')
              .then(res => res.text())
              .then(text => setPrivacyText(text))
              .catch(() => setPrivacyText('Failed to load privacy policy.'));
      }
  };

  const renderPrivacyText = (text) => {
      if (!text) return 'Loading...';
      const parts = text.split(/(Google Ads Settings|home@s4m\.dev)/g);
      return parts.map((part, index) => {
          if (part === 'Google Ads Settings') {
              return <a key={index} href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">Google Ads Settings</a>;
          }
          if (part === 'home@s4m.dev') {
              return <a key={index} href="mailto:home@s4m.dev" className="text-emerald-400 hover:underline">home@s4m.dev</a>;
          }
          return <span key={index}>{part}</span>;
      });
  };
  
  useEffect(() => {
     if (isMobile) return;
     
     const saved = localStorage.getItem('vni_history');
     if (saved) {
         try { setHistory(JSON.parse(saved)); } catch (e) {}
     }
     
     let interval;
     let hasFetchedLocation = false;

     const fetchLocation = () => {
         fetch('http://127.0.0.1:3001/api/my-location')
           .then(r => r.json())
           .then(data => {
               if (data.ip) {
                   const baseLoc = {
                       status: 'success',
                       query: data.ip,
                       country: data.country_name,
                       countryCode: data.country_code,
                       regionName: data.region_name,
                       city: data.city_name,
                       zip: data.zip_code,
                       lat: parseFloat(data.latitude),
                       lon: parseFloat(data.longitude),
                       isp: data.as,
                       org: data.as,
                       as: data.asn ? `AS${data.asn}` : '',
                       timezone: data.time_zone
                   };
                   
                   setMyLocation(baseLoc);

                   if ("geolocation" in navigator) {
                       navigator.geolocation.getCurrentPosition(
                           (position) => {
                               setMyLocation(prev => {
                                   if (!prev) return prev;
                                   return {
                                       ...prev,
                                       lat: position.coords.latitude,
                                       lon: position.coords.longitude
                                   };
                               });
                           },
                           (error) => console.log("GPS Geolocation denied or failed, using IP fallback."),
                           { timeout: 10000 }
                       );
                   }
               }
           })
           .catch(e => console.error(e));
     };

     const pingBackend = async () => {
         try {
             const res = await fetch('http://127.0.0.1:3001/api/ping');
             if (res.ok) {
                 setBackendStatus('connected');
                 if (!hasFetchedLocation) {
                     hasFetchedLocation = true;
                     fetchLocation();
                 }
             } else {
                 setBackendStatus('disconnected');
             }
         } catch (e) {
             setBackendStatus('disconnected');
         }
     };

     pingBackend();
     interval = setInterval(pingBackend, 3000);

     return () => clearInterval(interval);
  }, [isMobile]);

  const saveToHistory = (traceTarget, traceHops) => {
     if (traceHops.length === 0) return;
     const entry = {
         id: Date.now(),
         target: traceTarget,
         date: new Date().toLocaleString(),
         hops: traceHops
     };
     const newHistory = [entry, ...history].slice(0, 10);
     setHistory(newHistory);
     localStorage.setItem('vni_history', JSON.stringify(newHistory));
  };

  const startTrace = (newTarget) => {
    setTarget(newTarget);
    setHops([]);
    setSelectedHop(null);
    setTracing(true);
    setCompareMode(false);
    
    const pastTrace = history.find(h => h.target === newTarget);
    if (pastTrace) {
        setCompareHops(pastTrace.hops);
        setCompareMode(true);
    } else {
        setCompareHops([]);
    }

    const evtSource = new EventSource(`http://localhost:3001/api/trace?target=${encodeURIComponent(newTarget)}`);
    
    let currentHops = [];
    evtSource.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      if (parsed.type === 'hop') {
         setHops(prev => {
           if (prev.some(h => h.hop === parsed.data.hop)) return prev;
           currentHops = [...prev, parsed.data].sort((a, b) => a.hop - b.hop);
           return currentHops;
         });
      } else if (parsed.type === 'done' || parsed.type === 'error') {
         evtSource.close();
         setTracing(false);
         saveToHistory(newTarget, currentHops);
      }
    };
    
    evtSource.onerror = () => {
      evtSource.close();
      setTracing(false);
      saveToHistory(newTarget, currentHops);
    };
  };

  const loadHistoryTrace = (entry) => {
      if (tracing) return;
      setTarget(entry.target);
      setHops(entry.hops);
      setSelectedHop(null);
      setCompareMode(false);
      setCompareHops([]);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white font-sans overflow-hidden">
       {isElectron && (
           <div className="h-8 shrink-0 bg-gray-950 flex items-center px-4 border-b border-gray-900 z-50 select-none" style={{ WebkitAppRegion: 'drag' }}>
               <Activity size={14} className="text-emerald-500 mr-2" />
               <span className="text-[11px] font-bold text-gray-400 tracking-widest uppercase">S4m's VNI</span>
           </div>
       )}
       <div className="flex flex-1 overflow-hidden relative">
           <div className="w-2/5 h-full border-r border-gray-800 bg-gray-900 flex flex-col relative z-10 shadow-2xl shadow-black">
              <Sidebar 
                 startTrace={startTrace} 
                 tracing={tracing} 
                 hops={hops} 
                 selectedHop={selectedHop}
                 setSelectedHop={setSelectedHop}
                 setHoveredHop={setHoveredHop}
                 history={history}
                 loadHistoryTrace={loadHistoryTrace}
                 compareMode={compareMode}
                 compareHops={compareHops}
                 myLocation={myLocation}
                 openPrivacy={openPrivacy}
              />
           </div>
           <div className="w-3/5 h-full relative z-0">
          <MapView hops={hops} selectedHop={selectedHop} setSelectedHop={setSelectedHop} hoveredHop={hoveredHop} myLocation={myLocation} />
          
          <button 
             onClick={() => setShowInfo(true)}
             className="absolute top-6 right-6 z-50 bg-gray-900/80 hover:bg-gray-800 text-gray-400 hover:text-emerald-400 p-2.5 rounded-full border border-gray-700 backdrop-blur-sm transition-all shadow-lg"
             title="About VNI.S4m.dev"
          >
             <Info size={24} />
          </button>

          {showInfo && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                  <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-md shadow-2xl">
                      <div className="flex justify-between items-start mb-4">
                          <h2 className="text-xl font-bold text-emerald-400 flex items-center gap-2">
                             <Activity /> About VNI.S4m.dev
                          </h2>
                          <button onClick={() => setShowInfo(false)} className="text-gray-500 hover:text-white transition">
                             <X size={20} />
                          </button>
                      </div>
                      <div className="space-y-4 text-gray-300 text-sm leading-relaxed">
                          <p>
                              <strong>Visual Network Intelligence (VNI)</strong> is an interactive traceroute dashboard.
                          </p>
                          <p>
                              It tracks your network packets as they travel across the globe, plotting each router on an interactive map.
                          </p>
                          <ul className="list-disc list-inside space-y-1 text-gray-400">
                              <li>Real-time IP Geolocation & mapping</li>
                              <li>Deep WHOIS & ASN registry enrichment</li>
                              <li>Historical route comparison (detect changes)</li>
                              <li>Smart identification of local & internal gateways</li>
                          </ul>
                          <p className="text-xs text-gray-500 pt-4 mt-4 border-t border-gray-800">
                              Built for network diagnostics and learning.
                          </p>
                      </div>
                  </div>
              </div>
          )}
       </div>
       
       {isMobile && (
           <div className="absolute inset-0 z-[150] flex flex-col items-center justify-center bg-gray-950/90 backdrop-blur-md p-6 text-center">
               <div className="bg-gray-900 border border-emerald-500/30 rounded-2xl p-8 max-w-lg shadow-2xl shadow-emerald-900/20">
                   <Activity className="w-16 h-16 text-emerald-500 mx-auto mb-6" />
                   <h1 className="text-2xl font-bold text-white mb-4">Desktop Only</h1>
                   <p className="text-gray-400 mb-6 leading-relaxed">
                       VNI relies on a lightweight local background engine to trace network routes. 
                       Because mobile devices (iOS/Android) cannot run desktop executables, this tool is only available on Windows, Mac, and Linux computers.
                   </p>
                   <p className="text-emerald-400 font-semibold mb-8">
                       Please visit vni.s4m.dev on your computer!
                   </p>

                   <div className="w-full pt-6 border-t border-gray-800/50 flex flex-col items-center gap-2">
                       <p className="text-xs text-gray-500">
                           <button onClick={openPrivacy} className="text-emerald-500 hover:text-emerald-400 hover:underline transition cursor-pointer">Privacy Policy</button>
                       </p>
                       <p className="text-xs text-gray-600">
                           &copy; {new Date().getFullYear()} <a href="https://www.s4m.dev/" target="_blank" rel="noopener noreferrer" className="hover:text-gray-400 transition-colors">S4M.dev</a>. All rights reserved.
                       </p>
                   </div>
               </div>
           </div>
       )}

       {!isMobile && backendStatus === 'disconnected' && (
           <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-gray-950/90 backdrop-blur-md p-6 text-center">
               <div className="bg-gray-900 border border-emerald-500/30 rounded-2xl p-8 max-w-lg shadow-2xl shadow-emerald-900/20">
                   <Activity className="w-16 h-16 text-emerald-500 mx-auto mb-6 animate-pulse" />
                   <h1 className="text-2xl font-bold text-white mb-4">VNI Engine is Not Running</h1>
                   <p className="text-gray-400 mb-6 leading-relaxed">
                       {isElectron 
                           ? "Starting local background engine..." 
                           : "To perform physical network traceroutes, VNI requires a local engine. For the ultimate experience, we highly recommend downloading the full Desktop App!"}
                   </p>
                   
                   {!isElectron && (
                       <>
                           <div className="mb-6">
                               <a href="https://github.com/leumas05/VNI.S4m.dev/releases/download/v1.0.1/S4m.s.VNI.Engine.Setup.1.0.0.exe" download className="inline-block w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 px-8 rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:shadow-[0_0_30px_rgba(16,185,129,0.6)] hover:scale-[1.02]">
                                   Download Full Desktop App (Windows)
                               </a>
                           </div>

                           <div className="relative flex py-4 items-center">
                               <div className="flex-grow border-t border-gray-800"></div>
                               <span className="flex-shrink-0 mx-4 text-gray-600 text-xs uppercase tracking-widest">Or use web version</span>
                               <div className="flex-grow border-t border-gray-800"></div>
                           </div>
                           
                           <p className="text-xs text-gray-500 mb-4">Download just the raw background engine to continue using the browser version:</p>
                           <div className="flex gap-2 justify-center mb-8 flex-wrap">
                               <a href="https://github.com/leumas05/VNI.S4m.dev/releases/download/v1.0/S4m.s-VNI-Engine-win.exe" download className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold py-2 px-4 rounded border border-gray-700 transition">
                                   Windows Engine
                               </a>
                               <a href="https://github.com/leumas05/VNI.S4m.dev/releases/download/v1.0/S4m.s-VNI-Engine-macos" download className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold py-2 px-4 rounded border border-gray-700 transition">
                                   Mac Engine
                               </a>
                               <a href="https://github.com/leumas05/VNI.S4m.dev/releases/download/v1.0/S4m.s-VNI-Engine-linux" download className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold py-2 px-4 rounded border border-gray-700 transition">
                                   Linux Engine
                               </a>
                           </div>
                       </>
                   )}
                   
                   <p className="text-sm text-gray-500 bg-gray-950 rounded-lg p-3 border border-gray-800 inline-block mb-6">
                       <span className="animate-pulse inline-block w-2 h-2 rounded-full bg-emerald-500 mr-2"></span>
                       Waiting for connection on <strong>localhost:3001</strong>...
                   </p>

                   <div className="w-full pt-6 border-t border-gray-800/50 flex flex-col items-center gap-2">
                       <p className="text-xs text-gray-500">
                           <button onClick={openPrivacy} className="text-emerald-500 hover:text-emerald-400 hover:underline transition cursor-pointer">Privacy Policy</button>
                       </p>
                       <p className="text-xs text-gray-600">
                           &copy; {new Date().getFullYear()} <a href="https://www.s4m.dev/" target="_blank" rel="noopener noreferrer" className="hover:text-gray-400 transition-colors">S4M.dev</a>. All rights reserved.
                       </p>
                   </div>
               </div>
           </div>
       )}

      {showPrivacy && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
              <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95">
                  <div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-3">
                      <h2 className="text-lg font-bold text-emerald-400">Privacy Policy</h2>
                      <button onClick={() => setShowPrivacy(false)} className="text-gray-500 hover:text-white transition cursor-pointer">
                         <X size={20} />
                      </button>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar text-sm text-gray-300 whitespace-pre-wrap leading-relaxed pr-2 font-mono">
                      {renderPrivacyText(privacyText)}
                  </div>
              </div>
          </div>
      )}
      </div>
    </div>
  );
}

export default App;