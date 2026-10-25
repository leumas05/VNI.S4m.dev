const { isPrivateIp, cidrToRange } = require('./utils');

// Cached JWT for api.iplocation.io
let iplocJwt = null;
let iplocJwtExp = 0;
let iplocJwtPromise = null;

// In-memory cache of multi-provider lookups per IP (valid for 30 minutes)
const multiGeoCache = new Map();
const GEO_CACHE_TTL_MS = 30 * 60 * 1000;

async function getIpLocationJwt() {
    const nowSec = Math.floor(Date.now() / 1000);
    if (iplocJwt && nowSec + 25 < iplocJwtExp) {
        return iplocJwt;
    }
    if (iplocJwtPromise) {
        return iplocJwtPromise;
    }

    iplocJwtPromise = (async () => {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3500);
            const res = await fetch('https://api.iplocation.io/api/v1/gen-ref-jwt', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Referer': 'https://iplocation.io/',
                    'Origin': 'https://iplocation.io',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                },
                body: JSON.stringify({ method: 'V1' }),
                signal: controller.signal
            });
            clearTimeout(timeout);
            if (res.ok) {
                const data = await res.json();
                if (data && data.token) {
                    iplocJwt = data.token;
                    iplocJwtExp = data.exp || (nowSec + (data.ttl || 180));
                    return iplocJwt;
                }
            }
        } catch (err) {
            // fallback will be used
        } finally {
            iplocJwtPromise = null;
        }
        return null;
    })();

    return iplocJwtPromise;
}

function cleanVal(val) {
    if (val === undefined || val === null) return null;
    const s = String(val).trim();
    if (!s || s === 'N/A' || s === '-' || s === '_' || s.startsWith('This parameter is unavailable')) return null;
    return s;
}

function parseCoord(val) {
    if (val === undefined || val === null) return null;
    const n = parseFloat(val);
    if (isNaN(n) || (n === 0 && String(val) !== '0')) return null;
    return n;
}

