// Global variables
const socket = io();
let map;
let dashboardMap;
let markers = {};
let dashboardMarkers = {};
let modules = {};
let engineers = [];
let faultLog = [];
let currentPage = 'dashboard';

// Leaflet-based implementation (no API key needed)
let L_initialized = false;

// Route tracking
let dispatchedEngineers = {};

// Initialize application
async function init() {
    try {
        // Load data files
        const [modRes, engRes] = await Promise.all([
            fetch('/data/modules.json'),
            fetch('/data/engineers.json')
        ]);
        modules = await modRes.json();
        engineers = await engRes.json();

        // Update modules count
        document.getElementById('modulesOnline').textContent = Object.keys(modules).length;

        // Initialize maps
        initMaps();

        // Load engineers list
        loadEngineers();

        // Update map status overlay
        updateMapStatus();

        // Set up socket listeners
        socket.on('fault_event', data => handleFault(data.ip));
        socket.on('connect', () => {
            updateSystemStatus(true);
            updateMapStatus();
        });
        socket.on('disconnect', () => {
            updateSystemStatus(false);
            updateMapStatus();
        });

        // Store for debugging
        window.__modules = modules;
        window.__engineers = engineers;

        console.log('Dashboard initialized successfully');
    } catch (err) {
        console.error('Initialization error:', err);
    }
}

// Initialize Maps with Leaflet
function initMaps() {
    console.log('Initializing Leaflet maps...');
    
    if (!window.L) {
        console.error('Leaflet library not loaded');
        handleMapUnavailable();
        return;
    }

    try {
        // Main map
        console.log('Creating main map with Leaflet...');
        const mapElement = document.getElementById('map');
        if (!mapElement) {
            console.error('Map container element not found');
            return;
        }
        
        // Check if map already exists
        if (map) {
            console.log('Map already initialized, skipping re-initialization');
            return;
        }
        
        // Ensure map container has proper dimensions
        mapElement.style.height = '100%';
        mapElement.style.width = '100%';
        
        map = L.map('map', {
            center: [19.08, 72.88],
            zoom: 13,
            attributionControl: true
        });

        // Add OpenStreetMap tiles (free, no API key needed)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(map);

        console.log('Main map created successfully');

        // Dashboard map
        console.log('Creating dashboard map...');
        const dashboardMapElement = document.getElementById('dashboard-map');
        if (dashboardMapElement) {
            dashboardMapElement.style.height = '100%';
            dashboardMapElement.style.width = '100%';
            
            dashboardMap = L.map('dashboard-map', {
                center: [19.08, 72.88],
                zoom: 12,
                attributionControl: false
            });

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap',
                maxZoom: 19
            }).addTo(dashboardMap);

            console.log('Dashboard map created successfully');
        }

        // Add module markers
        console.log('Adding markers for', Object.keys(modules).length, 'modules');
        for (const ip in modules) {
            const m = modules[ip];
            
            try {
                // Create custom marker
                const markerIcon = L.icon({
                    iconUrl: createMarkerIconUrl('green'),
                    iconSize: [32, 40],
                    iconAnchor: [16, 40],
                    popupAnchor: [0, -40]
                });

                // Main map marker
                markers[ip] = L.marker([m.lat, m.lng], { icon: markerIcon })
                    .bindPopup(`
                        <div class="module-popup">
                            <div class="module-popup-header">${m.name}</div>
                            <div class="module-popup-info">
                                <div class="module-popup-info-row">
                                    <span class="module-popup-info-label">IP:</span>
                                    <span class="module-popup-info-value">${ip}</span>
                                </div>
                                <div class="module-popup-info-row">
                                    <span class="module-popup-info-label">Type:</span>
                                    <span class="module-popup-info-value">${m.type}</span>
                                </div>
                            </div>
                            <div class="module-popup-actions">
                                <button class="btn-fault" onclick="simulateFaultAt('${ip}')">Simulate</button>
                            </div>
                        </div>
                    `)
                    .addTo(map);

                // Dashboard map marker
                if (dashboardMap) {
                    dashboardMarkers[ip] = L.marker([m.lat, m.lng], { icon: markerIcon })
                        .addTo(dashboardMap);
                }
            } catch (err) {
                console.error(`Error creating marker for ${ip}:`, err);
            }
        }

        L_initialized = true;
        console.log('✅ Leaflet maps initialized successfully');
    } catch (err) {
        console.error('❌ Leaflet map init error:', err);
        handleMapUnavailable();
    }
}

