import {
  Router,
  RadioTower,
  Network,
  Monitor,
  Laptop,
  Smartphone,
  Tablet,
  Watch,
  Tv,
  Speaker,
  Gamepad2,
  Camera,
  Printer,
  HardDrive,
  Server,
  Home,
  Lightbulb,
  Utensils,
  Thermometer,
  BatteryCharging,
  Sun,
  Plug,
  Cpu,
  Wifi
} from 'lucide-react';

export const DEVICE_ICON_CATALOG = [
  { id: 'router', label: 'Router / Gateway', icon: Router, color: '#10b981' },
  { id: 'mesh_node', label: 'Mesh Node / AP', icon: RadioTower, color: '#14b8a6' },
  { id: 'switch', label: 'Network Switch', icon: Network, color: '#0d9488' },
  { id: 'desktop', label: 'Desktop PC', icon: Monitor, color: '#38bdf8' },
  { id: 'laptop', label: 'Laptop / Notebook', icon: Laptop, color: '#06b6d4' },
  { id: 'mobile', label: 'Smartphone', icon: Smartphone, color: '#ec4899' },
  { id: 'tablet', label: 'Tablet / iPad', icon: Tablet, color: '#f43f5e' },
  { id: 'watch', label: 'Smartwatch', icon: Watch, color: '#d946ef' },
  { id: 'tv', label: 'Smart TV / Streamer', icon: Tv, color: '#a855f7' },
  { id: 'speaker', label: 'Speaker / Audio', icon: Speaker, color: '#8b5cf6' },
  { id: 'console', label: 'Game Console', icon: Gamepad2, color: '#6366f1' },
  { id: 'camera', label: 'Security Camera', icon: Camera, color: '#ef4444' },
  { id: 'printer', label: 'Printer / Scanner', icon: Printer, color: '#0ea5e9' },
  { id: 'nas', label: 'NAS Storage', icon: HardDrive, color: '#4f46e5' },
  { id: 'server', label: 'Server / HomeLab', icon: Server, color: '#3b82f6' },
  { id: 'smart_home', label: 'Smart Home Hub', icon: Home, color: '#f59e0b' },
  { id: 'light', label: 'Smart Lighting', icon: Lightbulb, color: '#eab308' },
  { id: 'plug', label: 'Smart Plug / Relay', icon: Plug, color: '#34d399' },
  { id: 'appliance', label: 'Home Appliance', icon: Utensils, color: '#f97316' },
  { id: 'climate', label: 'Climate / HVAC', icon: Thermometer, color: '#fb923c' },
  { id: 'ev_charger', label: 'EV Charger', icon: BatteryCharging, color: '#84cc16' },
  { id: 'solar', label: 'Solar / Battery', icon: Sun, color: '#facc15' },
  { id: 'iot', label: 'IoT / Sensor', icon: Cpu, color: '#f59e0b' }
];

const CATALOG_BY_ID = Object.fromEntries(DEVICE_ICON_CATALOG.map(item => [item.id, item]));

export function getDeviceIcon(type) {
  if (!type) return Wifi;
  if (type === 'computer') return Laptop;
  if (type === 'network') return RadioTower;
  return CATALOG_BY_ID[type]?.icon || Wifi;
}

export function getDeviceColor(type, isThisDevice = false, isGateway = false) {
  if (isGateway) return '#10b981'; // Emerald
  if (isThisDevice) return '#38bdf8'; // Sky blue
  if (type === 'computer') return '#06b6d4';
  if (type === 'network') return '#14b8a6';
  return CATALOG_BY_ID[type]?.color || '#94a3b8';
}

export function formatDeviceType(type) {
  if (!type) return 'Client Device';
  if (type === 'computer') return 'Laptop / PC';
  if (type === 'network') return 'Network Device';
  if (type === 'device') return 'Client Device';
  return CATALOG_BY_ID[type]?.label || type.replace(/_/g, ' ');
}

