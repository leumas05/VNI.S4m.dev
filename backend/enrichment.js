const { isPrivateIp, cidrToRange } = require('./utils');

async function enrichHop(hopData) {
    const privateType = isPrivateIp(hopData.ip);
    if (!hopData.ip || privateType) {
        hopData.isPrivate = true;
        hopData.privateType = typeof privateType === 'string' ? privateType : 'Internal';
        return hopData;
    }
    
    hopData.isPrivate = false;

    try {
        const [geoRes, ripeRes] = await Promise.allSettled([
            fetch(`https://api.ip2location.io/?ip=${hopData.ip}&format=json`).then(r => r.json()),
            fetch(`https://stat.ripe.net/data/whois/data.json?resource=${hopData.ip}`).then(r => r.json())
        ]);

        if (geoRes.status === 'fulfilled' && geoRes.value.ip) {
            const geo = geoRes.value;
            
            hopData.geo = {
                lat: geo.latitude ? parseFloat(geo.latitude) : null,
                lon: geo.longitude ? parseFloat(geo.longitude) : null,
                country: geo.country_name,
                countryCode: geo.country_code,
                region: geo.region_name,
                city: geo.city_name,
                zip: geo.zip_code,
                isp: geo.as,
                asn: geo.asn ? `AS${geo.asn}` : ''
            };
        }

        if (ripeRes.status === 'fulfilled' && ripeRes.value.data && (ripeRes.value.data.records || ripeRes.value.data.irr_records)) {
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
module.exports = { enrichHop };
