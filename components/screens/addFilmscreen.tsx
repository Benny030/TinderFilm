'use client';

import { type FormEvent, useState } from 'react';
import { styles } from '@/styles/appStyles';

type Movie = {
  id: string | number;
  title: string;
  year: number;
  genre: string;
  cover: string | null;
  trailer: string | null;
};

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
  isSubmitting: boolean;
  statusMessage: string;
  movies: Movie[];
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onDelete: (id: string | number) => void;
  onEdit: (id: string | number, data: Partial<Movie>) => Promise<void>;
  onBack: () => void;
};

export default function AddFilmScreen({
  title, setTitle,
  year, setYear,
  genre, setGenre,
  cover, setCover,
  trailer, setTrailer,
  isSubmitting,
  statusMessage,
  movies,
  onSubmit,
  onDelete,
  onEdit,
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
  const [isEditing, setIsEditing] = useState(false);

  const openEdit = (m: Movie) => {
    setEditTarget(m);
    setEditTitle(m.title);
    setEditYear(String(m.year));
    setEditGenre(m.genre);
    setEditCover(m.cover ?? '');
    setEditTrailer(m.trailer ?? '');
  };

  const closeEdit = () => {
    setEditTarget(null);
    setIsEditing(false);
  };

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
    });
    setIsEditing(false);
    closeEdit();
  };

  return (
    <div style={styles.screen}>
      <div style={styles.header}>
        <button style={styles.headerBtn} onClick={onBack}>←</button>
        <span style={styles.headerTitle}>Aggiungi Film</span>
        <span />
      </div>

      <div style={styles.fbody}>
        <form onSubmit={onSubmit} style={styles.form}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titolo film" required style={styles.input} />
          <div style={styles.twoCol}>
            <input type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2026" style={styles.input} />
            <input value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="Genere" style={styles.input} />
          </div>
          <input value={cover} onChange={(e) => setCover(e.target.value)} placeholder="URL copertina" style={styles.input} />
          <input value={trailer} onChange={(e) => setTrailer(e.target.value)} placeholder="URL trailer" style={styles.input} />
          <button type="submit" disabled={isSubmitting} style={styles.submitBtn}>
            {isSubmitting ? 'Salvataggio...' : '🎬 Aggiungi Film'}
          </button>
        </form>

        {statusMessage && <div style={styles.message}>{statusMessage}</div>}

        <div style={styles.divider} />
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

      {/* ── POPUP CONFERMA ELIMINAZIONE ───────────────────────────────────────── */}
      {deleteTarget && (
        <div style={styles.popupOverlay}>
          <div style={styles.popupCard}>
            <div style={styles.popupTitle}>Eliminare?</div>
            <div style={styles.popupMovie}>
              Sei sicuro di voler eliminare <strong>{deleteTarget.title}</strong> dal database?
            </div>
            <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
              <button
                style={{ ...styles.submitBtn, flex: 1, background: '#F4B8C8' }}
                onClick={() => {
                  onDelete(deleteTarget.id);
                  setDeleteTarget(null);
                }}
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

      {/* ── POPUP MODIFICA FILM ───────────────────────────────────────────────── */}
      {editTarget && (
        <div style={styles.popupOverlay}>
          <div style={{ ...styles.popupCard, textAlign: 'left', maxHeight: '90vh', maxWidth: '90vh',overflowY: 'auto' }}>
            <div style={{ ...styles.popupTitle, textAlign: 'center' }}>✏️ Modifica Film</div>

            <form onSubmit={handleEditSubmit} style={{ ...styles.form, width: '100%' }}>
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Titolo"
                required
                style={styles.input}
              />
              <div style={styles.twoCol}>
                <input
                  type="number"
                  value={editYear}
                  onChange={(e) => setEditYear(e.target.value)}
                  placeholder="Anno"
                  style={styles.input}
                />
                <input
                  value={editGenre}
                  onChange={(e) => setEditGenre(e.target.value)}
                  placeholder="Genere"
                  style={styles.input}
                />
              </div>
              <input
                value={editCover}
                onChange={(e) => setEditCover(e.target.value)}
                placeholder="URL copertina"
                style={styles.input}
              />
              <input
                value={editTrailer}
                onChange={(e) => setEditTrailer(e.target.value)}
                placeholder="URL trailer"
                style={styles.input}
              />

              <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                <button
                  type="submit"
                  disabled={isEditing}
                  style={{ ...styles.submitBtn, flex: 1 }}
                >
                  {isEditing ? 'Salvataggio...' : '💾 Salva'}
                </button>
                <button
                  type="button"
                  style={{ ...styles.submitBtn, flex: 1, background: '#EEE8D8' }}
                  onClick={closeEdit}
                >
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