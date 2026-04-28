'use client';

import { type FormEvent, useState, useRef } from 'react';
import { styles } from '@/styles/appStyles';
import type { Movie, JsonMovieRow } from '@/types';

type Props = {
  title: string;
  setTitle: (v: string) => void;
  year: string;
  setYear: (v: string) => void;
  genre: string;
  setGenre: (v: string) => void;
  cover: string;
  setCover: (v: string) => void;
  trailer: string;
  setTrailer: (v: string) => void;
  tramaCorta: string;
  setTramaCorta: (v: string) => void;
  tramaLunga: string;
  setTramaLunga: (v: string) => void;
  isSubmitting: boolean;
  statusMessage: string;
  movies: Movie[];
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onDelete: (id: string | number) => void;
  onEdit: (id: string | number, data: Partial<Movie>) => Promise<void>;
  onBulkImport: (rows: JsonMovieRow[]) => Promise<{ ok: number; errors: number }>;
  onBack: () => void;
};

export default function AddFilmScreen({
  title, setTitle,
  year, setYear,
  genre, setGenre,
  cover, setCover,
  trailer, setTrailer,
  tramaCorta, setTramaCorta,
  tramaLunga, setTramaLunga,
  isSubmitting,
  statusMessage,
  movies,
  onSubmit,
  onDelete,
  onEdit,
  onBulkImport,
  onBack,
}: Props) {

  // ───── POPUP ELIMINA ─────
  const [deleteTarget, setDeleteTarget] = useState<Movie | null>(null);

  // ───── POPUP MODIFICA ─────
  const [editTarget, setEditTarget] = useState<Movie | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editYear, setEditYear] = useState('');
  const [editGenre, setEditGenre] = useState('');
  const [editCover, setEditCover] = useState('');
  const [editTrailer, setEditTrailer] = useState('');
  const [editTramaCorta, setEditTramaCorta] = useState('');
  const [editTramaLunga, setEditTramaLunga] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // ───── IMPORT JSON ─────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<JsonMovieRow[] | null>(null);
  const [importError, setImportError] = useState('');
  const [importStatus, setImportStatus] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const openEdit = (m: Movie) => {
    setEditTarget(m);
    setEditTitle(m.title);
    setEditYear(String(m.year));
    setEditGenre(m.genre);
    setEditCover(m.cover ?? '');
    setEditTrailer(m.trailer ?? '');
    setEditTramaCorta(m.trama_c ?? '');
    setEditTramaLunga(m.trama_l ?? '');
  };

  const closeEdit = () => { setEditTarget(null); setIsEditing(false); };

  const handleEditSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editTarget) return;
    setIsEditing(true);
    await onEdit(editTarget.id, {
      title: editTitle.trim(),
      year: Number(editYear),
      genre: editGenre.trim(),
      cover: editCover.trim() || null,
      trailer: editTrailer.trim() || null,
      trama_c: editTramaCorta.trim() || null,
      trama_l: editTramaLunga.trim() || null,
    });
    setIsEditing(false);
    closeEdit();
  };

  // ─── Legge il file JSON e mostra anteprima ────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError('');
    setImportPreview(null);
    setImportStatus('');
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        const rows: JsonMovieRow[] = Array.isArray(parsed) ? parsed : [parsed];

        // Validazione minima
        const invalid = rows.findIndex((r) => !r.title || !r.year || !r.genre);
        if (invalid !== -1) {
          setImportError(`Riga ${invalid + 1}: mancano title, year o genre.`);
          return;
        }
        setImportPreview(rows);
      } catch {
        setImportError('File JSON non valido.');
      }
    };
    reader.readAsText(file);
  };

  // ─── Avvia l'importazione ─────────────────────────────────────────────────
  const handleImportConfirm = async () => {
    if (!importPreview) return;
    setIsImporting(true);
    setImportStatus('');
    const { ok, errors } = await onBulkImport(importPreview);
    setIsImporting(false);
    setImportPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setImportStatus(`✅ ${ok} film importati${errors > 0 ? ` • ⚠️ ${errors} errori` : ''}.`);
  };

  return (
    <div style={styles.screen}>
      <div style={styles.header}>
        <button style={styles.headerBtn} onClick={onBack}>←</button>
        <span style={styles.headerTitle}>Aggiungi Film</span>
        <span />
      </div>

      <div style={styles.fbody}>

        {/* ── FORM SINGOLO ─────────────────────────────────────────────────── */}
        <form onSubmit={onSubmit} style={styles.form}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titolo film" required style={styles.input} />
          <div style={styles.twoCol}>
            <input type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2026" style={styles.input} />
            <input value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="Genere" style={styles.input} />
          </div>
          <input value={cover} onChange={(e) => setCover(e.target.value)} placeholder="URL copertina" style={styles.input} />
          <input value={trailer} onChange={(e) => setTrailer(e.target.value)} placeholder="URL trailer" style={styles.input} />
          <input value={tramaCorta} onChange={(e) => setTramaCorta(e.target.value)} placeholder="Trama Corta" style={styles.input} />
          <input value={tramaLunga} onChange={(e) => setTramaLunga(e.target.value)} placeholder="Trama Lunga" style={styles.input} />
          
          
          <button type="submit" disabled={isSubmitting} style={styles.submitBtn}>
            {isSubmitting ? 'Salvataggio...' : '🎬 Aggiungi Film'}
          </button>
        </form>

        {statusMessage && <div style={styles.message}>{statusMessage}</div>}

        <div style={styles.divider} />

        {/* ── IMPORT JSON ───────────────────────────────────────────────────── */}
        <h3 style={styles.sectionTitle}>Importazione massiva JSON</h3>
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px', marginBottom: '8px' }}>
          <div style={{ fontSize: '12px', color: '#7A6F65', lineHeight: '1.6' }}>
            Il file deve essere un array JSON con campi: <code>title</code>, <code>year</code>, <code>genre</code> (obbligatori) + <code>cover</code>, <code>trailer</code>, <code>trama_c</code>, <code>trama_l</code> (opzionali).
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            style={{ fontSize: '13px', color: '#2E2A26' }}
          />

          {importError && (
            <div style={{ ...styles.message, background: '#F4B8C8', color: '#E8869E', borderColor: '#E8869E' }}>
              {importError}
            </div>
          )}

          {importStatus && <div style={styles.message}>{importStatus}</div>}

          {/* Anteprima e conferma */}
          {importPreview && (
            <div style={{ background: '#EEE8D8', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column' as const, gap: '10px' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#2E2A26' }}>
                📋 {importPreview.length} film trovati — confermi l'importazione?
              </div>
              {/* Lista compatta primi 5 */}
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '4px' }}>
                {importPreview.slice(0, 5).map((r, i) => (
                  <div key={i} style={{ fontSize: '12px', color: '#7A6F65' }}>
                    • {r.title} ({r.year}) — {r.genre}
                  </div>
                ))}
                {importPreview.length > 5 && (
                  <div style={{ fontSize: '12px', color: '#B0A899' }}>
                    …e altri {importPreview.length - 5} film
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={handleImportConfirm}
                  disabled={isImporting}
                  style={{ ...styles.submitBtn, flex: 1 }}
                >
                  {isImporting ? 'Importazione...' : '⬆️ Importa tutto'}
                </button>
                <button
                  onClick={() => { setImportPreview(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  style={{ ...styles.submitBtn, flex: 1, background: '#EEE8D8' }}
                >
                  Annulla
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={styles.divider} />

        {/* ── LISTA FILM ────────────────────────────────────────────────────── */}
        <h3 style={styles.sectionTitle}>Film esistenti</h3>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.tableHeader}>Titolo</th>
              <th style={styles.tableHeader}>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {movies.map((m) => (
              <tr key={m.id}>
                <td style={styles.tableCell}>{m.title}</td>
                <td style={{ ...styles.tableCell, textAlign: 'center' }}>
                  <button style={styles.deleteBtn} onClick={() => openEdit(m)}>✏️</button>
                  <br />
                  <button style={styles.deleteBtn} onClick={() => setDeleteTarget(m)}>🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── POPUP CONFERMA ELIMINAZIONE ───────────────────────────────────── */}
      {deleteTarget && (
        <div style={styles.popupOverlay}>
          <div style={styles.popupCard}>
            <div style={styles.popupTitle}>Eliminare?</div>
            <div style={styles.popupMovie}>
              Sei sicuro di voler eliminare <strong>{deleteTarget.title}</strong>?
            </div>
            <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
              <button
                style={{ ...styles.submitBtn, flex: 1, background: '#F4B8C8' }}
                onClick={() => { onDelete(deleteTarget.id); setDeleteTarget(null); }}
              >
                🗑️ Elimina
              </button>
              <button
                style={{ ...styles.submitBtn, flex: 1, background: '#EEE8D8' }}
                onClick={() => setDeleteTarget(null)}
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── POPUP MODIFICA FILM ───────────────────────────────────────────── */}
      {editTarget && (
        <div style={styles.popupOverlay}>
          <div style={{ ...styles.popupCard, textAlign: 'left', maxHeight: '90vh', maxWidth: '90vw', overflowY: 'auto' }}>
            <div style={{ ...styles.popupTitle, textAlign: 'center' }}>✏️ Modifica Film</div>
            <form onSubmit={handleEditSubmit} style={{ ...styles.form, width: '100%' }}>
              <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Titolo" required style={styles.input} />
              <div style={styles.twoCol}>
                <input type="number" value={editYear} onChange={(e) => setEditYear(e.target.value)} placeholder="Anno" style={styles.input} />
                <input value={editGenre} onChange={(e) => setEditGenre(e.target.value)} placeholder="Genere" style={styles.input} />
              </div>
              <input value={editCover} onChange={(e) => setEditCover(e.target.value)} placeholder="URL copertina" style={styles.input} />
              <input value={editTrailer} onChange={(e) => setEditTrailer(e.target.value)} placeholder="URL trailer" style={styles.input} />

              <input value={editTramaCorta} onChange={(e) => setEditTramaCorta(e.target.value)} placeholder="Trama Corta" style={styles.input} />
              <input value={editTramaLunga} onChange={(e) => setEditTramaLunga(e.target.value)} placeholder="Trama Lunga" style={styles.input} />
              <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                <button type="submit" disabled={isEditing} style={{ ...styles.submitBtn, flex: 1 }}>
                  {isEditing ? 'Salvataggio...' : '💾 Salva'}
                </button>
                <button type="button" style={{ ...styles.submitBtn, flex: 1, background: '#EEE8D8' }} onClick={closeEdit}>
                  Annulla
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}