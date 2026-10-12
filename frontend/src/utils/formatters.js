export function formatConfidence(val) {
  if (!val) return 'Estimated';
  const v = String(val).trim().toLowerCase();
  if (v === 'hög' || v === 'high') return 'High';
  if (v === 'medel' || v === 'med' || v === 'medium') return 'Medium';
  if (v === 'låg' || v === 'low') return 'Low';
  return val;
}

export function formatOsName(name) {
  if (!name) return 'Unknown / Embedded OS';
  return String(name)
    .replace(/Okänt\s*\/\s*Inbäddat\s*OS/gi, 'Unknown / Embedded OS')
    .replace(/Okänt\s*OS/gi, 'Unknown OS')
    .replace(/Inbäddat\s*OS/gi, 'Embedded OS')
    .replace(/Nätverksstack\s*\/\s*Cisco\s*\/\s*Inbäddat\s*RTOS/gi, 'Network Stack / Cisco / Embedded RTOS')
    .replace(/Skrivare\s*Inbäddat\s*RTOS\s*\/\s*CUPS/gi, 'Printer Embedded RTOS / CUPS')
    .replace(/Skrivare/gi, 'Printer');
}

export function formatBasis(basis) {
  if (!basis) return 'No specific heuristics confirmed';
  return String(basis)
    .replace(/Uppskattning baserad på hårdvara och MAC-adress/gi, 'Estimated based on hardware and MAC address')
    .replace(/standardvärde för Linux\s*\/\s*Unix\s*\/\s*Darwin-kärna/gi, 'standard default for Linux / Unix / Darwin kernel')
    .replace(/standardvärde för Windows NT-kärna/gi, 'standard default for Windows NT kernel')
    .replace(/standardvärde för nätverks-\s*och\s*mikrostacks/gi, 'standard default for network appliances & microstacks')
    .replace(/Google Cast-tjänst/gi, 'Google Cast service')
    .replace(/Skrivartjänster/gi, 'Printer services')
    .replace(/eller skrivarhårdvara identifierad/gi, 'or printer hardware verified')
    .replace(/Öppna Windows-portar 135 \(RPC\) och 445 \(SMB\) verifierade/gi, 'Open Windows ports 135 (RPC) and 445 (SMB) verified')
    .replace(/Fjärrskrivbord \(RDP port 3389\) öppen/gi, 'Remote Desktop (RDP port 3389) open')
    .replace(/Windows NetBIOS-namn identifierat:/gi, 'Windows NetBIOS name identified:')
    .replace(/NetBIOS-namn:/gi, 'NetBIOS Name:')
    .replace(/SSH \(port 22\) öppen med Linux TTL/gi, 'SSH (port 22) open with Linux TTL')
    .replace(/Apple mDNS Zeroconf\s*\/\s*AirPlay-tjänster eller Apple MAC-adress verifierad/gi, 'Apple mDNS Zeroconf / AirPlay services or Apple MAC address verified')
    .replace(/Zaptec laddar-hårdvaruavtryck/gi, 'Zaptec EV Charger hardware fingerprint')
    .replace(/Samsung Smart Home IoT-apparat/gi, 'Samsung Smart Home IoT appliance')
    .replace(/Smart TV SoC\s*\/\s*DVB Display-stack/gi, 'Smart TV SoC / DVB Display stack')
    .replace(/standardmässig för/gi, 'standard default for')
    .replace(/Identifierad via/gi, 'Identified via')
    .replace(/Hårdvaru-OUI/gi, 'Hardware OUI')
    .replace(/verifierad/gi, 'verified')
    .replace(/verifierat/gi, 'verified')
    .replace(/aktiv/gi, 'active')
    .replace(/öppen/gi, 'open')
    .replace(/öppna/gi, 'open');
}
