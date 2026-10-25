const { exec, spawn } = require('child_process');
const os = require('os');
const dgram = require('dgram');
const net = require('net');

// Comprehensive MAC OUI database for instant offline vendor & device recognition
// Format: 6-char hex prefix without delimiters (lowercase)
const OUI_DATABASE = {
  // Apple
  '000393': 'Apple', '000502': 'Apple', '000a27': 'Apple', '000a95': 'Apple', '000d93': 'Apple',
  '0010fa': 'Apple', '001124': 'Apple', '001451': 'Apple', '0016cb': 'Apple', '0017f2': 'Apple',
  '0019e3': 'Apple', '001b63': 'Apple', '001c42': 'Apple', '001cb3': 'Apple', '001d4f': 'Apple',
  '001e52': 'Apple', '001ec2': 'Apple', '001f5b': 'Apple', '001ff3': 'Apple', '0021e9': 'Apple',
  '002241': 'Apple', '002312': 'Apple', '002332': 'Apple', '00236c': 'Apple', '0023df': 'Apple',
  '002436': 'Apple', '002500': 'Apple', '00254b': 'Apple', '0025bc': 'Apple', '002608': 'Apple',
  '040cce': 'Apple', '041552': 'Apple', '042665': 'Apple', '04489a': 'Apple', '044b80': 'Apple',
  '0452f3': 'Apple', '045453': 'Apple', '04d3cf': 'Apple', '04db56': 'Apple', '04e536': 'Apple',
  '086698': 'Apple', '087045': 'Apple', '087402': 'Apple', '08e689': 'Apple', '08f4ab': 'Apple',
  '101c0c': 'Apple', '1040f3': 'Apple', '109add': 'Apple', '10ddb1': 'Apple', '14109f': 'Apple',
  '14205e': 'Apple', '145a05': 'Apple', '148f21': 'Apple', '1499e2': 'Apple', '14c213': 'Apple',
  '18af61': 'Apple', '18e728': 'Apple', '1c1abb': 'Apple', '207d74': 'Apple', '20a2e4': 'Apple',
  '24240e': 'Apple', '280b5c': 'Apple', '286aba': 'Apple', '28cfda': 'Apple', '28e02c': 'Apple',
  '28e14c': 'Apple', '28e7cf': 'Apple', '28f076': 'Apple', '2cbe08': 'Apple', '30074d': 'Apple',
  '34159e': 'Apple', '34363b': 'Apple', '38ca84': 'Apple', '3c0754': 'Apple', '3c15c2': 'Apple',
  '3cd0f8': 'Apple', '404d7f': 'Apple', '406c8f': 'Apple', '40a6d9': 'Apple', '442a60': 'Apple',
  '48437c': 'Apple', '4c57ca': 'Apple', '50ea9c': 'Apple', '542696': 'Apple', '5855ca': 'Apple',
  '5c879c': 'Apple', '600308': 'Apple', '68a86d': 'Apple', '6c4008': 'Apple',
  '701124': 'Apple', '748114': 'Apple', '784f43': 'Apple', '7cd1c3': 'Apple', '804971': 'Apple',
  '843835': 'Apple', '88665a': 'Apple', '8c8590': 'Apple', '907240': 'Apple', '949426': 'Apple',
  '9801a7': 'Apple', 'a45e60': 'Apple', '4ccd86': 'Apple (iPhone / iPad)', '4ccdb6': 'Apple (iPhone / iPad)',
  'acbc32': 'Apple', 'b065bd': 'Apple', 'b418d1': 'Apple', 'b8e856': 'Apple', 'bc52b7': 'Apple',
  'c09a42': 'Apple', 'c4b301': 'Apple', 'c869cd': 'Apple', 'cc29f5': 'Apple', 'd023db': 'Apple',
  'd4619d': 'Apple', 'd8004d': 'Apple', 'dc2b61': 'Apple', 'e0b55f': 'Apple', 'e4e4ab': 'Apple',
  'e8040b': 'Apple', 'ec3586': 'Apple', 'f01898': 'Apple', 'f45c89': 'Apple', 'f82793': 'Apple',

  // Google / Nest
  '001a11': 'Google', '089e08': 'Google', '18d6c7': 'Google', '20dfb9': 'Google', '30fd38': 'Google',
  '3cf7a4': 'Google', '48d6d5': 'Google', '546009': 'Google', '641666': 'Google', '70ee50': 'Google',
  '94ebcd': 'Google', 'a47733': 'Google', 'b827eb': 'Google', 'd86c63': 'Google', 'e03f49': 'Google',
  'f40343': 'Google', 'f88f12': 'Google',

  // Smart TVs & Display Modules (Vestel, Earda Technologies, TCL, etc.)
  'a808cf': 'Vestel (Smart TV)', '001a2b': 'Vestel (Smart TV)', '2827bf': 'Vestel (Smart TV)', 'bc1485': 'Vestel (Smart TV)',
  '64bb1e': 'Earda Technologies (Smart TV)', '9cb1dc': 'Earda Technologies (Smart TV)',

  // Samsung
  '0007ab': 'Samsung', '001247': 'Samsung', '001599': 'Samsung', '0016db': 'Samsung', '001a80': 'Samsung',
  '002119': 'Samsung', '0023d7': 'Samsung', '0808c2': 'Samsung', '1449e0': 'Samsung', '14f42a': 'Samsung',
  '18227e': 'Samsung', '1867b0': 'Samsung', '244bfe': 'Samsung', '2c088c': 'Samsung', '30074d': 'Samsung',
  '3423ba': 'Samsung', '380195': 'Samsung', '4844f7': 'Samsung', '4c3cb7': 'Samsung', '50c8e5': 'Samsung',
  '50fdd5': 'Samsung (Smart Oven / Appliance)', '5492be': 'Samsung', '58c38b': 'Samsung', '5c0a5b': 'Samsung',
  '68ebae': 'Samsung', '78471d': 'Samsung', '8425db': 'Samsung', '887598': 'Samsung', '8c7712': 'Samsung',
  '9463d1': 'Samsung', 'a0821f': 'Samsung', 'a87b39': 'Samsung', 'a8ba69': 'Samsung (Galaxy Phone)',
  'b07994': 'Samsung', 'b479a7': 'Samsung', 'bc20a4': 'Samsung', 'c0a810': 'Samsung', 'cc07ab': 'Samsung',
  'd022be': 'Samsung', 'd857ef': 'Samsung', 'e432cb': 'Samsung', 'f409d8': 'Samsung',

  // Zaptec (EV Chargers & Energy Management)
  '28562f': 'Zaptec (EV Charger)',
  '841fe8': 'Zaptec (EV Charger)',
  '30c922': 'Zaptec (Energy Balancer)',

  // Solar & Energy Storage
  'ece334': 'Solar Panels / Battery Inverter',

  // TP-Link & Deco Mesh
  '0019e0': 'TP-Link', '002127': 'TP-Link', '14cc20': 'TP-Link', '1c3bf3': 'TP-Link', '30b5c2': 'TP-Link',
  '30de4b': 'TP-Link', '50c7bf': 'TP-Link', '54c80f': 'TP-Link', '6032b1': 'TP-Link', '645601': 'TP-Link',
  '6c4cbc': 'TP-Link (Deco Router)', '704f57': 'TP-Link', '784476': 'TP-Link', '8416f9': 'TP-Link',
  '984827': 'TP-Link', 'a42bb0': 'TP-Link', 'ac84c6': 'TP-Link', 'b04e26': 'TP-Link', 'c025e9': 'TP-Link',
  'c0a5dd': 'TP-Link', 'c46e1f': 'TP-Link', 'd807b6': 'TP-Link', 'e4c32a': 'TP-Link',
  'e848b8': 'TP-Link (Deco Mesh Node)', 'f4ec38': 'TP-Link',

  // Intel & Motherboards
  '0002b3': 'Intel', '000347': 'Intel', '000423': 'Intel', '0007e9': 'Intel', '000e0c': 'Intel',
  '001111': 'Intel', '001302': 'Intel', '001320': 'Intel', '0013e8': 'Intel', '001500': 'Intel',
  '001676': 'Intel', '0018de': 'Intel', '0019d1': 'Intel', '001b21': 'Intel', '001cbf': 'Intel',
  '001e67': 'Intel', '00215c': 'Intel', '0022fa': 'Intel', '0024d7': 'Intel', '2cf05d': 'MSI (Micro-Star)',
  '3413e8': 'Intel', '3c6aa7': 'Intel', '484520': 'Intel', '4c1d96': 'Intel', '5cf370': 'Intel',
  '6805ca': 'Intel', '7c5cf8': 'Intel', '8086f2': 'Intel', '843a4b': 'Intel', '94659c': 'Intel',
  'a0a8cd': 'Intel', 'a434d9': 'Intel', 'a44cc8': 'Intel', 'b46bf9': 'Intel', 'c85b76': 'Intel',

  // Raspberry Pi
  'b827eb': 'Raspberry Pi', 'dca632': 'Raspberry Pi', 'e45f01': 'Raspberry Pi', '28cdc1': 'Raspberry Pi',

  // Espressif (IoT / Smart Home / ESP8266 / ESP32)
  '18fe34': 'Espressif (IoT)', '240ac4': 'Espressif (IoT)', '2462ab': 'Espressif (IoT)', '246f28': 'Espressif (IoT)',
  '24b2de': 'Espressif (IoT)', '2c3ae8': 'Espressif (IoT)', '30aea4': 'Espressif (IoT)', '3c6105': 'Espressif (IoT)',
  '3c71bf': 'Espressif (IoT)', '40f520': 'Espressif (IoT)', '483fda': 'Espressif (IoT)', '485519': 'Espressif (IoT)',
  '545a16': 'Espressif (IoT)', '5ccf7f': 'Espressif (IoT)', '600194': 'Espressif (IoT)', '68c63a': 'Espressif (IoT)',
  '807d3a': 'Espressif (IoT)', '840d8e': 'Espressif (IoT)', '84f3eb': 'Espressif (IoT)', '9097d5': 'Espressif (IoT)',
  '94b97e': 'Espressif (IoT)', 'a020a6': 'Espressif (IoT)', 'ac67b2': 'Espressif (IoT)',
  'b00cd1': 'HP / Espressif (Printer / IoT)', 'b4e62d': 'Espressif (IoT)', 'bcddc2': 'Espressif (IoT)',
  'c44f33': 'Espressif (IoT)', 'cc50e3': 'Espressif (IoT)', 'd8a01d': 'Espressif (IoT)', 'dc4f22': 'Espressif (IoT)',
  'e09806': 'Espressif (IoT)', 'e8db84': 'Espressif (IoT)',

  // Amazon (Echo / FireTV / Kindle / Ring)
  '00376d': 'Amazon', '00fc8b': 'Amazon', '18742e': 'Amazon', '240588': 'Amazon', '2c0406': 'Amazon',
  '34d270': 'Amazon', '3c5c44': 'Amazon', '40b4cd': 'Amazon', '44650d': 'Amazon', '4c11ae': 'Amazon',
  '50dc21': 'Amazon', '5828aa': 'Amazon', '6837e9': 'Amazon', '68545a': 'Amazon', '747548': 'Amazon',
  '74c246': 'Amazon', '7c86ce': 'Amazon', '84d6d0': 'Amazon', '8cf5a3': 'Amazon', '90a1db': 'Amazon',
  'a002dc': 'Amazon', 'ac63be': 'Amazon', 'b47c9c': 'Amazon', 'cc9e00': 'Amazon', 'd48a3b': 'Amazon',
  'fc65de': 'Amazon', 'fc7426': 'Amazon',

  // Sony (PlayStation / Bravia TV)
  '00014a': 'Sony', '00041f': 'Sony', '001315': 'Sony', '0015c1': 'Sony', '0019c5': 'Sony',
  '001d0d': 'Sony', '001fa9': 'Sony', '00248d': 'Sony', '0498f3': 'Sony', '0cfe45': 'Sony (PlayStation)',
  '280d96': 'Sony', '709e29': 'Sony (PlayStation)', 'ac9b0a': 'Sony', 'bc60a7': 'Sony (PlayStation)',

  // Microsoft (Xbox / Surface)
  '00155d': 'Microsoft (Hyper-V)', '0017fa': 'Microsoft', '281878': 'Microsoft (Surface)',
  '501ac5': 'Microsoft (Xbox)', '7c1e52': 'Microsoft (Xbox)', 'dc9b9c': 'Microsoft (Xbox)',
  '84b1e2': 'Microsoft (Surface / PC)', '6045bd': 'Microsoft (Surface)', 'c83f26': 'Microsoft',
  '985fd3': 'Microsoft (Surface)', 'dc5360': 'Microsoft / AzureWave',

  // Asus
  '0015f2': 'ASUS', '001b2f': 'ASUS', '001e8c': 'ASUS', '049226': 'ASUS', '08606e': 'ASUS',
  '10bf48': 'ASUS', '14dae9': 'ASUS', '1c872c': 'ASUS', '2c4d54': 'ASUS', '305a3a': 'ASUS',
  '40167e': 'ASUS', '50465d': 'ASUS', '6045cb': 'ASUS', '704d7b': 'ASUS', 'ac220b': 'ASUS',

  // Netgear
  '00095b': 'Netgear', '000fb5': 'Netgear', '00146c': 'Netgear', '00184d': 'Netgear', '001f33': 'Netgear',
  '0024b2': 'Netgear', '0026f2': 'Netgear', '04a151': 'Netgear', '08bd43': 'Netgear', '100c6b': 'Netgear',
  '10da43': 'Netgear', '204e7f': 'Netgear', '2c3033': 'Netgear', '30469a': 'Netgear', '841b5e': 'Netgear',

  // Cisco / Meraki / Linksys
  '00000c': 'Cisco', '000142': 'Cisco', '000163': 'Cisco', '0002b9': 'Cisco', '000427': 'Cisco',
  '000652': 'Cisco', '000785': 'Cisco', '000b46': 'Cisco', '00180a': 'Cisco Meraki', '34dbfd': 'Cisco Meraki',
  '000625': 'Linksys', '000c41': 'Linksys', '000e35': 'Linksys', '0014bf': 'Linksys', '001839': 'Linksys',

  // Ubiquiti Networks (UniFi)
  '00156d': 'Ubiquiti', '002722': 'Ubiquiti', '24a43c': 'Ubiquiti', '687251': 'Ubiquiti',
  '7483c2': 'Ubiquiti', '788a20': 'Ubiquiti', '802aa8': 'Ubiquiti', 'b4fbe4': 'Ubiquiti',
  'dc9fdb': 'Ubiquiti', 'e063da': 'Ubiquiti', 'fcecda': 'Ubiquiti',

  // Synology / QNAP
  '001132': 'Synology (NAS)', '0024ec': 'Synology (NAS)', '9009d0': 'Synology (NAS)',
  '00089b': 'QNAP (NAS)', '245ebb': 'QNAP (NAS)',

  // Smart Home / Audio / Philips / Sonos
  '000ec6': 'Philips Hue', '001788': 'Philips Hue', 'ecb5fa': 'Philips Hue',
  '000e58': 'Sonos', '5caafd': 'Sonos', '949f3e': 'Sonos', 'b8e937': 'Sonos',

  // Xiaomi
  '009ee8': 'Xiaomi', '185936': 'Xiaomi', '286c07': 'Xiaomi', '34ce00': 'Xiaomi', '508f4c': 'Xiaomi',
  '64cc2e': 'Xiaomi', '742344': 'Xiaomi', '8cbebe': 'Xiaomi', 'a43d78': 'Xiaomi', 'd8b28e': 'Xiaomi',

  // Realtek
  '000732': 'Realtek', '000ee8': 'Realtek', '00e04c': 'Realtek', '525400': 'QEMU / KVM Virtual'
};

