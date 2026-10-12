import React, { useState } from 'react';
import {
  X,
  Radio,
  Copy,
  Check,
  Download,
  ExternalLink,
  Search,
  Tag,
  Server,
  Tv,
  Printer,
  Music,
  Cast,
  FileText,
  Info,
  ShieldCheck,
  Sliders
} from 'lucide-react';

// Friendly descriptions for known mDNS / DNS-SD TXT keys
const TXT_DESCRIPTIONS = {
  fn: 'Vänligt visningsnamn (Friendly Name)',
  md: 'Enhetsmodell (Hardware Model)',
  id: 'Unikt enhets-ID (Device Identifier)',
  cd: 'Konfigurations-ID / App-ID',
  rm: 'Fjärrhanterings-ID (Remote Management ID)',
  ve: 'Protokollversion (Cast / Protocol Version)',
  ic: 'Ikon-sökväg (Device Icon Path)',
  ca: 'Egenskapsflaggor (Capabilities Bitmask)',
  st: 'Enhetsstatus (State / Status)',
  bs: 'Bluetooth/MAC-hårdvarureferens',
  nf: 'Nätverksflaggor (Network Flags)',
  ct: 'Klientspecifikation (Client Spec)',
  rs: 'Tjänstestatus (Resolved Service State)',
  wp: 'Webbport / API-port',
  ty: 'Skrivarmodell / Utrustningstyp',
  product: 'Fullständigt produktnamn',
  adminurl: 'Webbadministration / Kontrollpanel',
  pdl: 'Stödda dokument- & utskriftsformat (PDL)',
  rp: 'Utskriftskö / Protokollsökväg (Resource Path)',
  URF: 'AirPrint Universal Raster Format specifikationer',
  Scan: 'Inbyggd skannerfunktion (T = Ja, F = Nej)',
  Duplex: 'Dubbelsidig utskrift (Duplex printing)',
  Color: 'Färgutskrift (Color support)',
  Fax: 'Inbyggd faxfunktion',
  TLS: 'Kryptering / TLS-version',
  mac: 'Fysisk MAC-adress',
  usb_MFG: 'USB-tillverkare (Hardware Manufacturer)',
  usb_MDL: 'USB-modellbeteckning (Hardware Model)',
  'mopria-certified': 'Mopria-certifierad mobilutskrift',
  UUID: 'Universellt unikt enhets-ID (UUID)',
  kind: 'Stödda medietyper (dokument, kuvert, foto)',
  PaperMax: 'Maximal pappersstorlek',
  priority: 'Tjänsteprioritet',
  qtotal: 'Antal utskriftsköer (Queue Total)',
  txtvers: 'TXT-protokollversion',
  CPath: 'Spotify Connect API-sökväg',
  VERSION: 'Spotify Connect protokollversion',
  Stack: 'Ljudstack / Spelarmotor',
  model: 'Apple hårdvarukod (t.ex. AppleTV / iPhone)',
  flags: 'Apple AirPlay funktionsflaggor',
  pk: 'Apple AirPlay publik krypteringsnyckel'
};

function getServiceIcon(serviceName) {
  const s = (serviceName || '').toLowerCase();
  if (s.includes('cast')) return Cast;
  if (s.includes('tv')) return Tv;
  if (s.includes('print')) return Printer;
  if (s.includes('spotify') || s.includes('audio')) return Music;
  return Radio;
}