function haversineKm(lat1, lon1, lat2, lon2) {
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return Infinity;
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function querySingleIpLocationProvider(ip, service, jwt) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    try {
        const res = await fetch('https://api.iplocation.io/api/v1/ip-location', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwt}`,
                'Referer': 'https://iplocation.io/',
                'Origin': 'https://iplocation.io',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            },
            body: JSON.stringify({
                method: 'V1',
                ip,
                service
            }),
            signal: controller.signal
        });
        clearTimeout(timeout);
        if (!res.ok) return null;
        const json = await res.json();
        const svc = json?.result?.[service];
        if (!svc) return null;

        const all = svc.all || {};
        const lat = parseCoord(svc.latitude ?? all.latitude);
        const lon = parseCoord(svc.longitude ?? all.longitude);
        if (lat === null || lon === null) return null;

        const city = cleanVal(svc.city_name ?? all.city ?? all.cityName);
        const region = cleanVal(svc.state_name ?? all.region ?? all.stateProv ?? all.regionName);
        const country = cleanVal(svc.country_name ?? all.country_name ?? all.countryName);
        const countryCode = cleanVal(svc.country_code ?? all.countryCode ?? all.country);
        const zip = cleanVal(svc.postal_code ?? all.postal ?? all.zipCode);

        let rawAsn = cleanVal(
            typeof svc.asn === 'object' ? svc.asn?.asn : (svc.asn ?? all.asNumber ?? (typeof all.asn === 'object' ? all.asn?.asn : all.asn))
        );
        if (rawAsn && !rawAsn.toUpperCase().startsWith('AS')) {
            rawAsn = `AS${rawAsn}`;
        }

        const isp = cleanVal(
            svc.organization ??
            svc.isp ??
            svc.as_name ??
            all.isp ??
            (typeof all.asn === 'object' ? all.asn?.name : null) ??
            all.asName
        );

        const providerLabelMap = {
            ip2location: 'IP2Location',
            ipinfo: 'IPInfo',
            dbip: 'DB-IP',
            criminalip: 'Criminal IP'
        };

        // Base reliability weight:
        // IPInfo, DB-IP, and IP2Location have city-level precision; Criminal IP often lacks city_name and falls back to country/state centroid
        let baseWeight = 1.0;
        if (service === 'ipinfo') baseWeight = 1.15;
        else if (service === 'ip2location') baseWeight = 1.1;
        else if (service === 'dbip') baseWeight = 1.05;
        else if (service === 'criminalip') baseWeight = city ? 0.95 : 0.45;

        if (!city) baseWeight *= 0.55;

        const extra = {};
        if (service === 'criminalip' && all.score) {
            extra.inboundRisk = all.score.inbound;
            extra.outboundRisk = all.score.outbound;
            extra.issues = all.issues || null;
        }
        if (service === 'ipinfo' && all.privacy) {
            extra.privacy = all.privacy;
            extra.anycast = Boolean(all.anycast);
        }
        if (service === 'dbip') {
            extra.threatLevel = all.threatLevel || null;
            extra.usageType = all.usageType || null;
            extra.isAnycast = Boolean(all.isAnycast);
        }

        return {
            id: service,
            provider: providerLabelMap[service] || service,
            lat,
            lon,
            city,
            region,
            country,
            countryCode: countryCode ? countryCode.toUpperCase() : null,
            zip,
            isp,
            asn: rawAsn,
            baseWeight,
            hasCity: Boolean(city),
            extra
        };
    } catch {
        clearTimeout(timeout);
        return null;
    }
}

async function fetchDirectFallbackProviders(ip) {
    const candidates = [];
    const tasks = [
        // 1. Direct IP2Location.io API
        (async () => {
            try {
                const r = await fetch(`https://api.ip2location.io/?ip=${encodeURIComponent(ip)}&format=json`);
                if (!r.ok) return;
                const d = await r.json();
                const lat = parseCoord(d.latitude);
                const lon = parseCoord(d.longitude);
                if (lat !== null && lon !== null) {
                    candidates.push({
                        id: 'ip2location',
                        provider: 'IP2Location',
                        lat,
                        lon,
                        city: cleanVal(d.city_name),
                        region: cleanVal(d.region_name),
                        country: cleanVal(d.country_name),
                        countryCode: cleanVal(d.country_code),
                        zip: cleanVal(d.zip_code),
                        isp: cleanVal(d.as),
                        asn: d.asn ? `AS${String(d.asn).replace(/^AS/i, '')}` : null,
                        baseWeight: cleanVal(d.city_name) ? 1.1 : 0.6,
                        hasCity: Boolean(cleanVal(d.city_name))
                    });
                }
            } catch {}
        })(),
        // 2. Direct IPInfo.io API
        (async () => {
            try {
                const r = await fetch(`https://ipinfo.io/${encodeURIComponent(ip)}/json`);
                if (!r.ok) return;
                const d = await r.json();
                if (d.loc) {
                    const [latStr, lonStr] = d.loc.split(',');
                    const lat = parseCoord(latStr);
                    const lon = parseCoord(lonStr);
                    if (lat !== null && lon !== null) {
                        const orgParts = (d.org || '').match(/^(AS\d+)\s+(.*)$/i);
                        candidates.push({
                            id: 'ipinfo',
                            provider: 'IPInfo',
                            lat,
                            lon,
                            city: cleanVal(d.city),
                            region: cleanVal(d.region),
                            country: cleanVal(d.country),
                            countryCode: cleanVal(d.country),
                            zip: cleanVal(d.postal),
                            isp: orgParts ? orgParts[2] : cleanVal(d.org),
                            asn: orgParts ? orgParts[1].toUpperCase() : null,
                            baseWeight: cleanVal(d.city) ? 1.15 : 0.6,
                            hasCity: Boolean(cleanVal(d.city)),
                            extra: { anycast: Boolean(d.anycast) }
                        });
                    }
                }
            } catch {}
        })()
    ];

    await Promise.allSettled(tasks);
    return candidates;
}