// Format MAC address clearly in uppercase hyphen notation (e.g. 6C-4C-BC-0B-7A-AC)
function formatMac(mac) {
  if (!mac) return '';
  const clean = mac.toUpperCase().replace(/[^0-9A-F]/g, '');
  if (clean.length === 12) {
    return clean.match(/.{1,2}/g).join('-');
  }
  return mac.toUpperCase().replace(/:/g, '-');
}

// Detect Vendor and whether the device is using a randomized/private MAC address
function lookupVendor(mac) {
  if (!mac) return { vendor: 'Unknown', isRandomized: false };
  const clean = mac.toLowerCase().replace(/[^0-9a-f]/g, '');
  if (clean.length < 6) return { vendor: 'Unknown', isRandomized: false };

  // Check locally administered (randomized / private Wi-Fi) address bit:
  // Bit 1 of byte 0 is set: byte0 & 2 !== 0 (e.g. second digit is 2, 6, a, or e)
  const firstByte = parseInt(clean.substring(0, 2), 16);
  const isRandomized = (firstByte & 0x02) !== 0;

  const prefix = clean.substring(0, 6);
  if (OUI_DATABASE[prefix]) {
    return { vendor: OUI_DATABASE[prefix], isRandomized };
  }

  if (isRandomized) {
    return { vendor: 'Private MAC (Randomized Wi-Fi)', isRandomized: true };
  }

  return { vendor: 'Generic Device', isRandomized: false };
}

function guessDeviceType({
  vendor,
  isGateway,
  isThisDevice,
  hostname,
  mdnsServices = [],
  openPorts = [],
  netbios = null,
  osFamily = '',
  isRandomized = false
}) {
  if (isGateway) return 'router';
  if (isThisDevice) return 'desktop';

  const v = (vendor || '').toLowerCase();
  const h = (hostname || '').toLowerCase();
  const servs = (mdnsServices || []).map(s => String(s).toLowerCase()).join(' ');
  const openPortNumbers = (openPorts || []).map(p => typeof p === 'object' ? p.port : p);

  if (openPortNumbers.includes(631) || openPortNumbers.includes(9100) || servs.includes('print') || servs.includes('ipp') || v.includes('printer') || h.includes('skrivare') || h.includes('laserjet') || h.includes('printer')) return 'printer';
  if (v.includes('charger') || v.includes('zaptec') || h.includes('laddare') || h.includes('zaptec')) return 'ev_charger';
  if (v.includes('solar') || v.includes('battery') || h.includes('solpanel') || h.includes('batteri')) return 'solar';
  if (v.includes('oven') || v.includes('appliance') || h.includes('oven') || h.includes('ugn')) return 'iot';
  if (v.includes('mesh') || v.includes('deco') || h.includes('deco')) return 'mesh_node';

  // PC / Laptop / Windows identification (NetBIOS workstation, SMB/RPC ports, Windows OS, or PC vendors)
  if (
    (netbios && netbios.name) ||
    openPortNumbers.includes(135) ||
    openPortNumbers.includes(445) ||
    openPortNumbers.includes(3389) ||
    osFamily === 'Windows' ||
    v.includes('surface') ||
    v.includes('intel') ||
    v.includes('realtek') ||
    v.includes('msi') ||
    v.includes('dell') ||
    v.includes('lenovo') ||
    h.includes('laptop') ||
    h.includes('surface') ||
    h.includes('desktop') ||
    h.includes('dator') ||
    h.includes('skola') ||
    h.includes('-pc')
  ) {
    return 'computer';
  }

  // Explicit smartphone / mobile markers
  if (
    openPortNumbers.includes(62078) ||
    v.includes('iphone') ||
    v.includes('galaxy') ||
    /(?:iphone|ipad|galaxy|s2[0-5]|23\+|pixel|oneplus|redmi|phone|mobil)/i.test(h)
  ) {
    return 'mobile';
  }

  if (openPortNumbers.includes(8008) || openPortNumbers.includes(8009) || servs.includes('google cast') || servs.includes('android tv') || v.includes('tv') || v.includes('vestel') || v.includes('earda') || h.includes('tv') || h.includes('chromecast')) return 'tv';
  if (v.includes('playstation') || v.includes('sony') || v.includes('xbox') || v.includes('nintendo') || h.includes('playstation') || h.includes('xbox')) return 'console';
  if (servs.includes('spotify') || servs.includes('airplay audio') || v.includes('sonos') || v.includes('audio')) return 'iot';
  if (v.includes('espressif') || v.includes('philips') || v.includes('iot') || v.includes('hue') || v.includes('nest') || v.includes('amazon') || h.includes('iot')) return 'iot';
  if (v.includes('tp-link') || v.includes('netgear') || v.includes('asus') || v.includes('cisco') || v.includes('ubiquiti') || v.includes('linksys')) return 'network';
  if (v.includes('nas') || v.includes('synology') || v.includes('qnap') || h.includes('nas') || h.includes('server')) return 'server';
  if (v.includes('apple') || v.includes('samsung') || v.includes('xiaomi') || v.includes('private mac') || isRandomized) return 'mobile';
  if (v.includes('microsoft') || v.includes('hp')) return 'computer';

  return 'device';
}



