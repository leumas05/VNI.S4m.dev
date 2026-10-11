const { exec, spawn } = require('child_process');
const os = require('os');
const dgram = require('dgram');

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
  '5c879c': 'Apple', '600308': 'Apple', '64bb1e': 'Apple (TV / Device)', '68a86d': 'Apple', '6c4008': 'Apple',
  '701124': 'Apple', '748114': 'Apple', '784f43': 'Apple', '7cd1c3': 'Apple', '804971': 'Apple',
  '843835': 'Apple', '88665a': 'Apple', '8c8590': 'Apple', '907240': 'Apple', '949426': 'Apple',
  '9801a7': 'Apple', '9cb1dc': 'Apple (TV / Device)', 'a45e60': 'Apple', 'a808cf': 'Apple (TV / Device)',
  'acbc32': 'Apple', 'b065bd': 'Apple', 'b418d1': 'Apple', 'b8e856': 'Apple', 'bc52b7': 'Apple',
  'c09a42': 'Apple', 'c4b301': 'Apple', 'c869cd': 'Apple', 'cc29f5': 'Apple', 'd023db': 'Apple',
  'd4619d': 'Apple', 'd8004d': 'Apple', 'dc2b61': 'Apple', 'e0b55f': 'Apple', 'e4e4ab': 'Apple',
  'e8040b': 'Apple', 'ec3586': 'Apple', 'f01898': 'Apple', 'f45c89': 'Apple', 'f82793': 'Apple',

  // Google / Nest
  '001a11': 'Google', '089e08': 'Google', '18d6c7': 'Google', '20dfb9': 'Google', '30fd38': 'Google',
  '3cf7a4': 'Google', '48d6d5': 'Google', '4ccd86': 'Google', '4ccdb6': 'Google (Nest / Smart Device)',
  '546009': 'Google', '641666': 'Google', '70ee50': 'Google', '94ebcd': 'Google', 'a47733': 'Google',
  'b827eb': 'Google', 'd86c63': 'Google', 'e03f49': 'Google', 'f40343': 'Google', 'f88f12': 'Google',

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

// Guess human-friendly device type based on vendor, role, and hostname
function guessDeviceType({ vendor, isGateway, isThisDevice, hostname }) {
  if (isGateway) return 'router';
  if (isThisDevice) return 'desktop';

  const v = (vendor || '').toLowerCase();
  const h = (hostname || '').toLowerCase();

  if (v.includes('charger') || v.includes('zaptec') || h.includes('laddare') || h.includes('zaptec')) return 'ev_charger';
  if (v.includes('solar') || v.includes('battery') || h.includes('solpanel') || h.includes('batteri')) return 'solar';
  if (v.includes('oven') || v.includes('appliance') || h.includes('oven') || h.includes('ugn')) return 'iot';
  if (v.includes('printer') || h.includes('skrivare') || h.includes('printer')) return 'printer';
  if (v.includes('mesh') || v.includes('deco') || h.includes('deco')) return 'mesh_node';
  if (v.includes('tv') || h.includes('tv') || h.includes('chromecast')) return 'tv';
  if (v.includes('playstation') || v.includes('sony') || v.includes('xbox') || v.includes('nintendo') || h.includes('playstation') || h.includes('xbox')) return 'console';
  if (v.includes('espressif') || v.includes('philips') || v.includes('iot') || v.includes('hue') || v.includes('sonos') || v.includes('nest') || v.includes('amazon') || h.includes('iot')) return 'iot';
  if (v.includes('tp-link') || v.includes('netgear') || v.includes('asus') || v.includes('cisco') || v.includes('ubiquiti') || v.includes('linksys')) return 'network';
  if (v.includes('nas') || v.includes('synology') || v.includes('qnap') || h.includes('nas') || h.includes('server')) return 'server';
  if (v.includes('apple') || v.includes('samsung') || v.includes('galaxy') || v.includes('private mac') || h.includes('iphone') || h.includes('s23') || h.includes('a55') || h.includes('mobil')) return 'mobile';
  if (v.includes('intel') || v.includes('realtek') || v.includes('msi') || v.includes('dell') || v.includes('hp') || v.includes('lenovo') || h.includes('dator') || h.includes('pc')) return 'computer';

  return 'device';
}

