// --- Initialize Leaflet Map ---
const map = L.map('map').setView([11.5, 124.0], 8);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// --- Store devices, markers, and paths ---
let markers = {};
let paths = {};
let currentDeviceId = null;

// --- Helper: random color for path ---
function getRandomColor() {
  return '#' + Math.floor(Math.random() * 16777215).toString(16);
}

// --- Add or update device marker ---
function updateDeviceMarker(id, name, lat, lng, status = "OFFLINE") {
  if (!markers[id]) {
    markers[id] = L.marker([lat, lng]).addTo(map)
      .bindPopup(`<b>${name}</b><br>Latitude: ${lat.toFixed(6)}<br>Longitude: ${lng.toFixed(6)}<br>Status: ${status}`);
    paths[id] = L.polyline([[lat, lng]], { color: getRandomColor() }).addTo(map);
  } else {
    markers[id].setLatLng([lat, lng]);
    const latlngs = paths[id].getLatLngs();
    latlngs.push([lat, lng]);
    paths[id].setLatLngs(latlngs);
    markers[id].getPopup().setContent(`<b>${name}</b><br>Latitude: ${lat.toFixed(6)}<br>Longitude: ${lng.toFixed(6)}<br>Status: ${status}`);
  }
}

// --- Device Registration ---
const registerBtn = document.getElementById('registerBtn');
const deviceSelect = document.getElementById('deviceSelect');

registerBtn.addEventListener('click', () => {
  const deviceId = document.getElementById('deviceId').value.trim();
  const deviceName = document.getElementById('deviceName').value.trim();

  if (!deviceId || !deviceName) return alert('Please enter both Device ID and Name.');

  if ([...deviceSelect.options].some(opt => opt.value === deviceId)) return alert('Device ID already registered.');

  const option = document.createElement('option');
  option.value = deviceId;
  option.textContent = deviceName;
  deviceSelect.appendChild(option);

  updateDeviceMarker(deviceId, deviceName, 11.5, 124.0, "OFFLINE");

  document.getElementById('deviceId').value = '';
  document.getElementById('deviceName').value = '';
});

// --- Select device from dropdown ---
deviceSelect.addEventListener('change', e => {
  currentDeviceId = e.target.value;
  if (currentDeviceId && markers[currentDeviceId]) {
    map.setView(markers[currentDeviceId].getLatLng(), 14);
    markers[currentDeviceId].openPopup();
  }
});

// --- Fetch all devices and update markers/status ---
async function fetchAllDevices() {
  try {
    const res = await fetch('/tracker/latest'); // Endpoint returns all devices as object
    const devices = await res.json();

    devices.forEach(device => {
      updateDeviceMarker(device.deviceId, device.name, device.lat, device.lng, device.status);

      // Update selected device status card
      if (device.deviceId === currentDeviceId) {
        document.getElementById("gforce").innerText = device.gforce;
        document.getElementById("gyro").innerText = device.gyro;
        document.getElementById("last").innerText = new Date(device.timestamp).toLocaleString();
        const statusIndicator = document.querySelector(".status-indicator");
        statusIndicator.className = `status-indicator ${device.status === "ONLINE" ? "status-online" : "status-offline"}`;
        document.getElementById("conn").innerText = device.status || "OFFLINE";
      }
    });
  } catch (e) {
    console.error('Error fetching devices:', e);
  }
}

// --- Fetch crash history ---
async function fetchCrashHistory() {
  if (!currentDeviceId) return;
  try {
    const res = await fetch(`/tracker/history?deviceId=${currentDeviceId}`);
    const history = await res.json();
    const tbody = document.getElementById("crashTableBody");
    if (history.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="border border-gray-300 px-4 py-2 text-center text-gray-500">No crash history available</td></tr>';
      return;
    }
    tbody.innerHTML = history.map(crash => `
      <tr>
        <td class="border border-gray-300 px-4 py-2">${new Date(crash.timestamp).toLocaleString()}</td>
        <td class="border border-gray-300 px-4 py-2">${crash.lat.toFixed(6)}, ${crash.lng.toFixed(6)}</td>
        <td class="border border-gray-300 px-4 py-2">${crash.gforce}</td>
        <td class="border border-gray-300 px-4 py-2">${crash.gyro}</td>
      </tr>
    `).join('');
  } catch (e) { console.error(e); }
}

// --- Crash notification ---
function showCrashNotification(device) {
  const notification = document.getElementById("crashNotification");
  const deviceName = deviceSelect.querySelector(`option[value="${device.deviceId}"]`)?.textContent || device.deviceId;
  notification.innerHTML = `<i class="fas fa-exclamation-triangle mr-2"></i>CRASH DETECTED on ${deviceName}!`;
  notification.classList.remove("hidden");
  setTimeout(() => notification.classList.add("hidden"), 10000);

  if (Notification.permission === "granted") {
    new Notification("Crash Alert", { body: `Motorcycle crash detected on ${deviceName}!` });
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission();
  }
}

// --- Logout ---
document.getElementById("logoutBtn")?.addEventListener("click", () => {
  sessionStorage.removeItem("user");
  window.location = "/";
});

// --- Update clock ---
setInterval(() => {
  document.getElementById("currentTime").innerText = new Date().toLocaleString();
}, 1000);

// --- Real-time updates ---
setInterval(fetchAllDevices, 2000);
setInterval(fetchCrashHistory, 5000);

// --- Initial load ---
window.onload = () => {
  if (deviceSelect.options.length > 1) {
    deviceSelect.selectedIndex = 1;
    currentDeviceId = deviceSelect.value;
  }
  fetchAllDevices();
  fetchCrashHistory();
};
