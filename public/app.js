// Dropin station client — synchronized YouTube player for one station.
//
// The server is the conductor: it tells every client tuned to THIS station which
// video is playing and exactly when it started. Each browser embeds the YouTube
// IFrame player and seeks to the shared position, so everyone watches/listens in
// sync. New joiners jump straight to the current spot.
//
// The station is identified by the first path segment, e.g. /chill-vibes.
// Identity (nickname + avatar) is handled by the shared Profile module.

// Which station is this page? First URL path segment, e.g. "/chill-vibes".
const STATION_SLUG = decodeURIComponent(location.pathname.replace(/^\/+/, '').split('/')[0] || '');
if (!STATION_SLUG) {
  // No station in the URL — back to the lobby.
  location.href = '/';
}
const API = `/api/stations/${encodeURIComponent(STATION_SLUG)}`;

const joinBtn = document.getElementById('joinBtn');
const skipBtn = document.getElementById('skipBtn');
const nowPlaying = document.getElementById('nowPlaying');
const nowBy = document.getElementById('nowBy');
const stationNameEl = document.getElementById('stationName');
const playlistEl = document.getElementById('playlist');
const queueCount = document.getElementById('queueCount');
const addForm = document.getElementById('addForm');
const urlInput = document.getElementById('urlInput');
const addPlaylistBtn = document.getElementById('addPlaylistBtn');
const addProgress = document.getElementById('addProgress');
const toast = document.getElementById('toast');

// Add-section tabs + search
const tabSearch = document.getElementById('tabSearch');
const tabLink = document.getElementById('tabLink');
const searchForm = document.getElementById('searchForm');
const searchInput = document.getElementById('searchInput');
const searchSuggestions = document.getElementById('searchSuggestions');

// ---------------------------------------------------------------------------
// Shared-timeline state
// ---------------------------------------------------------------------------
let ws = null;
let player = null;
let playerReady = false;
let joined = false; // has the user tapped (so we may play with sound)?

// Latest "now playing" info from the server.
let currentVideoId = null; // what the server says should play
let loadedVideoId = null; // what the local player currently has loaded
let erroredVideoId = null; // last video the player refused to play (report once)
let startedAt = 0; // server epoch ms when the current song began
let clockOffset = 0; // (client clock - server clock), ms

/** Expected playback position (seconds) for the current song, right now. */
function expectedPosition() {
  if (!startedAt) return 0;
  return Math.max(0, (Date.now() - clockOffset - startedAt) / 1000);
}

// ---------------------------------------------------------------------------
// YouTube IFrame API
// ---------------------------------------------------------------------------
(function loadYouTubeApi() {
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);
})();

window.onYouTubeIframeAPIReady = function () {
  player = new YT.Player('player', {
    width: '100%',
    height: '100%',
    playerVars: {
      autoplay: 0,
      controls: 1,
      rel: 0,
      modestbranding: 1,
      playsinline: 1,
    },
    events: {
      onReady: () => {
        playerReady = true;
        applyCurrent();
      },
      onStateChange: (e) => {
        // When the local video ends, nudge the server to advance.
        if (e.data === YT.PlayerState.ENDED && ws && currentVideoId) {
          ws.send(JSON.stringify({ type: 'ended', videoId: currentVideoId }));
        }
      },
      onError: (e) => {
        // The player can't show this video. Codes 101/150 mean the owner
        // disabled embedding (the "Video unavailable / Watch on YouTube"
        // screen); 100 means removed/private; 2/5 are bad-parameter/HTML5
        // errors. In every case this video won't play here, so nudge the
        // server to advance past it (same path as the 'ended' fallback).
        // Guard so each dud is reported only once.
        if (!currentVideoId || currentVideoId === erroredVideoId) return;
        erroredVideoId = currentVideoId;
        const embedBlocked = e.data === 101 || e.data === 150;
        showToast(
          embedBlocked
            ? 'That video blocks embedding — skipping.'
            : 'Video unavailable — skipping.',
          true
        );
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ended', videoId: currentVideoId }));
        }
      },
    },
  });
};