// Detect default gateway and active interface
function getDefaultGateway() {
  const isWin = os.platform() === 'win32';
  return new Promise((resolve) => {
    if (isWin) {
      exec('route print 0.0.0.0', { timeout: 3500 }, (err, stdout) => {
        if (err || !stdout) return resolve(null);
        const match = stdout.match(/0\.0\.0\.0\s+0\.0\.0\.0\s+([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)\s+([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/);
        if (match) {
          resolve({
            gatewayIp: match[1],
            interfaceIp: match[2]
          });
        } else {
          resolve(null);
        }
      });
    } else {
      exec("ip route show default || netstat -nr | grep default", { timeout: 3500 }, (err, stdout) => {
        if (err || !stdout) return resolve(null);
        const match = stdout.match(/default\s+(?:via\s+)?([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/);
        if (match) {
          resolve({ gatewayIp: match[1], interfaceIp: null });
        } else {
          resolve(null);
        }
      });
    }
  });
}

// Quick parallel ping to measure latency and ICMP TTL to an IP
function measurePing(ip, timeoutMs = 600) {
  const isWin = os.platform() === 'win32';
  const args = isWin ? ['-n', '1', '-w', String(timeoutMs), ip] : ['-c', '1', '-W', '1', ip];
  return new Promise((resolve) => {
    const child = spawn('ping', args);
    let output = '';
    child.stdout.on('data', d => { output += d.toString(); });
    child.stderr.on('data', d => { output += d.toString(); });
    child.on('close', code => {
      const timeMatch = output.match(/(?:time|tid)[=<](\d+(?:\.\d+)?) ?ms/i);
      const isLess1ms = /(?:time|tid)<1\s*ms/i.test(output);
      const ttlMatch = output.match(/TTL=(\d+)/i);
      const ttl = ttlMatch ? parseInt(ttlMatch[1], 10) : null;

      if (timeMatch || isLess1ms) {
        const val = timeMatch ? parseFloat(timeMatch[1]) : 1;
        resolve({ alive: true, latency: isLess1ms ? 1 : Math.round(val), ttl });
      } else if (ttlMatch && code === 0) {
        resolve({ alive: true, latency: 1, ttl });
      } else {
        resolve({
          alive: code === 0 && !output.toLowerCase().includes('unreachable') && !output.toLowerCase().includes('inte nås'),
          latency: null,
          ttl: null
        });
      }
    });
    child.on('error', () => resolve({ alive: false, latency: null, ttl: null }));
  });
}

// Lightweight non-blocking subnet sweep to populate ARP cache with all active network devices
function sweepSubnet(subnetPrefix, start = 1, end = 254) {
  return new Promise((resolve) => {
    const isWin = os.platform() === 'win32';
    const total = Math.min(254, end) - Math.max(1, start) + 1;
    let finished = 0;
    const maxConcurrent = 60;
    let index = start;

    const launchNext = () => {
      if (index > end) {
        if (finished >= total) resolve();
        return;
      }
      const targetIp = `${subnetPrefix}.${index++}`;
      const args = isWin ? ['-n', '1', '-w', '150', targetIp] : ['-c', '1', '-W', '1', targetIp];
      try {
        const child = spawn('ping', args);
        child.on('close', () => {
          finished++;
          launchNext();
        });
        child.on('error', () => {
          finished++;
          launchNext();
        });
      } catch (e) {
        finished++;
        launchNext();
      }
    };

    const initialWorkers = Math.min(maxConcurrent, total);
    for (let i = 0; i < initialWorkers; i++) {
      launchNext();
    }

    // Safety timeout ceiling: max 3.5 seconds
    setTimeout(() => {
      resolve();
    }, 3500);
  });
}

// Parse output of `arp -a`
function getArpTable() {
  return new Promise((resolve) => {
    exec('arp -a', { timeout: 3500 }, (err, stdout) => {
      if (err || !stdout) return resolve([]);
      const lines = stdout.split('\n');
      const entries = [];

      for (const line of lines) {
        const match = line.trim().match(/([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})\s+([0-9a-fA-F[:-]{11,17})\s+([a-zA-Z]+)/);
        if (match) {
          const ip = match[1];
          const rawMac = match[2];
          const mac = formatMac(rawMac);
          const type = match[3].toLowerCase();

          const parts = ip.split('.').map(Number);
          const isBroadcast = parts[3] === 255 || mac === 'FF-FF-FF-FF-FF-FF';
          const isMulticast = parts[0] >= 224 && parts[0] <= 239;
          const isLoopback = parts[0] === 127;

          if (!isBroadcast && !isMulticast && !isLoopback && mac !== '00-00-00-00-00-00') {
            entries.push({ ip, mac, type });
          }
        }
      }
      resolve(entries);
    });
  });
}

// ==========================================
// Persistent Background Discovery Engine
// ==========================================
const persistentMdnsCache = {};
const persistentSsdpCache = {};
let bgMdnsSocket = null;
let bgSsdpSocket = null;
let bgKeepAliveTimer = null;
let bgListenersStarted = false;

// Parse standard and raw mDNS / Bonjour records into the target map
function parseMdnsMessage(msg, ip, targetMap) {
  if (!ip || !msg || msg.length < 12) return;

  // DNS Header Flags: Bit 15 (msg[2] & 0x80) is QR (0 = Query, 1 = Response).
  // Strictly ignore mDNS Query packets so client devices searching for Cast / Spotify / AirPlay
  // are never misidentified as hosting those services themselves.
  const isResponse = (msg[2] & 0x80) !== 0;
  const qdCount = msg.readUInt16BE(4);
  const anCount = msg.readUInt16BE(6);
  const nsCount = msg.readUInt16BE(8);
  const arCount = msg.readUInt16BE(10);
  if (!isResponse || (anCount === 0 && nsCount === 0 && arCount === 0)) {
    return;
  }

  // Skip the 12-byte DNS header and any echoed Question records (qdCount)
  let answerStart = 12;
  for (let q = 0; q < qdCount && answerStart < msg.length; q++) {
    while (answerStart < msg.length) {
      const len = msg[answerStart];
      if (len === 0) {
        answerStart += 1;
        break;
      }
      if ((len & 0xc0) === 0xc0) {
        answerStart += 2;
        break;
      }
      answerStart += 1 + len;
    }
    answerStart += 4; // Skip QTYPE (2) + QCLASS (2)
  }

  if (answerStart >= msg.length) return;
  const body = msg.slice(answerStart);

  if (!targetMap[ip]) {
    targetMap[ip] = {
      services: new Set(),
      serviceTypes: new Set(),
      name: null,
      model: null,
      hostname: null,
      port: null,
      txtRecords: {},
      rawEntries: [],
      adminUrl: null
    };
  }

  const entry = targetMap[ip];
  const str = body.toString('latin1');

  // 1. Parse standard DNS TXT records (TYPE 16 = 0x0010)
  for (let i = 0; i < body.length - 10; i++) {
    if (body[i] === 0x00 && body[i + 1] === 0x10 && (body[i + 2] === 0x00 || body[i + 2] === 0x80) && body[i + 3] === 0x01) {
      const rdlength = body.readUInt16BE(i + 8);
      let rdataPos = i + 10;
      const rdataEnd = Math.min(body.length, rdataPos + rdlength);

      while (rdataPos < rdataEnd) {
        const strLen = body[rdataPos];
        if (strLen === 0) break;
        if (rdataPos + 1 + strLen <= rdataEnd) {
          const item = body.slice(rdataPos + 1, rdataPos + 1 + strLen).toString('utf8');
          const eq = item.indexOf('=');
          if (eq > 0) {
            const k = item.substring(0, eq).trim();
            const v = item.substring(eq + 1).trim();
            if (k && !entry.txtRecords[k]) {
              entry.txtRecords[k] = v;
            }
          }
          if (!entry.rawEntries.includes(item)) {
            entry.rawEntries.push(item);
          }
          rdataPos += 1 + strLen;
        } else {
          break;
        }
      }
    }
  }

  // Regex fallback for any key=value pairs in buffer that weren't inside standard TXT blocks
  const kvRegex = /(?:[\x01-\x1f]|^)([a-zA-Z0-9_\-]{1,32})=([^\x00\r\n\t\x1b\x7f]{1,250})/g;
  let kvMatch;
  while ((kvMatch = kvRegex.exec(str)) !== null) {
    const k = kvMatch[1].trim();
    const v = kvMatch[2].replace(/[\x00-\x1f].*$/, '').trim();
    if (k && v && !entry.txtRecords[k]) {
      entry.txtRecords[k] = v;
      if (!entry.rawEntries.includes(`${k}=${v}`)) entry.rawEntries.push(`${k}=${v}`);
    }
  }

  // 2. Parse SRV records for port (TYPE 33 = 0x0021)
  for (let i = 0; i < body.length - 16; i++) {
    if (body[i] === 0x00 && body[i + 1] === 0x21 && (body[i + 2] === 0x00 || body[i + 2] === 0x80) && body[i + 3] === 0x01) {
      const srvPort = body.readUInt16BE(i + 14);
      if (srvPort > 0 && srvPort < 65535 && !entry.port) {
        entry.port = srvPort;
      }
    }
  }

  // 3. Extract hostnames (*.local)
  const hostMatches = str.match(/([a-zA-Z0-9\-]{2,64}\.local)/g) || [];
  for (const h of hostMatches) {
    if (!h.startsWith('_') && !entry.hostname) {
      entry.hostname = h.replace(/\.$/, '');
    }
  }

  // 4. Extract Friendly Name from parsed records or string
  if (entry.txtRecords.fn && !entry.name) {
    entry.name = entry.txtRecords.fn;
  }
  if (entry.txtRecords.ty && !entry.name) {
    entry.name = entry.txtRecords.ty;
  }
  if (entry.txtRecords.product && !entry.name) {
    entry.name = entry.txtRecords.product.replace(/[()]/g, '').trim();
  }
  if (!entry.name) {
    const fnMatch = str.match(/fn=([^\x00\r\n\t]+)/);
    if (fnMatch) entry.name = fnMatch[1].trim();
    const hpMatch = str.match(/(HP [A-Za-z0-9\- ]+(?:MFP|LaserJet|DeskJet|ENVY|OfficeJet)[A-Za-z0-9\- ]*)/);
    if (hpMatch) entry.name = hpMatch[1].trim();
  }

  // 5. Extract Model Name
  if (entry.txtRecords.md && !entry.model) {
    entry.model = entry.txtRecords.md;
  }
  if (entry.txtRecords.usb_MDL && !entry.model) {
    entry.model = entry.txtRecords.usb_MDL;
  }
  if (!entry.model) {
    const mdMatch = str.match(/md=([^\x00\r\n\t]+)/);
    if (mdMatch) entry.model = mdMatch[1].replace(/[\x00-\x1f].*$/, '').trim();
  }

  // 6. Extract admin url
  if (entry.txtRecords.adminurl && !entry.adminUrl) {
    entry.adminUrl = entry.txtRecords.adminurl;
  }

  // 7. Service detection & registration
  if (str.includes('_googlecast')) {
    entry.services.add('Google Cast');
    entry.serviceTypes.add('_googlecast._tcp.local');
  }
  if (str.includes('_spotify-connect')) {
    entry.services.add('Spotify Connect');
    entry.serviceTypes.add('_spotify-connect._tcp.local');
  }
  if (str.includes('_androidtvremote')) {
    entry.services.add('Android TV');
    entry.serviceTypes.add('_androidtvremote._tcp.local');
  }
  if (str.includes('_airplay')) {
    entry.services.add('AirPlay');
    entry.serviceTypes.add('_airplay._tcp.local');
  }
  if (str.includes('_raop')) {
    entry.services.add('AirPlay Audio');
    entry.serviceTypes.add('_raop._tcp.local');
  }
  if (str.includes('_companion-link')) {
    entry.services.add('Apple Home / Companion');
    entry.serviceTypes.add('_companion-link._tcp.local');
  }
  if (str.includes('_airdrop')) {
    entry.services.add('AirDrop');
    entry.serviceTypes.add('_airdrop._tcp.local');
  }
  if (str.includes('_ipp') || str.includes('_printer')) {
    entry.services.add('Printer (IPP)');
    entry.serviceTypes.add('_ipp._tcp.local');
  }
  if (str.includes('_scanner')) {
    entry.services.add('Scanner');
    entry.serviceTypes.add('_scanner._tcp.local');
  }
  if (str.includes('_smb')) {
    entry.services.add('Samba (SMB)');
    entry.serviceTypes.add('_smb._tcp.local');
  }
  if (str.includes('_hap')) {
    entry.services.add('HomeKit');
    entry.serviceTypes.add('_hap._tcp.local');
  }
  if (str.includes('_matter')) {
    entry.services.add('Matter');
    entry.serviceTypes.add('_matter._tcp.local');
  }
  if (str.includes('_http.')) {
    entry.services.add('Web Server');
    entry.serviceTypes.add('_http._tcp.local');
  }
  if (str.includes('_ssh.')) {
    entry.services.add('SSH');
    entry.serviceTypes.add('_ssh._tcp.local');
  }
  if (str.includes('_sftp-ssh.')) {
    entry.services.add('SFTP');
    entry.serviceTypes.add('_sftp-ssh._tcp.local');
  }
  if (str.includes('_sleep-proxy.')) {
    entry.services.add('Apple Sleep Proxy');
    entry.serviceTypes.add('_sleep-proxy._udp.local');
  }
}

// Handle incoming SSDP location URL and fetch root description XML asynchronously
async function handleSsdpLocation(ip, locUrl) {
  if (!ip || !locUrl) return;
  if (persistentSsdpCache[ip]?.location === locUrl && persistentSsdpCache[ip]?.rawXml) {
    return;
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1200);
      const res = await fetch(locUrl, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        const xml = await res.text();
        const fnMatch = xml.match(/<friendlyName>([^<]+)<\/friendlyName>/i);
        const mnMatch = xml.match(/<modelName>([^<]+)<\/modelName>/i);
        persistentSsdpCache[ip] = {
          name: fnMatch ? fnMatch[1].trim() : (mnMatch ? mnMatch[1].trim() : null),
          model: mnMatch ? mnMatch[1].trim() : null,
          location: locUrl,
          rawXml: xml
        };
        break;
      }
    } catch (e) {
      if (attempt === 0) await new Promise(r => setTimeout(r, 120));
    }
  }
}

// Build standard DNS query packet
function buildDnsQueryPacket(domain) {
  const parts = domain.split('.');
  const labels = [];
  for (const p of parts) {
    labels.push(Buffer.from([p.length]));
    labels.push(Buffer.from(p, 'ascii'));
  }
  labels.push(Buffer.from([0]));
  const header = Buffer.from([0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0]);
  const qTypeClass = Buffer.from([0, 12, 0, 1]); // QTYPE=PTR, QCLASS=IN
  return Buffer.concat([header, Buffer.concat(labels), qTypeClass]);
}

// Broadcast mDNS discovery query burst
function sendMdnsQueryBurst(socket) {
  if (!socket) return;
  const queries = [
    '_services._dns-sd._udp.local',
    '_googlecast._tcp.local',
    '_airplay._tcp.local',
    '_raop._tcp.local',
    '_companion-link._tcp.local',
    '_airdrop._tcp.local',
    '_spotify-connect._tcp.local',
    '_ipp._tcp.local',
    '_printer._tcp.local',
    '_hap._tcp.local',
    '_matter._tcp.local',
    '_smb._tcp.local',
    '_http._tcp.local',
    '_device-info._tcp.local',
    '_sleep-proxy._udp.local'
  ];
  for (const q of queries) {
    try {
      const packet = buildDnsQueryPacket(q);
      socket.send(packet, 5353, '224.0.0.251');
    } catch (e) {}
  }
}

// Broadcast SSDP M-SEARCH burst
function sendSsdpQueryBurst(socket) {
  if (!socket) return;
  const queries = [
    'M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: "ssdp:discover"\r\nMX: 2\r\nST: ssdp:all\r\n\r\n',
    'M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: "ssdp:discover"\r\nMX: 2\r\nST: upnp:rootdevice\r\n\r\n'
  ];
  for (const q of queries) {
    try {
      socket.send(Buffer.from(q), 1900, '239.255.255.250');
    } catch (e) {}
  }
}

// Start permanent background listeners for continuous mDNS & SSDP observation
function startPermanentBackgroundListeners(localIp = null) {
  if (bgListenersStarted) return;
  bgListenersStarted = true;

  // 1. Permanent mDNS listener on port 5353
  try {
    bgMdnsSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    bgMdnsSocket.on('message', (msg, rinfo) => {
      parseMdnsMessage(msg, rinfo.address, persistentMdnsCache);
    });
    bgMdnsSocket.on('error', () => {
      // Non-fatal
    });
    bgMdnsSocket.bind(5353, () => {
      try {
        if (localIp) {
          bgMdnsSocket.addMembership('224.0.0.251', localIp);
          bgMdnsSocket.setMulticastInterface(localIp);
        } else {
          bgMdnsSocket.addMembership('224.0.0.251');
        }
      } catch (e) {}
      sendMdnsQueryBurst(bgMdnsSocket);
    });
  } catch (e) {}

  // 2. Permanent SSDP listener on port 1900
  try {
    bgSsdpSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    bgSsdpSocket.on('message', (msg, rinfo) => {
      const text = msg.toString();
      const locMatch = text.match(/LOCATION:\s*([^\r\n]+)/i);
      if (locMatch) {
        handleSsdpLocation(rinfo.address, locMatch[1].trim());
      }
    });
    bgSsdpSocket.on('error', () => {
      // Non-fatal
    });
    bgSsdpSocket.bind(1900, () => {
      try {
        if (localIp) {
          bgSsdpSocket.setMulticastInterface(localIp);
          bgSsdpSocket.addMembership('239.255.255.250', localIp);
        } else {
          bgSsdpSocket.addMembership('239.255.255.250');
        }
      } catch (e) {}
      sendSsdpQueryBurst(bgSsdpSocket);
    });
  } catch (e) {}

  // 3. Periodic low-rate heartbeat refresh every 60 seconds
  if (!bgKeepAliveTimer) {
    bgKeepAliveTimer = setInterval(() => {
      if (bgMdnsSocket) sendMdnsQueryBurst(bgMdnsSocket);
      if (bgSsdpSocket) sendSsdpQueryBurst(bgSsdpSocket);
    }, 60000);
    if (bgKeepAliveTimer.unref) bgKeepAliveTimer.unref();
  }
}

// SSDP UPnP device friendlyName & XML discovery
function discoverSsdpNames(timeoutMs = 1600, localIp = null) {
  startPermanentBackgroundListeners(localIp);

  return new Promise((resolve) => {
    let client;
    try {
      client = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    } catch (e) {
      return resolve({ ...persistentSsdpCache });
    }

    const discovered = {};

    client.on('message', (msg, rinfo) => {
      const text = msg.toString();
      const locMatch = text.match(/LOCATION:\s*([^\r\n]+)/i);
      if (locMatch) {
        const url = locMatch[1].trim();
        discovered[rinfo.address] = url;
        handleSsdpLocation(rinfo.address, url);
      }
    });

    client.on('error', () => {
      try { client.close(); } catch (e) {}
      resolve({ ...persistentSsdpCache });
    });

    client.bind(0, () => {
      if (localIp) {
        try { client.setMulticastInterface(localIp); } catch (e) {}
      }

      sendSsdpQueryBurst(client);

      setTimeout(() => {
        sendSsdpQueryBurst(client);
      }, 250);

      setTimeout(() => {
        sendSsdpQueryBurst(client);
      }, 500);
    });

    setTimeout(async () => {
      try { client.close(); } catch (e) {}

      // Fetch any newly discovered locations that aren't yet in persistent cache
      await Promise.all(
        Object.entries(discovered).map(async ([ip, locUrl]) => {
          if (!persistentSsdpCache[ip]) {
            await handleSsdpLocation(ip, locUrl);
          }
        })
      );

      resolve({ ...persistentSsdpCache });
    }, timeoutMs);
  });
}

// Fetch UPnP / SSDP XML on demand (either from cached location or common local endpoints)
async function fetchDeviceXml(ip, cachedLocation = null, cachedXml = null) {
  if (cachedXml) return { location: cachedLocation || `http://${ip}:1900/description.xml`, xml: cachedXml };
  if (persistentSsdpCache[ip]?.rawXml) {
    return {
      location: persistentSsdpCache[ip].location || cachedLocation || `http://${ip}:1900/description.xml`,
      xml: persistentSsdpCache[ip].rawXml
    };
  }

  const loc = cachedLocation || persistentSsdpCache[ip]?.location;
  if (loc) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 1000);
        const res = await fetch(loc, { signal: controller.signal });
        clearTimeout(timer);
        if (res.ok) {
          const xml = await res.text();
          return { location: loc, xml };
        }
      } catch (e) {
        if (attempt === 0) await new Promise(r => setTimeout(r, 100));
      }
    }
  }

  // Probe common UPnP / SSDP ports concurrently so non-UPnP devices never stall inspection
  const probeUrls = [
    `http://${ip}:8008/ssdp/device-desc.xml`,
    `http://${ip}:1900/description.xml`,
    `http://${ip}:49152/wps_device.xml`,
    `http://${ip}:49153/description.xml`,
    `http://${ip}:52323/dmr.xml`,
    `http://${ip}:5000/rootDesc.xml`,
    `http://${ip}:80/description.xml`
  ];

  const results = await Promise.all(
    probeUrls.map(async (url) => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 650);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        if (res.ok) {
          const text = await res.text();
          if (text && (text.includes('<?xml') || text.includes('<root') || text.includes('<device'))) {
            return { location: url, xml: text };
          }
        }
      } catch (e) {}
      return null;
    })
  );

  return results.find(r => r !== null) || null;
}

