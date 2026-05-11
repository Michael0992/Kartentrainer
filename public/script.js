// ── State ────────────────────────────────────────────────────────────────────
let aktuellerStapel = null;
let stapelKarten   = [];   // noch nicht gezogene Karten (LIFO)
let donePile       = [];   // bereits abgelegte Karten
let aktiveKarte    = null; // Karte gerade in der Mitte
let karteGeflippt  = false;
let animiert       = false;

// ── API ───────────────────────────────────────────────────────────────────────
async function api(method, url, body) {
  const r = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  return r.json();
}

// ── Routing / Views ───────────────────────────────────────────────────────────
function zeigeView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${name}`).classList.add('active');
}

function setzeBreadcrumb(teile) {
  document.getElementById('breadcrumb').innerHTML = teile
    .map((t, i) =>
      i < teile.length - 1
        ? `<a href="#" data-view="${t.view}">${t.label}</a> ›`
        : `<span>${t.label}</span>`
    )
    .join(' ');
}

document.getElementById('breadcrumb').addEventListener('click', e => {
  const a = e.target.closest('a[data-view]');
  if (!a) return;
  e.preventDefault();
  if (a.dataset.view === 'menu') ladeMenu();
  if (a.dataset.view === 'bearbeiten' && aktuellerStapel) ladeBearbeiten(aktuellerStapel);
});

// ── Hauptmenü ─────────────────────────────────────────────────────────────────
async function ladeMenu() {
  aktuellerStapel = null;
  zeigeView('menu');
  setzeBreadcrumb([{ label: 'Meine Stapel' }]);

  const liste  = document.getElementById('stapel-liste');
  const leer   = document.getElementById('leere-meldung');
  const stapel = await api('GET', '/api/stapel');

  if (!stapel.length) {
    liste.innerHTML = '';
    leer.style.display = 'block';
    return;
  }
  leer.style.display = 'none';

  liste.innerHTML = stapel.map(s => `
    <div class="stapel-item">
      <div class="stapel-info">
        <span class="stapel-name">${esc(s.bezeichner)}</span>
        <span class="stapel-anzahl">${s.anzahl} Karte${s.anzahl !== 1 ? 'n' : ''}</span>
      </div>
      <div class="stapel-aktionen">
        <button class="btn-primary"  data-ueben="${s.id}">Üben</button>
        <button class="btn-secondary" data-edit="${s.id}">Bearbeiten</button>
        <button class="btn-danger"   data-del="${s.id}">✕</button>
      </div>
    </div>
  `).join('');

  liste.querySelectorAll('[data-ueben]').forEach(btn =>
    btn.addEventListener('click', () => starteAbfrage(stapel.find(s => s.id == btn.dataset.ueben)))
  );
  liste.querySelectorAll('[data-edit]').forEach(btn =>
    btn.addEventListener('click', () => ladeBearbeiten(stapel.find(s => s.id == btn.dataset.edit)))
  );
  liste.querySelectorAll('[data-del]').forEach(btn =>
    btn.addEventListener('click', async () => {
      if (!confirm('Stapel wirklich löschen?')) return;
      await api('DELETE', `/api/stapel/${btn.dataset.del}`);
      ladeMenu();
    })
  );
}

document.getElementById('btn-neuer-stapel').addEventListener('click', () => {
  oeffneModal('Neuer Stapel', [
    { name: 'bezeichner', label: 'Name', type: 'input', placeholder: 'z.B. Englisch Vokabeln' },
  ], async felder => {
    const neuer = await api('POST', '/api/stapel', { bezeichner: felder.bezeichner });
    schliesseModal();
    ladeBearbeiten(neuer);
  });
});

// ── Bearbeitungs-Modus ────────────────────────────────────────────────────────
async function ladeBearbeiten(stapel) {
  aktuellerStapel = stapel;
  zeigeView('bearbeiten');
  setzeBreadcrumb([
    { label: 'Meine Stapel', view: 'menu' },
    { label: stapel.bezeichner },
  ]);
  document.getElementById('bearbeiten-titel').textContent = stapel.bezeichner;

  const karten = await api('GET', `/api/stapel/${stapel.id}/karten`);
  const liste  = document.getElementById('karten-liste');
  const leer   = document.getElementById('karten-leer');

  if (!karten.length) {
    liste.innerHTML = '';
    leer.style.display = 'block';
    return;
  }
  leer.style.display = 'none';

  liste.innerHTML = karten.map(k => `
    <div class="karten-eintrag">
      <div class="karten-inhalt">
        <div class="karten-frage">${esc(k.frage)}</div>
        <div class="karten-antwort">${esc(k.antwort)}</div>
      </div>
      <div class="karten-aktionen">
        <button class="btn-secondary" data-karte-edit="${k.id}"
          data-frage="${escAttr(k.frage)}" data-antwort="${escAttr(k.antwort)}">Bearbeiten</button>
        <button class="btn-danger" data-karte-del="${k.id}">✕</button>
      </div>
    </div>
  `).join('');

  liste.querySelectorAll('[data-karte-edit]').forEach(btn =>
    btn.addEventListener('click', () => {
      oeffneModal('Karte bearbeiten', [
        { name: 'frage',   label: 'Frage',   type: 'textarea', value: btn.dataset.frage },
        { name: 'antwort', label: 'Antwort', type: 'textarea', value: btn.dataset.antwort },
      ], async felder => {
        await api('PUT', `/api/karten/${btn.dataset.karteEdit}`, felder);
        schliesseModal();
        ladeBearbeiten(aktuellerStapel);
      });
    })
  );

  liste.querySelectorAll('[data-karte-del]').forEach(btn =>
    btn.addEventListener('click', async () => {
      await api('DELETE', `/api/karten/${btn.dataset.karteDel}`);
      ladeBearbeiten(aktuellerStapel);
    })
  );
}

document.getElementById('btn-karte-hinzufuegen').addEventListener('click', () => {
  oeffneModal('Neue Karte', [
    { name: 'frage',   label: 'Frage',   type: 'textarea', placeholder: 'Frage eingeben …' },
    { name: 'antwort', label: 'Antwort', type: 'textarea', placeholder: 'Antwort eingeben …' },
  ], async felder => {
    await api('POST', `/api/stapel/${aktuellerStapel.id}/karten`, felder);
    schliesseModal();
    ladeBearbeiten(aktuellerStapel);
  });
});

// ── Abfrage-Modus ─────────────────────────────────────────────────────────────
async function starteAbfrage(stapel) {
  aktuellerStapel = stapel;
  const karten = await api('GET', `/api/stapel/${stapel.id}/karten`);

  if (!karten.length) {
    alert('Dieser Stapel hat noch keine Karten!');
    return;
  }

  // Fisher-Yates shuffle
  const gemischt = [...karten];
  for (let i = gemischt.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [gemischt[i], gemischt[j]] = [gemischt[j], gemischt[i]];
  }

  stapelKarten  = gemischt;
  donePile      = [];
  aktiveKarte   = null;
  karteGeflippt = false;

  zeigeView('abfrage');
  setzeBreadcrumb([
    { label: 'Meine Stapel', view: 'menu' },
    { label: stapel.bezeichner },
  ]);

  document.getElementById('fertig-banner').style.display = 'none';
  versteckeKarte(false);
  aktualisiereAbfrageUI();
}

function aktualisiereAbfrageUI() {
  const verbleibend = stapelKarten.length;
  const gesamt      = stapelKarten.length + donePile.length + (aktiveKarte ? 1 : 0);

  // Stack-Phantome
  document.querySelector('.stapel-phantom.p1').classList.toggle('verborgen', verbleibend < 3);
  document.querySelector('.stapel-phantom.p2').classList.toggle('verborgen', verbleibend < 2);
  document.querySelector('.stapel-phantom.p3').classList.toggle('verborgen', verbleibend < 1);

  document.getElementById('stapel-counter').textContent =
    `${verbleibend} Karte${verbleibend !== 1 ? 'n' : ''}`;

  const bereich = document.getElementById('stapel-bereich');
  bereich.classList.toggle('leer', aktiveKarte !== null || verbleibend === 0);

  document.getElementById('stapel-hinweis').textContent =
    aktiveKarte     ? '' :
    verbleibend > 0 ? 'Klicke auf den Stapel' : '';

  const gemacht = donePile.length;
  document.getElementById('fortschritt').textContent = `${gemacht} / ${gesamt}`;
  document.getElementById('btn-vorherige').disabled = donePile.length === 0;
}

// Karte ziehen
document.getElementById('stapel-bereich').addEventListener('click', () => {
  if (aktiveKarte || animiert || stapelKarten.length === 0) return;
  zieheKarte();
});

function zieheKarte() {
  aktiveKarte   = stapelKarten.pop();
  karteGeflippt = false;

  document.getElementById('frage-text').textContent  = aktiveKarte.frage;
  document.getElementById('antwort-text').textContent = aktiveKarte.antwort;

  const karteEl = document.getElementById('karte');
  karteEl.classList.remove('geflippt', 'animiere-raus', 'animiere-rein');
  karteEl.classList.add('sichtbar');
  void karteEl.offsetWidth;
  karteEl.classList.add('animiere-rein');

  aktualisiereAbfrageUI();
}

// Karte klicken → flippen oder ablegen
document.getElementById('karte').addEventListener('click', () => {
  if (!aktiveKarte || animiert) return;

  const karteEl = document.getElementById('karte');

  if (!karteGeflippt) {
    karteEl.classList.add('geflippt');
    karteGeflippt = true;
    return;
  }

  // Ablegen
  animiert = true;
  karteEl.classList.remove('animiere-rein');
  karteEl.classList.add('animiere-raus');

  karteEl.addEventListener('animationend', () => {
    donePile.push(aktiveKarte);
    aktiveKarte   = null;
    karteGeflippt = false;
    animiert      = false;
    karteEl.classList.remove('sichtbar', 'animiere-raus', 'geflippt');

    aktualisiereAbfrageUI();

    if (stapelKarten.length === 0) {
      const g = donePile.length;
      document.getElementById('fertig-text').textContent =
        `Du hast alle ${g} Karte${g !== 1 ? 'n' : ''} durchgegangen.`;
      document.getElementById('fertig-banner').style.display = 'block';
    }
  }, { once: true });
});

// Vorherige Karte
document.getElementById('btn-vorherige').addEventListener('click', () => {
  if (donePile.length === 0) return;

  if (aktiveKarte) {
    stapelKarten.push(aktiveKarte);
    versteckeKarte(false);
    aktiveKarte   = null;
    karteGeflippt = false;
  }

  aktiveKarte = donePile.pop();
  document.getElementById('fertig-banner').style.display = 'none';

  document.getElementById('frage-text').textContent  = aktiveKarte.frage;
  document.getElementById('antwort-text').textContent = aktiveKarte.antwort;

  const karteEl = document.getElementById('karte');
  karteEl.classList.remove('geflippt', 'animiere-raus', 'animiere-rein');
  karteEl.classList.add('sichtbar');
  void karteEl.offsetWidth;
  karteEl.classList.add('animiere-rein');
  karteGeflippt = false;

  aktualisiereAbfrageUI();
});

// Neu mischen
document.getElementById('btn-neu-mischen').addEventListener('click', () => {
  if (aktuellerStapel) starteAbfrage(aktuellerStapel);
});
document.getElementById('btn-abfrage-mischen').addEventListener('click', () => {
  if (aktuellerStapel) starteAbfrage(aktuellerStapel);
});

function versteckeKarte(resetState = true) {
  const karteEl = document.getElementById('karte');
  karteEl.classList.remove('sichtbar', 'animiere-rein', 'animiere-raus', 'geflippt');
  if (resetState) { aktiveKarte = null; karteGeflippt = false; }
}

// ── Modal ─────────────────────────────────────────────────────────────────────
let modalSubmitHandler = null;

function oeffneModal(titel, felder, onSubmit) {
  document.getElementById('modal-titel').textContent = titel;
  document.getElementById('modal-felder').innerHTML = felder.map(f => `
    <div class="modal-feld">
      <label>${f.label}</label>
      ${f.type === 'textarea'
        ? `<textarea name="${f.name}" rows="2" placeholder="${f.placeholder || ''}" required>${esc(f.value || '')}</textarea>`
        : `<input type="text" name="${f.name}" placeholder="${f.placeholder || ''}" value="${escAttr(f.value || '')}" required>`
      }
    </div>
  `).join('');

  document.getElementById('modal-overlay').style.display = 'flex';
  document.querySelector('#modal-felder [required]').focus();

  const form = document.getElementById('modal-form');
  if (modalSubmitHandler) form.removeEventListener('submit', modalSubmitHandler);
  modalSubmitHandler = e => {
    e.preventDefault();
    const data = {};
    felder.forEach(f => {
      data[f.name] = document.querySelector(`#modal-felder [name="${f.name}"]`).value;
    });
    onSubmit(data);
  };
  form.addEventListener('submit', modalSubmitHandler);
}

function schliesseModal() {
  document.getElementById('modal-overlay').style.display = 'none';
}

document.getElementById('modal-cancel').addEventListener('click', schliesseModal);
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay')) schliesseModal();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') schliesseModal();
});

// ── Utils ─────────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function escAttr(s) { return String(s).replace(/"/g, '&quot;'); }

// ── Start ─────────────────────────────────────────────────────────────────────
ladeMenu();