/** Load / seek the local player to match the server timeline. */
function applyCurrent() {
  if (!playerReady) return;

  if (!currentVideoId) {
    loadedVideoId = null;
    try {
      player.stopVideo();
    } catch {
      /* noop */
    }
    return;
  }

  const pos = expectedPosition();

  if (currentVideoId !== loadedVideoId) {
    loadedVideoId = currentVideoId;
    player.loadVideoById({ videoId: currentVideoId, startSeconds: pos });
    // Before the user has interacted, autoplay-with-sound is blocked, so play
    // muted just to stay visually in sync; tapping "join" unmutes.
    if (!joined) player.mute();
  } else {
    correctDrift();
  }
}

/** Re-seek if the local player has drifted from the shared position. */
function correctDrift() {
  if (!playerReady || !currentVideoId) return;
  try {
    const expected = expectedPosition();
    const actual = player.getCurrentTime();
    if (Math.abs(actual - expected) > 1.5) {
      player.seekTo(expected, true);
    }
  } catch {
    /* player not ready for these calls yet */
  }
}

setInterval(correctDrift, 3000);

// ---------------------------------------------------------------------------
// Join (user gesture unlocks audio)
// ---------------------------------------------------------------------------
joinBtn.addEventListener('click', () => {
  joined = true;
  joinBtn.classList.add('hidden');
  if (playerReady && currentVideoId) {
    try {
      player.unMute();
      player.setVolume(100);
      player.seekTo(expectedPosition(), true);
      player.playVideo();
    } catch {
      /* noop */
    }
  }
});

skipBtn.addEventListener('click', () => {
  const p = Profile.load();
  fetch(`${API}/skip`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nick: p ? p.nick : '', avatar: p ? p.avatar : '' }),
  }).catch(() => {});
});

// ---------------------------------------------------------------------------
// State rendering
// ---------------------------------------------------------------------------
function renderState(state) {
  clockOffset = Date.now() - state.serverNow;

  if (state.station) {
    stationNameEl.textContent = state.station.name;
    document.title = `${state.station.name} — DropIn`;
  }

  if (state.current) {
    currentVideoId = state.current.videoId;
    startedAt = state.current.startedAt;
    nowPlaying.textContent = state.current.title;
    const by = state.current.addedBy;
    nowBy.textContent = by && by.nick ? `${by.avatar || ''} added by ${by.nick}` : '';
    skipBtn.classList.remove('hidden');
    joinBtn.textContent = '▶ Tap to join';
  } else {
    currentVideoId = null;
    startedAt = 0;
    nowPlaying.textContent = 'Nothing playing yet';
    nowBy.textContent = '';
    skipBtn.classList.add('hidden');
  }
  applyCurrent();

  // FLIP: remember each row's current position so we can animate the reorder.
  const oldPos = new Map();
  playlistEl.querySelectorAll('li[data-id]').forEach((li) => {
    oldPos.set(li.dataset.id, li.getBoundingClientRect().top);
  });

  playlistEl.innerHTML = '';
  if (!state.playlist.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'The playlist is empty. Add a song!';
    playlistEl.appendChild(li);
  } else {
    state.playlist.forEach((song, i) => {
      const li = document.createElement('li');
      li.dataset.id = song.id;

      const avatar = document.createElement('span');
      avatar.className = 'track-avatar';
      avatar.textContent = (song.addedBy && song.addedBy.avatar) || '🎵';

      const main = document.createElement('div');
      main.className = 'track-main';

      const title = document.createElement('span');
      title.className = 'track-title';
      title.textContent = song.title;

      const by = document.createElement('span');
      by.className = 'track-by';
      by.textContent = song.addedBy && song.addedBy.nick ? `added by ${song.addedBy.nick}` : '';

      main.append(title, by);

      const controls = document.createElement('div');
      controls.className = 'track-controls';

      const up = document.createElement('button');
      up.className = 'move-btn';
      up.textContent = '▲';
      up.title = 'Move up';
      up.disabled = i === 0;
      up.addEventListener('click', () => moveSong(song.id, 'up'));

      const down = document.createElement('button');
      down.className = 'move-btn';
      down.textContent = '▼';
      down.title = 'Move down';
      down.disabled = i === state.playlist.length - 1;
      down.addEventListener('click', () => moveSong(song.id, 'down'));

      const remove = document.createElement('button');
      remove.className = 'remove-btn';
      remove.textContent = '🗑';
      remove.title = 'Remove from playlist';
      remove.addEventListener('click', () => removeSong(song.id));

      controls.append(up, down, remove);
      li.append(avatar, main, controls);
      playlistEl.appendChild(li);
    });
  }
  queueCount.textContent = String(state.playlist.length);

  // Populate chat + activity feeds once per (re)connection; live updates arrive
  // as separate 'chat'/'action' messages afterwards.
  if (!feedsInitialized) {
    renderChat(state.chat || []);
    renderActions(state.actions || []);
    feedsInitialized = true;
  }

  // FLIP: animate each row from its old position to the new one.
  playlistEl.querySelectorAll('li[data-id]').forEach((li) => {
    const from = oldPos.get(li.dataset.id);
    if (from === undefined) {
      // Newly added row: gentle fade/slide in.
      li.classList.add('track-enter');
      requestAnimationFrame(() => li.classList.remove('track-enter'));
      return;
    }
    const delta = from - li.getBoundingClientRect().top;
    if (!delta) return;
    li.style.transition = 'none';
    li.style.transform = `translateY(${delta}px)`;
    requestAnimationFrame(() => {
      li.style.transition = 'transform 0.32s cubic-bezier(0.2, 0.8, 0.2, 1)';
      li.style.transform = '';
    });
  });
}