// Create marker icon URL for Leaflet
function createMarkerIconUrl(color) {
    const colors = {
        green: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
        red: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        yellow: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png'
    };
    return colors[color] || colors.green;
}

// Create custom marker icon with status
function createCustomMarker(status, moduleName) {
    const colors = {
        green: '#28a745',
        red: '#dc3545',
        yellow: '#ffc107'
    };

    const svgMarker = `
        <svg width="32" height="40" viewBox="0 0 32 40" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 0C9.37 0 4 5.37 4 12c0 9 12 28 12 28s12-19 12-28c0-6.63-5.37-12-12-12z" 
                  fill="${colors[status] || colors.green}" 
                  opacity="0.9"/>
            <circle cx="16" cy="12" r="5" fill="white" opacity="0.95"/>
            <circle cx="24" cy="6" r="5" fill="${colors[status]}" opacity="0.8"/>
            <text x="24" y="11" font-size="8" fill="white" text-anchor="middle" dominant-baseline="middle">●</text>
        </svg>
    `;

    return `data:image/svg+xml;base64,${btoa(svgMarker)}`;
}

// Create marker icon helper
function createMarkerIcon(color) {
    return `http://maps.google.com/mapfiles/ms/icons/${color}-dot.png`;
}

// Show module information with popup
function showModuleInfo(ip, module) {
    const status = 'Online'; // TODO: Get actual status
    const statusColor = status === 'Fault' ? '#dc3545' : '#28a745';
    
    if (markers[ip]) {
        markers[ip].openPopup();
    }
}

// Handle fault event with real-time distance calculation
function handleFault(ip) {
    const module = modules[ip];
    if (!module) {
        console.warn('Module not found:', ip);
        return;
    }

    console.log(`🚨 Fault detected at ${module.name}`);

    // Update markers to red
    if (markers[ip]) {
        const redIcon = L.icon({
            iconUrl: createMarkerIconUrl('red'),
            iconSize: [32, 40],
            iconAnchor: [16, 40],
            popupAnchor: [0, -40]
        });
        markers[ip].setIcon(redIcon);
    }
    if (dashboardMarkers[ip]) {
        const redIcon = L.icon({
            iconUrl: createMarkerIconUrl('red'),
            iconSize: [32, 40],
            iconAnchor: [16, 40],
            popupAnchor: [0, -40]
        });
        dashboardMarkers[ip].setIcon(redIcon);
    }

    // Pan map to fault location
    if (map) {
        map.setView([module.lat, module.lng], 14);
    }

    // Show alert
    const alertBanner = document.getElementById('alertBanner');
    alertBanner.classList.remove('hidden');
    document.getElementById('alertMsg').innerHTML = `
        <i class="ti ti-alert-triangle"></i>
        <strong>Fault Detected!</strong> ${module.name} (${ip})
    `;

    // Find closest engineer using Haversine formula
    let closest = engineers[0];
    let minDistance = Infinity;

    engineers.forEach(eng => {
        const d = calculateDistance(module.lat, module.lng, eng.lat, eng.lng);
        if (d < minDistance) {
            minDistance = d;
            closest = eng;
        }
    });

    // Dispatch engineer
    dispatchEngineer(closest, module, ip, minDistance, 'Calculating...');

    // Update fault count
    const faultCount = document.querySelectorAll('[data-status="faulty"]').length + 1;
    document.getElementById('faultCount').textContent = faultCount;

    // Update map status overlay
    updateMapStatus();

    // Add to event log
    addEventToLog(`Fault detected at ${module.name}`, 'danger');
}

// Calculate distance between two points (Fallback Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Geocoding functions - Not needed with Leaflet/OSM
// Keeping structure for future use

