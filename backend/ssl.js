const tls = require('tls');
const net = require('net');

function getApexDomain(hostname) {
    if (!hostname || net.isIP(hostname)) return hostname;
    const parts = hostname.trim().toLowerCase().split('.');
    if (parts.length <= 2) return hostname;
    const secondLevelTlds = ['co.uk', 'com.se', 'org.uk', 'gov.uk', 'ac.uk', 'com.au', 'net.au'];
    const lastTwo = parts.slice(-2).join('.');
    if (secondLevelTlds.includes(lastTwo) && parts.length >= 3) {
        return parts.slice(-3).join('.');
    }
    return parts.slice(-2).join('.');
}

async function fetchCertificateTransparencySans(targetDomain) {
    if (!targetDomain || net.isIP(targetDomain)) return [];
    const names = new Set();
    const clean = targetDomain.trim().toLowerCase();
    const apex = getApexDomain(clean);

    const domainsToQuery = Array.from(new Set([clean, apex]));

    for (const d of domainsToQuery) {
        // 1. Try CertSpotter (Fast, comprehensive CT API)
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 2500);
            const res = await fetch(`https://api.certspotter.com/v1/issuances?domain=${encodeURIComponent(d)}&include_subdomains=true&expand=dns_names`, {
                signal: controller.signal
            });
            clearTimeout(timeout);
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) {
                    data.forEach(item => {
                        (item.dns_names || []).forEach(n => {
                            if (typeof n === 'string') names.add(n.trim().toLowerCase());
                        });
                    });
                }
            }
        } catch {
            // timeout or network issue
        }

        // 2. Fallback to crt.sh if needed
        if (names.size <= 2) {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 3000);
                const res = await fetch(`https://crt.sh/?q=${encodeURIComponent(d)}&output=json`, {
                    signal: controller.signal
                });
                clearTimeout(timeout);
                if (res.ok) {
                    const certs = await res.json();
                    if (Array.isArray(certs)) {
                        certs.forEach(c => {
                            if (c.name_value) {
                                c.name_value.split('\n').forEach(n => {
                                    const cleaned = n.trim().toLowerCase();
                                    if (cleaned) names.add(cleaned);
                                });
                            }
                        });
                    }
                }
            } catch {
                // timeout or network issue
            }
        }
    }

    return Array.from(names);
}

