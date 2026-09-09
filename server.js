/**
 * DropiIn - a shared network jukebox (synchronized YouTube player).
 *
 * How it works:
 *  - Serves a web page on port 8080.
 *  - Any client on the network can paste a YouTube URL to add a song.
 *  - The server keeps a shared playlist and an authoritative "now playing"
 *    timeline (which video + when it started). It does NOT download anything;
 *    each client's browser embeds the YouTube player and seeks to the shared
 *    position, so everyone watches/listens in sync.
 *  - Songs auto-advance when they finish, while the playlist is not empty.
 *
 * Only lightweight metadata (title + duration) is fetched via yt-dlp, which
 * works even on networks where media downloads are blocked.
 */

const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const https = require('https');
const { execFileSync } = require('child_process');
const { WebSocketServer } = require('ws');
const { create: createYoutubeDl } = require('youtube-dl-exec');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const PORT = 8080;
const CACHE_FILE = path.join(__dirname, 'cache.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

// ---------------------------------------------------------------------------
// Binary discovery (yt-dlp)
//
// The bundled yt-dlp binary can fail to download behind restrictive proxies, so
// we locate a real binary by checking (in order): an explicit env override,
// common per-OS install locations, and finally the system PATH. Only metadata
// is fetched (no media download), so ffmpeg is not required.
// ---------------------------------------------------------------------------
const IS_WINDOWS = process.platform === 'win32';

/** Executable file name for the current platform ("yt-dlp" vs "yt-dlp.exe"). */
function exeName(base) {
  return IS_WINDOWS ? `${base}.exe` : base;
}

function searchDir(root, name, maxDepth) {
  if (maxDepth < 0 || !fs.existsSync(root)) return null;
  let entries;
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isFile() && entry.name.toLowerCase() === name.toLowerCase()) {
      return full;
    }
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const found = searchDir(path.join(root, entry.name), name, maxDepth - 1);
      if (found) return found;
    }
  }
  return null;
}

function discoverBinary(base, envVar) {
  const target = exeName(base);

  // 1. Explicit environment override
  const override = process.env[envVar];
  if (override && fs.existsSync(override)) {
    return override;
  }

  // 2. Binary bundled with this application
  const bundled = path.join(__dirname, 'bin', target);
  if (fs.existsSync(bundled)) {
    return bundled;
  }

  // 3. Common system locations
  const home = os.homedir();

  const roots = IS_WINDOWS
    ? [
        path.join(home, 'AppData', 'Local', 'Microsoft', 'WinGet', 'Packages'),
        path.join(home, 'scoop', 'apps'),
        'C:\\ProgramData\\chocolatey\\bin',
      ]
    : [
        '/usr/local/bin',
        '/usr/bin',
        '/bin',
        '/snap/bin',
        path.join(home, '.local', 'bin'),
        path.join(home, 'bin'),
      ];

  const depth = IS_WINDOWS ? 4 : 1;

  for (const root of roots) {
    const found = searchDir(root, target, depth);
    if (found) {
      return found;
    }
  }

  return null;
}

const YT_DLP_PATH = discoverBinary('yt-dlp', 'YT_DLP_PATH');
const YT_DLP_BIN = YT_DLP_PATH || exeName('yt-dlp');

// A youtube-dl-exec instance bound to the discovered (or PATH) yt-dlp binary.
const youtubedl = createYoutubeDl(YT_DLP_BIN);

