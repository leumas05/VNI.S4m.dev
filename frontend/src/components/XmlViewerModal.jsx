import React, { useState, useEffect } from 'react';
import { X, Copy, Check, ExternalLink, Download, FileCode, RefreshCw, AlertCircle } from 'lucide-react';

export default function XmlViewerModal({ isOpen, onClose, device }) {
  const [loading, setLoading] = useState(false);
  const [xmlContent, setXmlContent] = useState('');
  const [xmlUrl, setXmlUrl] = useState('');
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  useEffect(() => {
    if (!isOpen || !device) {
      setXmlContent('');
      setXmlUrl('');
      setError(null);
      return;
    }

    // If device already has cached rawXml from scan
    if (device.ssdp?.rawXml) {
      setXmlContent(device.ssdp.rawXml);
      setXmlUrl(device.ssdp.location || `http://${device.ip}:1900/description.xml`);
      setLoading(false);
      return;
    }

    // Fetch XML on demand
    const loadXml = async () => {
      setLoading(true);
      setError(null);
      try {
        const locParam = device.ssdp?.location ? `&location=${encodeURIComponent(device.ssdp.location)}` : '';
        const res = await fetch(`/api/device-xml?ip=${device.ip}${locParam}`);
        const data = await res.json();
        if (data.ok && data.xml) {
          setXmlContent(data.xml);
          setXmlUrl(data.location || `http://${device.ip}`);
        } else {
          setError(data.error || 'Ingen UPnP / SSDP XML-beskrivning hittades på denna enhet.');
        }
      } catch (e) {
        setError(e.message || 'Kunde inte hämta XML-filen.');
      } finally {
        setLoading(false);
      }
    };

    loadXml();
  }, [isOpen, device]);

  if (!isOpen || !device) return null;

  const handleCopy = () => {
    if (!xmlContent) return;
    navigator.clipboard.writeText(xmlContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyUrl = () => {
    if (!xmlUrl) return;
    navigator.clipboard.writeText(xmlUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleDownload = () => {
    if (!xmlContent) return;
    const blob = new Blob([xmlContent], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${device.ip}-device-desc.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const lines = xmlContent ? xmlContent.split('\n') : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-gray-950 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden text-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800/80 bg-gray-900/60">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-sky-950/80 border border-sky-500/40 text-sky-400">
              <FileCode size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-wide">
                  UPnP / SSDP XML-beskrivning
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-950 border border-sky-500/30 text-sky-300">
                  {device.ip}
                </span>
              </div>
              <p className="text-xs text-gray-400 truncate mt-0.5">
                {device.hostname || device.vendor || 'Nätverksenhet'} {device.mac ? `• ${device.mac}` : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition"
            title="Stäng"
          >
            <X size={18} />
          </button>
        </div>

        {/* URL Banner */}
        {xmlUrl && (
          <div className="px-6 py-2.5 bg-gray-900/40 border-b border-gray-800/50 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
            <div className="flex items-center gap-2 truncate text-gray-400">
              <span className="text-[10px] uppercase font-bold text-gray-500">Källa:</span>
              <span className="text-sky-300 truncate select-all">{xmlUrl}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleCopyUrl}
                className="px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition flex items-center gap-1 text-[11px]"
                title="Kopiera länk"
              >
                {copiedUrl ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                <span>Kopiera URL</span>
              </button>
              <a
                href={xmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition flex items-center gap-1 text-[11px]"
                title="Öppna i ny flik"
              >
                <ExternalLink size={12} />
                <span>Öppna</span>
              </a>
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="px-6 py-2 bg-gray-950/80 border-b border-gray-800/60 flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-3">
            {lines.length > 0 && (
              <span className="font-mono text-[11px]">
                {lines.length} rader • {(new Blob([xmlContent]).size / 1024).toFixed(1)} KB
              </span>
            )}
            {device.friendlyName && (
              <span className="text-emerald-400 font-semibold text-[11px] truncate">
                Friendly Name: "{device.friendlyName}"
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              disabled={!xmlContent}
              className="px-2.5 py-1 rounded-lg bg-gray-850 hover:bg-gray-800 border border-gray-700 text-gray-200 hover:text-white transition flex items-center gap-1.5 font-medium text-xs disabled:opacity-40"
            >
              {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              <span>{copied ? 'Kopierad!' : 'Kopiera XML'}</span>
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={!xmlContent}
              className="px-2.5 py-1 rounded-lg bg-gray-850 hover:bg-gray-800 border border-gray-700 text-gray-200 hover:text-white transition flex items-center gap-1.5 font-medium text-xs disabled:opacity-40"
            >
              <Download size={13} />
              <span>Ladda ner</span>
            </button>
          </div>
        </div>

        {/* Code Content Body */}
        <div className="flex-1 overflow-auto p-4 bg-[#0a0e17] font-mono text-xs select-text">
          {loading && (
            <div className="h-64 flex flex-col items-center justify-center gap-3 text-gray-400">
              <RefreshCw size={24} className="animate-spin text-sky-400" />
              <span>Hämtar UPnP/SSDP XML från {device.ip}...</span>
            </div>
          )}

          {error && !loading && (
            <div className="h-64 flex flex-col items-center justify-center gap-3 text-center px-6">
              <div className="p-3 rounded-full bg-amber-950/60 border border-amber-500/30 text-amber-400">
                <AlertCircle size={24} />
              </div>
              <div className="max-w-md">
                <h4 className="text-sm font-bold text-white mb-1">Ingen XML hittades</h4>
                <p className="text-xs text-gray-400 leading-relaxed">
                  {error}
                </p>
                <p className="text-[11px] text-gray-500 mt-2">
                  Obs: Enheter som mobiler eller IoT utan UPnP-tjänst delar inte ut någon XML-beskrivning.
                </p>
              </div>
            </div>
          )}

          {!loading && !error && xmlContent && (
            <div className="table w-full border-collapse">
              {lines.map((line, idx) => (
                <div key={idx} className="table-row hover:bg-gray-900/40">
                  <span className="table-cell select-none pr-4 text-right text-gray-600 text-[11px] font-mono w-12">
                    {idx + 1}
                  </span>
                  <span className="table-cell whitespace-pre font-mono text-[11px] text-gray-300">
                    {line}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-6 py-2.5 bg-gray-900/60 border-t border-gray-800 flex items-center justify-between text-[11px] text-gray-500">
          <span>
            UPnP Device Architecture v1.1 • SSDP M-SEARCH response
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition font-medium"
          >
            Stäng
          </button>
        </div>
      </div>
    </div>
  );
}

