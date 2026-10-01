const dns = require('dns').promises;

function isPrivateIp(ip) {
    if (!ip) return false;
    
    if (ip.includes(':')) {
        const lower = ip.toLowerCase();
        if (lower === '::1') return 'Localhost'; 
        if (lower.startsWith('fe80:')) return 'Link-Local';
        if (lower.startsWith('fc') || lower.startsWith('fd')) return 'Unique Local';
        return false;
    }

    const parts = ip.split('.');
    if (parts.length !== 4) return false;
    const [p1, p2, p3, p4] = parts.map(Number);
    
    if (p1 === 127) return 'Localhost';
    if (p1 === 10) return 'Internal Router (Class A)';
    if (p1 === 172 && p2 >= 16 && p2 <= 31) return 'Internal Router (Class B)';
    if (p1 === 192 && p2 === 168) return 'Local LAN Router';
    if (p1 === 100 && p2 >= 64 && p2 <= 127) return 'ISP NAT Router (CGNAT)';
    if (p1 === 169 && p2 === 254) return 'APIPA (Link-Local)';
    
    return false;
}

async function resolveHostname(ip) {
    try {
        const hostnames = await dns.reverse(ip);
        if (hostnames && hostnames.length > 0) {
            return hostnames[0];
        }
    } catch (e) {
        return null;
    }
    return null;
}

module.exports = {
    isPrivateIp,
    resolveHostname,
    cidrToRange
};

function cidrToRange(cidr) {
    if (!cidr || !cidr.includes('/')) return cidr;
    try {
        const [ip, bits] = cidr.split('/');
        const ipParts = ip.split('.').map(Number);
        if (ipParts.length !== 4 || isNaN(bits)) return cidr;
        
        const ipNum = (ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3];
        const mask = ~(2 ** (32 - Number(bits)) - 1);
        
        const startNum = ipNum & mask;
        const endNum = startNum | ~mask;
        
        const numToIp = (num) => [
            (num >>> 24) & 255,
            (num >>> 16) & 255,
            (num >>> 8) & 255,
            num & 255
        ].join('.');
        
        return `${numToIp(startNum)} - ${numToIp(endNum)}`;
    } catch (e) {
        return cidr;
    }
}