// Pure Node.js mDNS / Bonjour Service & Hostname Discovery (zero external deps)
function discoverMdns(localIp, timeoutMs = 1800) {
  startPermanentBackgroundListeners(localIp);

  return new Promise((resolve) => {
    let socket;
    try {
      socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    } catch (e) {
      return resolve(getPersistentMdnsSnapshot());
    }

    socket.on('message', (msg, rinfo) => {
      parseMdnsMessage(msg, rinfo.address, persistentMdnsCache);
    });

    socket.on('error', () => {
      try { socket.close(); } catch (e) {}
      resolve(getPersistentMdnsSnapshot());
    });

    socket.bind(0, () => {
      try {
        if (localIp) {
          socket.setMulticastInterface(localIp);
        }
      } catch (e) {}

      sendMdnsQueryBurst(socket);
    });

    setTimeout(() => {
      try { socket.close(); } catch (e) {}
      resolve(getPersistentMdnsSnapshot());
    }, timeoutMs);
  });
}

function getPersistentMdnsSnapshot() {
  const finalResult = {};
  for (const [ip, d] of Object.entries(persistentMdnsCache)) {
    finalResult[ip] = {
      name: d.name,
      model: d.model,
      hostname: d.hostname,
      port: d.port,
      services: Array.from(d.services || []),
      serviceTypes: Array.from(d.serviceTypes || []),
      txtRecords: d.txtRecords || {},
      rawEntries: d.rawEntries || [],
      adminUrl: d.adminUrl || null
    };
  }
  return finalResult;
}