// Detect local adapter connection medium (Cable / Ethernet vs Wi-Fi 2.4/5 GHz)
function getLocalConnectionInfo() {
  return new Promise((resolve) => {
    if (os.platform() !== 'win32') {
      return resolve({ medium: 'cable', band: null, interfaceName: 'Ethernet', label: 'Kabel (Ethernet)' });
    }

    exec('netsh wlan show interfaces', { timeout: 1500 }, (err, wlanOut) => {
      const isWifiConnected = !err && wlanOut && /State\s*:\s*connected/i.test(wlanOut);
      if (isWifiConnected) {
        const bandMatch = wlanOut.match(/Band\s*:\s*([^\r\n]+)/i);
        const bssidMatch = wlanOut.match(/BSSID\s*:\s*([^\r\n]+)/i);
        const ssidMatch = wlanOut.match(/SSID\s*:\s*([^\r\n]+)/i);
        const radioMatch = wlanOut.match(/Radio type\s*:\s*([^\r\n]+)/i);
        const signalMatch = wlanOut.match(/Signal\s*:\s*([^\r\n]+)/i);

        let band = '5 GHz';
        if (bandMatch) {
          band = bandMatch[1].trim();
        } else if (radioMatch && (radioMatch[1].includes('802.11b') || radioMatch[1].includes('802.11g'))) {
          band = '2.4 GHz';
        }

        return resolve({
          medium: band.includes('2.4') ? 'wifi_24g' : 'wifi_5g',
          band,
          ssid: ssidMatch ? ssidMatch[1].trim() : null,
          bssid: bssidMatch ? formatMac(bssidMatch[1].trim()) : null,
          signal: signalMatch ? signalMatch[1].trim() : null,
          interfaceName: 'Wi-Fi',
          label: `Wi-Fi ${band}`
        });
      }

      exec('netsh interface show interface', { timeout: 1500 }, (err2, ifOut) => {
        const isEthernet = !err2 && ifOut && /Connected\s+Dedicated\s+Ethernet/i.test(ifOut);
        resolve({
          medium: 'cable',
          band: null,
          interfaceName: isEthernet ? 'Ethernet' : 'LAN',
          label: 'Kabel (Ethernet)'
        });
      });
    });
  });
}

// Guess connection medium based on device type & vendor
function guessConnectionMedium({ deviceType, isThisDevice, vendor, hostname }) {
  if (isThisDevice) return { medium: 'cable', label: 'Kabel (Ethernet)' };
  if (deviceType === 'router' || deviceType === 'mesh_node') {
    return { medium: 'cable', label: 'Kabel / Mesh' };
  }
  const v = (vendor || '').toLowerCase();
  const h = (hostname || '').toLowerCase();
  if (
    deviceType === 'iot' ||
    deviceType === 'ev_charger' ||
    deviceType === 'solar' ||
    deviceType === 'printer' ||
    v.includes('zaptec') ||
    v.includes('solar') ||
    v.includes('oven') ||
    v.includes('ugn') ||
    v.includes('espressif') ||
    h.includes('ugn') ||
    h.includes('printer')
  ) {
    return { medium: 'wifi_24g', label: '2,4 GHz' };
  }
  if (deviceType === 'mobile' || deviceType === 'tv' || deviceType === 'console') {
    return { medium: 'wifi_5g', label: '5 GHz' };
  }
  return { medium: 'wifi_5g', label: '5 GHz' };
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

// Quick parallel ping to measure latency to an IP
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
      const ttlMatch = output.match(/TTL=/i);

      if (timeMatch || isLess1ms) {
        const val = timeMatch ? parseFloat(timeMatch[1]) : 1;
        resolve({ alive: true, latency: isLess1ms ? 1 : Math.round(val) });
      } else if (ttlMatch && code === 0) {
        resolve({ alive: true, latency: 1 });
      } else {
        resolve({ alive: code === 0 && !output.toLowerCase().includes('unreachable') && !output.toLowerCase().includes('inte nås'), latency: null });
      }
    });
    child.on('error', () => resolve({ alive: false, latency: null }));
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

