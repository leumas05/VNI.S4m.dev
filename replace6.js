const fs = require('fs');

let code = fs.readFileSync('frontend/src/App.jsx', 'utf8');

// 1. Add state
code = code.replace(
  'const [updateAvailable, setUpdateAvailable] = useState(false);',
  'const [updateAvailable, setUpdateAvailable] = useState(false);\n  const [isDownloading, setIsDownloading] = useState(false);'
);

// 2. Add listener
const oldEffect = `      if (window.electronAPI.onUpdateDownloaded) {
        window.electronAPI.onUpdateDownloaded(() => {
          setUpdateAvailable(true);
        });
      }`;

const newEffect = `      if (window.electronAPI.onUpdateDownloaded) {
        window.electronAPI.onUpdateDownloaded(() => {
          setIsDownloading(false);
          setUpdateAvailable(true);
        });
      }
      if (window.electronAPI.onUpdateDownloading) {
        window.electronAPI.onUpdateDownloading(() => {
          setIsDownloading(true);
        });
      }`;

code = code.replace(oldEffect, newEffect);

// 3. Add to top bar
const oldTopBar = `<span className="text-[11px] font-bold text-gray-400 tracking-widest uppercase">S4m's VNI (v{__APP_VERSION__})</span>`;
const newTopBar = `<span className="text-[11px] font-bold text-gray-400 tracking-widest uppercase">S4m's VNI (v{__APP_VERSION__})</span>
                {isDownloading && (
                    <span className="ml-4 text-[10px] text-emerald-500 font-mono animate-pulse">Downloading update...</span>
                )}`;

code = code.replace(oldTopBar, newTopBar);

fs.writeFileSync('frontend/src/App.jsx', code);