/**
 * Compute consensus location from multiple providers (IP2Location, DB-IP, IPInfo, Criminal IP),
 * optionally refined by previous hop and next hop coordinates + RTT constraints.
 */
function computeConsensusGeo(candidates, neighborContext = null) {
    if (!candidates || candidates.length === 0) return null;

    const prevGeo = neighborContext?.prevGeo || null;
    const nextGeo = neighborContext?.nextGeo || null;
    const prevRtt = neighborContext?.prevRtt ?? null;
    const currRtt = neighborContext?.currRtt ?? null;
    const nextRtt = neighborContext?.nextRtt ?? null;

    // Score each candidate based on:
    // 1. Base provider precision weight (whether it has city-level data vs country centroid)
    // 2. Exact city/region name consensus + Spatial clustering agreement (Mutual Haversine proximity)
    // 3. Route continuity with previous hop and/or next hop (if available)
    const cityCounts = {};
    for (const c of candidates) {
        if (c.city) {
            const normCity = c.city.toLowerCase().trim();
            cityCounts[normCity] = (cityCounts[normCity] || 0) + 1;
        }
    }

    const scored = candidates.map((c, idx) => {
        let clusterScore = 0;
        if (c.city) {
            const matches = cityCounts[c.city.toLowerCase().trim()] || 1;
            if (matches >= 2) clusterScore += (matches - 1) * 0.55;
        }
        for (let j = 0; j < candidates.length; j++) {
            if (idx === j) continue;
            const other = candidates[j];
            const dist = haversineKm(c.lat, c.lon, other.lat, other.lon);
            // Tighter Gaussian spatial agreement kernel (strong boost if within 10km, moderate within 45km)
            if (dist <= 10) clusterScore += 1.45 * other.baseWeight;
            else if (dist <= 45) clusterScore += 0.95 * other.baseWeight;
            else if (dist <= 120) clusterScore += 0.45 * other.baseWeight;
            else if (dist <= 300) clusterScore += 0.2 * other.baseWeight;
            else if (c.countryCode && c.countryCode === other.countryCode) clusterScore += 0.1 * other.baseWeight;
        }

        let routeScore = 0;
        // Route Continuity Check:
        // Fiber speed of light is ~100 km per 1 ms of RTT (200 km one-way, 100 km round-trip).
        if (prevGeo && prevGeo.lat != null && prevGeo.lon != null && nextGeo && nextGeo.lat != null && nextGeo.lon != null) {
            const directDist = haversineKm(prevGeo.lat, prevGeo.lon, nextGeo.lat, nextGeo.lon);
            const detourDist =
                haversineKm(prevGeo.lat, prevGeo.lon, c.lat, c.lon) +
                haversineKm(c.lat, c.lon, nextGeo.lat, nextGeo.lon);
            const excessKm = Math.max(0, detourDist - directDist);

            // Penalize huge physically impossible detours (e.g. a European hop falsely geolocated in Kansas US while prev & next are in Sweden/Germany)
            if (excessKm <= 80) routeScore += 1.35;
            else if (excessKm <= 300) routeScore += 0.85;
            else if (excessKm <= 800) routeScore += 0.3;
            else if (excessKm > 2200) routeScore -= 1.25;

            // Also check RTT interpolation if RTTs are known
            if (currRtt !== null && prevRtt !== null && nextRtt !== null && nextRtt >= prevRtt) {
                const deltaPrev = Math.max(0.5, currRtt - prevRtt);
                const maxPhysicalKmFromPrev = deltaPrev * 145 + 220; // generous fiber allowance
                const distFromPrev = haversineKm(prevGeo.lat, prevGeo.lon, c.lat, c.lon);
                if (distFromPrev <= maxPhysicalKmFromPrev) {
                    routeScore += 0.65;
                } else if (distFromPrev > maxPhysicalKmFromPrev * 2.5) {
                    routeScore -= 0.9;
                }
            }
        } else if (prevGeo && prevGeo.lat != null && prevGeo.lon != null) {
            const distFromPrev = haversineKm(prevGeo.lat, prevGeo.lon, c.lat, c.lon);
            if (currRtt !== null && prevRtt !== null) {
                const deltaPrev = Math.max(1, currRtt - prevRtt);
                const maxPhysicalKm = deltaPrev * 145 + 250;
                if (distFromPrev <= maxPhysicalKm) routeScore += 0.85;
                else if (distFromPrev > maxPhysicalKm * 2.5) routeScore -= 0.85;
            } else {
                // Prefer candidates closer to the previous hop when providers disagree wildly across continents
                if (distFromPrev <= 600) routeScore += 0.5;
                else if (distFromPrev > 3500) routeScore -= 0.5;
            }
        } else if (nextGeo && nextGeo.lat != null && nextGeo.lon != null) {
            const distToNext = haversineKm(c.lat, c.lon, nextGeo.lat, nextGeo.lon);
            if (distToNext <= 600) routeScore += 0.5;
            else if (distToNext > 3500) routeScore -= 0.5;
        }

        const totalScore = Math.max(0.1, c.baseWeight + clusterScore + routeScore);
        return {
            ...c,
            clusterScore: Number(clusterScore.toFixed(2)),
            routeScore: Number(routeScore.toFixed(2)),
            totalScore: Number(totalScore.toFixed(2))
        };
    });

    scored.sort((a, b) => b.totalScore - a.totalScore);
    const best = scored[0];

    // Average coordinates among all candidates within 90 km of the winning cluster so pin placement is super accurate
    const inWinnerCluster = scored.filter(c => haversineKm(best.lat, best.lon, c.lat, c.lon) <= 90);
    let weightSum = 0;
    let weightedLat = 0;
    let weightedLon = 0;

    for (const c of inWinnerCluster) {
        weightSum += c.totalScore;
        weightedLat += c.lat * c.totalScore;
        weightedLon += c.lon * c.totalScore;
    }

    let finalLat = weightSum > 0 ? weightedLat / weightSum : best.lat;
    let finalLon = weightSum > 0 ? weightedLon / weightSum : best.lon;
    let routeRefined = false;
    let refinementNote = null;

    // Extreme Anycast / Registry HQ Anomaly Correction:
    // If ALL GeoIP providers place an intermediate router hop >2,000 km off the physical path between prevGeo and nextGeo,
    // AND the RTT increase between prev -> curr -> next makes that continent jump physically impossible (faster than speed of light in fiber),
    // pull the coordinate toward the physical fiber path between prevGeo and nextGeo!
    if (prevGeo?.lat != null && nextGeo?.lat != null) {
        const directAb = haversineKm(prevGeo.lat, prevGeo.lon, nextGeo.lat, nextGeo.lon);
        const detour = haversineKm(prevGeo.lat, prevGeo.lon, finalLat, finalLon) + haversineKm(finalLat, finalLon, nextGeo.lat, nextGeo.lon);
        const rttSpan = (currRtt != null && prevRtt != null) ? Math.max(1, currRtt - prevRtt) : null;
        const maxPossibleKm = rttSpan !== null ? (rttSpan * 150 + 350) : 1400;

        if (detour - directAb > 1800 && haversineKm(prevGeo.lat, prevGeo.lon, finalLat, finalLon) > maxPossibleKm) {
            // Interpolate along the path between prevGeo and nextGeo based on RTT ratio
            let t = 0.5;
            if (currRtt != null && prevRtt != null && nextRtt != null && nextRtt > prevRtt) {
                t = Math.min(0.9, Math.max(0.1, (currRtt - prevRtt) / (nextRtt - prevRtt)));
            }
            finalLat = prevGeo.lat + (nextGeo.lat - prevGeo.lat) * t;
            finalLon = prevGeo.lon + (nextGeo.lon - prevGeo.lon) * t;
            routeRefined = true;
            refinementNote = 'Refined via Neighbor Hop & RTT Triangulation (Anycast/HQ anomaly corrected)';
        }
    }

    // Pick best non-null metadata fields from the winning cluster (falling back to any candidate)
    const pickField = (field) => {
        for (const c of inWinnerCluster) {
            if (c[field]) return c[field];
        }
        for (const c of scored) {
            if (c[field]) return c[field];
        }
        return null;
    };

    const countryCode = routeRefined ? (prevGeo?.countryCode || nextGeo?.countryCode || pickField('countryCode')) : pickField('countryCode');
    const country = routeRefined ? (prevGeo?.country || nextGeo?.country || pickField('country')) : pickField('country');
    const city = routeRefined
        ? `In Transit (${prevGeo?.city || prevGeo?.countryCode || 'Prev'} ➔ ${nextGeo?.city || nextGeo?.countryCode || 'Next'})`
        : pickField('city');
    const region = routeRefined ? (prevGeo?.region || nextGeo?.region || '') : pickField('region');
    const zip = pickField('zip');
    const isp = pickField('isp');
    const asn = pickField('asn');

    // Calculate confidence level based on provider agreement
    const agreeingCount = inWinnerCluster.length;
    let confidence = 'Medium';
    if (agreeingCount >= 3) confidence = 'High';
    else if (agreeingCount === 2) confidence = 'Good';
    else if (routeRefined) confidence = 'Route-Triangulated';

    // Collect Criminal IP threat score if present
    const crim = scored.find(c => c.id === 'criminalip');
    const threatIntel = crim?.extra ? {
        inbound: crim.extra.inboundRisk || 'Safe',
        outbound: crim.extra.outboundRisk || 'Safe',
        issues: crim.extra.issues || null
    } : null;

    return {
        lat: Number(finalLat.toFixed(5)),
        lon: Number(finalLon.toFixed(5)),
        country: country || 'Unknown',
        countryCode: countryCode || '',
        region: region || '',
        city: city || (routeRefined ? `In Transit (${prevGeo?.city || prevGeo?.countryCode || 'Prev'} ➔ ${nextGeo?.city || nextGeo?.countryCode || 'Next'})` : ''),
        zip: zip || '',
        isp: isp || '',
        asn: asn || '',
        confidence,
        agreeingProviders: agreeingCount,
        totalProviders: scored.length,
        primaryProvider: best.provider,
        routeRefined,
        refinementNote: refinementNote || (neighborContext ? 'Verified with adjacent hops' : null),
        threatIntel,
        providers: scored.map(s => ({
            id: s.id,
            provider: s.provider,
            city: s.city || 'N/A',
            region: s.region || 'N/A',
            country: s.country || 'N/A',
            countryCode: s.countryCode || '',
            lat: s.lat,
            lon: s.lon,
            isp: s.isp || '',
            asn: s.asn || '',
            score: s.totalScore,
            selected: inWinnerCluster.some(w => w.id === s.id)
        }))
    };
}

