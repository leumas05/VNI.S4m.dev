const { execFile } = require('child_process');
const os = require('os');
const { isPrivateIp } = require('./utils');

// In-memory cache for IP geolocations to avoid redundant lookups and rate limits
const geoCache = new Map();

// In-memory cache for PID -> process name mapping (refresh every 10 seconds)
let processMapCache = new Map();
let lastProcessMapTime = 0;

function getProcessMap() {
    return new Promise((resolve) => {
        const now = Date.now();
        if (processMapCache.size > 0 && (now - lastProcessMapTime) < 10000) {
            return resolve(processMapCache);
        }

        const isWin = os.platform() === 'win32';
        if (isWin) {
            execFile('tasklist', ['/fo', 'csv', '/nh'], { windowsHide: true }, (err, stdout) => {
                if (err || !stdout) return resolve(processMapCache);
                const map = new Map();
                stdout.split(/\r?\n/).forEach(line => {
                    if (!line.trim()) return;
                    const match = line.match(/^"([^"]+)","(\d+)"/);
                    if (match) {
                        const name = match[1];
                        const pid = parseInt(match[2], 10);
                        if (!isNaN(pid)) map.set(pid, name);
                    }
                });
                processMapCache = map;
                lastProcessMapTime = now;
                resolve(map);
            });
        } else {
            execFile('ps', ['-A', '-o', 'pid,comm'], (err, stdout) => {
                if (err || !stdout) return resolve(processMapCache);
                const map = new Map();
                stdout.split(/\r?\n/).forEach(line => {
                    const parts = line.trim().split(/\s+/);
                    if (parts.length >= 2) {
                        const pid = parseInt(parts[0], 10);
                        const name = parts.slice(1).join(' ');
                        if (!isNaN(pid)) map.set(pid, name);
                    }
                });
                processMapCache = map;
                lastProcessMapTime = now;
                resolve(map);
            });
        }
    });
}

function parseNetstatWindows() {
    return new Promise((resolve) => {
        execFile('netstat', ['-ano', '-p', 'tcp'], { windowsHide: true }, (err, stdout) => {
            if (err || !stdout) return resolve([]);
            const connections = [];
            stdout.split(/\r?\n/).forEach(line => {
                const trimmed = line.trim();
                if (!trimmed.startsWith('TCP')) return;
                const parts = trimmed.split(/\s+/);
                if (parts.length >= 5) {
                    const local = parts[1];
                    const foreign = parts[2];
                    const state = parts[3];
                    const pid = parseInt(parts[4], 10);

                    const lastColon = foreign.lastIndexOf(':');
                    if (lastColon === -1) return;
                    const remoteIp = foreign.slice(0, lastColon).replace(/[\[\]]/g, '');
                    const remotePort = parseInt(foreign.slice(lastColon + 1), 10);

                    connections.push({
                        proto: 'TCP',
                        local,
                        foreign,
                        remoteIp,
                        remotePort,
                        state,
                        pid: isNaN(pid) ? null : pid
                    });
                }
            });
            resolve(connections);
        });
    });
}

