const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const db = new Database(path.join(__dirname, 'vokabel.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS stapel (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bezeichner TEXT NOT NULL,
    erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS karten (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stapel_id INTEGER NOT NULL,
    frage TEXT NOT NULL,
    antwort TEXT NOT NULL,
    FOREIGN KEY(stapel_id) REFERENCES stapel(id) ON DELETE CASCADE
  );
`);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Stapel
app.get('/api/stapel', (req, res) => {
  res.json(db.prepare(`
    SELECT s.*, COUNT(k.id) as anzahl
    FROM stapel s LEFT JOIN karten k ON k.stapel_id = s.id
    GROUP BY s.id ORDER BY s.erstellt_am DESC
  `).all());
});

app.post('/api/stapel', (req, res) => {
  const { bezeichner } = req.body;
  if (!bezeichner?.trim()) return res.status(400).json({ error: 'Bezeichner erforderlich' });
  const result = db.prepare('INSERT INTO stapel (bezeichner) VALUES (?)').run(bezeichner.trim());
  res.json({ id: result.lastInsertRowid, bezeichner: bezeichner.trim(), anzahl: 0 });
});

app.put('/api/stapel/:id', (req, res) => {
  const { bezeichner } = req.body;
  db.prepare('UPDATE stapel SET bezeichner = ? WHERE id = ?').run(bezeichner.trim(), req.params.id);
  res.json({ ok: true });
});

app.delete('/api/stapel/:id', (req, res) => {
  db.prepare('DELETE FROM stapel WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Karten
app.get('/api/stapel/:id/karten', (req, res) => {
  res.json(db.prepare('SELECT * FROM karten WHERE stapel_id = ? ORDER BY id').all(req.params.id));
});

app.post('/api/stapel/:id/karten', (req, res) => {
  const { frage, antwort } = req.body;
  if (!frage?.trim() || !antwort?.trim()) return res.status(400).json({ error: 'Frage und Antwort erforderlich' });
  const result = db.prepare('INSERT INTO karten (stapel_id, frage, antwort) VALUES (?, ?, ?)').run(req.params.id, frage.trim(), antwort.trim());
  res.json({ id: result.lastInsertRowid, stapel_id: Number(req.params.id), frage: frage.trim(), antwort: antwort.trim() });
});

app.put('/api/karten/:id', (req, res) => {
  const { frage, antwort } = req.body;
  db.prepare('UPDATE karten SET frage = ?, antwort = ? WHERE id = ?').run(frage.trim(), antwort.trim(), req.params.id);
  res.json({ ok: true });
});

app.delete('/api/karten/:id', (req, res) => {
  db.prepare('DELETE FROM karten WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.listen(3000, () => console.log('Server läuft auf http://localhost:3000'));