/**
 * Fetch raw provider candidates for an IP from iplocation.io (IP2Location, IPInfo, DB-IP, Criminal IP)
 */
async function fetchMultiProviderCandidates(ip) {
    if (!ip || isPrivateIp(ip)) return [];

    const now = Date.now();
    const cached = multiGeoCache.get(ip);
    if (cached && (now - cached.timestamp) < GEO_CACHE_TTL_MS) {
        return cached.candidates;
    }

    const isIpv6 = ip.includes(':');
    const services = isIpv6
        ? ['ip2location', 'ipinfo', 'dbip']
        : ['ip2location', 'ipinfo', 'dbip', 'criminalip'];

    let candidates = [];
    const jwt = await getIpLocationJwt();

    if (jwt) {
        const results = await Promise.allSettled(
            services.map(svc => querySingleIpLocationProvider(ip, svc, jwt))
        );
        candidates = results
            .filter(r => r.status === 'fulfilled' && r.value)
            .map(r => r.value);
    }

    // If iplocation.io returned nothing (e.g. token rotation or rate limit), fall back to direct APIs
    if (candidates.length === 0) {
        candidates = await fetchDirectFallbackProviders(ip);
    }

    if (candidates.length > 0) {
        multiGeoCache.set(ip, { timestamp: now, candidates });
    }

    return candidates;
}

