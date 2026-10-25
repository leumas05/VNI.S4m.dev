const { spawn } = require('child_process');
const os = require('os');
const { enrichHop, refineHopWithNeighbors } = require('./enrichment');
const { resolveHostname } = require('./utils');
const readline = require('readline');

function getAvgRtt(rttArr) {
    if (!Array.isArray(rttArr) || rttArr.length === 0) return null;
    const nums = rttArr
        .map(v => parseFloat(String(v).replace(/[^\d.]/g, '')))
        .filter(n => !isNaN(n));
    if (nums.length === 0) return null;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
}

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

    // Ordered list of enriched hops for neighbor-aware geo triangulation (prevHop + nextHop)
    const collectedHops = [];

    const findPrevGeoHop = (hopNumber) => {
        for (let i = collectedHops.length - 1; i >= 0; i--) {
            const h = collectedHops[i];
            if (h.hop < hopNumber && h.geo && h.geo.lat != null && h.geo.lon != null) {
                return h;
            }
        }
        return null;
    };

    const emitAndRefineNeighbors = (enrichedHop) => {
        // Insert or update in collectedHops sorted by hop number
        const existingIdx = collectedHops.findIndex(h => h.hop === enrichedHop.hop);
        if (existingIdx !== -1) {
            collectedHops[existingIdx] = enrichedHop;
        } else {
            collectedHops.push(enrichedHop);
            collectedHops.sort((a, b) => a.hop - b.hop);
        }

        // First, refine this hop itself if both prev and next are already known (in case hops finished out-of-order)
        const myIdx = collectedHops.findIndex(h => h.hop === enrichedHop.hop);
        const prevForMe = findPrevGeoHop(enrichedHop.hop);
        let nextForMe = null;
        for (let i = myIdx + 1; i < collectedHops.length; i++) {
            if (collectedHops[i].geo && collectedHops[i].geo.lat != null) {
                nextForMe = collectedHops[i];
                break;
            }
        }
        if (prevForMe || nextForMe) {
            refineHopWithNeighbors(enrichedHop, prevForMe, nextForMe);
        }

        // Emit current hop
        onHopCallback(enrichedHop);

        // Now check if any earlier public hop before `enrichedHop` now has BOTH a previous hop AND a next hop (`enrichedHop`),
        // and re-refine that earlier hop so its location benefits from knowing where the packet went next!
        if (enrichedHop.geo && enrichedHop.geo.lat != null && enrichedHop.geo.lon != null) {
            for (let i = myIdx - 1; i >= 0; i--) {
                const candidateMiddle = collectedHops[i];
                if (!candidateMiddle.isPrivate && !candidateMiddle.dropped && candidateMiddle.geoCandidates?.length > 0) {
                    const prevBeforeMiddle = findPrevGeoHop(candidateMiddle.hop);
                    const prevLat = candidateMiddle.geo?.lat;
                    const prevLon = candidateMiddle.geo?.lon;
                    const prevCity = candidateMiddle.geo?.city;

                    refineHopWithNeighbors(candidateMiddle, prevBeforeMiddle, enrichedHop);

                    // If coordinates or city changed meaningfully after knowing `nextHop`, emit an updated hop event
                    if (
                        candidateMiddle.geo?.lat !== prevLat ||
                        candidateMiddle.geo?.lon !== prevLon ||
                        candidateMiddle.geo?.city !== prevCity ||
                        candidateMiddle.geo?.routeRefined
                    ) {
                        onHopCallback({ ...candidateMiddle });
                    }
                    break; // Only need to refine the immediate preceding public hop
                }
            }
        }
    };

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

                const prevHop = findPrevGeoHop(parsed.hop);
                const neighborContext = prevHop
                    ? {
                          prevGeo: prevHop.geo,
                          prevRtt: getAvgRtt(prevHop.rtt),
                          currRtt: getAvgRtt(parsed.rtt)
                      }
                    : null;

                const enriched = await enrichHop(parsed, neighborContext);
                emitAndRefineNeighbors(enriched);

                if (shouldAbort && !fatalError && targetIp && targetIp !== lastHopIp) {
                    child.kill();

                    pendingHops++;
                    try {
                        const finalHostname = await resolveHostname(targetIp) || targetIp;
                        const prevForFinal = findPrevGeoHop(parsed.hop + 1);
                        const finalEnriched = await enrichHop(
                            {
                                hop: parsed.hop + 1,
                                rtt: ['-', '-', '-'],
                                ip: targetIp,
                                hostname: finalHostname,
                                dropped: false,
                                estimatedFinal: true
                            },
                            prevForFinal ? { prevGeo: prevForFinal.geo, prevRtt: getAvgRtt(prevForFinal.rtt) } : null
                        );
                        emitAndRefineNeighbors(finalEnriched);
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
                const prevForFinal = findPrevGeoHop(lastHopNumber + 1);
                const finalEnriched = await enrichHop(
                    {
                        hop: lastHopNumber + 1,
                        rtt: ['-', '-', '-'],
                        ip: targetIp,
                        hostname: finalHostname,
                        dropped: false,
                        estimatedFinal: true
                    },
                    prevForFinal ? { prevGeo: prevForFinal.geo, prevRtt: getAvgRtt(prevForFinal.rtt) } : null
                );
                emitAndRefineNeighbors(finalEnriched);
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