export default function MdnsViewerModal({ isOpen, onClose, device }) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'txt' | 'raw'
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);

  if (!isOpen || !device) return null;

  const mdns = device.mdns || {};
  const services = mdns.services || [];
  const serviceTypes = mdns.serviceTypes || [];
  const txtRecords = mdns.txtRecords || {};
  const rawEntries = mdns.rawEntries || [];
  const txtEntries = Object.entries(txtRecords);

  const filteredTxtEntries = txtEntries.filter(([k, v]) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const desc = (TXT_DESCRIPTIONS[k] || '').toLowerCase();
    return k.toLowerCase().includes(q) || String(v).toLowerCase().includes(q) || desc.includes(q);
  });

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(mdns, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyValue = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleDownloadJson = () => {
    const blob = new Blob([JSON.stringify({ device: { ip: device.ip, hostname: device.hostname, mac: device.mac }, mdns }, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${device.ip}-mdns-bonjour.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-gray-950 border border-indigo-900/50 rounded-2xl shadow-2xl overflow-hidden text-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-850 bg-gradient-to-r from-gray-900/90 to-indigo-950/40">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-indigo-950/90 border border-indigo-500/40 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.25)]">
              <Radio size={22} className="animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-wide flex items-center gap-1.5">
                  <span>mDNS & Bonjour Tjänsteutforskare</span>
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-950/90 border border-indigo-500/40 text-indigo-300">
                  {device.ip}
                </span>
                {mdns.port && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-gray-900 border border-gray-700 text-gray-300">
                    Port {mdns.port}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 truncate mt-0.5">
                {mdns.name || device.hostname || device.vendor || 'Nätverksenhet'}
                {mdns.model ? ` • ${mdns.model}` : ''}
                {device.mac ? ` • ${device.mac}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition cursor-pointer"
              title="Stäng"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Quick Links & Info Strip */}
        <div className="px-6 py-2.5 bg-gray-900/50 border-b border-gray-850 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
          <div className="flex items-center gap-3 text-gray-400 text-[11px] truncate">
            <span className="text-gray-500 uppercase font-bold text-[10px]">Protokoll:</span>
            <span className="text-indigo-300">Multicast DNS (RFC 6762) & DNS-SD (RFC 6763)</span>
            {mdns.hostname && (
              <>
                <span className="text-gray-600">•</span>
                <span className="text-gray-400">Host:</span>
                <span className="text-amber-300 font-bold">{mdns.hostname}</span>
              </>
            )}
          </div>

          {mdns.adminUrl && (
            <a
              href={mdns.adminUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 rounded bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-500/40 text-indigo-300 hover:text-white transition flex items-center gap-1.5 text-[11px] font-sans font-semibold cursor-pointer"
              title="Öppna enhetens webbadministration"
            >
              <ExternalLink size={12} />
              <span>Öppna Web Admin</span>
            </a>
          )}
        </div>

        {/* Navigation Tabs & Search */}
        <div className="px-6 py-2 bg-gray-950 border-b border-gray-850 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 bg-gray-900/90 p-1 rounded-xl border border-gray-800">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'overview'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Sliders size={13} />
              <span>Översikt & Tjänster ({services.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('txt')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'txt'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Tag size={13} />
              <span>TXT Records ({txtEntries.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('raw')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'raw'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <FileText size={13} />
              <span>Rådata & JSON</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'txt' && (
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filtrera nyckel eller värde..."
                  className="bg-gray-900 border border-gray-800 rounded-lg pl-7 pr-3 py-1 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500 w-44 font-sans"
                />
              </div>
            )}

            <button
              type="button"
              onClick={handleCopyJson}
              className="px-2.5 py-1 rounded-lg bg-gray-900 hover:bg-gray-850 border border-gray-700/80 text-gray-300 hover:text-white transition flex items-center gap-1.5 text-xs font-medium cursor-pointer"
              title="Kopiera mDNS-data till urklipp"
            >
              {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              <span>{copied ? 'Kopierat!' : 'Kopiera'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadJson}
              className="px-2.5 py-1 rounded-lg bg-gray-900 hover:bg-gray-850 border border-gray-700/80 text-gray-300 hover:text-white transition flex items-center gap-1.5 text-xs font-medium cursor-pointer"
              title="Ladda ner som JSON-fil"
            >
              <Download size={13} />
              <span>Spara</span>
            </button>
          </div>
        </div>

        {/* Modal Content Body */}
        <div className="flex-1 overflow-auto p-6 bg-[#0a0e17] space-y-4">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Device Profile Card */}
              <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-3 flex items-center gap-1.5">
                  <Info size={14} />
                  <span>Enhetsprofil & Detaljer</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="bg-gray-950/70 border border-gray-850 rounded-lg p-2.5">
                    <span className="text-[10px] text-gray-500 uppercase font-bold block">Visningsnamn (mDNS Name)</span>
                    <span className="text-white font-semibold text-sm mt-0.5 block truncate">
                      {mdns.name || 'Ej angivet'}
                    </span>
                  </div>

                  <div className="bg-gray-950/70 border border-gray-850 rounded-lg p-2.5">
                    <span className="text-[10px] text-gray-500 uppercase font-bold block">Modell (Model Name)</span>
                    <span className="text-indigo-300 font-semibold text-sm mt-0.5 block truncate">
                      {mdns.model || device.modelName || 'Ej angivet'}
                    </span>
                  </div>

                  <div className="bg-gray-950/70 border border-gray-850 rounded-lg p-2.5">
                    <span className="text-[10px] text-gray-500 uppercase font-bold block">Lokal Domän / Hostname</span>
                    <span className="text-amber-300 font-mono text-xs mt-0.5 block truncate">
                      {mdns.hostname || `${device.ip}.local`}
                    </span>
                  </div>

                  <div className="bg-gray-950/70 border border-gray-850 rounded-lg p-2.5">
                    <span className="text-[10px] text-gray-500 uppercase font-bold block">Tjänsteport (SRV Port)</span>
                    <span className="text-emerald-400 font-mono text-xs mt-0.5 block truncate">
                      {mdns.port ? `TCP/UDP Port ${mdns.port}` : 'Standardport / Ej specificerad'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Discovered Services Grid */}
              <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-3 flex items-center gap-1.5">
                  <Server size={14} />
                  <span>Upptäckta Bonjour / Zeroconf-tjänster</span>
                </h4>

                {services.length === 0 ? (
                  <div className="text-xs text-gray-500 italic p-3 text-center">
                    Inga namngivna tjänstekategorier identifierades på denna enhet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {services.map((srv, idx) => {
                      const IconComp = getServiceIcon(srv);
                      return (
                        <div
                          key={idx}
                          className="flex items-center gap-3 p-3 bg-indigo-950/40 border border-indigo-500/30 rounded-xl hover:border-indigo-500/60 transition"
                        >
                          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
                            <IconComp size={16} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">{srv}</div>
                            <div className="text-[10px] text-indigo-300/80 font-mono truncate">
                              Aktiv Bonjour-tjänst
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Service Types / PTR Domains */}
                {serviceTypes.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-800">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1.5">
                      Registrerade PTR Tjänstetyper:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {serviceTypes.map((st, sIdx) => (
                        <span
                          key={sIdx}
                          className="px-2 py-0.5 rounded font-mono text-[10px] bg-gray-950 border border-gray-800 text-gray-300"
                        >
                          {st}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: TXT RECORDS */}
          {activeTab === 'txt' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-gray-400 px-1">
                <span>
                  Visar {filteredTxtEntries.length} av {txtEntries.length} TXT-parametrar
                </span>
                <span className="text-[11px] text-gray-500 font-mono">
                  DNS-SD TXT RDATA (RFC 6763 §6)
                </span>
              </div>

              {filteredTxtEntries.length === 0 ? (
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-8 text-center text-gray-500 text-xs">
                  {search ? 'Inga attribut matchar din sökning.' : 'Inga TXT-attribut mottogs från denna enhet.'}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {filteredTxtEntries.map(([k, v]) => {
                    const desc = TXT_DESCRIPTIONS[k] || 'DNS-SD enhetsparameter';
                    const isCopied = copiedKey === k;
                    const isUrl = String(v).startsWith('http://') || String(v).startsWith('https://');

                    return (
                      <div
                        key={k}
                        className="bg-gray-900/70 hover:bg-gray-900 border border-gray-800 hover:border-indigo-500/40 rounded-xl p-3 transition flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-indigo-400 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-500/30">
                              {k}
                            </span>
                            <span className="text-[11px] text-gray-400 font-medium truncate">
                              {desc}
                            </span>
                          </div>

                          <div className="mt-1.5 font-mono text-xs text-gray-200 break-all select-all pl-0.5">
                            {isUrl ? (
                              <a
                                href={v}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sky-400 hover:underline flex items-center gap-1"
                              >
                                <span>{v}</span>
                                <ExternalLink size={11} />
                              </a>
                            ) : (
                              v
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => handleCopyValue(v, k)}
                            className="px-2 py-1 rounded bg-gray-800 hover:bg-gray-750 text-gray-300 hover:text-white transition flex items-center gap-1 text-[11px] font-mono cursor-pointer"
                            title="Kopiera värde"
                          >
                            {isCopied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                            <span>{isCopied ? 'Kopierat' : 'Kopiera'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: RAW DATA & JSON */}
          {activeTab === 'raw' && (
            <div className="space-y-4">
              <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                    <FileText size={14} />
                    <span>Råa mDNS-strängar ({rawEntries.length})</span>
                  </h4>
                </div>

                <div className="bg-black/80 rounded-lg p-3 font-mono text-xs text-gray-300 border border-gray-850 max-h-56 overflow-auto space-y-1">
                  {rawEntries.length === 0 ? (
                    <span className="text-gray-600">Inga råa strängar loggade.</span>
                  ) : (
                    rawEntries.map((line, idx) => (
                      <div key={idx} className="flex gap-3 hover:bg-gray-900/50 py-0.5 px-1 rounded">
                        <span className="text-gray-600 select-none w-8 text-right shrink-0">{idx + 1}</span>
                        <span className="break-all">{line}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                    <Server size={14} />
                    <span>Fullständigt mDNS JSON-objekt</span>
                  </h4>
                </div>

                <pre className="bg-black/80 rounded-lg p-3 font-mono text-xs text-indigo-200 border border-gray-850 max-h-72 overflow-auto select-all">
                  {JSON.stringify(mdns, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-2.5 bg-gray-900/60 border-t border-gray-850 flex items-center justify-between text-[11px] text-gray-500">
          <span>
            Apple Bonjour / ZeroConf • Port 5353 Multicast UDP (224.0.0.251)
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition font-medium cursor-pointer"
          >
            Stäng
          </button>
        </div>
      </div>
    </div>
  );
}