function getAvgRttMs(rttArr) {
    if (!Array.isArray(rttArr) || rttArr.length === 0) return null;
    const nums = rttArr
        .map(v => parseFloat(String(v).replace(/[^\d.]/g, '')))
        .filter(n => !isNaN(n));
    if (nums.length === 0) return null;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/**
 * Re-evaluate a hop's geolocation using its raw multi-provider candidates + previous/next hop locations & RTTs
 */
function refineHopWithNeighbors(hopData, prevHop, nextHop) {
    if (!hopData || hopData.isPrivate || hopData.dropped || !hopData.geoCandidates || hopData.geoCandidates.length === 0) {
        return hopData;
    }

    const neighborContext = {
        prevGeo: prevHop?.geo || null,
        nextGeo: nextHop?.geo || null,
        prevRtt: prevHop ? getAvgRttMs(prevHop.rtt) : null,
        currRtt: getAvgRttMs(hopData.rtt),
        nextRtt: nextHop ? getAvgRttMs(nextHop.rtt) : null
    };

    const refinedGeo = computeConsensusGeo(hopData.geoCandidates, neighborContext);
    if (refinedGeo) {
        hopData.geo = refinedGeo;
    }
    return hopData;
}

async function enrichHop(hopData, neighborContext = null) {
    const privateType = isPrivateIp(hopData.ip);
    if (!hopData.ip || privateType) {
        hopData.isPrivate = true;
        hopData.privateType = typeof privateType === 'string' ? privateType : 'Internal';
        return hopData;
    }

    hopData.isPrivate = false;

    try {
        const [candidatesRes, ripeRes] = await Promise.allSettled([
            fetchMultiProviderCandidates(hopData.ip),
            fetch(`https://stat.ripe.net/data/whois/data.json?resource=${hopData.ip}`).then(r => r.json())
        ]);

        const candidates = candidatesRes.status === 'fulfilled' ? candidatesRes.value : [];
        hopData.geoCandidates = candidates;

        if (candidates.length > 0) {
            hopData.geo = computeConsensusGeo(candidates, neighborContext);
        }

        if (ripeRes.status === 'fulfilled' && ripeRes.value?.data && (ripeRes.value.data.records || ripeRes.value.data.irr_records)) {
            const records = [
                ...(ripeRes.value.data.records || []),
                ...(ripeRes.value.data.irr_records || [])
            ].flat();
            let netname = null, descr = null, country = null, asn = null, netblock = null;

            for (const record of records) {
                const key = record.key.toLowerCase();
                if ((key === 'netname' || key === 'ownerid') && !netname) netname = record.value;
                if ((key === 'descr' || key === 'orgname' || key === 'organization' || key === 'owner') && !descr) descr = record.value;
                if (key === 'country' && !country) country = record.value;
                if ((key === 'origin' || key === 'originas' || key === 'aut-num') && !asn) asn = record.value;
                if ((key === 'route' || key === 'route6' || key === 'inetnum' || key === 'inet6num' || key === 'netrange') && !netblock) netblock = record.value;
            }

            hopData.registry = {
                netname,
                descr,
                country,
                asn: asn || hopData.geo?.asn,
                netblock: cidrToRange(netblock),
                authoritative: ripeRes.value.data.authorities?.[0] || 'Unknown'
            };
        } else if (hopData.geo?.asn) {
            hopData.registry = { asn: hopData.geo.asn };
        }
    } catch (e) {
        console.error('Enrichment error for IP ' + hopData.ip, e);
    }

    return hopData;
}

module.exports = {
    enrichHop,
    fetchMultiProviderCandidates,
    computeConsensusGeo,
    refineHopWithNeighbors,
    haversineKm
};