// ==========================================
// Deep Fingerprinting & Diagnostic Probes
// ==========================================

// 1. NetBIOS Name Service Query (UDP 137)
function queryNetbios(ip, timeoutMs = 500) {
  return new Promise((resolve) => {
    const nbnsQuery = Buffer.from([
      0x13, 0x37, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x20, 0x43, 0x4b, 0x41, 0x41, 0x41, 0x41, 0x41, 0x41, 0x41, 0x41, 0x41,
      0x41, 0x41, 0x41, 0x41, 0x41, 0x41, 0x41, 0x41, 0x41, 0x41, 0x41, 0x41,
      0x41, 0x41, 0x41, 0x41, 0x41, 0x41, 0x41, 0x41, 0x41, 0x00, 0x00, 0x21,
      0x00, 0x01
    ]);

    const sock = dgram.createSocket('udp4');
    let timer = null;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      try { sock.close(); } catch (e) {}
    };

    timer = setTimeout(() => {
      cleanup();
      resolve(null);
    }, timeoutMs);

    sock.on('message', (msg) => {
      cleanup();
      try {
        if (msg.length < 57) return resolve(null);
        const numNames = msg.readUInt8(56);
        const names = [];
        let computerName = null;
        let workgroup = null;
        let offset = 57;

        for (let i = 0; i < numNames && offset + 18 <= msg.length; i++) {
          const rawName = msg.toString('ascii', offset, offset + 15).trim().replace(/[\x00-\x1f]/g, '');
          const nameType = msg.readUInt8(offset + 15);
          const flags = msg.readUInt16BE(offset + 16);
          const isGroup = (flags & 0x8000) !== 0; // Bit 15 = 1 means Group / Workgroup name, 0 = Unique computer name
          names.push({ name: rawName, type: nameType, isGroup });
          if (!isGroup && (nameType === 0x00 || nameType === 0x20) && !rawName.startsWith('IS~') && !computerName) {
            computerName = rawName;
          } else if (isGroup && (nameType === 0x00 || nameType === 0x1e) && !workgroup) {
            workgroup = rawName;
          }
          offset += 18;
        }

        const fallbackUnique = names.find(n => !n.isGroup && n.name);
        resolve({
          name: computerName || (fallbackUnique ? fallbackUnique.name : (names[0] ? names[0].name : null)),
          workgroup: workgroup || null,
          names
        });
      } catch (e) {
        resolve(null);
      }
    });

    sock.on('error', () => { cleanup(); resolve(null); });

    try {
      sock.send(nbnsQuery, 137, ip, (err) => {
        if (err) { cleanup(); resolve(null); }
      });
    } catch (e) {
      cleanup();
      resolve(null);
    }
  });
}

// 2. SNMP v1/v2c Query (UDP 161)
const OID_SYS_DESCR = Buffer.from([0x2b, 0x06, 0x01, 0x02, 0x01, 0x01, 0x01, 0x00]);
const OID_SYS_UPTIME = Buffer.from([0x2b, 0x06, 0x01, 0x02, 0x01, 0x01, 0x03, 0x00]);

const snmpSysDescrPacket = Buffer.from([
  0x30, 0x29, 0x02, 0x01, 0x00, 0x04, 0x06, 0x70, 0x75, 0x62, 0x6c, 0x69, 0x63,
  0xa0, 0x1c, 0x02, 0x04, 0x12, 0x34, 0x56, 0x78, 0x02, 0x01, 0x00, 0x02, 0x01, 0x00,
  0x30, 0x0e, 0x30, 0x0c, 0x06, 0x08, 0x2b, 0x06, 0x01, 0x02, 0x01, 0x01, 0x01, 0x00,
  0x05, 0x00
]);

const snmpSysUpTimePacket = Buffer.from([
  0x30, 0x29, 0x02, 0x01, 0x00, 0x04, 0x06, 0x70, 0x75, 0x62, 0x6c, 0x69, 0x63,
  0xa0, 0x1c, 0x02, 0x04, 0x12, 0x34, 0x56, 0x79, 0x02, 0x01, 0x00, 0x02, 0x01, 0x00,
  0x30, 0x0e, 0x30, 0x0c, 0x06, 0x08, 0x2b, 0x06, 0x01, 0x02, 0x01, 0x01, 0x03, 0x00,
  0x05, 0x00
]);

function querySnmp(ip, timeoutMs = 700) {
  return new Promise((resolve) => {
    const sock = dgram.createSocket('udp4');
    let timer = null;
    let sysDescr = null;
    let uptimeTicks = null;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      try { sock.close(); } catch (e) {}
    };

    const finalize = () => {
      let serialNumber = null;
      let model = null;
      let firmware = null;
      let formatted = null;
      let uptimeSeconds = null;

      if (sysDescr) {
        const snMatch = sysDescr.match(/SN:([A-Za-z0-9]+)/i);
        if (snMatch) serialNumber = snMatch[1];
        const pidMatch = sysDescr.match(/PID:([^,\n\]]+)/i);
        if (pidMatch) model = pidMatch[1].trim();
        const fnMatch = sysDescr.match(/FN:([A-Za-z0-9]+)/i);
        if (fnMatch) firmware = fnMatch[1];
      }

      if (uptimeTicks !== null) {
        uptimeSeconds = Math.floor(uptimeTicks / 100);
        const days = Math.floor(uptimeSeconds / 86400);
        const hours = Math.floor((uptimeSeconds % 86400) / 3600);
        const mins = Math.floor((uptimeSeconds % 3600) / 60);
        const secs = uptimeSeconds % 60;
        formatted = `${days > 0 ? days + 'd ' : ''}${hours}h ${mins}m ${secs}s`;
      }

      resolve(sysDescr || uptimeTicks !== null ? {
        sysDescr,
        uptime: formatted ? { formatted, seconds: uptimeSeconds, ticks: uptimeTicks } : null,
        serialNumber,
        model,
        firmware
      } : null);
    };

    timer = setTimeout(() => {
      cleanup();
      finalize();
    }, timeoutMs);

    sock.on('message', (msg) => {
      const descrOidIdx = msg.indexOf(OID_SYS_DESCR);
      if (descrOidIdx !== -1) {
        const valTagIdx = descrOidIdx + OID_SYS_DESCR.length;
        if (msg[valTagIdx] === 0x04) {
          let len = msg[valTagIdx + 1];
          let offset = valTagIdx + 2;
          if (len & 0x80) {
            const numBytes = len & 0x7f;
            len = 0;
            for (let k = 0; k < numBytes; k++) len = (len * 256) + msg[offset++];
          }
          sysDescr = msg.toString('latin1', offset, offset + len).trim();
        }
      }

      const uptimeOidIdx = msg.indexOf(OID_SYS_UPTIME);
      if (uptimeOidIdx !== -1) {
        const valTagIdx = uptimeOidIdx + OID_SYS_UPTIME.length;
        if (msg[valTagIdx] === 0x43) {
          const len = msg[valTagIdx + 1];
          let ticks = 0;
          for (let i = 0; i < len; i++) ticks = (ticks * 256) + msg[valTagIdx + 2 + i];
          uptimeTicks = ticks;
        }
      }

      if (sysDescr && uptimeTicks !== null) {
        cleanup();
        finalize();
      }
    });

    sock.on('error', () => { cleanup(); resolve(null); });

    try {
      sock.send(snmpSysDescrPacket, 161, ip, () => {});
      sock.send(snmpSysUpTimePacket, 161, ip, () => {});
    } catch (e) {
      cleanup();
      resolve(null);
    }
  });
}

// 3. Fast Concurrent TCP Port Probing
const DIAGNOSTIC_PORTS = [
  { port: 21, service: 'FTP', category: 'File Sharing' },
  { port: 22, service: 'SSH', category: 'Remote Administration' },
  { port: 53, service: 'DNS', category: 'Network Service' },
  { port: 80, service: 'HTTP', category: 'Web Portal' },
  { port: 135, service: 'MS-RPC', category: 'Windows RPC' },
  { port: 139, service: 'NetBIOS-SSN', category: 'SMB File Sharing' },
  { port: 443, service: 'HTTPS', category: 'Secure Web Portal' },
  { port: 445, service: 'SMB', category: 'Windows File Sharing' },
  { port: 554, service: 'RTSP', category: 'Video Stream / Camera' },
  { port: 631, service: 'IPP', category: 'Network Printing' },
  { port: 3389, service: 'RDP', category: 'Remote Desktop' },
  { port: 5000, service: 'UPnP / DSM', category: 'Synology / Management' },
  { port: 8008, service: 'Google Cast HTTP', category: 'Media Streaming' },
  { port: 8009, service: 'Google Cast Control', category: 'Media Control' },
  { port: 8080, service: 'HTTP-Alt', category: 'Web Interface' },
  { port: 9100, service: 'RAW JetDirect', category: 'Direct Printing' }
];

function probeTcpPort(ip, port, timeoutMs = 400) {
  return new Promise((resolve) => {
    const s = new net.Socket();
    s.setTimeout(timeoutMs);
    s.on('connect', () => {
      s.destroy();
      resolve(true);
    });
    s.on('timeout', () => { s.destroy(); resolve(false); });
    s.on('error', () => { s.destroy(); resolve(false); });
    try {
      s.connect(port, ip);
    } catch (e) {
      resolve(false);
    }
  });
}

