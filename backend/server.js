const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const { runTraceroute } = require('./traceroute');

const path = require('path');
const readline = require('readline');
const os = require('os');
const qrcode = require('qrcode-terminal');


const app = express();
app.use(cors());

app.use(express.static(path.join(__dirname, '../frontend/dist')));


function pingHost(target, callback) {
    const isWin = os.platform() === 'win32';
    const isMac = os.platform() === 'darwin';

    const cmd = 'ping';
    let args;
    if (isWin) {
        args = ['-n', '1', '-w', '1500', target];
    } else if (isMac) {
        args = ['-c', '1', '-W', '1500', target];
    } else {
        args = ['-c', '1', '-W', '2', target];
    }

    let output = '';
    const child = spawn(cmd, args);

    child.stdout.on('data', (d) => { output += d.toString(); });
    child.stderr.on('data', (d) => { output += d.toString(); });

    child.on('close', (code) => {
        const timeMatch = output.match(/time[=<](\d+(?:\.\d+)?) ?ms/i);
        const ttlMatch = output.match(/TTL=(\d+)/i);

        if (timeMatch) {
            const timeVal = parseFloat(timeMatch[1]);
            callback(null, {
                status: 'success',
                time: output.includes('time<1ms') ? 1 : Math.round(timeVal),
                rawTime: timeVal,
                ttl: ttlMatch ? parseInt(ttlMatch[1], 10) : null
            });
        } else if (output.toLowerCase().includes('timed out') || output.toLowerCase().includes('unreachable') || code !== 0) {
            callback(null, {
                status: 'timeout',
                time: null,
                ttl: null
            });
        } else {
            callback(null, {
                status: 'unknown',
                time: null,
                ttl: null
            });
        }
    });

    child.on('error', (err) => {
        callback(err);
    });

    return child;
}

app.get('/api/ping', (req, res) => {
    res.json({ status: 'ok' });
});

app.get('/api/ping-stream', (req, res) => {
    const target = req.query.target;
    if (!target || !/^[a-zA-Z0-9\.\:\-]+$/.test(target)) {
        return res.status(400).json({ error: 'Valid target IP or hostname is required' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let seq = 0;
    let isClosed = false;
    let currentChild = null;
    let timer = null;

    const pingNext = () => {
        if (isClosed) return;
        seq++;
        currentChild = pingHost(target, (err, result) => {
            currentChild = null;
            if (isClosed) return;

            if (err) {
                res.write(`data: ${JSON.stringify({ seq, time: null, status: 'error', error: err.message, timestamp: Date.now() })}\n\n`);
            } else {
                res.write(`data: ${JSON.stringify({ seq, time: result.time, status: result.status, ttl: result.ttl, timestamp: Date.now() })}\n\n`);
            }

            if (!isClosed) {
                timer = setTimeout(pingNext, 850);
            }
        });
    };

    pingNext();

    req.on('close', () => {
        isClosed = true;
        if (timer) clearTimeout(timer);
        if (currentChild && !currentChild.killed) {
            try { currentChild.kill(); } catch (e) {}
        }
    });
});

app.get('/api/ping-target', (req, res) => {
    const target = req.query.target;
    if (!target || !/^[a-zA-Z0-9\.\:\-]+$/.test(target)) {
        return res.status(400).json({ error: 'Valid target IP or hostname is required' });
    }
    pingHost(target, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(result);
    });
});

app.get('/api/my-location', async (req, res) => {
    let clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    let url = 'https://api.ip2location.io/?format=json';
    
    const isPrivateIp = (ip) => {
        if (!ip) return true;
        if (ip === '::1' || ip === '127.0.0.1' || ip.startsWith('::ffff:127.0.0.1')) return true;
        if (ip.startsWith('192.168.') || ip.startsWith('::ffff:192.168.')) return true;
        if (ip.startsWith('10.') || ip.startsWith('::ffff:10.')) return true;
        if (ip.startsWith('172.') || ip.startsWith('::ffff:172.')) {
            // Technically 172.16.0.0 - 172.31.255.255, but this is a safe enough check
            return true;
        }
        return false;
    };

    if (clientIp && !isPrivateIp(clientIp)) {
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
    console.log(`  ${gray}>> Press Ctrl+C or type 'quit' to stop the engine${reset}\n`);

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    console.log(`  ${gray}>> Type '${cyan}uplink${gray}' to broadcast to your local network${reset}`);

    rl.on('line', (input) => {
        const cmd = input.trim().toLowerCase();
        if (cmd === 'uplink') {
            const interfaces = os.networkInterfaces();
            let localIp = '127.0.0.1';
            for (const name of Object.keys(interfaces)) {
                for (const iface of interfaces[name]) {
                    if (iface.family === 'IPv4' && !iface.internal) {
                        localIp = iface.address;
                        break;
                    }
                }
                if (localIp !== '127.0.0.1') break;
            }
            
            if (localIp !== '127.0.0.1') {
                const url = `http://${localIp}:${PORT}`;
                console.log(`\n  ${cyan}[O] UPLINK ESTABLISHED${reset}`);
                console.log(`  ${gray}>> Broadcasting on local network at:${reset} ${green}${url}${reset}\n`);
                qrcode.generate(url, {small: true}, function (qr) {
                    const indentedCode = qr.split('\n').map(line => '  ' + line).join('\n');
                    console.log(indentedCode);
                });
                console.log(`  ${gray}>> Scan the QR code with your phone to connect.${reset}\n`);
            } else {
                console.log(`  ${gray}>> ERROR: Could not determine local network IP.${reset}\n`);
            }
        } else if (cmd === 'quit' || cmd === 'stop' || cmd === 'exit') {
            console.log(`\n  ${gray}>> Shutting down S4m's VNI Background Engine...${reset}`);
            process.exit(0);
        }
    });

});
