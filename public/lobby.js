// Dropin lobby — lists every station (live now-playing + listener counts) and
// lets you spin up a new one. Each station lives at /<slug>. Entering or creating
// a station requires an identity (nickname + avatar) first.

const stationList = document.getElementById('stationList');
const emptyState = document.getElementById('emptyState');
const addStationBtn = document.getElementById('addStationBtn');
const stationModal = document.getElementById('stationModal');
const stationForm = document.getElementById('stationForm');
const stationNameInput = document.getElementById('stationNameInput');
const stationPublicInput = document.getElementById('stationPublicInput');
const stationCancel = document.getElementById('stationCancel');
const toastEl = document.getElementById('toast');

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------
let toastTimer = null;
function showToast(message, isError) {
  toastEl.textContent = message;
  toastEl.classList.toggle('error', !!isError);
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3200);
}

// ---------------------------------------------------------------------------
// Render the station grid
// ---------------------------------------------------------------------------
function stationCard(s) {
  const card = document.createElement('a');
  card.className = 'station-card card';
  card.href = `/${encodeURIComponent(s.slug)}`;
  card.addEventListener('click', (e) => {
    e.preventDefault();
    // Only logged-in users may enter a station.
    Profile.require(() => {
      location.href = card.href;
    });
  });

  const head = document.createElement('div');
  head.className = 'station-head';
  const titleWrap = document.createElement('div');
  titleWrap.className = 'station-title-wrap';
  const name = document.createElement('span');
  name.className = 'station-name';
  name.textContent = s.name;
  titleWrap.appendChild(name);
  if (s.id) {
    const id = document.createElement('span');
    id.className = 'station-id';
    id.textContent = `#${s.id}`;
    id.title = 'Station id';
    titleWrap.appendChild(id);
  }
  if (s.createdBy && s.createdBy.nick) {
    const by = document.createElement('span');
    by.className = 'station-by';
    by.textContent = `by ${s.createdBy.nick}`;
    titleWrap.appendChild(by);
  }
  const listeners = document.createElement('span');
  listeners.className = 'station-listeners';
  listeners.textContent = `🎧 ${s.listeners}`;
  listeners.title = `${s.listeners} listening now`;
  head.append(titleWrap, listeners);

  const now = document.createElement('div');
  now.className = 'station-now';
  if (s.current) {
    const label = document.createElement('span');
    label.className = 'station-now-label';
    label.textContent = '▶';
    const title = document.createElement('span');
    title.className = 'station-now-title';
    title.textContent = s.current.title;
    now.append(label, title);
  } else {
    now.classList.add('idle');
    now.textContent = 'Idle — nothing playing';
  }

  const meta = document.createElement('div');
  meta.className = 'station-meta';
  meta.textContent = s.queueLength
    ? `${s.queueLength} in queue`
    : 'Queue empty';

  card.append(head, now, meta);
  return card;
}

function renderStations(list) {
  stationList.innerHTML = '';
  if (!list.length) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');
  list.forEach((s) => stationList.appendChild(stationCard(s)));
}

// ---------------------------------------------------------------------------
// Live updates via WebSocket (lobby channel)
// ---------------------------------------------------------------------------
let ws = null;
function connectWs() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}/ws?station=${encodeURIComponent('__lobby__')}`);
  ws.addEventListener('message', (ev) => {
    const data = JSON.parse(ev.data);
    if (data.type === 'lobby') renderStations(data.stations);
  });
  ws.addEventListener('close', () => setTimeout(connectWs, 2000));
}

// ---------------------------------------------------------------------------
// Create a station
// ---------------------------------------------------------------------------
function openStationModal() {
  stationNameInput.value = '';
  stationPublicInput.checked = true;
  stationModal.classList.remove('hidden');
  stationNameInput.focus();
}
function closeStationModal() {
  stationModal.classList.add('hidden');
}

addStationBtn.addEventListener('click', () => {
  // Require identity before creating (and then entering) a station.
  Profile.require(openStationModal);
});
stationCancel.addEventListener('click', closeStationModal);
stationModal.addEventListener('click', (e) => {
  if (e.target === stationModal) closeStationModal();
});

stationForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = stationNameInput.value.trim();
  if (!name) {
    showToast('Please enter a station name.', true);
    return;
  }
  try {
    const p = Profile.load();
    const res = await fetch('/api/stations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        isPublic: stationPublicInput.checked,
        nick: p ? p.nick : '',
        avatar: p ? p.avatar : '',
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Could not create station.', true);
      return;
    }
    location.href = `/${data.slug}`;
  } catch {
    showToast('Network error.', true);
  }
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
Profile.renderChip();
// Ask first-time visitors for a nickname + avatar right away.
if (!Profile.load()) Profile.open();
fetch('/api/stations')
  .then((r) => r.json())
  .then(renderStations)
  .catch(() => {});
connectWs();
