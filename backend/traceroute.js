const { spawn } = require('child_process');
const os = require('os');
const { enrichHop } = require('./enrichment');
const { resolveHostname } = require('./utils');
const readline = require('readline');

function runTraceroute(target, onHopCallback, onDoneCallback) {
    const isWin = os.platform() === 'win32';
    
    const cmd = isWin ? 'tracert' : 'traceroute';
    const args = isWin ? ['-d', target] : ['-n', target]; 

    const child = spawn(cmd, args);

    const rl = readline.createInterface({
        input: child.stdout,
        terminal: false
    });

    let pendingHops = 0;
    let isProcessClosed = false;
    let consecutiveTimeouts = 0;
    let targetIp = null;
    let abortTriggered = false;
    let fatalError = false;

    let doneCalled = false;
    const finish = () => {
        if (!doneCalled) {
            doneCalled = true;
            if (onDoneCallback) onDoneCallback();
        }
    };

    let lastHopNumber = 0;
    let lastHopIp = null;

    rl.on('line', async (line) => {
        if (abortTriggered) return;

        if (!targetIp) {
            const m1 = line.match(/\[([a-fA-F0-9\.:]+)\]/);
            const m2 = line.match(/to [^\s]+ \(([a-fA-F0-9\.:]+)\)/);
            if (m1) targetIp = m1[1];
            else if (m2) targetIp = m2[1];
            
            if (!targetIp && /^[a-fA-F0-9\.:]+$/.test(target)) {
                targetIp = target;
            }
        }

        const parsed = parseLine(line, isWin);
        if (parsed) {
            lastHopNumber = parsed.hop;
            if (parsed.ip) lastHopIp = parsed.ip;

            if (parsed.errorMsg) {
                fatalError = true;
                abortTriggered = true;
                child.kill();
            }

            if (parsed.dropped) consecutiveTimeouts++;
            else consecutiveTimeouts = 0;

            const shouldAbort = consecutiveTimeouts >= 5;
            if (shouldAbort) abortTriggered = true;

            pendingHops++;
            try {
                if (parsed.ip && (!parsed.hostname || parsed.hostname === parsed.ip)) {
                    parsed.hostname = await resolveHostname(parsed.ip) || parsed.ip;
                }
                
                const enriched = await enrichHop(parsed);
                onHopCallback(enriched);

                if (shouldAbort && !fatalError && targetIp && targetIp !== lastHopIp) {
                    child.kill();
                    
                    pendingHops++;
                    try {
                        const finalHostname = await resolveHostname(targetIp) || targetIp;
                        const finalEnriched = await enrichHop({
                            hop: parsed.hop + 1,
                            rtt: ['-','-','-'],
                            ip: targetIp,
                            hostname: finalHostname,
                            dropped: false,
                            estimatedFinal: true
                        });
                        onHopCallback(finalEnriched);
                    } finally {
                        pendingHops--;
                        if (isProcessClosed && pendingHops === 0) finish();
                    }
                }
            } finally {
                pendingHops--;
                if (isProcessClosed && pendingHops === 0) finish();
            }
        }
    });

    child.on('close', async () => {
        isProcessClosed = true;
        
        if (!abortTriggered && !fatalError && targetIp && targetIp !== lastHopIp) {
            abortTriggered = true;
            pendingHops++;
            try {
                const finalHostname = await resolveHostname(targetIp) || targetIp;
                const finalEnriched = await enrichHop({
                    hop: lastHopNumber + 1,
                    rtt: ['-','-','-'],
                    ip: targetIp,
                    hostname: finalHostname,
                    dropped: false,
                    estimatedFinal: true
                });
                onHopCallback(finalEnriched);
            } finally {
                pendingHops--;
                if (pendingHops === 0) finish();
            }
        } else {
            if (pendingHops === 0) finish();
        }
    });

    return child;
}

function parseLine(line, isWin) {
    if (isWin) {
        const match = line.match(/^\s*(\d+)\s+(.+)$/);
        if (!match) return null;
        
        const hop = parseInt(match[1]);
        const rest = match[2];
        
        let rtt = [];
        let ip = null;
        let dropped = false;

        const tokens = rest.trim().split(/\s+/);
        
        for (let i = 0; i < 3; i++) {
            if (tokens[0] === '*') {
                rtt.push('*');
                tokens.shift();
            } else if (tokens[1] === 'ms') {
                rtt.push(tokens[0]);
                tokens.shift();
                tokens.shift();
            } else if (tokens[0] && tokens[0].endsWith('ms')) {
                // sometimes it's <1ms
                rtt.push(tokens[0].replace('ms', ''));
                tokens.shift();
            }
        }
        
        let errorMsg = null;
        const fullRest = rest.trim();
        if (fullRest.includes('Destination net unreachable') || fullRest.includes('Transmit error') || fullRest.includes('General failure')) {
            errorMsg = fullRest;
            dropped = true;
            ip = null;
        } else if (tokens.length > 0 && !tokens[0].includes('Request')) {
            ip = tokens[0];
        } else {
            dropped = rtt.every(r => r === '*');
        }
        
        if (!ip && !dropped) {
            dropped = true;
        }

        return { hop, rtt, ip, hostname: ip, dropped, errorMsg };
    } else {
        const match = line.match(/^\s*(\d+)\s+(.+)$/);
        if (!match) return null;
        
        const hop = parseInt(match[1]);
        const tokens = match[2].trim().split(/\s+/);
        
        if (tokens[0] === '*') {
             return { hop, rtt: ['*', '*', '*'], ip: null, hostname: null, dropped: true };
        }
        
        const ip = tokens[0];
        let rtt = [];
        for (let i = 1; i < tokens.length; i++) {
            if (tokens[i] !== 'ms' && tokens[i] !== '*') {
                rtt.push(tokens[i]);
            } else if (tokens[i] === '*') {
                rtt.push('*');
            }
        }
        
        return { hop, rtt: rtt.slice(0, 3), ip, hostname: ip, dropped: false };
    }
}

module.exports = { runTraceroute };
