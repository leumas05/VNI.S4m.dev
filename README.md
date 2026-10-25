# Visual Network Intelligence (VNI)

![VNI Logo](frontend/public/vite.svg)

**VNI (Visual Network Intelligence)** is a comprehensive, real-time network intelligence, traceroute, connection radar, and local area network (LAN) topology platform built with **React**, **Three.js / WebGL**, **Leaflet**, **Node.js**, and **Electron**.

Live Web Dashboard: **[https://vni.s4m.dev](https://vni.s4m.dev)**

---

## Core Modules & Capabilities

### 1. Interactive Global Traceroute (2D Map & 3D WebGL Globe)
- **Dual Visualization Engines**: Switch seamlessly between a dark-mode **2D Leaflet Map** and a hardware-accelerated **3D Three.js / WebGL Globe** with animated packet arcs, atmospheric glow, and smart node de-clustering.
- **Multi-Provider GeoIP Consensus (`iplocation.io`)**: Queries **IP2Location**, **IPInfo**, **DB-IP**, and **Criminal IP** in parallel to compute weighted spatial consensus for every hop, exposing per-provider coordinates, scores, and Criminal IP Inbound/Outbound threat intelligence.
- **Neighbor Hop & RTT Route Triangulation**: Evaluates physical fiber speed-of-light constraints (`prevHop` + `nextHop` + `RTT`) to automatically correct Anycast or corporate headquarters geolocation anomalies along the actual fiber path.
- **Deep Registry & WHOIS Enrichment**: Pulls authoritative RIPE / ARIN / APNIC / LACNIC / AFRINIC netblocks, ASN ownership, CIDR IP counts, and direct registry links.
- **Trace History & Route Comparison**: Automatically stores historical traces in `localStorage` and highlights route changes and latency deltas against previous runs.
- **Public IP History Tracking**: Tracks your public IP address history over time in `localStorage` with exact `From` / `To` timestamps, active session duration, ISP, and location.

### 2. Live Connection Radar (Real-Time OS Socket & Process Monitor)
- **TCP + Connected UDP (`QUIC / HTTP3`, WebRTC, Gaming)**: Polls active OS network sockets (`netstat` / `ss`) every 4 seconds and maps each connection to its owning process (`PID` & executable name).
- **OS DNS Cache & Reverse PTR Resolution**: Harvests the local OS DNS resolver cache (`ipconfig /displaydns`) and combines it with asynchronous Reverse DNS (`PTR`) lookups to reveal the exact domain name behind CDN/cloud IPs.
- **Security, Encryption & Telemetry Analysis**:
  - Automatically flags **TLS / QUIC Encrypted** sockets, **Telemetry / Analytics** endpoints (e.g., Microsoft Vortex, Google Analytics, Sentry), and **Unencrypted (Cleartext)** traffic.
  - Displays live session duration timers (`⏱`) and `NEW` connection badges.
- **Flat List & Grouped-by-App Views**: Group connections by application (e.g., `chrome.exe`, `discord.exe`, `spotify.exe`) or filter by `Encrypted`, `Telemetry`, `UDP/QUIC`, or `New`.
- **1-Click Active Tools**: Launch a full **Traceroute**, **Live Ping**, **DNS DiG**, or **SSL/TLS Certificate Inspection** directly from any Radar connection card.

### 3. Deep LAN Scanner & Interactive Topology Tree
- **Multi-Protocol Zero-Config Discovery**: Combines active subnet sweeps with permanent background listeners for **ARP**, **mDNS / Bonjour (`.local`)**, **SSDP / UPnP (XML)**, **WS-Discovery (WSD)**, **NetBIOS (NBNS)**, **LLMNR**, **SNMP (v1/v2c)**, and **DHCP Fingerprinting**.
- **Dynamic Verified Topology (`Tree View` & `Radial View`)**:
  - Automatically detects **Mesh Wi-Fi Satellites / Access Points** and verifies which node your PC is connected to using sub-millisecond ping/RTT analysis.
  - Groups unverified wireless clients cleanly under a **Shared Subnet Clients** bus rather than guessing Layer 2 paths, while rendering live animated socket links (`⚡ SOCKETS`) for active local traffic.
  - Includes automatic bounding-box collision relaxation so cards never overlap in either Tree or Radial mode.
- **Deep Device Inspector (`Inspect` Modal)**:
  - **Custom TCP Port Scanner**: Scan `Top 100 Ports`, `Web & Admin Ports`, or any custom port range (`1–65535`) with live TCP banner grabbing.
  - **TLS Certificate Identity Extraction**: Reads Common Name (`CN`) and Subject Alternative Names (`SAN`) from local HTTPS ports (`443`, `8443`, etc.).
  - **Automated Security & Risk Audit**: Evaluates exposed insecure services (Telnet, FTP, SMBv1, unauthenticated ADB, Docker API, RTSP, etc.) and grades each device (`A+` to `D`).
  - **Wake-on-LAN (WoL)**: Send magic packets (`0xFF * 6 + MAC * 16`) directly to sleeping devices.
- **22 Custom Device Icon Categories & Nicknames**: Automatic hardware/OUI/protocol classification across 22 icon types (Gaming, Solar Inverter, EV Charger, Smart TV, NAS, IoT Chip, Mesh Node, Camera, Smart Appliance, etc.) with inline custom icon and nickname overrides persisted in `localStorage`.

### 4. Built-in Network Diagnostic Suite
- **Continuous Live Ping Monitor**: Real-time SSE latency graph with min/avg/max RTT, jitter, TTL, and packet loss statistics.
- **Interactive DNS `DiG` Tool**: Query `A`, `AAAA`, `CNAME`, `MX`, `NS`, `TXT`, `SOA`, and `PTR` records against Cloudflare (`1.1.1.1`), Google (`8.8.8.8`), Quad9 (`9.9.9.9`), or your system resolver.
- **SSL / TLS Certificate Inspector**: Inspect full X.509 certificate chains, validity countdowns, issuers, SANs, fingerprints, and TLS protocol versions.

---

## Architecture

VNI runs either as a **standalone cross-platform Electron Desktop App** or as a **Hybrid Web App (`vni.s4m.dev`)** paired with the local **VNI Background Engine**:

1. **Frontend (`frontend/`)**:
   - Built with **React 18**, **Vite**, **TailwindCSS**, **Leaflet / React-Leaflet** (2D Map), **Three.js / react-globe.gl** (3D WebGL Globe), and **Lucide Icons**.
2. **Backend Engine (`backend/`)**:
   - Node.js + Express server (`port 3001`) providing real-time Server-Sent Events (SSE) and REST endpoints:
     - `backend/traceroute.js` & `backend/enrichment.js`: Native OS traceroute + 4-provider GeoIP consensus + neighbor hop & RTT triangulation + RIPE WHOIS.
     - `backend/netstat.js`: Real-time TCP/UDP socket scanner, PID-to-process mapper, Windows DNS cache harvester (`ipconfig /displaydns`), and telemetry/security analyzer.
     - `backend/arp.js`: Deep LAN scanner, IEEE OUI hardware database, mDNS/SSDP/WSD/LLMNR/DHCP listeners, SNMP & TCP banner grabber, Wake-on-LAN, and custom port scanner.
     - `backend/dns.js` & `backend/ssl.js`: Multi-resolver DNS `DiG` engine and TLS X.509 certificate inspector.

---

## Quick Start (Development)

1. **Clone the repository**:
   ```bash
   git clone https://github.com/leumas05/VNI.S4m.dev.git
   cd VNI.S4m.dev
   ```

2. **Install dependencies**:
   ```bash
   npm install
   cd frontend && npm install
   cd ..
   ```

3. **Run in development mode (Frontend + Electron/Backend)**:
   ```bash
   npm start
   ```
   Or run the backend engine and frontend dev server separately:
   ```bash
   node backend/server.js
   npm --prefix frontend run dev
   ```

---

## Production Builds

VNI uses `electron-builder` to package native desktop installers for Windows (`NSIS .exe`), macOS (`.dmg`), and Linux (`.AppImage`).

To build the frontend bundle and package the desktop application for your OS:
```bash
npm run build:app
```
The compiled installers and executables will be output to the `release/` directory.

---

*Created by [S4m.dev](https://www.s4m.dev/) • [Live Web App](https://vni.s4m.dev) • [GitHub Repository](https://github.com/leumas05/VNI.S4m.dev)*