// Confirm yt-dlp is actually installed and runnable before serving requests.
// Without it the server can't resolve any song metadata, so print a clear,
// actionable message instead of failing later on the first add.
function ytDlpVersion(bin) {
  try {
    return execFileSync(bin, ['--version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

const YT_DLP_VERSION = ytDlpVersion(YT_DLP_BIN);
if (YT_DLP_VERSION) {
  console.log(`yt-dlp : ${YT_DLP_BIN} (version ${YT_DLP_VERSION})`);
} else {
  console.error('yt-dlp : NOT FOUND — the server cannot fetch song metadata.');
  console.error('  Install it and/or set YT_DLP_PATH, for example:');
  if (IS_WINDOWS) {
    console.error('    winget install yt-dlp.yt-dlp');
  } else {
    console.error('    sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \\');
    console.error('      -o /usr/local/bin/yt-dlp && sudo chmod a+rx /usr/local/bin/yt-dlp');
    console.error('    # or:  pipx install yt-dlp   /   pip install -U yt-dlp');
  }
}

// Optional network/auth options for restricted environments. YouTube now often
// requires a signed-in session (PO token) to download media; the most reliable
// fix on a locked-down machine is a cookies.txt exported from your browser.
//   ./cookies.txt (auto)   OR  YTDLP_COOKIES_FILE=path/to/cookies.txt
//   YTDLP_PROXY            e.g. http://user:pass@proxy:8080
//   YTDLP_COOKIES_BROWSER  e.g. chrome | edge | firefox
//   YTDLP_PLAYER_CLIENT    e.g. android | web_safari | tv
const COOKIES_FILE =
  process.env.YTDLP_COOKIES_FILE ||
  (fs.existsSync(path.join(__dirname, 'cookies.txt'))
    ? path.join(__dirname, 'cookies.txt')
    : null);
if (COOKIES_FILE) console.log('cookies:', COOKIES_FILE);

const DOWNLOAD_NET_OPTS = {
  ...(COOKIES_FILE ? { cookies: COOKIES_FILE } : {}),
  ...(process.env.YTDLP_PROXY ? { proxy: process.env.YTDLP_PROXY } : {}),
  ...(process.env.YTDLP_COOKIES_BROWSER
    ? { cookiesFromBrowser: process.env.YTDLP_COOKIES_BROWSER }
    : {}),
  ...(process.env.YTDLP_PLAYER_CLIENT
    ? { extractorArgs: `youtube:player_client=${process.env.YTDLP_PLAYER_CLIENT}` }
    : {}),
};

// ---------------------------------------------------------------------------
// Persistent cache: youtube url -> { url, videoId, title, duration }
// ---------------------------------------------------------------------------
/** @type {Record<string, {url: string, videoId: string, title: string, duration: number}>} */
let cache = {};
if (fs.existsSync(CACHE_FILE)) {
  try {
    cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  } catch {
    cache = {};
  }
}
function saveCache() {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

// ---------------------------------------------------------------------------
// Stations — each is an isolated jukebox with its own playlist, authoritative
// timeline, chat and activity log. The lobby aggregates a light summary of all
// of them. Everything is in-memory (nothing persisted except the metadata
// cache), matching the single-station design this scaled up from.
// ---------------------------------------------------------------------------
/** @typedef {{nick: string, avatar: string}} AddedBy */
/** @typedef {{id: string, url: string, videoId: string, title: string, duration: number, addedBy: AddedBy}} Song */
/** @typedef {{id: string, nick: string, avatar: string, text: string, at: number}} FeedEntry */
/** @typedef {{name: string, slug: string, playlist: Song[], current: Song|null, startedAt: number, advanceTimer: any, chat: FeedEntry[], actions: FeedEntry[], createdAt: number}} Station */

const CHAT_MAX = 60;
const ACTION_MAX = 60;

// The lobby is not a real station; clients subscribe to it for the station list.
const LOBBY = '__lobby__';

// Slugs that must never become a station (they would shadow routes / assets).
const RESERVED_SLUGS = new Set([
  '', LOBBY, 'api', 'ws', 'app.js', 'lobby.js', 'profile.js',
  'style.css', 'index.html', 'station.html', 'favicon.ico',
]);

/**
 * Turn a human station name into a URL-safe slug:
 *   "Chill Vibes 🎧" -> "chill-vibes"
 */
function slugify(name) {
  return String(name)
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-') // non-alphanumeric -> hyphen
    .replace(/^-+|-+$/g, '') // trim leading/trailing hyphens
    .slice(0, 48);
}

/** @type {Map<string, Station>} */
const stations = new Map();

/** Generate a short, random station id (6 hex chars, e.g. "a1b2c3"). */
function stationId() {
  return crypto.randomBytes(3).toString('hex');
}

/**
 * Build a fresh, empty station from a display name. Each station gets a random
 * id that is folded into its slug (e.g. "chill-vibes-a1b2c3"), so two stations
 * may share the same display name while still having distinct, unique URLs.
 */
function createStation(name, isPublic = true) {
  const base = slugify(name);
  let id;
  let slug;
  do {
    id = stationId();
    slug = base ? `${base}-${id}` : id;
  } while (stations.has(slug) || RESERVED_SLUGS.has(slug));
  return {
    name: String(name).slice(0, 40),
    id,
    slug,
    isPublic: isPublic !== false, // private stations are hidden from the lobby
    playlist: [],
    current: null,
    startedAt: 0, // epoch ms when `current` began playing
    advanceTimer: null, // fires when the current song should end
    chat: [],
    actions: [],
    createdAt: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// WebSocket: push per-station state, and a lobby summary, to subscribed clients.
// Each socket records which station (or the lobby) it is tuned to on `ws`.
// ---------------------------------------------------------------------------
let wss = null;

/** Open WebSocket clients currently tuned to a given station slug. */
function stationClients(slug) {
  const out = [];
  if (!wss) return out;
  for (const ws of wss.clients) {
    if (ws.readyState === ws.OPEN && ws.stationSlug === slug) out.push(ws);
  }
  return out;
}

/** Number of active listeners (open sockets) on a station. */
function countListeners(slug) {
  return stationClients(slug).length;
}

/** Send a JSON object to every client tuned to one station. */
function sendToStation(slug, obj) {
  const msg = JSON.stringify(obj);
  for (const ws of stationClients(slug)) ws.send(msg);
}

function stateSnapshot(station) {
  return {
    type: 'state',
    station: { slug: station.slug, id: station.id, name: station.name },
    serverNow: Date.now(),
    current: station.current
      ? {
          id: station.current.id,
          videoId: station.current.videoId,
          title: station.current.title,
          url: station.current.url,
          duration: station.current.duration,
          startedAt: station.startedAt,
          addedBy: station.current.addedBy || null,
        }
      : null,
    playlist: station.playlist.map((s) => ({
      id: s.id,
      title: s.title,
      url: s.url,
      addedBy: s.addedBy || null,
    })),
    chat: station.chat,
    actions: station.actions,
  };
}

/** Broadcast a station's full state to its listeners, and refresh the lobby. */
function notifyState(station) {
  sendToStation(station.slug, stateSnapshot(station));
  broadcastLobby(); // now-playing / queue length may have changed
}

/** Send a transient notice (toast) to one station's listeners. */
function notify(station, event, message) {
  sendToStation(station.slug, { type: 'notice', event, message });
}

// ---------------------------------------------------------------------------
// Lobby — a light summary of every station (now-playing + listener counts).
// ---------------------------------------------------------------------------
function lobbySnapshot() {
  return {
    type: 'lobby',
    serverNow: Date.now(),
    stations: [...stations.values()]
      .filter((s) => s.isPublic) // private stations are reachable only by direct link
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((s) => ({
        slug: s.slug,
        id: s.id,
        name: s.name,
        listeners: countListeners(s.slug),
        queueLength: s.playlist.length,
        current: s.current ? { title: s.current.title, videoId: s.current.videoId } : null,
      })),
  };
}

/** Push the latest station list to every lobby client. */
function broadcastLobby() {
  if (!wss) return;
  const msg = JSON.stringify(lobbySnapshot());
  for (const ws of wss.clients) {
    if (ws.readyState === ws.OPEN && ws.isLobby) ws.send(msg);
  }
}

// ---------------------------------------------------------------------------
// Chat + action log — per-station, in-memory ring buffers (no persistence).
// Oldest entries are dropped once the cap is reached.
// ---------------------------------------------------------------------------
/** Normalize a user identity from a request/message body. */
function readActor(body) {
  return {
    nick: body && body.nick ? String(body.nick).slice(0, 24) : '',
    avatar: body && body.avatar ? String(body.avatar).slice(0, 8) : '',
  };
}

/** Append a chat message to a station and broadcast it to its listeners. */
function pushChat(station, { nick, avatar, text }) {
  const entry = {
    id: crypto.randomBytes(4).toString('hex'),
    nick,
    avatar,
    text,
    at: Date.now(),
  };
  station.chat.push(entry);
  while (station.chat.length > CHAT_MAX) station.chat.shift();
  sendToStation(station.slug, { type: 'chat', message: entry });
}

/** Append an action-log entry (who did what) to a station and broadcast it. */
function pushAction(station, text, actor) {
  const entry = {
    id: crypto.randomBytes(4).toString('hex'),
    nick: (actor && actor.nick) || '',
    avatar: (actor && actor.avatar) || '',
    text,
    at: Date.now(),
  };
  station.actions.push(entry);
  while (station.actions.length > ACTION_MAX) station.actions.shift();
  sendToStation(station.slug, { type: 'action', action: entry });
}

// ---------------------------------------------------------------------------
// Playback loop — the server just tracks time; clients do the actual playing.
// Each function operates on a specific station.
// ---------------------------------------------------------------------------
function playNext(station) {
  if (station.advanceTimer) {
    clearTimeout(station.advanceTimer);
    station.advanceTimer = null;
  }

  const next = station.playlist.shift();
  if (!next) {
    station.current = null;
    station.startedAt = 0;
    notifyState(station);
    return;
  }

  station.current = next;
  station.startedAt = Date.now();
  notifyState(station);

  // Auto-advance when the song is expected to finish. A small buffer covers
  // seek/network latency; clients also report 'ended' as a fallback.
  if (station.current.duration && station.current.duration > 0) {
    station.advanceTimer = setTimeout(
      () => playNext(station),
      (station.current.duration + 1) * 1000
    );
  }
}

/** Advance only if the given video is still the current one (avoids double-skips). */
function endIfCurrent(station, videoId) {
  if (station.current && station.current.videoId === videoId) playNext(station);
}

/** Move a queued song up or down by one position. Returns true if it moved. */
function moveSong(station, id, dir) {
  const list = station.playlist;
  const i = list.findIndex((s) => s.id === id);
  if (i < 0) return false;
  const j = dir === 'up' ? i - 1 : i + 1;
  if (j < 0 || j >= list.length) return false;
  [list[i], list[j]] = [list[j], list[i]];
  notifyState(station);
  return true;
}

/** Remove a queued song by id. Returns the removed song, or null. */
function removeSong(station, id) {
  const i = station.playlist.findIndex((s) => s.id === id);
  if (i < 0) return null;
  const [removed] = station.playlist.splice(i, 1);
  notifyState(station);
  return removed;
}

/** Start playback if nothing is currently playing on the station. */
function ensurePlaying(station) {
  if (!station.current) playNext(station);
}

// ---------------------------------------------------------------------------
// Metadata — resolve a YouTube URL to { videoId, title, duration }.
// Only metadata is fetched (no media download), so this works even where
// downloads are blocked. Falls back to YouTube's oEmbed for the title.
// ---------------------------------------------------------------------------
function extractVideoId(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return u.pathname.slice(1) || null;
    if (host.endsWith('youtube.com')) {
      if (u.searchParams.get('v')) return u.searchParams.get('v');
      const m = u.pathname.match(/\/(embed|shorts|live)\/([^/?]+)/);
      if (m) return m[2];
    }
  } catch {
    /* not a URL */
  }
  return null;
}

/** Return the playlist id (list=...) if the URL points at a YouTube playlist. */
function extractPlaylistId(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host.endsWith('youtube.com') || host === 'youtu.be') {
      return u.searchParams.get('list');
    }
  } catch {
    /* not a URL */
  }
  return null;
}

function oembedTitle(url) {
  return new Promise((resolve) => {
    const api = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`;
    https
      .get(api, { rejectUnauthorized: false }, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(body).title || null);
          } catch {
            resolve(null);
          }
        });
      })
      .on('error', () => resolve(null));
  });
}

/**
 * Best-effort embeddability check via YouTube's oEmbed endpoint. Videos whose
 * owner disabled embedding return HTTP 401 — the same ones the IFrame player
 * shows as "Video unavailable / Watch on YouTube". Fail-open: any other status
 * or a network hiccup counts as embeddable, so we never wrongly reject a good
 * video on a flaky / TLS-inspecting network.
 */
function checkEmbeddable(videoId) {
  return new Promise((resolve) => {
    const watch = `https://www.youtube.com/watch?v=${videoId}`;
    const api = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watch)}`;
    https
      .get(api, { rejectUnauthorized: false }, (res) => {
        res.resume(); // drain the response so the socket is freed
        resolve(res.statusCode !== 401);
      })
      .on('error', () => resolve(true));
  });
}

async function resolveSong(url) {
  const cached = cache[url];
  if (cached && cached.videoId) return cached;

  let videoId = extractVideoId(url);
  let title = null;
  let duration = 0;

  try {
    const info = await youtubedl(url, {
      dumpSingleJson: true,
      noWarnings: true,
      noCheckCertificates: true,
      noPlaylist: true,
      ...DOWNLOAD_NET_OPTS,
    });
    videoId = info.id || videoId;
    title = info.title || null;
    duration = Number(info.duration) || 0;
  } catch (err) {
    console.warn('Metadata fetch failed:', err.stderr || err.shortMessage || err.message);
  }

  if (!videoId) throw new Error('Could not recognize a YouTube video in that link.');
  if (!title) title = (await oembedTitle(url)) || 'YouTube video';

  const meta = { url, videoId, title, duration };
  cache[url] = meta;
  saveCache();
  return meta;
}

/**
 * Resolve a YouTube playlist link to an array of song metadata.
 * Uses a flat listing (no per-video extraction) so it stays fast, and caps the
 * number of entries to keep huge playlists / auto-generated mixes reasonable.
 */
const PLAYLIST_MAX = 15;
async function resolvePlaylist(url) {
  const listId = extractPlaylistId(url);
  const target = listId ? `https://www.youtube.com/playlist?list=${listId}` : url;

  const info = await youtubedl(target, {
    dumpSingleJson: true,
    flatPlaylist: true,
    noWarnings: true,
    noCheckCertificates: true,
    yesPlaylist: true,
    playlistEnd: PLAYLIST_MAX,
    ...DOWNLOAD_NET_OPTS,
  });

  const entries = info && Array.isArray(info.entries) ? info.entries : [];
  const metas = [];
  for (const e of entries.slice(0, PLAYLIST_MAX)) {
    const videoId = e.id;
    if (!videoId) continue;
    const songUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const meta = {
      url: songUrl,
      videoId,
      title: e.title || 'YouTube video',
      duration: Number(e.duration) || 0,
    };
    cache[songUrl] = meta;
    metas.push(meta);
  }
  if (metas.length) saveCache();
  return metas;
}

/**
 * Resolve a free-text query to the first YouTube search result.
 * Uses yt-dlp's `ytsearch1:` so only metadata is fetched (no media download).
 */
async function resolveSearch(query) {
  // Flat search returns just id/title/duration per hit. Crucially it skips full
  // video extraction (nsig challenge + googlevideo format URLs), which is slow
  // and intermittently 403s on locked-down networks — the same reason
  // resolvePlaylist() uses flatPlaylist. We pull several results so we can skip
  // over any that aren't embeddable and still find a playable one.
  const info = await youtubedl(`ytsearch8:${query}`, {
    dumpSingleJson: true,
    flatPlaylist: true,
    noWarnings: true,
    noCheckCertificates: true,
    ...DOWNLOAD_NET_OPTS,
  });
  const entries = (info && Array.isArray(info.entries) ? info.entries : [info]).filter(
    (e) => e && e.id
  );
  if (!entries.length) throw new Error('No results found for that search.');

  // Many official music videos disable embedding, so the IFrame player would
  // just show "Video unavailable". Filter those out and take the first result
  // YouTube actually lets us embed. checkEmbeddable() fails open, so only videos
  // that explicitly block embedding are dropped — a flaky network won't reject a
  // good hit. If every result blocks embedding, tell the user instead of
  // queuing something that can't play.
  let entry = null;
  for (const candidate of entries) {
    if (await checkEmbeddable(candidate.id)) {
      entry = candidate;
      break;
    }
  }
  if (!entry) {
    throw new Error('Those results all block embedding. Try a different search.');
  }

  const url = `https://www.youtube.com/watch?v=${entry.id}`;
  const meta = {
    url,
    videoId: entry.id,
    title: entry.title || 'YouTube video',
    duration: Number(entry.duration) || 0,
  };
  cache[url] = meta;
  saveCache();
  return meta;
}

/** Fetch YouTube search-as-you-type suggestions for a query. */
function fetchSuggestions(query) {
  return new Promise((resolve) => {
    const api =
      'https://suggestqueries.google.com/complete/search' +
      `?client=firefox&ds=yt&q=${encodeURIComponent(query)}`;
    // rejectUnauthorized:false mirrors yt-dlp's --no-check-certificates, needed
    // on networks with a TLS-inspecting proxy (self-signed cert in the chain).
    https
      .get(api, { rejectUnauthorized: false }, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            resolve(Array.isArray(parsed[1]) ? parsed[1].slice(0, 8) : []);
          } catch {
            resolve([]);
          }
        });
      })
      .on('error', () => resolve([]));
  });
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------
const app = express();
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

// --- Station management (lobby) --------------------------------------------

// List all stations with a light summary for the lobby.
app.get('/api/stations', (req, res) => {
  res.json(lobbySnapshot().stations);
});

// Create a new station. Body: { name, isPublic }. Returns { slug, name, id }.
// Each station gets a unique id folded into its slug, so duplicate display
// names are allowed — they simply live at different URLs.
app.post('/api/stations', (req, res) => {
  const name = (req.body && req.body.name ? String(req.body.name) : '').trim();
  if (!name) return res.status(400).json({ error: 'Please provide a station name.' });
  const isPublic = !(req.body && req.body.isPublic === false);

  const station = createStation(name, isPublic);
  stations.set(station.slug, station);
  broadcastLobby();
  console.log(`+ station "${station.name}" (/${station.slug})`);
  res.status(201).json({ slug: station.slug, name: station.name, id: station.id });
});

// Resolve the :slug route param to a station, or send a 404.
function requireStation(req, res) {
  const station = stations.get(req.params.slug);
  if (!station) {
    res.status(404).json({ error: 'No such station.' });
    return null;
  }
  return station;
}

// --- Per-station endpoints -------------------------------------------------

// Current state for initial page load.
app.get('/api/stations/:slug/state', (req, res) => {
  const station = requireStation(req, res);
  if (!station) return;
  res.json(stateSnapshot(station));
});

// Add a song by YouTube URL or by search query (first result is used).
app.post('/api/stations/:slug/add', (req, res) => {
  const station = requireStation(req, res);
  if (!station) return;

  const url = (req.body && req.body.url ? String(req.body.url) : '').trim();
  const query = (req.body && req.body.query ? String(req.body.query) : '').trim();

  if (!url && !query) {
    return res.status(400).json({ error: 'Please provide a URL or search term.' });
  }
  if (url && !/^https?:\/\//i.test(url)) {
    return res.status(400).json({ error: 'Please provide a valid URL.' });
  }

  const addedBy = readActor(req.body);

  // Respond immediately; resolving metadata may take a moment.
  res.status(202).json({ status: 'adding' });
  notify(station, 'adding', 'Adding song…');

  const who = addedBy.nick ? `${addedBy.nick} added` : 'Added';

  // Explicit "Add Playlist" request: add every song (up to PLAYLIST_MAX).
  if (url && req.body && req.body.playlist === true) {
    if (!extractPlaylistId(url)) {
      notify(station, 'error', 'That link has no playlist. Use "Add Video" instead.');
      return;
    }
    resolvePlaylist(url)
      .then((metas) => {
        if (!metas.length) throw new Error('No videos found in that playlist.');
        metas.forEach((meta) => {
          station.playlist.push({ id: crypto.randomBytes(6).toString('hex'), ...meta, addedBy });
        });
        notify(
          station,
          'added',
          `${who} ${metas.length} song${metas.length === 1 ? '' : 's'} from a playlist`
        );
        pushAction(
          station,
          `added ${metas.length} song${metas.length === 1 ? '' : 's'} from a playlist`,
          addedBy
        );
        notifyState(station);
        ensurePlaying(station);
      })
      .catch((err) => {
        console.error('Failed to add playlist:', err.message);
        notify(station, 'error', err.message || 'Could not add that playlist.');
      });
    return;
  }

  const resolver = url ? resolveSong(url) : resolveSearch(query);
  resolver
    .then((meta) => {
      const song = { id: crypto.randomBytes(6).toString('hex'), ...meta, addedBy };
      station.playlist.push(song);
      notify(station, 'added', `${who}: ${song.title}`);
      pushAction(station, `added ${song.title}`, addedBy);
      notifyState(station);
      ensurePlaying(station);
    })
    .catch((err) => {
      console.error('Failed to add song:', err.message);
      notify(station, 'error', err.message || 'Could not add song.');
    });
});

// Skip the current song (advance to the next one).
app.post('/api/stations/:slug/skip', (req, res) => {
  const station = requireStation(req, res);
  if (!station) return;
  if (station.current) pushAction(station, `skipped ${station.current.title}`, readActor(req.body));
  playNext(station);
  res.json({ status: 'skipped' });
});

// Reorder a queued song up or down by one position.
app.post('/api/stations/:slug/move', (req, res) => {
  const station = requireStation(req, res);
  if (!station) return;
  const id = req.body && req.body.id ? String(req.body.id) : '';
  const dir = req.body && req.body.dir === 'up' ? 'up' : 'down';
  const moved = moveSong(station, id, dir);
  res.status(moved ? 200 : 400).json({ status: moved ? 'moved' : 'no-op' });
});

// Remove a queued song by id.
app.post('/api/stations/:slug/remove', (req, res) => {
  const station = requireStation(req, res);
  if (!station) return;
  const id = req.body && req.body.id ? String(req.body.id) : '';
  const removed = removeSong(station, id);
  if (removed) {
    notify(station, 'removed', `Removed: ${removed.title}`);
    pushAction(station, `removed ${removed.title}`, readActor(req.body));
    res.json({ status: 'removed' });
  } else {
    res.status(400).json({ status: 'no-op' });
  }
});

// YouTube search-as-you-type suggestions (global; not station-specific).
app.get('/api/suggest', async (req, res) => {
  const q = (req.query && req.query.q ? String(req.query.q) : '').trim();
  if (!q) return res.json([]);
  const suggestions = await fetchSuggestions(q);
  res.json(suggestions);
});

// --- Page routing ----------------------------------------------------------
//   "/"           -> the lobby (station list)
//   "/<station>"  -> the station player page (resolved client-side by slug)
app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.get('/:slug', (req, res, next) => {
  // Let unmatched /api and /ws paths fall through to a normal 404.
  if (req.params.slug === 'api' || req.params.slug === 'ws') return next();
  res.sendFile(path.join(PUBLIC_DIR, 'station.html'));
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
const server = http.createServer(app);
wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', (ws, req) => {
  // Which station (or the lobby) is this socket tuned to? e.g. /ws?station=chill
  let slug = LOBBY;
  try {
    slug = new URL(req.url, 'http://localhost').searchParams.get('station') || LOBBY;
  } catch {
    slug = LOBBY;
  }

  // Lobby clients only receive the station list; they never send commands.
  if (slug === LOBBY) {
    ws.isLobby = true;
    ws.send(JSON.stringify(lobbySnapshot()));
    return;
  }

  const station = stations.get(slug);
  if (!station) {
    ws.close(); // unknown station — the page will redirect to the lobby
    return;
  }

  ws.stationSlug = slug;
  ws.send(JSON.stringify(stateSnapshot(station)));
  broadcastLobby(); // a listener just joined this station

  ws.on('message', (raw) => {
    let data;
    try {
      data = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (data.type === 'ended' && data.videoId) endIfCurrent(station, data.videoId);
    if (data.type === 'skip') playNext(station);
    if (data.type === 'chat') {
      const text = String(data.text || '').trim().slice(0, 300);
      if (!text) return;
      const actor = readActor(data);
      pushChat(station, { nick: actor.nick, avatar: actor.avatar, text });
    }
  });

  ws.on('close', () => broadcastLobby()); // a listener left this station
});

server.listen(PORT, () => {
  const host = os.hostname();
  console.log(`\n  DropIn is playing on http://localhost:${PORT}`);
  // YouTube's embedded player rejects a bare-IP origin (the "Video unavailable /
  // Watch on YouTube" screen), but accepts a hostname. Tell clients to use the
  // machine name, not the raw IP, so embed-restricted videos play for everyone.
  console.log(`  Share this with clients: http://${host}:${PORT}`);
  console.log(`  (Use the hostname, not the IP — YouTube blocks embeds on bare-IP pages.)\n`);
});