// SSDP UPnP device friendlyName discovery
function discoverSsdpNames(timeoutMs = 1500) {
  return new Promise((resolve) => {
    let client;
    try {
      client = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    } catch (e) {
      return resolve({});
    }

    const discovered = {};

    client.on('message', (msg, rinfo) => {
      const text = msg.toString();
      const locMatch = text.match(/LOCATION:\s*([^\r\n]+)/i);
      if (locMatch && !discovered[rinfo.address]) {
        discovered[rinfo.address] = locMatch[1].trim();
      }
    });

    client.on('error', () => {
      try { client.close(); } catch (e) {}
      resolve({});
    });

    client.bind(0, () => {
      const query = 'M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: "ssdp:discover"\r\nMX: 2\r\nST: ssdp:all\r\n\r\n';
      client.send(Buffer.from(query), 1900, '239.255.255.250');
    });

    setTimeout(async () => {
      try { client.close(); } catch (e) {}
      const results = {};
      await Promise.all(
        Object.entries(discovered).map(async ([ip, locUrl]) => {
          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 1000);
            const res = await fetch(locUrl, { signal: controller.signal });
            clearTimeout(timer);
            const xml = await res.text();
            const fnMatch = xml.match(/<friendlyName>([^<]+)<\/friendlyName>/i);
            const mnMatch = xml.match(/<modelName>([^<]+)<\/modelName>/i);
            if (fnMatch) {
              results[ip] = {
                name: fnMatch[1].trim(),
                model: mnMatch ? mnMatch[1].trim() : null
              };
            }
          } catch (e) {}
        })
      );
      resolve(results);
    }, timeoutMs);
  });
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

  // 2. Detect default gateway
  const gwInfo = await getDefaultGateway();
  const gatewayIp = gwInfo?.gatewayIp || (localIp !== '127.0.0.1' ? `${localIp.split('.').slice(0, 3).join('.')}.1` : '192.168.1.1');

  // 3. Sweep subnet and discover SSDP in parallel
  let ssdpMap = {};
  if (options.sweep !== false && localIp !== '127.0.0.1') {
    const subnetPrefix = localIp.split('.').slice(0, 3).join('.');
    const [_, ssdpResult] = await Promise.all([
      sweepSubnet(subnetPrefix, 1, 254),
      discoverSsdpNames(1500)
    ]);
    ssdpMap = ssdpResult || {};
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
    type: 'dynamic'
  };

  // Identify "This Device" (host PC running VNI)
  const { vendor: thisVendor } = lookupVendor(localMac);
  const hostConn = await getLocalConnectionInfo();
  const thisDevice = {
    id: `self-${localIp}`,
    ip: localIp,
    mac: localMac || 'Internal',
    vendor: thisVendor !== 'Unknown' ? thisVendor : os.hostname(),
    hostname: `${os.hostname()} (This PC)`,
    deviceType: 'desktop',
    isGateway: false,
    isThisDevice: true,
    latency: 0,
    type: 'local',
    connection: hostConn,
    medium: hostConn.medium
  };

  // Build client devices
  const clientDevices = [];
  const seenIps = new Set([gatewayIp, localIp]);

  for (const entry of rawArp) {
    if (seenIps.has(entry.ip)) continue;
    seenIps.add(entry.ip);

    const { vendor, isRandomized } = lookupVendor(entry.mac);
    const ssdpInfo = ssdpMap[entry.ip];
    const friendlyName = ssdpInfo?.name || null;
    const dType = guessDeviceType({ vendor, isGateway: false, isThisDevice: false, hostname: friendlyName });

    // Derive display hostname
    let displayHostname = friendlyName || entry.ip;
    if (!friendlyName) {
      if (vendor.includes('Zaptec')) displayHostname = 'Zaptec Go (EV Charger)';
      else if (vendor.includes('Solar')) displayHostname = 'Solar Panels / Inverter';
      else if (vendor.includes('Deco Mesh Node')) displayHostname = 'TP-Link Deco Mesh Node';
      else if (vendor.includes('Samsung (Smart Oven')) displayHostname = 'Samsung Smart Oven';
      else if (vendor.includes('Printer')) displayHostname = 'Network Printer';
    }

    const isMeshNode = dType === 'mesh_node' || vendor.includes('Deco') || displayHostname.includes('Deco');
    const devConn = guessConnectionMedium({ deviceType: dType, isThisDevice: false, vendor, hostname: displayHostname });

    clientDevices.push({
      id: `dev-${entry.ip.replace(/\./g, '-')}`,
      ip: entry.ip,
      mac: entry.mac,
      vendor: isRandomized ? `${vendor} (Randomized)` : vendor,
      hostname: displayHostname,
      friendlyName,
      deviceType: dType,
      isGateway: false,
      isThisDevice: false,
      isMeshNode,
      isRandomized,
      latency: null,
      type: entry.type,
      connection: devConn,
      medium: devConn.medium
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

  // 6. Ping Gateway and client devices concurrently for quick latency checks
  const pingTargets = [gatewayDevice, ...clientDevices];
  await Promise.all(
    pingTargets.map(async (dev) => {
      try {
        const res = await measurePing(dev.ip, 600);
        dev.latency = res.latency;
        dev.isAlive = res.alive;
      } catch (e) {
        dev.latency = null;
        dev.isAlive = false;
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
  getLocalConnectionInfo,
  guessConnectionMedium
};
