const tls = require('tls');
const net = require('net');

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

        const options = {
            port: targetPort,
            host: cleanTarget,
            // When connecting to an IP, SNI is omitted so the TLS handshake negotiates directly
            servername: isIp ? undefined : cleanTarget,
            rejectUnauthorized: false,
            timeout: timeoutMs
        };

        let timer;
        const socket = tls.connect(options, () => {
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

            // Extract SANs (Subject Alternative Names)
            let sans = [];
            if (cert.subjectaltname) {
                sans = cert.subjectaltname
                    .split(',')
                    .map(s => s.trim().replace(/^DNS:|^IP Address:/i, ''))
                    .filter(Boolean);
            } else if (cert.subject?.CN) {
                sans = [cert.subject.CN];
            }

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
                sans,
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

