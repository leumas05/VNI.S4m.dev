# Visual Network Intelligence (VNI)

![VNI Logo](frontend/public/vite.svg)

**VNI (Visual Network Intelligence)** is an interactive, real-time traceroute dashboard built with React, Node.js, and Electron. It visually maps the physical journey of network packets across the globe using IP geolocation, ASN registry enrichment, and smart clustering.

## Features
- **Real-Time Map Visualization**: See exactly where your data travels with animated packet flows and geographic clustering.
- **Deep Network Insights**: Detailed WHOIS info, ASN details, and latency (ping) tracking for each hop.
- **Cross-Platform Desktop App**: Built with Electron for native integration on Windows, macOS, and Linux.
- **Trace History & Comparison**: Save previous traces and compare them side-by-side to detect routing changes.
- **Smart Gateway Detection**: Automatically identifies internal IP ranges (192.168.x.x, 10.x.x.x) and marks them appropriately.

## Architecture
VNI consists of two parts running seamlessly inside the Electron wrapper:
1. **Frontend (React + Vite)**: A highly interactive UI leveraging TailwindCSS, Leaflet.js for map rendering, and Server-Sent Events (SSE) for real-time updates.
2. **Backend Engine (Node.js)**: A lightweight Express server that utilizes native OS commands (`tracert` / `traceroute`) to perform raw ICMP/UDP traces directly from the user's local network.

## Quick Start (Development)

To run the app locally in development mode:

1. Clone the repository:
   ```bash
   git clone https://github.com/leumas05/VNI.S4m.dev.git
   ```
2. Install dependencies:
   ```bash
   npm install
   cd frontend && npm install
   cd ../backend && npm install
   ```
3. Start the application:
   ```bash
   npm start
   ```

## Production Builds

VNI uses `electron-builder` to package native installers. 
To build the application for your current operating system, run:
```bash
npm run build:app
```
The resulting executable will be available in the `release/` directory.

---
*Created by [S4M.dev](https://www.s4m.dev/)*