// Dispatch engineer with route visualization
function dispatchEngineer(engineer, module, moduleIp, distance, duration) {
    // Check if engineer already dispatched
    if (dispatchedEngineers[engineer.id]) {
        console.log(`${engineer.name} already dispatched to another fault`);
        return;
    }

    // Mark engineer as dispatched
    dispatchedEngineers[engineer.id] = { moduleIp, distance, duration };

    // Log dispatch
    addEventToLog(`Dispatched ${engineer.name} (${distance.toFixed(1)}km away)`, 'info');

    // Draw route line on map if using Leaflet
    if (L_initialized && map) {
        const latlngs = [
            [engineer.lat, engineer.lng],
            [module.lat, module.lng]
        ];
        
        const polyline = L.polyline(latlngs, {
            color: '#1971c2',
            weight: 3,
            opacity: 0.8,
            dashArray: '10, 5'
        }).addTo(map);
        
        // Pan to show entire route
        const group = new L.featureGroup([
            L.marker([engineer.lat, engineer.lng]),
            L.marker([module.lat, module.lng])
        ]);
        map.fitBounds(group.getBounds().pad(0.1));
    }

    console.log(`Engineer ${engineer.name} dispatched to ${module.name} (${distance.toFixed(2)}km away)`);
}

// Add event to log
function addEventToLog(message, type = 'info') {
    const eventList = document.getElementById('recentEvents');
    const timestamp = new Date().toLocaleTimeString();
    
    faultLog.unshift({ message, type, timestamp });
    if (faultLog.length > 10) faultLog.pop();

    eventList.innerHTML = faultLog.map(event => `
        <div class="event-item" style="border-left-color: ${type === 'danger' ? '#dc3545' : type === 'success' ? '#28a745' : '#17a2b8'}">
            <div><strong>${event.message}</strong></div>
            <div class="event-time">${event.timestamp}</div>
        </div>
    `).join('');
}

// Reset system
function resetSystem() {
    // Reset all markers to green
    for (const ip in markers) {
        const greenIcon = L.icon({
            iconUrl: createMarkerIconUrl('green'),
            iconSize: [32, 40],
            iconAnchor: [16, 40],
            popupAnchor: [0, -40]
        });
        markers[ip].setIcon(greenIcon);
        if (dashboardMarkers[ip]) {
            dashboardMarkers[ip].setIcon(greenIcon);
        }
    }
    
    // Clear routes (recreate map to clear overlays)
    if (map) {
        map.eachLayer(function(layer) {
            if (layer instanceof L.Polyline) {
                map.removeLayer(layer);
            }
        });
    }
    
    // Clear dispatch tracking
    dispatchedEngineers = {};
    
    // Hide alert
    document.getElementById('alertBanner').classList.add('hidden');
    document.getElementById('faultCount').textContent = '0';
    
    // Update map status
    updateMapStatus();
    
    addEventToLog('System reset - all faults cleared', 'success');
}

// Simulate fault from UI
function simulateFaultFromUI() {
    const ip = document.getElementById('simIp').value || '192.168.1.12';
    if (modules[ip]) {
        handleFault(ip);
    } else {
        alert('Invalid IP address');
    }
}

// Simulate fault at specific module
function simulateFaultAt(ip) {
    handleFault(ip);
}

