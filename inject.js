const fs = require('fs');
let code = fs.readFileSync('backend/server.js', 'utf8');

const imports = `
const path = require('path');
const readline = require('readline');
const os = require('os');
const qrcode = require('qrcode-terminal');
`;

code = code.replace("const { runTraceroute } = require('./traceroute');", "const { runTraceroute } = require('./traceroute');\n" + imports);

const staticMiddleware = `
app.use(express.static(path.join(__dirname, '../frontend/dist')));
`;
code = code.replace("app.use(cors());", "app.use(cors());\n" + staticMiddleware);

const rlLogic = `
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    console.log(\`  \${gray}>> Type '\${cyan}uplink\${gray}' to broadcast to your local network\${reset}\`);

    rl.on('line', (input) => {
        if (input.trim().toLowerCase() === 'uplink') {
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
                const url = \`http://\${localIp}:\${PORT}\`;
                console.log(\`\\n  \${cyan}[O] UPLINK ESTABLISHED\${reset}\`);
                console.log(\`  \${gray}>> Broadcasting on local network at:\${reset} \${green}\${url}\${reset}\\n\`);
                qrcode.generate(url, {small: true}, function (qr) {
                    const indentedCode = qr.split('\\n').map(line => '  ' + line).join('\\n');
                    console.log(indentedCode);
                });
                console.log(\`  \${gray}>> Scan the QR code with your phone to connect.\${reset}\\n\`);
            } else {
                console.log(\`  \${gray}>> ERROR: Could not determine local network IP.\${reset}\\n\`);
            }
        }
    });
`;

code = code.replace("console.log(`  ${gray}>> Press Ctrl+C to stop the engine${reset}\\n`);", "console.log(`  ${gray}>> Press Ctrl+C to stop the engine${reset}\\n`);\n" + rlLogic);

fs.writeFileSync('backend/server.js', code);
