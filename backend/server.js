const express = require('express');
const cors = require('cors');
const { runTraceroute } = require('./traceroute');

const app = express();
app.use(cors());

app.get('/api/ping', (req, res) => {
    res.json({ status: 'ok' });
});

app.get('/api/my-location', async (req, res) => {
    let clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    let url = 'https://api.ip2location.io/?format=json';
    if (clientIp && clientIp !== '::1' && clientIp !== '127.0.0.1' && !clientIp.startsWith('::ffff:127.0.0.1')) {
        clientIp = clientIp.split(',')[0].trim();
        url += `&ip=${clientIp}`;
    }
    try {
        const fetchRes = await fetch(url);
        const data = await fetchRes.json();
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/trace', (req, res) => {
    const target = req.query.target;
    if (!target) {
        return res.status(400).json({ error: 'Target is required' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    console.log(`Starting trace to ${target}`);
    const traceProcess = runTraceroute(target, (hopData) => {
        res.write(`data: ${JSON.stringify({ type: 'hop', data: hopData })}\n\n`);
    }, () => {
        console.log(`Trace finished safely.`);
        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        res.end();
    });

    traceProcess.on('error', (err) => {
        console.error('Trace error', err);
        res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
        res.end();
    });

    req.on('close', () => {
        console.log('Client disconnected, killing trace');
        traceProcess.kill();
    });
});

app.get('/api/trace/json', (req, res) => {
    const target = req.query.target;
    if (!target) {
        return res.status(400).json({ error: 'Target is required' });
    }

    // Set a 2-minute timeout to allow the traceroute to finish
    req.setTimeout(120000);

    console.log(`Starting JSON trace to ${target}`);
    const hops = [];
    
    const traceProcess = runTraceroute(target, (hopData) => {
        hops.push(hopData);
    }, () => {
        console.log(`JSON trace to ${target} finished.`);
        if (!res.headersSent) {
            res.json({ target, hops });
        }
    });

    traceProcess.on('error', (err) => {
        console.error('JSON Trace error', err);
        if (!res.headersSent) {
            res.status(500).json({ error: err.message, partialHops: hops });
        }
    });

    req.on('close', () => {
        if (!res.writableEnded) {
            console.log('Client disconnected from JSON trace, killing trace');
            traceProcess.kill();
        }
    });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    const green = '\x1b[32m';
    const cyan = '\x1b[36m';
    const gray = '\x1b[90m';
    const reset = '\x1b[0m';
    
    console.log(`${green}
  ____  _  _             _      __     ___   _ ___ 
 / ___|| || |  _ __ ___ ( )___  \\ \\   / / \\ | |_ _|
 \\___ \\| || |_| '_ \` _ \\|// __|  \\ \\ / /|  \\| || | 
  ___) |__   _| | | | | | \\__ \\   \\ V / | |\\  || | 
 |____/   |_| |_| |_| |_| |___/    \\_/  |_| \\_|___|
${reset}`);
    
    console.log(`  ${cyan}[✓] S4m's VNI Background Engine is ONLINE${reset}`);
    console.log(`  ${gray}>> Listening on port: ${PORT}${reset}`);
    console.log(`  ${gray}>> Ready to bridge local network traceroutes${reset}`);
    console.log(`  ${gray}>> You can now use the browser version at: ${cyan}https://vni.s4m.dev${reset}`);
    console.log(`  ${gray}>> Press Ctrl+C to stop the engine${reset}\n`);
});