function checkSsl(target, port = 443, timeoutMs = 5000) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        if (!target || typeof target !== 'string') {
            return resolve({ ok: false, error: 'Valid target host is required' });
        }

        const cleanTarget = target.trim().replace(/^https?:\/\//i, '').split('/')[0].split(':')[0];
        if (!cleanTarget) {
            return resolve({ ok: false, error: 'Empty target host' });
        }

        const targetPort = parseInt(port, 10) || 443;
        const isIp = net.isIP(cleanTarget) !== 0;

        // Start CT log search in parallel with TLS connection
        const ctPromise = isIp ? Promise.resolve([]) : fetchCertificateTransparencySans(cleanTarget);

        const options = {
            port: targetPort,
            host: cleanTarget,
            servername: isIp ? undefined : cleanTarget,
            rejectUnauthorized: false,
            timeout: timeoutMs
        };

        let timer;
        const socket = tls.connect(options, async () => {
            clearTimeout(timer);
            const duration = Date.now() - startTime;
            const cert = socket.getPeerCertificate(true);

            if (!cert || Object.keys(cert).length === 0) {
                socket.destroy();
                return resolve({
                    ok: false,
                    host: cleanTarget,
                    port: targetPort,
                    error: 'Server responded on port ' + targetPort + ' but presented no TLS certificate'
                });
            }

            const authorized = Boolean(socket.authorized);
            const authorizationError = socket.authorizationError || null;
            const protocol = socket.getProtocol() || 'Unknown';
            const cipher = socket.getCipher() || null;

            // Extract Certificate Chain
            const chain = [];
            let curr = cert;
            const seen = new Set();
            while (curr && curr.subject) {
                const certId = curr.fingerprint256 || curr.serialNumber || curr.subject?.CN;
                if (seen.has(certId)) break;
                seen.add(certId);

                const isSelfSigned = (curr.subject?.CN === curr.issuer?.CN && (curr.subject?.O === curr.issuer?.O || !curr.subject?.O));
                chain.push({
                    cn: curr.subject?.CN || 'Unknown',
                    o: curr.subject?.O || null,
                    ou: curr.subject?.OU || null,
                    issuerCn: curr.issuer?.CN || null,
                    issuerO: curr.issuer?.O || null,
                    validFrom: curr.valid_from || null,
                    validTo: curr.valid_to || null,
                    fingerprint256: curr.fingerprint256 || null,
                    isRoot: isSelfSigned
                });

                if (!curr.issuerCertificate || curr.issuerCertificate === curr) break;
                curr = curr.issuerCertificate;
            }

            // Extract Direct Active Cert SANs
            let directSans = [];
            if (cert.subjectaltname) {
                directSans = cert.subjectaltname
                    .split(',')
                    .map(s => s.trim().replace(/^DNS:|^IP Address:/i, ''))
                    .filter(Boolean);
            } else if (cert.subject?.CN) {
                directSans = [cert.subject.CN];
            }

            // Await CT logs results
            let ctSans = [];
            try {
                ctSans = await ctPromise;
            } catch {
                ctSans = [];
            }

            // Merge direct SANs and CT log SANs
            const allSansSet = new Set([...directSans, ...ctSans]);
            const allSans = Array.from(allSansSet).sort((a, b) => {
                // Keep apex and wildcard at the top, rest alphabetical
                if (a === cleanTarget) return -1;
                if (b === cleanTarget) return 1;
                if (a.startsWith('*.')) return -1;
                if (b.startsWith('*.')) return 1;
                return a.localeCompare(b);
            });

            const validToMs = cert.valid_to ? new Date(cert.valid_to).getTime() : 0;
            const validFromMs = cert.valid_from ? new Date(cert.valid_from).getTime() : 0;
            const now = Date.now();
            const isExpired = validToMs > 0 && now > validToMs;
            const daysRemaining = validToMs > 0 ? Math.round((validToMs - now) / (1000 * 60 * 60 * 24)) : 0;
            const isExpiringSoon = daysRemaining > 0 && daysRemaining <= 14;

            socket.destroy();

            resolve({
                ok: true,
                host: cleanTarget,
                port: targetPort,
                authorized,
                authorizationError,
                protocol,
                cipher,
                handshakeTime: duration,
                subject: {
                    cn: cert.subject?.CN || cleanTarget,
                    o: cert.subject?.O || null,
                    ou: cert.subject?.OU || null,
                    c: cert.subject?.C || null,
                    st: cert.subject?.ST || null,
                    l: cert.subject?.L || null
                },
                issuer: {
                    cn: cert.issuer?.CN || 'Unknown CA',
                    o: cert.issuer?.O || null,
                    ou: cert.issuer?.OU || null,
                    c: cert.issuer?.C || null
                },
                validFrom: cert.valid_from,
                validTo: cert.valid_to,
                validFromMs,
                validToMs,
                daysRemaining,
                isExpired,
                isExpiringSoon,
                sans: allSans,
                directSans,
                ctSans,
                fingerprint: cert.fingerprint || null,
                fingerprint256: cert.fingerprint256 || null,
                serialNumber: cert.serialNumber || null,
                keyType: cert.asymKeyType || (cert.bits ? 'RSA/EC' : null),
                keyBits: cert.bits || null,
                chain
            });
        });

        timer = setTimeout(() => {
            socket.destroy();
            resolve({
                ok: false,
                host: cleanTarget,
                port: targetPort,
                error: `Connection timed out after ${timeoutMs / 1000}s`,
                code: 'ETIMEDOUT'
            });
        }, timeoutMs);

        socket.on('error', (err) => {
            clearTimeout(timer);
            socket.destroy();
            resolve({
                ok: false,
                host: cleanTarget,
                port: targetPort,
                error: err.message,
                code: err.code || 'UNKNOWN'
            });
        });
    });
}

module.exports = {
    checkSsl
};