async function probeTcpPorts(ip, customPorts = null, timeoutMs = 400) {
  const portsToProbe = customPorts || DIAGNOSTIC_PORTS;
  const results = await Promise.all(
    portsToProbe.map(async (item) => {
      const portNum = typeof item === 'number' ? item : item.port;
      const serviceName = item.service || `Port ${portNum}`;
      const category = item.category || 'Service';
      const isOpen = await probeTcpPort(ip, portNum, timeoutMs);
      return {
        port: portNum,
        service: serviceName,
        category,
        open: isOpen
      };
    })
  );
  return results;
}

// 4. HTTP Banner Grabbing & Device Details Scraping
async function inspectHttpBannersAndStatus(ip, openPortResults, vendor = '') {
  const openPortNumbers = openPortResults.filter(p => p.open).map(p => p.port);
  let serverBanner = null;
  let title = null;
  let consumableStatus = null;
  let firmwareVersion = null;
  let serialNumber = null;
  let castInfo = null;

  // Try HTTP banners on 80, 8080, 443
  const webPorts = [80, 8080, 443].filter(p => openPortNumbers.includes(p));
  if (webPorts.length > 0) {
    const port = webPorts[0];
    const proto = port === 443 ? 'https' : 'http';
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1200);
      const res = await fetch(`${proto}://${ip}:${port}/`, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (VNI Device Inspector)' }
      });
      clearTimeout(timeout);
      serverBanner = res.headers.get('server');
      const text = await res.text();
      const titleMatch = text.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) {
        title = titleMatch[1].replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
      }
    } catch (e) {}
  }

  // Google Cast eureka_info (port 8008)
  if (openPortNumbers.includes(8008)) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1200);
      const res = await fetch(`http://${ip}:8008/setup/eureka_info`, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const json = await res.json();
        castInfo = {
          name: json.name || null,
          modelName: json.model_name || null,
          buildVersion: json.build_version || null,
          releaseTrack: json.release_track || null,
          uptimeSeconds: json.uptime ? Math.floor(json.uptime) : null,
          ssid: json.ssid || null,
          bssid: json.bssid || null
        };
        if (castInfo.buildVersion) firmwareVersion = `Cast build ${castInfo.buildVersion}`;
      }
    } catch (e) {}
  }

  // Printer specific supplies status & firmware
  const isPrinter = openPortNumbers.includes(631) || openPortNumbers.includes(9100) ||
    vendor.toLowerCase().includes('printer') || vendor.toLowerCase().includes('hp');

  if (isPrinter && (openPortNumbers.includes(80) || openPortNumbers.includes(8080))) {
    const pPort = openPortNumbers.includes(80) ? 80 : 8080;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1200);
      const res = await fetch(`http://${ip}:${pPort}/info_suppliesStatus.html`, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const html = await res.text();
        const pctMatch = html.match(/SupplyName[^>]*alignRight[^>]*>[\s\S]*?(\d+%\s*†?)/i) ||
                         html.match(/(\d+%\s*†)/i) ||
                         html.match(/(\d+%\s*kvar|\d+%\s*level|\d+%\s*toner)/i);
        if (pctMatch) {
          consumableStatus = {
            tonerLevel: pctMatch[1].replace(/&nbsp;/g, ' ').replace('†', '').replace(/\s+/g, ' ').trim(),
            details: 'Toner Level (Cartridge)'
          };
        }
        const cartMatch = html.match(/([0-9]{10}-[0-9A-Z]{4})/);
        if (cartMatch && consumableStatus) {
          consumableStatus.cartridgeSerial = cartMatch[1];
        }
      }
    } catch (e) {}

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1200);
      const res = await fetch(`http://${ip}:${pPort}/info_configuration.html`, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const html = await res.text();
        const fwMatch = html.match(/(?:Firmware|Datecode|Version)[^<]*<[^>]*>([0-9]{8})/i) ||
                        html.match(/([0-9]{8})/);
        if (fwMatch && !firmwareVersion) {
          firmwareVersion = `Datecode ${fwMatch[1]}`;
        }
      }
    } catch (e) {}
  }

  return {
    serverBanner,
    title,
    consumableStatus,
    firmwareVersion,
    serialNumber,
    castInfo
  };
}

// 5. Operating System Fingerprinting (TTL + Ports + Zeroconf + NetBIOS)
function guessOsFingerprint({
  ttl,
  vendor = '',
  mdns = null,
  ssdp = null,
  openPorts = [],
  netbios = null,
  hostname = '',
  isRandomized = false
}) {
  let osName = 'Unknown / Embedded OS';
  let osFamily = 'Unknown';
  let confidence = 'Low';
  let basis = [];

  const openPortNumbers = openPorts.map(p => typeof p === 'object' ? p.port : p);
  const vendorLower = (vendor || '').toLowerCase();
  const hostLower = (hostname || '').toLowerCase();
  const mdnsTypes = mdns?.serviceTypes || [];

  // Check TTL
  if (ttl !== null && ttl !== undefined) {
    if (ttl >= 100 && ttl <= 128) {
      osName = 'Microsoft Windows (10 / 11)';
      osFamily = 'Windows';
      confidence = 'Medium';
      basis.push(`ICMP TTL=${ttl} (standard default for Windows NT kernel)`);
    } else if (ttl >= 50 && ttl <= 64) {
      osName = 'Linux / Unix / RTOS';
      osFamily = 'Unix/Linux';
      confidence = 'Medium';
      basis.push(`ICMP TTL=${ttl} (standard default for Linux / Unix / Darwin kernel)`);
    } else if (ttl >= 200 && ttl <= 255) {
      osName = 'Network Stack / Cisco / Embedded RTOS';
      osFamily = 'Embedded/Network';
      confidence = 'Medium';
      basis.push(`ICMP TTL=${ttl} (standard default for network appliances & microstacks)`);
    }
  }

  const hasSmb = openPortNumbers.includes(445) || openPortNumbers.includes(139);
  const hasRdp = openPortNumbers.includes(3389);
  const hasRpc = openPortNumbers.includes(135);
  const hasSsh = openPortNumbers.includes(22);
  const hasIpp = openPortNumbers.includes(631) || openPortNumbers.includes(9100);
  const hasIosSync = openPortNumbers.includes(62078);
  const hasCastPort = openPortNumbers.includes(8008) || openPortNumbers.includes(8009);
  const hasCastMdns = mdnsTypes.some(t => t.includes('googlecast') || t.includes('androidtvremote'));
  const hasAirplay = mdnsTypes.some(t => t.includes('airplay') || t.includes('raop') || t.includes('companion-link'));
  const isWindowsNetbios = Boolean(netbios && netbios.name && (ttl === null || ttl === undefined || ttl > 64));
  const isMobileHint =
    vendorLower.includes('galaxy') ||
    vendorLower.includes('samsung') && !vendorLower.includes('oven') && !vendorLower.includes('appliance') && !vendorLower.includes('tv') ||
    /(?:galaxy|s2[0-5]|23\+|pixel|oneplus|redmi|xiaomi|android|phone|mobil)/i.test(hostLower);

  if (hasIpp || vendorLower.includes('printer')) {
    osName = 'Printer Embedded RTOS / CUPS';
    osFamily = 'Embedded RTOS';
    confidence = 'High';
    basis.push('Printer services (IPP port 631 / RAW port 9100) or printer hardware verified');
  } else if ((hasSmb && hasRpc) || hasRdp) {
    osName = 'Microsoft Windows (10 / 11 / Server)';
    osFamily = 'Windows';
    confidence = 'High';
    basis.push('Open Windows ports 135 (RPC) / 445 (SMB) verified');
    if (hasRdp) basis.push('Remote Desktop (RDP port 3389) open');
  } else if (isWindowsNetbios || vendorLower.includes('surface')) {
    osName = 'Microsoft Windows (10 / 11)';
    osFamily = 'Windows';
    confidence = 'High';
    if (netbios && netbios.name) {
      basis.push(`Windows NetBIOS workstation identified: ${netbios.name}${netbios.workgroup ? ` (${netbios.workgroup})` : ''}`);
    } else {
      basis.push('Microsoft Surface / Windows hardware fingerprint');
    }
  } else if (hasIosSync || hasAirplay || vendorLower.includes('apple') || /(?:iphone|ipad|macbook|imac)/i.test(hostLower)) {
    osName = 'Apple Darwin (iOS / iPadOS / macOS)';
    osFamily = 'Apple Darwin';
    confidence = 'High';
    basis.push('Apple Zeroconf / AirPlay services or Apple hardware verified');
  } else if (hasCastPort || (hasCastMdns && !isMobileHint)) {
    osName = 'Google CastOS / Android TV';
    osFamily = 'Android TV';
    confidence = 'High';
    basis.push('Google Cast service (port 8008/8009 / mDNS _googlecast) active');
  } else if (vendorLower.includes('zaptec')) {
    osName = 'Zaptec Charger OS (FreeRTOS / ESP-IDF)';
    osFamily = 'Embedded RTOS';
    confidence = 'High';
    basis.push('Zaptec EV Charger hardware fingerprint');
  } else if (vendorLower.includes('samsung') && (vendorLower.includes('oven') || vendorLower.includes('appliance'))) {
    osName = 'Samsung Smart Appliance (Tizen RT / FreeRTOS)';
    osFamily = 'Embedded IoT';
    confidence = 'High';
    basis.push('Samsung Smart Home IoT appliance');
  } else if (vendorLower.includes('vestel') || vendorLower.includes('tcl') || vendorLower.includes('earda')) {
    osName = 'Smart TV OS (Android TV / Linux)';
    osFamily = 'Smart TV';
    confidence = 'High';
    basis.push('Smart TV SoC / DVB Display stack');
  } else if (vendorLower.includes('deco') || (vendorLower.includes('tp-link') && openPortNumbers.includes(443))) {
    osName = 'TP-Link Deco / Embedded Linux (OpenWrt)';
    osFamily = 'Embedded Linux';
    confidence = 'High';
    basis.push('TP-Link Router / Mesh network appliance stack');
  } else if (isMobileHint) {
    osName = 'Google Android (Mobile OS)';
    osFamily = 'Android';
    confidence = 'High';
    basis.push('Android / Samsung mobile device fingerprint (Linux kernel TTL=64)');
  } else if ((isRandomized || vendorLower.includes('private mac')) && (ttl === null || ttl <= 64) && openPortNumbers.length === 0) {
    osName = 'Mobile OS (Android / iOS)';
    osFamily = 'Mobile (Linux / Darwin)';
    confidence = 'Medium';
    basis.push('Randomized Private Wi-Fi MAC with mobile TCP/IP stack (0 open server ports)');
  } else if (hasSsh && (ttl === null || ttl <= 64)) {
    osName = 'Linux Server / Raspberry Pi / OpenWrt';
    osFamily = 'Linux';
    confidence = 'High';
    basis.push('SSH (port 22) open with Linux TTL');
  }

  if (netbios && netbios.name && !basis.some(b => b.includes('NetBIOS'))) {
    basis.push(`NetBIOS Name: ${netbios.name}`);
  }

  return {
    osName,
    osFamily,
    confidence,
    ttl: ttl || null,
    basis: basis.length > 0 ? basis.join(' • ') : 'Estimated based on hardware and MAC address'
  };
}