/** Ask the server to move a queued song up or down. */
function moveSong(id, dir) {
  fetch(`${API}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, dir }),
  }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Remove a song
// ---------------------------------------------------------------------------
/** Ask the server to remove a queued song immediately. */
function removeSong(id) {
  const p = Profile.load();
  fetch(`${API}/remove`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, nick: p ? p.nick : '', avatar: p ? p.avatar : '' }),
  }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Toast notifications
// ---------------------------------------------------------------------------
let toastTimer = null;
function showToast(message, isError) {
  toast.textContent = message;
  toast.classList.toggle('error', !!isError);
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}
// Let the shared Profile module reuse this nicer toast.
window.showToast = showToast;

// ---------------------------------------------------------------------------
// Share this station's link
// ---------------------------------------------------------------------------
const shareBtn = document.getElementById('shareBtn');
if (shareBtn) {
  shareBtn.addEventListener('click', async () => {
    const url = location.href;
    const title = (stationNameEl && stationNameEl.textContent) || 'DropIn station';
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      showToast('Station link copied to clipboard.');
    } catch (err) {
      // A share sheet the user dismisses rejects with AbortError — ignore it.
      if (err && err.name === 'AbortError') return;
      // Clipboard API can be blocked (insecure origin); fall back to a prompt.
      window.prompt('Copy this station link:', url);
    }
  });
}

// ---------------------------------------------------------------------------
// WebSocket: live playlist + notifications for THIS station
// ---------------------------------------------------------------------------
function connectWs() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}/ws?station=${encodeURIComponent(STATION_SLUG)}`);

  ws.addEventListener('message', (ev) => {
    const data = JSON.parse(ev.data);
    if (data.type === 'state') {
      renderState(data);
    } else if (data.type === 'notice') {
      showToast(data.message, data.event === 'error');
      // A song finished resolving (or failed) — stop one pending progress bar.
      if (data.event === 'added' || data.event === 'error') resolveAddProgress();
    } else if (data.type === 'chat') {
      appendChat(data.message);
    } else if (data.type === 'action') {
      appendAction(data.action);
    }
  });

  ws.addEventListener('close', () => {
    feedsInitialized = false;
    setTimeout(connectWs, 2000);
  });
}

// ---------------------------------------------------------------------------
// Add song
// ---------------------------------------------------------------------------
// Number of songs this client is currently waiting on. The progress bar stays
// visible and animating until each pending add lands in the playlist (or fails).
let pendingAdds = 0;
let addWatchdog = null;

function showAddProgress() {
  pendingAdds += 1;
  addProgress.classList.remove('hidden');
  // Safety net: if an 'added'/'error' notice is ever missed, don't hang forever.
  clearTimeout(addWatchdog);
  addWatchdog = setTimeout(() => {
    pendingAdds = 0;
    addProgress.classList.add('hidden');
  }, 60000);
}

