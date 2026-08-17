<<<<<<< HEAD
# Divya-System
Developed DIVYA', an IoT-enabled fault detection system for Overhead low-voltage grid, utilizing Arduino and LoRa to achieve real-time, long-range wireless monitoring Designed dual-node architecture Child/Parent) integrating ZMPT101B voltage sensors and motorized MCCBs to automatically isolate broken lines and prevent electrocution hazards.
=======
# Power Grid Fault Detection System

A premium-styled industrial IoT dashboard that visualises power-grid modules on Google Maps, highlights faults in real-time and notifies the nearest engineer.

## Quick Start

1. Install dependencies

```bash
cd "C:/Projects/Divya System"
npm install
```

2. Configure Google Maps

Copy `.env.example` to `.env` and replace `YOUR_GOOGLE_MAPS_API_KEY` with a valid key.

3. Start the server

```bash
npm start
```

4. Open the dashboard

Visit http://localhost:3000 in a browser.

5. Test a fault

```bash
curl -X POST http://localhost:3000/report-fault \
  -H "Content-Type: application/json" \
  -d '{"ip":"192.168.1.12"}'
```

You should see the red marker appear, the alert banner show, and the console log the nearest engineer.

## Extending the System

- MQTT – add the `mqtt` npm package, subscribe to `grid/faults`, and forward messages to `io.emit('fault_event', ...)`.
- Database – replace `data/*.json` with a MongoDB or PostgreSQL backend; update `server.js` to expose an API.
- Docker – a `Dockerfile` + `docker-compose.yml` can be added for containerised deployment.
- Authentication – protect `/report-fault` with an API key or JWT if desired.

If you'd like any of the optional extensions (MQTT, DB, Docker), tell me which and I'll add them.
>>>>>>> 03ba5f0 (Initial commit)