// 6. Complete Single-Device Inspection
async function inspectDevice(ip, mac = null, vendor = null, hostname = null) {
  const startTime = Date.now();
  const resolvedVendor = (!vendor || vendor === 'Generic Device' || vendor === 'Unknown') && mac
    ? lookupVendor(mac).vendor
    : (vendor || 'Generic Device');
  const isRandomized = mac ? lookupVendor(mac).isRandomized : (resolvedVendor || '').toLowerCase().includes('randomized');

  const [pingRes, portResults, netbiosRes, snmpRes, mdnsMapResult, xmlRes] = await Promise.all([
    measurePing(ip, 700),
    probeTcpPorts(ip),
    queryNetbios(ip, 600),
    querySnmp(ip, 700),
    discoverMdns(null, 650),
    fetchDeviceXml(ip)
  ]);

  const mdnsInfo = (mdnsMapResult && mdnsMapResult[ip]) ? mdnsMapResult[ip] : (persistentMdnsCache[ip] ? {
    name: persistentMdnsCache[ip].name,
    model: persistentMdnsCache[ip].model,
    hostname: persistentMdnsCache[ip].hostname,
    port: persistentMdnsCache[ip].port,
    services: Array.from(persistentMdnsCache[ip].services || []),
    serviceTypes: Array.from(persistentMdnsCache[ip].serviceTypes || []),
    txtRecords: persistentMdnsCache[ip].txtRecords || {},
    rawEntries: persistentMdnsCache[ip].rawEntries || [],
    adminUrl: persistentMdnsCache[ip].adminUrl || null
  } : null);

  let ssdpInfo = null;
  if (xmlRes && xmlRes.xml) {
    const fnMatch = xmlRes.xml.match(/<friendlyName>([^<]+)<\/friendlyName>/i);
    const mnMatch = xmlRes.xml.match(/<modelName>([^<]+)<\/modelName>/i);
    ssdpInfo = {
      name: fnMatch ? fnMatch[1].trim() : (mnMatch ? mnMatch[1].trim() : null),
      model: mnMatch ? mnMatch[1].trim() : null,
      location: xmlRes.location,
      rawXml: xmlRes.xml
    };
  } else if (persistentSsdpCache[ip]) {
    ssdpInfo = persistentSsdpCache[ip];
  }

  const bannerInfo = await inspectHttpBannersAndStatus(ip, portResults, resolvedVendor || '');
  const effectiveHostname = netbiosRes?.name || mdnsInfo?.name || ssdpInfo?.name || hostname || '';

  const osFingerprint = guessOsFingerprint({
    ttl: pingRes.ttl,
    vendor: resolvedVendor,
    mdns: mdnsInfo,
    ssdp: ssdpInfo,
    openPorts: portResults.filter(p => p.open),
    netbios: netbiosRes,
    hostname: effectiveHostname,
    isRandomized
  });

  let uptime = null;
  if (snmpRes && snmpRes.uptime) {
    uptime = {
      source: 'SNMP (sysUpTime)',
      formatted: snmpRes.uptime.formatted,
      seconds: snmpRes.uptime.seconds
    };
  } else if (bannerInfo.castInfo && bannerInfo.castInfo.uptimeSeconds) {
    const s = bannerInfo.castInfo.uptimeSeconds;
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    uptime = {
      source: 'Google Cast API (eureka_info)',
      formatted: `${d > 0 ? d + 'd ' : ''}${h}h ${m}m ${s % 60}s`,
      seconds: s
    };
  }

  const networkCapabilities = [];
  const mdnsTypes = mdnsInfo?.serviceTypes || [];
  if (mdnsTypes.some(t => t.includes('airplay') || t.includes('raop'))) {
    networkCapabilities.push({ id: 'airplay', label: 'Apple AirPlay', icon: 'Radio' });
  }
  if (mdnsTypes.some(t => t.includes('googlecast')) || portResults.some(p => p.port === 8008 && p.open)) {
    networkCapabilities.push({ id: 'cast', label: 'Google Cast', icon: 'Tv' });
  }
  if (mdnsTypes.some(t => t.includes('spotify-connect'))) {
    networkCapabilities.push({ id: 'spotify', label: 'Spotify Connect', icon: 'Music' });
  }
  if (mdnsTypes.some(t => t.includes('ipp') || t.includes('printer')) || portResults.some(p => (p.port === 631 || p.port === 9100) && p.open)) {
    networkCapabilities.push({ id: 'print', label: 'IPP / AirPrint Printing', icon: 'Printer' });
  }
  if (portResults.some(p => p.port === 445 && p.open)) {
    networkCapabilities.push({ id: 'smb', label: 'SMB File Sharing (Windows / Samba)', icon: 'Folder' });
  }
  if (portResults.some(p => p.port === 22 && p.open)) {
    networkCapabilities.push({ id: 'ssh', label: 'SSH Shell', icon: 'Terminal' });
  }
  if (portResults.some(p => (p.port === 80 || p.port === 443 || p.port === 8080) && p.open)) {
    networkCapabilities.push({ id: 'web', label: 'Web Management (HTTP/S)', icon: 'Globe' });
  }


  const deviceSpecific = {
    printer: bannerInfo.consumableStatus ? {
      tonerLevel: bannerInfo.consumableStatus.tonerLevel,
      cartridgeSerial: bannerInfo.consumableStatus.cartridgeSerial || null,
      details: bannerInfo.consumableStatus.details
    } : null,
    snmp: snmpRes ? {
      sysDescr: snmpRes.sysDescr,
      serialNumber: snmpRes.serialNumber,
      model: snmpRes.model,
      firmware: snmpRes.firmware
    } : null,
    upnp: ssdpInfo ? {
      friendlyName: ssdpInfo.name,
      modelName: ssdpInfo.model,
      location: ssdpInfo.location,
      rawXml: ssdpInfo.rawXml
    } : null,
    cast: bannerInfo.castInfo || null
  };

  const openWebPorts = portResults.filter(p => p.open && [80, 443, 8080, 8443].includes(p.port)).map(p => p.port);
  let webPortal = mdnsInfo?.adminUrl || null;
  if (!webPortal) {
    if (openWebPorts.includes(443)) webPortal = `https://${ip}`;
    else if (openWebPorts.includes(80)) webPortal = `http://${ip}`;
    else if (openWebPorts.includes(8443)) webPortal = `https://${ip}:8443`;
    else if (openWebPorts.includes(8080)) webPortal = `http://${ip}:8080`;
  }
  if (webPortal) {
    networkCapabilities.push({ id: 'web', label: 'Web Management Portal', icon: 'Globe', url: webPortal });
  }

  const serialNumber = snmpRes?.serialNumber || null;
  const firmware = snmpRes?.firmware || bannerInfo.firmwareVersion || null;
  const modelName = snmpRes?.model || bannerInfo.title || mdnsInfo?.model || ssdpInfo?.model || null;

  const openAllPorts = portResults.filter(p => p.open);
  const isResponding = Boolean(pingRes.alive || (netbiosRes && netbiosRes.name) || openAllPorts.length > 0);

  return {
    ip,
    mac,
    vendor: resolvedVendor,
    modelName,
    webPortal,
    ping: {
      alive: isResponding,
      latency: pingRes.latency,
      ttl: pingRes.ttl
    },
    names: {
      mdns: mdnsInfo?.name || null,
      netbios: netbiosRes?.name || null,
      workgroup: netbiosRes?.workgroup || null,
      hostname: mdnsInfo?.hostname || hostname || null,
      webTitle: bannerInfo.title || null
    },
    osFingerprint,
    ports: {
      all: portResults,
      openCount: openAllPorts.length,
      open: openAllPorts
    },
    banners: {
      httpServer: bannerInfo.serverBanner || null,
      webTitle: bannerInfo.title || null,
      firmware,
      serialNumber
    },
    networkCapabilities,
    uptime,
    deviceSpecific,
    mdns: mdnsInfo,
    ssdp: ssdpInfo,
    inspectedAt: new Date().toISOString(),
    durationMs: Date.now() - startTime
  };
}