function parseNetstatUnix() {
    return new Promise((resolve) => {
        execFile('ss', ['-tunp', '-H', 'state', 'established'], (err, stdout) => {
            if (!err && stdout) {
                const connections = [];
                stdout.split(/\r?\n/).forEach(line => {
                    const parts = line.trim().split(/\s+/);
                    if (parts.length >= 5) {
                        const peer = parts[4];
                        const lastColon = peer.lastIndexOf(':');
                        if (lastColon === -1) return;
                        const remoteIp = peer.slice(0, lastColon).replace(/[\[\]]/g, '');
                        const remotePort = parseInt(peer.slice(lastColon + 1), 10);
                        let pid = null;
                        let processName = null;
                        const procMatch = line.match(/users:\(\("([^"]+)",pid=(\d+)/);
                        if (procMatch) {
                            processName = procMatch[1];
                            pid = parseInt(procMatch[2], 10);
                        }
                        connections.push({
                            proto: parts[0].toUpperCase(),
                            local: parts[3],
                            foreign: peer,
                            remoteIp,
                            remotePort,
                            state: 'ESTABLISHED',
                            pid,
                            processName
                        });
                    }
                });
                return resolve(connections);
            }

            execFile('netstat', ['-anv', '-p', 'tcp'], (errNet, stdoutNet) => {
                if (errNet || !stdoutNet) return resolve([]);
                const connections = [];
                stdoutNet.split(/\r?\n/).forEach(line => {
                    if (!line.includes('ESTABLISHED')) return;
                    const parts = line.trim().split(/\s+/);
                    if (parts.length >= 5) {
                        const foreign = parts[4];
                        const lastDot = foreign.lastIndexOf('.');
                        const lastColon = foreign.lastIndexOf(':');
                        const sep = lastColon !== -1 ? lastColon : lastDot;
                        if (sep === -1) return;
                        const remoteIp = foreign.slice(0, sep);
                        const remotePort = parseInt(foreign.slice(sep + 1), 10);
                        connections.push({
                            proto: 'TCP',
                            local: parts[3],
                            foreign,
                            remoteIp,
                            remotePort,
                            state: 'ESTABLISHED',
                            pid: null
                        });
                    }
                });
                resolve(connections);
            });
        });
    });
}

async function fetchIpGeo(ip) {
    if (!ip || isPrivateIp(ip)) return null;
    if (geoCache.has(ip)) return geoCache.get(ip);

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(`https://api.ip2location.io/?ip=${encodeURIComponent(ip)}&format=json`, {
            signal: controller.signal
        });
        clearTimeout(timeout);
        if (res.ok) {
            const data = await res.json();
            if (data && (data.latitude || data.country_name)) {
                const geo = {
                    lat: parseFloat(data.latitude) || null,
                    lon: parseFloat(data.longitude) || null,
                    country: data.country_name || 'Unknown',
                    countryCode: data.country_code || '',
                    region: data.region_name || '',
                    city: data.city_name || '',
                    isp: data.as || data.isp || '',
                    asn: data.asn ? `AS${data.asn}` : ''
                };
                geoCache.set(ip, geo);
                return geo;
            }
        }
    } catch {
        // network or timeout
    }

    return null;
}

const SELF_PROCESS_KEYWORDS = ['electron', 'vni', 'node', 'agy', 'antigravity'];

function isSelfConnection(procName, pid) {
    if (pid && (pid === process.pid || pid === process.ppid)) return true;
    if (!procName) return false;
    const lower = procName.toLowerCase();
    return SELF_PROCESS_KEYWORDS.some(kw => lower.includes(kw));
}

async function getLiveConnections() {
    const isWin = os.platform() === 'win32';
    const [rawConns, procMap] = await Promise.all([
        isWin ? parseNetstatWindows() : parseNetstatUnix(),
        getProcessMap()
    ]);

    const validConns = [];
    const uniqueIps = new Set();

    rawConns.forEach(c => {
        if (!c.remoteIp) return;
        const ip = c.remoteIp;
        if (ip === '0.0.0.0' || ip === '127.0.0.1' || ip === '::1' || ip === '*' || isPrivateIp(ip)) return;
        if (c.state !== 'ESTABLISHED') return;

        const processName = c.processName || (c.pid ? procMap.get(c.pid) : null) || 'Unknown';
        const isSelf = isSelfConnection(processName, c.pid);
        validConns.push({
            ...c,
            process: processName,
            isSelf
        });
        uniqueIps.add(ip);
    });

    const ipArray = Array.from(uniqueIps).slice(0, 30);
    await Promise.allSettled(ipArray.map(ip => fetchIpGeo(ip)));

    const enriched = validConns.map(c => {
        const geo = geoCache.get(c.remoteIp) || null;
        return {
            ...c,
            geo
        };
    });

    const countryCounts = {};
    const processCounts = {};
    enriched.forEach(c => {
        if (c.geo?.countryCode) {
            countryCounts[c.geo.countryCode] = (countryCounts[c.geo.countryCode] || 0) + 1;
        }
        if (c.process) {
            processCounts[c.process] = (processCounts[c.process] || 0) + 1;
        }
    });

    return {
        timestamp: Date.now(),
        totalEstablished: rawConns.filter(c => c.state === 'ESTABLISHED').length,
        internetCount: enriched.length,
        uniqueIpsCount: uniqueIps.size,
        countryCounts,
        processCounts,
        connections: enriched
    };
}

module.exports = {
    getLiveConnections
};

