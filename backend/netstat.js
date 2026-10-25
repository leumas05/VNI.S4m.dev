const { execFile } = require('child_process');
const os = require('os');
const dns = require('dns');
const { isPrivateIp } = require('./utils');
const { fetchMultiProviderCandidates, computeConsensusGeo } = require('./enrichment');

// In-memory cache for IP geolocations to avoid redundant lookups and rate limits
const geoCache = new Map();

// In-memory cache for IP -> Reverse DNS / Local DNS Cache domain names
const domainCache = new Map();
let lastDnsCacheRead = 0;

// In-memory session tracker for connection duration & "NEW" badge
const activeSessionMap = new Map();

// In-memory cache for PID -> process info mapping (refresh every 10 seconds)
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
            execFile('tasklist', ['/fo', 'csv', '/nh'], { windowsHide: true, timeout: 3000 }, (err, stdout) => {
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
            execFile('ps', ['-A', '-o', 'pid,comm'], { timeout: 3000 }, (err, stdout) => {
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

// Harvest Windows local DNS resolver cache (`ipconfig /displaydns`) to map CDN IPs to exact domains queried by apps
function refreshWindowsDnsCache() {
    return new Promise((resolve) => {
        if (os.platform() !== 'win32') return resolve();
        const now = Date.now();
        if (now - lastDnsCacheRead < 8000) return resolve();
        lastDnsCacheRead = now;

        execFile('ipconfig', ['/displaydns'], { windowsHide: true, timeout: 2500, maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => {
            if (err || !stdout) return resolve();
            let currentRecordName = null;
            const lines = stdout.split(/\r?\n/);
            for (const rawLine of lines) {
                const line = rawLine.trim();
                if (!line) continue;

                // Match "Record Name . . . . . : example.com" or localized equivalents containing a domain
                const nameMatch = line.match(/(?:Record Name|Postnamn|Name)[\s.:]+([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/i);
                if (nameMatch) {
                    const candidate = nameMatch[1].toLowerCase().replace(/\.$/, '');
                    if (!candidate.endsWith('.in-addr.arpa') && !candidate.endsWith('.ip6.arpa')) {
                        currentRecordName = candidate;
                    }
                    continue;
                }

                // Match "A (Host) Record . . . : 142.250.74.110"
                if (currentRecordName) {
                    const ipMatch = line.match(/(?:A \(Host\)|A-post|Address|avano)[\s.:]+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
                    if (ipMatch) {
                        const ip = ipMatch[1];
                        if (!domainCache.has(ip) || domainCache.get(ip).source === 'ptr') {
                            domainCache.set(ip, { domain: currentRecordName, source: 'dns-cache' });
                        }
                    }
                }
            }
            resolve();
        });
    });
}

async function resolveIpDomain(ip) {
    if (!ip || isPrivateIp(ip)) return null;
    if (domainCache.has(ip)) return domainCache.get(ip).domain;

    try {
        const timeoutPromise = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 1200));
        const hostnames = await Promise.race([dns.promises.reverse(ip), timeoutPromise]);
        if (Array.isArray(hostnames) && hostnames.length > 0) {
            const clean = hostnames[0].toLowerCase().replace(/\.$/, '');
            domainCache.set(ip, { domain: clean, source: 'ptr' });
            return clean;
        }
    } catch {
        // Ignore reverse DNS errors
    }
    return null;
}

function parseEndpoint(endpointStr) {
    if (!endpointStr || endpointStr === '*:*') return null;
    const lastColon = endpointStr.lastIndexOf(':');
    if (lastColon === -1) return null;
    const ip = endpointStr.slice(0, lastColon).replace(/[\[\]]/g, '');
    const port = parseInt(endpointStr.slice(lastColon + 1), 10);
    if (!ip || isNaN(port)) return null;
    return { ip, port };
}

function parseNetstatWindows() {
    return new Promise((resolve) => {
        execFile('netstat', ['-ano'], { windowsHide: true, timeout: 3500, maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => {
            if (err || !stdout) return resolve([]);
            const connections = [];
            stdout.split(/\r?\n/).forEach(line => {
                const trimmed = line.trim();
                if (!trimmed.startsWith('TCP') && !trimmed.startsWith('UDP')) return;
                const parts = trimmed.split(/\s+/);
                const proto = parts[0].toUpperCase();

                if (proto === 'TCP' && parts.length >= 5) {
                    const local = parts[1];
                    const foreign = parts[2];
                    const state = parts[3];
                    const pid = parseInt(parts[4], 10);

                    const localEp = parseEndpoint(local);
                    const foreignEp = parseEndpoint(foreign);
                    if (!foreignEp) return;

                    connections.push({
                        proto: 'TCP',
                        local,
                        foreign,
                        localIp: localEp?.ip || null,
                        localPort: localEp?.port || null,
                        remoteIp: foreignEp.ip,
                        remotePort: foreignEp.port,
                        state,
                        pid: isNaN(pid) ? null : pid
                    });
                } else if (proto === 'UDP' && parts.length >= 4) {
                    // Connected UDP sockets (e.g. QUIC :443, WebRTC, Gaming, Discord Voice)
                    const local = parts[1];
                    const foreign = parts[2];
                    const pid = parseInt(parts[3], 10);
                    if (!foreign || foreign === '*:*' || foreign.startsWith('0.0.0.0') || foreign.startsWith('[::]')) return;

                    const localEp = parseEndpoint(local);
                    const foreignEp = parseEndpoint(foreign);
                    if (!foreignEp || !foreignEp.port) return;

                    connections.push({
                        proto: 'UDP',
                        local,
                        foreign,
                        localIp: localEp?.ip || null,
                        localPort: localEp?.port || null,
                        remoteIp: foreignEp.ip,
                        remotePort: foreignEp.port,
                        state: 'ACTIVE (UDP)',
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
                        const localEp = parseEndpoint(parts[3]);
                        const foreignEp = parseEndpoint(parts[4]);
                        if (!foreignEp) return;
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
                            foreign: parts[4],
                            localIp: localEp?.ip || null,
                            localPort: localEp?.port || null,
                            remoteIp: foreignEp.ip,
                            remotePort: foreignEp.port,
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
        const candidates = await fetchMultiProviderCandidates(ip);
        if (candidates && candidates.length > 0) {
            const consensus = computeConsensusGeo(candidates, null);
            if (consensus && (consensus.lat != null || consensus.country)) {
                geoCache.set(ip, consensus);
                return consensus;
            }
        }
    } catch {
        // fallback below
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

function getServiceLabel(proto, port) {
    const p = Number(port);
    if (proto === 'UDP' && p === 443) return 'QUIC / HTTP3';
    if (p === 443 || p === 8443) return 'HTTPS / TLS';
    if (p === 80 || p === 8080) return 'HTTP (Cleartext)';
    if (p === 53) return 'DNS';
    if (p === 853) return 'DNS-over-TLS';
    if (p === 22) return 'SSH';
    if (p === 21) return 'FTP';
    if (p === 3389) return 'RDP';
    if (p === 993 || p === 465 || p === 587) return 'Mail (TLS)';
    if (p === 5222 || p === 5228) return 'Push / XMPP';
    if (p === 3478 || p === 19302 || (p >= 50000 && p <= 65535 && proto === 'UDP')) return 'WebRTC / Voice';
    if (p >= 27015 && p <= 27050) return 'Game Server';
    return `${proto} :${p}`;
}

function getAppCategory(processName) {
    const p = (processName || '').toLowerCase();
    if (/(?:chrome|msedge|firefox|brave|opera|vivaldi|safari)/i.test(p)) return 'Browser';
    if (/(?:discord|slack|teams|zoom|telegram|whatsapp|signal|skype)/i.test(p)) return 'Communication';
    if (/(?:spotify|steam|epicgames|battle\.net|riot|vlc|obs)/i.test(p)) return 'Media & Gaming';
    if (/(?:code|cursor|node|git|python|docker|java|devenv|webstorm|idea)/i.test(p)) return 'Development';
    if (/(?:onedrive|dropbox|googledrive|icloud|synology|nextcloud)/i.test(p)) return 'Cloud Sync';
    if (/(?:svchost|system|lsass|services|wininit|searchapp|widgets)/i.test(p)) return 'System / OS';
    return 'Application';
}

function evaluateConnectionSecurity({ proto, remotePort, domain, isp, processName }) {
    const d = (domain || '').toLowerCase();
    const p = Number(remotePort);
    const proc = (processName || '').toLowerCase();
    const org = (isp || '').toLowerCase();

    // 1. Check for Telemetry / Analytics / Ad Tracker endpoints
    const isTelemetry =
        /(?:telemetry|metrics|vortex\.data\.microsoft|settings-win\.data\.microsoft|watson\.microsoft|google-analytics|doubleclick|app-measurement|crashlytics|sentry\.io|nel\.cloudflare|browser-intake-datadoghq|events\.data\.microsoft)/i.test(d) ||
        /(?:compattelrunner|diagtrack)/i.test(proc);

    if (isTelemetry) {
        return {
            status: 'telemetry',
            encrypted: p === 443 || p === 8443,
            label: 'Telemetry / Analytics',
            reason: `Background telemetry or diagnostics endpoint (${domain || org || 'Tracker'})`
        };
    }

    // 2. Check for Unencrypted Cleartext ports (HTTP 80, FTP 21, Telnet 23)
    if (p === 80 || p === 21 || p === 23) {
        return {
            status: 'warning',
            encrypted: false,
            label: 'Unencrypted (Cleartext)',
            reason: `Traffic on port ${p} is not encrypted with TLS`
        };
    }

    // 3. Standard Encrypted HTTPS / QUIC / Mail / DoT / SSH
    if ([443, 8443, 853, 993, 465, 587, 22, 5228].includes(p)) {
        return {
            status: 'secure',
            encrypted: true,
            label: proto === 'UDP' && p === 443 ? 'QUIC Encrypted' : 'TLS Encrypted',
            reason: `Encrypted transport over ${getServiceLabel(proto, p)}`
        };
    }

    // 4. Non-standard / High Ephemeral Ports
    return {
        status: 'advisory',
        encrypted: false,
        label: `Custom Port :${p}`,
        reason: `Direct socket on non-standard port ${proto} :${p}`
    };
}

function formatDuration(seconds) {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins < 60) return `${mins}m ${secs}s`;
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hours}h ${remMins}m`;
}

async function getLiveConnections() {
    const isWin = os.platform() === 'win32';
    const [rawConns, procMap] = await Promise.all([
        isWin ? parseNetstatWindows() : parseNetstatUnix(),
        getProcessMap(),
        refreshWindowsDnsCache()
    ]);

    const now = Date.now();
    const validInternetConns = [];
    const lanConnections = [];
    const uniqueIps = new Set();
    const seenSessionKeys = new Set();

    rawConns.forEach(c => {
        if (!c.remoteIp) return;
        const ip = c.remoteIp;
        if (ip === '0.0.0.0' || ip === '127.0.0.1' || ip === '::1' || ip === '*' || ip.startsWith('127.')) return;

        const isEstablished = c.state === 'ESTABLISHED' || c.state === 'ACTIVE (UDP)';
        if (!isEstablished) return;

        const processName = c.processName || (c.pid ? procMap.get(c.pid) : null) || 'Unknown';

        if (isPrivateIp(ip)) {
            lanConnections.push({
                protocol: c.proto,
                localAddress: c.localIp,
                localPort: c.localPort,
                remoteAddress: ip,
                remotePort: c.remotePort,
                state: c.state,
                pid: c.pid,
                processName
            });
            return;
        }

        const isSelf = isSelfConnection(processName, c.pid);
        const sessionKey = `${c.pid || 0}-${c.proto}-${ip}:${c.remotePort}`;
        seenSessionKeys.add(sessionKey);

        if (!activeSessionMap.has(sessionKey)) {
            activeSessionMap.set(sessionKey, now);
        }
        const firstSeen = activeSessionMap.get(sessionKey);
        const durationSeconds = Math.max(1, Math.round((now - firstSeen) / 1000));
        const isNew = durationSeconds <= 8;

        validInternetConns.push({
            ...c,
            process: processName,
            appCategory: getAppCategory(processName),
            serviceLabel: getServiceLabel(c.proto, c.remotePort),
            isSelf,
            firstSeen,
            durationSeconds,
            durationFormatted: formatDuration(durationSeconds),
            isNew
        });
        uniqueIps.add(ip);
    });

    // Clean up closed sessions from activeSessionMap
    for (const key of activeSessionMap.keys()) {
        if (!seenSessionKeys.has(key)) {
            activeSessionMap.delete(key);
        }
    }

    const ipArray = Array.from(uniqueIps).slice(0, 35);
    await Promise.allSettled([
        ...ipArray.map(ip => fetchIpGeo(ip)),
        ...ipArray.map(ip => resolveIpDomain(ip))
    ]);

    let encryptedCount = 0;
    let telemetryCount = 0;
    let warningCount = 0;

    const enriched = validInternetConns.map(c => {
        const geo = geoCache.get(c.remoteIp) || null;
        const domain = domainCache.get(c.remoteIp)?.domain || null;
        const domainSource = domainCache.get(c.remoteIp)?.source || null;
        const security = evaluateConnectionSecurity({
            proto: c.proto,
            remotePort: c.remotePort,
            domain,
            isp: geo?.isp,
            processName: c.process
        });

        if (security.encrypted) encryptedCount++;
        if (security.status === 'telemetry') telemetryCount++;
        if (security.status === 'warning') warningCount++;

        return {
            ...c,
            domain,
            domainSource,
            geo,
            security
        };
    });

    const countryCounts = {};
    const processCounts = {};
    const categoryCounts = {};
    enriched.forEach(c => {
        if (c.geo?.countryCode) {
            countryCounts[c.geo.countryCode] = (countryCounts[c.geo.countryCode] || 0) + 1;
        }
        if (c.process) {
            processCounts[c.process] = (processCounts[c.process] || 0) + 1;
        }
        if (c.appCategory) {
            categoryCounts[c.appCategory] = (categoryCounts[c.appCategory] || 0) + 1;
        }
    });

    return {
        timestamp: now,
        totalEstablished: rawConns.filter(c => c.state === 'ESTABLISHED' || c.state === 'ACTIVE (UDP)').length,
        internetCount: enriched.length,
        uniqueIpsCount: uniqueIps.size,
        encryptedCount,
        telemetryCount,
        warningCount,
        countryCounts,
        processCounts,
        categoryCounts,
        connections: enriched,
        lanConnections
    };
}

module.exports = {
    getLiveConnections
};