/**
 * Dynamically resolves the most accurate icon/type for a device based on:
 * 1. Explicit user icon override (stored in localStorage `vni_lan_icons`)
 * 2. Keywords in user-assigned nickname or discovered hostname/services
 * 3. Backend `dev.deviceType`
 */
export function resolveEffectiveDeviceType(dev, customName = '', customIconsMap = {}) {
  if (!dev) return 'device';
  if (dev.isGateway) return 'router';

  const customIcon = (dev.mac && customIconsMap[dev.mac]) || (dev.ip && customIconsMap[dev.ip]);
  if (customIcon && CATALOG_BY_ID[customIcon]) {
    return customIcon;
  }

  if (dev.isThisDevice) return 'desktop';

  const text = `${customName || ''} ${dev.hostname || ''} ${dev.friendlyName || ''} ${dev.modelName || ''}`.toLowerCase();

  if (text.trim()) {
    if (/(?:printer|laserjet|officejet|deskjet|pixma|skrivare)/i.test(text)) return 'printer';
    if (/(?:camera|ipcam|doorbell|ring|arlo|reolink|hikvision|kamera)/i.test(text)) return 'camera';
    if (/(?:charger|evse|wallbox|easee|zaptec|laddbox|laddare|elbil)/i.test(text)) return 'ev_charger';
    if (/(?:solar|inverter|fronius|sungrow|solaredge|goodwe|solcell|solpanel|batteri)/i.test(text)) return 'solar';
    if (/(?:oven|ugn|fridge|kyl|washer|tvätt|tvatt|dishwasher|diskmaskin|dryer|torktumlare|microwave|mikro|spis)/i.test(text)) return 'appliance';
    if (/(?:thermostat|termostat|daikin|mitsubishi|hvac|heatpump|värmepump|varmepump|klimat|ac\b|fläkt)/i.test(text)) return 'climate';
    if (/(?:hue|nanoleaf|lifx|wled|trådfri|tradfri|light|lampa|belysning)/i.test(text)) return 'light';
    if (/(?:shelly|tasmota|sonoff|smartplug|plug|uttag|relay|brytare)/i.test(text)) return 'plug';
    if (/(?:homeassistant|homebridge|dirigera|smartthings|hubitat|zigbee|homekit)/i.test(text)) return 'smart_home';
    if (/(?:switch|procurve|edgeswitch)/i.test(text) && !/(?:nintendo)/i.test(text)) return 'switch';
    if (/(?:mesh|deco|orbi|unifi|velop|aimesh|access-point|\bap\b|extender|repeater)/i.test(text)) return 'mesh_node';
    if (/(?:synology|qnap|truenas|unraid|\bnas\b|diskstation)/i.test(text)) return 'nas';
    if (/(?:server|proxmox|pihole|homelab|raspberry|vm\b|docker)/i.test(text)) return 'server';
    if (/(?:sonos|homepod|echo|nest-audio|nest-mini|speaker|soundbar|högtalare|hogtalare)/i.test(text)) return 'speaker';
    if (/(?:\btv\b|chromecast|apple-tv|appletv|bravia|shield|firetv|roku)/i.test(text)) return 'tv';
    if (/(?:playstation|ps5|ps4|xbox|nintendo|steamdeck|konsol)/i.test(text)) return 'console';
    if (/(?:ipad|tablet|galaxy-tab|surfplatta)/i.test(text)) return 'tablet';
    if (/(?:apple-watch|galaxy-watch|smartwatch|klocka)/i.test(text)) return 'watch';
    if (/(?:desktop|imac|mac-mini|mac-studio|workstation|stationär|stationar)/i.test(text)) return 'desktop';
    if (/(?:laptop|surface|macbook|thinkpad|notebook|bärbar|barbar)/i.test(text)) return 'laptop';
    if (/(?:iphone|galaxy|s2[0-5]|\b23\+|pixel|oneplus|redmi|phone|mobil)/i.test(text)) return 'mobile';
  }

  if (dev.deviceType === 'computer') return 'laptop';
  return dev.deviceType || 'device';
}