// Page switching
function switchPage(pageName) {
    // Hide all pages
    document.querySelectorAll('.page-content').forEach(page => {
        page.classList.remove('active');
    });
    
    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-page="${pageName}"]`).classList.add('active');
    
    // Show selected page
    document.getElementById(`${pageName}-page`).classList.add('active');
    
    currentPage = pageName;
    
    // Trigger map resize if needed
    setTimeout(() => {
        if (map && map.invalidateSize) {
            map.invalidateSize();
        }
        if (dashboardMap && dashboardMap.invalidateSize) {
            dashboardMap.invalidateSize();
        }
        if (pageName === 'map') {
            updateMapStatus();
        }
    }, 150);
}

// Center map
function centerMap() {
    if (map) {
        map.setView([19.08, 72.88], 13);
    }
    if (dashboardMap) {
        dashboardMap.setView([19.08, 72.88], 12);
    }
}

// Toggle map layer
function toggleMapLayer() {
    if (map) {
        const currentType = map.getMapTypeId ? map.getMapTypeId() : 'roadmap';
        // Leaflet uses tile layers, so we toggle between different tile providers
        console.log('Map layer toggle (no-op for Leaflet - using OpenStreetMap)');
    }
}

// Zoom map in or out
function zoomMap(direction) {
    if (map) {
        const currentZoom = map.getZoom();
        map.setZoom(currentZoom + direction);
    }
}

// Update map status overlay
function updateMapStatus() {
    const faultCount = Object.values(dispatchedEngineers).length;
    const activeEngineers = Object.keys(dispatchedEngineers).length;
    
    const statusModulesEl = document.getElementById('statusModules');
    const statusFaultsEl = document.getElementById('statusFaults');
    const statusEngineersEl = document.getElementById('statusEngineers');
    const statusSystemEl = document.getElementById('statusSystem');
    
    if (statusModulesEl) statusModulesEl.textContent = Object.keys(modules).length;
    if (statusFaultsEl) {
        statusFaultsEl.textContent = faultCount;
        statusFaultsEl.className = faultCount > 0 ? 'status-item-value danger' : 'status-item-value success';
    }
    if (statusEngineersEl) statusEngineersEl.textContent = engineers.length;
    if (statusSystemEl) {
        statusSystemEl.textContent = socket.connected ? 'Online' : 'Offline';
        statusSystemEl.className = socket.connected ? 'status-item-value success' : 'status-item-value danger';
    }
}

// Load engineers
function loadEngineers() {
    const engineersList = document.getElementById('engineersList');
    engineersList.innerHTML = engineers.map(eng => `
        <div class="engineer-card" onclick="selectEngineer(${eng.id})">
            <div class="engineer-name">${eng.name}</div>
            <div class="engineer-info">
                <div><strong>ID:</strong> ${eng.id}</div>
                <div><strong>Phone:</strong> ${eng.phone}</div>
                <div><strong>Email:</strong> ${eng.email}</div>
                <span class="engineer-badge">${eng.specialization}</span>
            </div>
        </div>
    `).join('');
}

// Filter engineers
function filterEngineers() {
    const searchTerm = document.getElementById('engineerSearch').value.toLowerCase();
    const cards = document.querySelectorAll('.engineer-card');
    
    cards.forEach(card => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

// Select engineer
function selectEngineer(engineerId) {
    const engineer = engineers.find(e => e.id === engineerId);
    if (engineer) {
        alert(`Selected: ${engineer.name}\nLocation: ${engineer.lat}, ${engineer.lng}\nPhone: ${engineer.phone}`);
    }
}

// Update system status
function updateSystemStatus(isOnline) {
    const statusEl = document.getElementById('systemStatus');
    if (isOnline) {
        statusEl.textContent = 'System: Online';
        statusEl.style.color = '#28a745';
    } else {
        statusEl.textContent = 'System: Offline';
        statusEl.style.color = '#dc3545';
    }
}

// Handle map unavailable
function handleMapUnavailable() {
    const mapElements = ['map', 'dashboard-map'];
    mapElements.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.innerHTML = `
                <div class="map-unavailable">
                    <i class="ti ti-map-off"></i>
                    <h3>Map Unavailable</h3>
                    <p>Google Maps API is not available or key is invalid</p>
                    <p style="font-size: 11px; margin-top: 8px; opacity: 0.7;">Check browser console for details</p>
                </div>
            `;
            el.style.background = 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)';
        }
    });
    console.log('Map unavailable message displayed');
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Initialise when page loads

// Simulate fault by POSTing to server endpoint
async function simulateFault(ip) {
    if (!ip) return alert('Please provide an IP to simulate');
    try {
        await fetch('/report-fault', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip })
        });
    } catch (err) {
        console.error('Simulate fault failed', err);
        alert('Failed to send simulate request — check server logs');
    }
}

// Hook for the UI button
function simulateFaultFromUI() {
    const ip = document.getElementById('simIp').value.trim();
    simulateFault(ip);
}

window.onload = init;
