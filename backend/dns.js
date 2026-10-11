const dns = require('dns');
const dnsPromises = dns.promises;
const { Resolver } = dnsPromises;

function isIpAddress(str) {
    if (!str) return false;
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){1,7}[0-9a-fA-F]{1,4}$|^::1$|^[0-9a-fA-F:]+$/;
    return ipv4Regex.test(str) || (str.includes(':') && ipv6Regex.test(str));
}

function toArpa(ip) {
    if (ip.includes('.')) {
        return ip.split('.').reverse().join('.') + '.in-addr.arpa';
    }
    return ip;
}

function getStatusCode(err) {
    if (!err) return 'NOERROR';
    if (err.code === 'ENOTFOUND') return 'NXDOMAIN';
    if (err.code === 'ENODATA') return 'NODATA';
    if (err.code === 'ETIMEOUT') return 'TIMEOUT';
    if (err.code === 'EREFUSED') return 'REFUSED';
    if (err.code === 'ESERVFAIL') return 'SERVFAIL';
    return err.code || 'ERROR';
}

function formatRawDig({ target, queryType, serverDisplay, status, answers, questions, queryTime }) {
    const lines = [];
    const now = new Date().toUTCString();
    lines.push(`; <<>> DiG (VNI Engine) <<>> ${queryType} ${target}`);
    lines.push(`;; Got answer:`);
    lines.push(`;; ->>HEADER<<- opcode: QUERY, status: ${status}, id: ${Math.floor(Math.random() * 60000) + 1000}`);
    lines.push(`;; flags: qr rd ra; QUERY: ${questions.length}, ANSWER: ${answers.length}, AUTHORITY: 0, ADDITIONAL: 0\n`);
    
    lines.push(`;; QUESTION SECTION:`);
    questions.forEach(q => {
        lines.push(`;${q.name}.\t\t\tIN\t${q.type}`);
    });
    lines.push('');

    if (answers.length > 0) {
        lines.push(`;; ANSWER SECTION:`);
        answers.forEach(a => {
            const extra = a.priority !== undefined ? `${a.priority}\t` : '';
            lines.push(`${a.name}.\t\t${a.ttl || 300}\tIN\t${a.type}\t${extra}${a.data}`);
        });
        lines.push('');
    }

    lines.push(`;; Query time: ${queryTime} msec`);
    lines.push(`;; SERVER: ${serverDisplay}`);
    lines.push(`;; WHEN: ${now}`);
    lines.push(`;; MSG SIZE  rcvd: ${Math.max(48, answers.length * 32 + 56)}`);
    return lines.join('\n');
}

async function performDig({ target, type, server }) {
    const startTime = Date.now();
    const cleanTarget = target.trim();
    const isTargetIp = isIpAddress(cleanTarget);
    const queryType = (type || (isTargetIp ? 'PTR' : 'ALL')).toUpperCase();

    let resolver;
    let serverDisplay = server ? server.trim() : 'Default (System)';
    if (server && isIpAddress(server.trim())) {
        resolver = new Resolver({ timeout: 2500, tries: 2 });
        resolver.setServers([server.trim()]);
        serverDisplay = `${server.trim()}#53`;
    } else {
        resolver = new Resolver({ timeout: 2500, tries: 2 });
    }

    const answers = [];
    const questions = [];
    let status = 'NOERROR';
    let errorMessage = null;

    try {
        if (isTargetIp) {
            // For an IP address, only Reverse DNS (PTR) query is valid
            questions.push({ name: toArpa(cleanTarget), type: 'PTR' });
            let ptrResults = [];
            try {
                ptrResults = await resolver.reverse(cleanTarget);
            } catch (err) {
                // If local system resolver fails or times out, try 1.1.1.1 / 8.8.8.8 public resolver
                if (!server) {
                    try {
                        const fallbackRes = new Resolver({ timeout: 2500, tries: 1 });
                        fallbackRes.setServers(['1.1.1.1', '8.8.8.8']);
                        ptrResults = await fallbackRes.reverse(cleanTarget);
                        serverDisplay = '1.1.1.1 (Fallback)';
                    } catch (fbErr) {
                        throw err;
                    }
                } else {
                    throw err;
                }
            }

            ptrResults.forEach(host => {
                answers.push({
                    name: toArpa(cleanTarget),
                    type: 'PTR',
                    ttl: 300,
                    data: host
                });
            });
        } else {
            // For hostnames/domains, query requested type(s)
            const effectiveType = queryType === 'PTR' ? 'ALL' : queryType;
            const typesToQuery = (effectiveType === 'ALL' || effectiveType === 'ANY')
                ? ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SOA']
                : [effectiveType];

            for (const t of typesToQuery) {
                questions.push({ name: cleanTarget, type: t });
                try {
                    if (t === 'A') {
                        const aRes = await resolver.resolve4(cleanTarget, { ttl: true });
                        aRes.forEach(r => answers.push({ name: cleanTarget, type: 'A', ttl: r.ttl, data: r.address }));
                    } else if (t === 'AAAA') {
                        const aaaaRes = await resolver.resolve6(cleanTarget, { ttl: true });
                        aaaaRes.forEach(r => answers.push({ name: cleanTarget, type: 'AAAA', ttl: r.ttl, data: r.address }));
                    } else if (t === 'CNAME') {
                        const cnames = await resolver.resolveCname(cleanTarget);
                        cnames.forEach(c => answers.push({ name: cleanTarget, type: 'CNAME', ttl: 300, data: c }));
                    } else if (t === 'MX') {
                        const mxs = await resolver.resolveMx(cleanTarget);
                        mxs.forEach(m => answers.push({ name: cleanTarget, type: 'MX', ttl: 300, data: m.exchange, priority: m.priority }));
                    } else if (t === 'TXT') {
                        const txts = await resolver.resolveTxt(cleanTarget);
                        txts.forEach(arr => answers.push({ name: cleanTarget, type: 'TXT', ttl: 300, data: arr.join(' ') }));
                    } else if (t === 'NS') {
                        const nss = await resolver.resolveNs(cleanTarget);
                        nss.forEach(ns => answers.push({ name: cleanTarget, type: 'NS', ttl: 300, data: ns }));
                    } else if (t === 'SOA') {
                        const soa = await resolver.resolveSoa(cleanTarget);
                        answers.push({
                            name: cleanTarget,
                            type: 'SOA',
                            ttl: soa.minttl || 300,
                            data: `${soa.nsname} ${soa.hostmaster} ${soa.serial} ${soa.refresh} ${soa.retry} ${soa.expire} ${soa.minttl}`,
                            soa: {
                                primaryNs: soa.nsname,
                                hostmaster: soa.hostmaster,
                                serial: soa.serial,
                                refresh: soa.refresh,
                                retry: soa.retry,
                                expire: soa.expire,
                                minttl: soa.minttl
                            }
                        });
                    }
                } catch (e) {
                    if (typesToQuery.length === 1) {
                        throw e;
                    }
                }
            }
        }
    } catch (err) {
        status = getStatusCode(err);
        errorMessage = err.message || status;
    }

    const queryTime = Date.now() - startTime;
    const rawOutput = formatRawDig({
        target: cleanTarget,
        queryType,
        serverDisplay,
        status,
        answers,
        questions,
        queryTime
    });

    return {
        status,
        statusCode: status === 'NOERROR' ? 0 : (status === 'NXDOMAIN' ? 3 : 2),
        queryTime,
        server: serverDisplay,
        target: cleanTarget,
        type: queryType,
        answers,
        errorMessage,
        rawOutput
    };
}

module.exports = {
    performDig,
    isIpAddress
};

