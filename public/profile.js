// Shared identity module for DropIn — used by BOTH the lobby and each station.
//
// It persists a { nick, avatar } profile in localStorage and drives the profile
// chip + "choose your identity" modal. Both pages must include the matching
// markup (the #profileChip button and #profileModal dialog). Expose one small
// API on window.Profile so page scripts don't each re-implement identity.

(function () {
  const PROFILE_KEY = 'dropin.profile';
  const AVATARS = [
    '🦊', '🐼', '🐙', '🦄', '🐸', '🐵', '🐯', '🐧', '🐨', '🦁', '🐮', '🐷', '🐳', '🦉', '🐝', '🐢',
    '🐰', '🐹', '🐺', '🦝', '🦔', '🐴', '🐔', '🦆', '🦅', '🦋', '🐬', '🦈', '🐊', '🦖', '🦕', '🐌',
  ];

  const chip = document.getElementById('profileChip');
  const chipAvatar = document.getElementById('profileAvatar');
  const chipNick = document.getElementById('profileNick');
  const modal = document.getElementById('profileModal');
  const nickInput = document.getElementById('nickInput');
  const avatarGrid = document.getElementById('avatarGrid');
  const saveBtn = document.getElementById('profileSave');
  const cancelBtn = document.getElementById('profileCancel');

  let selectedAvatar = null;
  let pending = null; // callback to run once a valid profile is saved

  function load() {
    try {
      const p = JSON.parse(localStorage.getItem(PROFILE_KEY));
      return p && p.nick && p.avatar ? p : null;
    } catch {
      return null;
    }
  }

  function save(p) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  }

  function renderChip() {
    if (!chip) return;
    const p = load();
    if (p) {
      chipAvatar.textContent = p.avatar;
      chipNick.textContent = p.nick;
      chip.classList.remove('hidden');
    } else {
      chip.classList.add('hidden');
    }
  }

  function buildGrid() {
    avatarGrid.innerHTML = '';
    AVATARS.forEach((emoji) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'avatar-option';
      btn.textContent = emoji;
      if (emoji === selectedAvatar) btn.classList.add('selected');
      btn.addEventListener('click', () => {
        selectedAvatar = emoji;
        avatarGrid
          .querySelectorAll('.avatar-option')
          .forEach((b) => b.classList.toggle('selected', b.textContent === emoji));
      });
      avatarGrid.appendChild(btn);
    });
  }

  function open() {
    const p = load();
    nickInput.value = p ? p.nick : '';
    selectedAvatar = p ? p.avatar : null;
    buildGrid();
    modal.classList.remove('hidden');
    nickInput.focus();
  }

  function close() {
    modal.classList.add('hidden');
    pending = null;
  }

  /** Run `cb` immediately if a profile exists, otherwise after the user saves one. */
  function require(cb) {
    if (load()) {
      cb();
      return;
    }
    pending = cb;
    open();
  }

  // A tiny toast so identity errors surface even before a page script loads.
  function toast(msg, isError) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle('error', !!isError);
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), 3000);
  }

  if (chip) chip.addEventListener('click', open);
  if (cancelBtn) cancelBtn.addEventListener('click', close);
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });
  }
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const nick = nickInput.value.trim();
      if (!nick) {
        toast('Please enter a nickname.', true);
        nickInput.focus();
        return;
      }
      if (!selectedAvatar) {
        toast('Please pick an avatar.', true);
        return;
      }
      save({ nick: nick.slice(0, 24), avatar: selectedAvatar });
      renderChip();
      modal.classList.add('hidden');
      window.dispatchEvent(new CustomEvent('profilechange'));
      const cb = pending;
      pending = null;
      if (cb) cb();
    });
  }

  window.Profile = { load, save, renderChip, open, require };
})();