function resolveAddProgress() {
  if (pendingAdds === 0) return;
  pendingAdds -= 1;
  if (pendingAdds === 0) {
    addProgress.classList.add('hidden');
    clearTimeout(addWatchdog);
  }
}

async function submitAdd(payload) {
  const profile = Profile.load();
  const formEl = payload.query ? searchForm : addForm;
  const btns = formEl.querySelectorAll('button');
  btns.forEach((b) => (b.disabled = true));
  // Show the bar immediately (before awaiting) so it is already counted when the
  // server's fast 'added' broadcast arrives for cached songs.
  showAddProgress();
  try {
    const res = await fetch(`${API}/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        nick: profile ? profile.nick : '',
        avatar: profile ? profile.avatar : '',
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Failed to add song.', true);
      resolveAddProgress(); // server rejected it; no 'added'/'error' will come.
    } else if (payload.query) {
      searchInput.value = '';
    } else {
      urlInput.value = '';
    }
  } catch {
    showToast('Network error.', true);
    resolveAddProgress();
  } finally {
    btns.forEach((b) => (b.disabled = false));
  }
}

addForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const url = urlInput.value.trim();
  if (!url) return;
  requireProfileThen({ url });
});

addPlaylistBtn.addEventListener('click', () => {
  const url = urlInput.value.trim();
  if (!url) {
    showToast('Paste a YouTube playlist link first.', true);
    urlInput.focus();
    return;
  }
  requireProfileThen({ url, playlist: true });
});

searchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const query = searchInput.value.trim();
  if (!query) return;
  hideSuggestions();
  requireProfileThen({ query });
});

/** Ensure the user has a profile, then add the given payload. */
function requireProfileThen(payload) {
  Profile.require(() => submitAdd(payload));
}

// ---------------------------------------------------------------------------
// Add-section tabs
// ---------------------------------------------------------------------------
function selectTab(which) {
  const search = which === 'search';
  tabSearch.classList.toggle('active', search);
  tabLink.classList.toggle('active', !search);
  searchForm.classList.toggle('hidden', !search);
  addForm.classList.toggle('hidden', search);
  hideSuggestions();
}
tabSearch.addEventListener('click', () => selectTab('search'));
tabLink.addEventListener('click', () => selectTab('link'));

// ---------------------------------------------------------------------------
// Search-as-you-type suggestions
// ---------------------------------------------------------------------------
let suggestTimer = null;
let suggestAbort = null;

function hideSuggestions() {
  searchSuggestions.classList.add('hidden');
  searchSuggestions.innerHTML = '';
}

function renderSuggestions(items) {
  searchSuggestions.innerHTML = '';
  if (!items.length) {
    hideSuggestions();
    return;
  }
  items.forEach((text) => {
    const li = document.createElement('li');
    li.className = 'suggestion';
    li.textContent = text;
    li.addEventListener('mousedown', (e) => {
      e.preventDefault(); // keep focus / avoid blur race
      searchInput.value = text;
      hideSuggestions();
      searchInput.focus();
    });
    searchSuggestions.appendChild(li);
  });
  searchSuggestions.classList.remove('hidden');
}

async function fetchSuggestions(q) {
  if (suggestAbort) suggestAbort.abort();
  suggestAbort = new AbortController();
  try {
    const res = await fetch(`/api/suggest?q=${encodeURIComponent(q)}`, {
      signal: suggestAbort.signal,
    });
    if (!res.ok) return;
    const items = await res.json();
    if (searchInput.value.trim()) renderSuggestions(items);
  } catch {
    /* aborted or offline — ignore */
  }
}

searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim();
  clearTimeout(suggestTimer);
  if (!q) {
    hideSuggestions();
    return;
  }
  suggestTimer = setTimeout(() => fetchSuggestions(q), 180);
});

searchInput.addEventListener('blur', () => setTimeout(hideSuggestions, 120));

// ---------------------------------------------------------------------------
// Side drawers: activity log (left) + chat (right)
// ---------------------------------------------------------------------------
const FEED_MAX = 60;
let feedsInitialized = false;

const actionsDrawer = document.getElementById('actionsDrawer');
const chatDrawer = document.getElementById('chatDrawer');
const actionsToggle = document.getElementById('actionsToggle');
const chatToggle = document.getElementById('chatToggle');
const actionsList = document.getElementById('actionsList');
const chatList = document.getElementById('chatList');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');

function scrolledToBottom(el) {
  return el.scrollHeight - el.scrollTop - el.clientHeight < 40;
}

function actionItemEl(a) {
  const li = document.createElement('li');
  li.className = 'log-item';
  const av = document.createElement('span');
  av.className = 'log-avatar';
  av.textContent = a.avatar || '•';
  const text = document.createElement('span');
  text.className = 'log-text';
  const who = document.createElement('strong');
  who.textContent = a.nick || 'Someone';
  text.append(who, document.createTextNode(` ${a.text}`));
  li.append(av, text);
  return li;
}

function renderActions(list) {
  actionsList.innerHTML = '';
  list.forEach((a) => actionsList.appendChild(actionItemEl(a)));
  actionsList.scrollTop = actionsList.scrollHeight;
}

function appendAction(a) {
  const stick = scrolledToBottom(actionsList);
  actionsList.appendChild(actionItemEl(a));
  while (actionsList.children.length > FEED_MAX) actionsList.removeChild(actionsList.firstChild);
  if (stick) actionsList.scrollTop = actionsList.scrollHeight;
}

function chatItemEl(m) {
  const li = document.createElement('li');
  li.className = 'chat-item';
  const av = document.createElement('span');
  av.className = 'chat-avatar';
  av.textContent = m.avatar || '🎧';
  const body = document.createElement('div');
  body.className = 'chat-body';
  const nick = document.createElement('span');
  nick.className = 'chat-nick';
  nick.textContent = m.nick || 'Anon';
  const text = document.createElement('span');
  text.className = 'chat-text';
  text.textContent = m.text;
  body.append(nick, text);
  li.append(av, body);
  return li;
}

function renderChat(list) {
  chatList.innerHTML = '';
  list.forEach((m) => chatList.appendChild(chatItemEl(m)));
  chatList.scrollTop = chatList.scrollHeight;
}

function appendChat(m) {
  const stick = scrolledToBottom(chatList);
  chatList.appendChild(chatItemEl(m));
  while (chatList.children.length > FEED_MAX) chatList.removeChild(chatList.firstChild);
  if (stick) chatList.scrollTop = chatList.scrollHeight;
}

const DRAWER_KEY = 'dropin.drawers';
function loadDrawerState() {
  try {
    return JSON.parse(localStorage.getItem(DRAWER_KEY)) || {};
  } catch {
    return {};
  }
}
function saveDrawerState(s) {
  localStorage.setItem(DRAWER_KEY, JSON.stringify(s));
}
function setDrawer(drawer, open) {
  drawer.classList.toggle('collapsed', !open);
}

const drawerState = loadDrawerState();
setDrawer(actionsDrawer, !!drawerState.actions);
setDrawer(chatDrawer, !!drawerState.chat);

actionsToggle.addEventListener('click', () => {
  const open = actionsDrawer.classList.contains('collapsed');
  setDrawer(actionsDrawer, open);
  drawerState.actions = open;
  saveDrawerState(drawerState);
});

chatToggle.addEventListener('click', () => {
  const open = chatDrawer.classList.contains('collapsed');
  setDrawer(chatDrawer, open);
  drawerState.chat = open;
  saveDrawerState(drawerState);
  if (open) {
    chatInput.focus();
    chatList.scrollTop = chatList.scrollHeight;
  }
});

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  const profile = Profile.load();
  if (!profile) {
    showToast('Set your nickname first.', true);
    Profile.open();
    return;
  }
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'chat', text, nick: profile.nick, avatar: profile.avatar }));
    chatInput.value = '';
  } else {
    showToast('Not connected — try again.', true);
  }
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
Profile.renderChip();
// Ask first-time users for a nickname + avatar right away (required to take part).
if (!Profile.load()) Profile.open();

// Validate the station exists; if not, send the user back to the lobby.
fetch(`${API}/state`)
  .then((r) => {
    if (!r.ok) {
      location.href = '/';
      return null;
    }
    return r.json();
  })
  .then((state) => {
    if (state) {
      renderState(state);
      connectWs();
    }
  })
  .catch(() => {});