// Main function to scan LAN and produce enriched device tree
async function scanLan(options = { sweep: true }) {
  const startTime = Date.now();

  // 1. Detect local network interfaces
  const ifaces = os.networkInterfaces();
  let localIface = null;
  let localIp = '127.0.0.1';
  let localMac = '';
  let subnetMask = '255.255.255.0';

  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIface = name;
        localIp = iface.address;
        localMac = formatMac(iface.mac);
        subnetMask = iface.netmask;
        break;
      }
    }
    if (localIp !== '127.0.0.1') break;
  }

  startPermanentBackgroundListeners(localIp !== '127.0.0.1' ? localIp : null);

  // 2. Detect default gateway
  const gwInfo = await getDefaultGateway();
  const gatewayIp = gwInfo?.gatewayIp || (localIp !== '127.0.0.1' ? `${localIp.split('.').slice(0, 3).join('.')}.1` : '192.168.1.1');

  // 3. Sweep subnet, discover SSDP and mDNS in parallel (or use persistent caches on quick scan)
  let ssdpMap = { ...persistentSsdpCache };
  let mdnsMap = getPersistentMdnsSnapshot();

  if (options.sweep !== false && localIp !== '127.0.0.1') {
    const subnetPrefix = localIp.split('.').slice(0, 3).join('.');
    const [_, ssdpResult, mdnsResult] = await Promise.all([
      sweepSubnet(subnetPrefix, 1, 254),
      discoverSsdpNames(1300, localIp),
      discoverMdns(localIp, 1300)
    ]);
    ssdpMap = ssdpResult || ssdpMap;
    mdnsMap = mdnsResult || mdnsMap;

    // For devices detected with Google Cast / TV / DIAL services that didn't reply to SSDP multicast M-SEARCH, probe port 8008 directly
    const candidateXmlIps = Object.keys(mdnsMap).filter(ip => {
      if (ssdpMap[ip]) return false;
      const servs = (mdnsMap[ip].services || []).join(' ').toLowerCase();
      return servs.includes('cast') || servs.includes('android tv') || servs.includes('dial');
    });

    if (candidateXmlIps.length > 0) {
      await Promise.all(candidateXmlIps.map(async (ip) => {
        try {
          const xmlRes = await fetchDeviceXml(ip);
          if (xmlRes) {
            const fnMatch = xmlRes.xml.match(/<friendlyName>([^<]+)<\/friendlyName>/i);
            const mnMatch = xmlRes.xml.match(/<modelName>([^<]+)<\/modelName>/i);
            ssdpMap[ip] = {
              name: fnMatch ? fnMatch[1].trim() : (mnMatch ? mnMatch[1].trim() : null),
              model: mnMatch ? mnMatch[1].trim() : null,
              location: xmlRes.location,
              rawXml: xmlRes.xml
            };
          }
        } catch (e) {}
      }));
    }
  } else {
    // Trigger non-blocking refresh burst on background sockets during quick scan
    if (bgMdnsSocket) sendMdnsQueryBurst(bgMdnsSocket);
    if (bgSsdpSocket) sendSsdpQueryBurst(bgSsdpSocket);
  }

  // 4. Read ARP table
  const rawArp = await getArpTable();

  // 5. Build device list
  // Identify Gateway device
  let gatewayMac = '';
  const gwEntry = rawArp.find(e => e.ip === gatewayIp);
  if (gwEntry) {
    gatewayMac = gwEntry.mac;
  }

  const { vendor: gwVendor } = lookupVendor(gatewayMac);
  const gatewayDevice = {
    id: `gw-${gatewayIp}`,
    ip: gatewayIp,
    mac: gatewayMac || 'Unknown',
    vendor: gwVendor !== 'Unknown' ? gwVendor : 'Router / Gateway',
    hostname: 'Default Gateway (Router)',
    deviceType: 'router',
    isGateway: true,
    isThisDevice: false,
    latency: null,
    type: 'dynamic',
    ssdp: ssdpMap[gatewayIp] || null,
    mdns: mdnsMap[gatewayIp] || null
  };

  // Identify "This Device" (host PC running VNI)
  const { vendor: thisVendor } = lookupVendor(localMac);
  const thisDevice = {
    id: `self-${localIp}`,
    ip: localIp,
    mac: localMac || 'Internal',
    vendor: thisVendor !== 'Unknown' ? thisVendor : os.hostname(),
    hostname: `${os.hostname()} (This PC)`,
    deviceType: 'desktop',
    isGateway: false,
    isThisDevice: true,
    isAlive: true,
    latency: 0,
    type: 'local',
    osFingerprint: {
      osName: os.platform() === 'win32' ? 'Microsoft Windows (10 / 11)' : (os.platform() === 'darwin' ? 'Apple macOS' : 'Linux Desktop'),
      osFamily: os.platform() === 'win32' ? 'Windows' : (os.platform() === 'darwin' ? 'Apple Darwin' : 'Linux'),
      confidence: 'High',
      ttl: os.platform() === 'win32' ? 128 : 64,
      basis: 'Local Host OS Kernel'
    },
    ssdp: ssdpMap[localIp] || null,
    mdns: mdnsMap[localIp] || null
  };

  // Build client devices
  const clientDevices = [];
  const seenIps = new Set([gatewayIp, localIp]);

  for (const entry of rawArp) {
    if (seenIps.has(entry.ip)) continue;
    seenIps.add(entry.ip);

    const { vendor, isRandomized } = lookupVendor(entry.mac);
    const ssdpInfo = ssdpMap[entry.ip];
    const mdnsInfo = mdnsMap[entry.ip];

    const friendlyName = mdnsInfo?.name || ssdpInfo?.name || null;
    const modelName = mdnsInfo?.model || ssdpInfo?.model || null;
    const mdnsServices = mdnsInfo?.services || [];

    const dType = guessDeviceType({
      vendor,
      isGateway: false,
      isThisDevice: false,
      hostname: friendlyName,
      mdnsServices,
      isRandomized
    });

    // Derive display hostname:
    // 1. mDNS / SSDP friendly name if discovered
    // 2. Specific vendor / appliance defaults
    // 3. Raw IP
    let displayHostname = friendlyName || entry.ip;
    if (!friendlyName) {
      if (vendor.includes('Zaptec')) displayHostname = 'Zaptec Go (EV Charger)';
      else if (vendor.includes('Solar')) displayHostname = 'Solar Panels / Inverter';
      else if (vendor.includes('Deco Mesh Node')) displayHostname = 'TP-Link Deco Mesh Node';
      else if (vendor.includes('Samsung (Smart Oven')) displayHostname = 'Samsung Smart Oven';
      else if (vendor.includes('Printer')) displayHostname = 'Network Printer';
      else if (vendor.includes('Surface')) displayHostname = 'Microsoft Surface PC';
    }

    clientDevices.push({
      id: `dev-${entry.ip.replace(/\./g, '-')}`,
      ip: entry.ip,
      mac: entry.mac,
      vendor: isRandomized ? `${vendor} (Randomized)` : vendor,
      hostname: displayHostname,
      friendlyName,
      modelName,
      deviceType: dType,
      isGateway: false,
      isThisDevice: false,
      isRandomized,
      latency: null,
      type: entry.type,
      ssdp: ssdpInfo ? {
        name: ssdpInfo.name,
        model: ssdpInfo.model,
        location: ssdpInfo.location,
        rawXml: ssdpInfo.rawXml
      } : null,
      mdns: mdnsInfo ? {
        name: mdnsInfo.name,
        model: mdnsInfo.model,
        hostname: mdnsInfo.hostname || null,
        port: mdnsInfo.port || null,
        services: mdnsServices,
        serviceTypes: mdnsInfo.serviceTypes || [],
        txtRecords: mdnsInfo.txtRecords || {},
        rawEntries: mdnsInfo.rawEntries || [],
        adminUrl: mdnsInfo.adminUrl || null
      } : null
    });
  }

  // Sort client devices logically by IP
  clientDevices.sort((a, b) => {
    const pa = a.ip.split('.').map(Number);
    const pb = b.ip.split('.').map(Number);
    for (let i = 0; i < 4; i++) {
      if (pa[i] !== pb[i]) return pa[i] - pb[i];
    }
    return 0;
  });

  // 6. Ping Gateway and client devices concurrently for quick latency checks, web portal discovery & OS / NetBIOS enrichment
  const pingTargets = [gatewayDevice, ...clientDevices];
  const FAST_DIAG_PORTS = [80, 443, 8080, 8443, 135, 445, 631, 9100, 8008, 62078];
  await Promise.all(
    pingTargets.map(async (dev) => {
      try {
        const [pingRes, nbRes, probedPorts] = await Promise.all([
          measurePing(dev.ip, 550),
          (!dev.isGateway && !dev.isThisDevice) ? queryNetbios(dev.ip, 400) : Promise.resolve(null),
          (!dev.isThisDevice) ? probeTcpPorts(dev.ip, FAST_DIAG_PORTS, 350) : Promise.resolve([])
        ]);

        const openPortObjs = (probedPorts || []).filter(p => p.open);
        const openPortNums = openPortObjs.map(p => p.port);

        dev.latency = pingRes.latency;
        dev.isAlive = Boolean(pingRes.alive || (nbRes && nbRes.name) || openPortNums.length > 0);
        dev.ttl = pingRes.ttl;

        if (nbRes && nbRes.name) {
          dev.netbiosName = nbRes.name;
          dev.workgroup = nbRes.workgroup;
          if (!dev.friendlyName || dev.hostname === dev.ip || dev.hostname === 'Microsoft Surface PC') {
            dev.hostname = nbRes.name;
          }
        }

        // Web portal detection
        const openWeb = openPortNums.filter(p => [80, 443, 8080, 8443].includes(p));
        let portalUrl = null;
        if (dev.mdns?.adminUrl) {
          portalUrl = dev.mdns.adminUrl;
        } else if (openWeb.includes(443)) {
          portalUrl = `https://${dev.ip}`;
        } else if (openWeb.includes(80)) {
          portalUrl = `http://${dev.ip}`;
        } else if (openWeb.includes(8443)) {
          portalUrl = `https://${dev.ip}:8443`;
        } else if (openWeb.includes(8080)) {
          portalUrl = `http://${dev.ip}:8080`;
        } else if (dev.isGateway) {
          portalUrl = `http://${dev.ip}`;
        }
        dev.webPortal = portalUrl;

        // Quick OS fingerprint for table/card view
        dev.osFingerprint = guessOsFingerprint({
          ttl: pingRes.ttl,
          vendor: dev.vendor,
          mdns: dev.mdns,
          ssdp: dev.ssdp,
          openPorts: openPortObjs,
          netbios: nbRes,
          hostname: dev.hostname,
          isRandomized: dev.isRandomized
        });

        // Re-evaluate deviceType with enriched NetBIOS, open ports, and OS family
        if (!dev.isGateway && !dev.isThisDevice) {
          dev.deviceType = guessDeviceType({
            vendor: dev.vendor,
            isGateway: false,
            isThisDevice: false,
            hostname: dev.hostname,
            mdnsServices: dev.mdns?.services || [],
            openPorts: openPortObjs,
            netbios: nbRes,
            osFamily: dev.osFingerprint?.osFamily || '',
            isRandomized: dev.isRandomized
          });
        }

        // Quick network capabilities tags
        const caps = [];
        const mdnsTypes = dev.mdns?.serviceTypes || [];
        if (mdnsTypes.some(t => t.includes('airplay') || t.includes('raop'))) caps.push('AirPlay');
        if (mdnsTypes.some(t => t.includes('googlecast')) || openPortNums.includes(8008)) caps.push('Cast');
        if (mdnsTypes.some(t => t.includes('spotify-connect'))) caps.push('Spotify');
        if (mdnsTypes.some(t => t.includes('ipp') || t.includes('printer')) || openPortNums.includes(631) || openPortNums.includes(9100)) caps.push('Print');
        if (openPortNums.includes(445)) caps.push('SMB');
        if (dev.ssdp) caps.push('UPnP');
        if (dev.webPortal) caps.push('Web');
        dev.networkCapabilities = caps;
      } catch (e) {
        dev.latency = null;
        dev.isAlive = false;
        dev.ttl = null;
        dev.webPortal = dev.isGateway ? `http://${dev.ip}` : null;
      }
    })
  );

  const durationMs = Date.now() - startTime;

  return {
    gateway: gatewayDevice,
    thisDevice,
    devices: clientDevices,
    totalDevices: clientDevices.length + 2,
    network: {
      interface: localIface || 'LAN',
      localIp,
      subnetMask,
      subnetPrefix: localIp.split('.').slice(0, 3).join('.') + '.0/24'
    },
    scannedAt: new Date().toISOString(),
    durationMs
  };
}

module.exports = {
  scanLan,
  measurePing,
  lookupVendor,
  formatMac,
  fetchDeviceXml,
  inspectDevice,
  queryNetbios,
  querySnmp,
  probeTcpPorts,
  guessOsFingerprint,
  startPermanentBackgroundListeners
};

