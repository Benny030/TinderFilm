'use client';

import { useEffect, useRef, useState } from 'react';
import { Flag, X } from '@phosphor-icons/react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/context/ThemeContext';
import { createBrowserClient } from '@/utils/supabase/browser';

type ReportTarget =
  | { type: 'user'; userId: string; label: string }
  | { type: 'review'; entryId: string; label: string }
  | { type: 'comment'; commentId: string; label: string };

type Props = {
  open: boolean;
  target: ReportTarget | null;
  onClose: () => void;
};

const REASONS = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Molestie o bullismo' },
  { value: 'hate', label: 'Odio o discriminazione' },
  { value: 'sexual_content', label: 'Contenuti sessuali' },
  { value: 'violence', label: 'Violenza' },
  { value: 'spoiler', label: 'Spoiler non segnalato' },
  { value: 'impersonation', label: 'Impersonificazione' },
  { value: 'other', label: 'Altro' },
] as const;

type Reason = (typeof REASONS)[number]['value'];

export default function ReportModal({
  open,
  target,
  onClose,
}: Props) {
  const { currentUser } = useAuth();
  const { theme } = useTheme();
  const supabase = useRef(createBrowserClient()).current;

  const isDark = theme === 'dark';

  const bg = isDark ? '#0a0806' : '#f5efe8';
  const card = isDark ? '#1c1613' : '#ffffff';
  const border = isDark ? '#2d221c' : '#d6cbbc';
  const text = isDark ? '#f0ebe6' : '#1f1a16';
  const muted = isDark ? '#b5a89e' : '#5c5248';
  const faint = isDark ? '#7a6b60' : '#8a7c6e';
  const pink = isDark ? '#ed3d73' : '#b83060';

  const [reason, setReason] = useState<Reason>('spam');
  const [details, setDetails] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!open) return;

    setReason('spam');
    setDetails('');
    setError('');
    setSuccess('');
    setSaving(false);
  }, [open, target]);

  if (!open || !target) return null;

  const submit = async () => {
    if (!currentUser || currentUser.isGuest || saving) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload: {
        reporter_user_id: string;
        reported_user_id?: string;
        review_entry_id?: string;
        comment_id?: string;
        reason: Reason;
        details: string | null;
      } = {
        reporter_user_id: currentUser.id,
        reason,
        details: details.trim() || null,
      };

      if (target.type === 'user') {
        payload.reported_user_id = target.userId;
      }

      if (target.type === 'review') {
        payload.review_entry_id = target.entryId;
      }

      if (target.type === 'comment') {
        payload.comment_id = target.commentId;
      }

      const { error: insertError } = await supabase
        .from('content_reports')
        .insert(payload);

      if (insertError) {
        if (insertError.code === '23505') {
          setSuccess('Hai già una segnalazione aperta per questo contenuto.');
          return;
        }

        throw insertError;
      }

      setSuccess('Segnalazione inviata. Grazie.');
    } catch (err: unknown) {
      console.error('Content report failed:', err);

      setError(
        err instanceof Error
          ? err.message
          : 'Impossibile inviare la segnalazione.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 500,
        background: 'rgba(0,0,0,.68)',
        display: 'grid',
        placeItems: 'center',
        padding: 18,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Segnala contenuto"
        style={{
          width: 'min(480px, 100%)',
          background: card,
          border: `1px solid ${border}`,
          color: text,
          padding: 18,
          boxShadow: '0 24px 70px rgba(0,0,0,.42)',
          fontFamily: "'Inter','Helvetica Neue',sans-serif",
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 14,
            marginBottom: 15,
          }}
        >
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                color: pink,
                fontSize: 10,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '.08em',
                marginBottom: 4,
              }}
            >
              <Flag size={14} weight="fill" />
              Segnalazione
            </div>

            <h2
              style={{
                margin: 0,
                fontSize: 20,
                fontFamily: "'Playfair Display','Georgia',serif",
              }}
            >
              Segnala
            </h2>

            <p
              style={{
                margin: '6px 0 0',
                color: muted,
                fontSize: 11,
                lineHeight: 1.5,
              }}
            >
              {target.label}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            style={{
              width: 34,
              height: 34,
              border: `1px solid ${border}`,
              background: bg,
              color: muted,
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {success ? (
          <div
            style={{
              border: '1px solid rgba(34,197,94,.35)',
              background: 'rgba(34,197,94,.08)',
              color: isDark ? '#86efac' : '#166534',
              padding: 13,
              fontSize: 11,
              lineHeight: 1.5,
            }}
          >
            {success}

            <button
              type="button"
              onClick={onClose}
              style={{
                display: 'block',
                marginTop: 12,
                width: '100%',
                border: `1px solid ${border}`,
                background: bg,
                color: text,
                padding: '9px 12px',
                cursor: 'pointer',
                fontWeight: 800,
              }}
            >
              Chiudi
            </button>
          </div>
        ) : (
          <>
            <label
              style={{
                display: 'block',
                color: faint,
                fontSize: 9,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '.07em',
                marginBottom: 6,
              }}
            >
              Motivo
            </label>

            <select
              value={reason}
              onChange={(event) => setReason(event.target.value as Reason)}
              style={{
                width: '100%',
                border: `1px solid ${border}`,
                background: bg,
                color: text,
                padding: '10px 11px',
                outline: 0,
                fontFamily: 'inherit',
                marginBottom: 13,
              }}
            >
              {REASONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <label
              style={{
                display: 'block',
                color: faint,
                fontSize: 9,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '.07em',
                marginBottom: 6,
              }}
            >
              Dettagli opzionali
            </label>

            <textarea
              value={details}
              maxLength={1000}
              onChange={(event) => setDetails(event.target.value)}
              placeholder="Spiega brevemente il problema..."
              style={{
                width: '100%',
                minHeight: 100,
                boxSizing: 'border-box',
                resize: 'vertical',
                border: `1px solid ${border}`,
                background: bg,
                color: text,
                padding: 10,
                outline: 0,
                fontFamily: 'inherit',
                fontSize: 11,
              }}
            />

            <div
              style={{
                textAlign: 'right',
                color: faint,
                fontSize: 8,
                marginTop: 4,
              }}
            >
              {details.length}/1000
            </div>

            {error && (
              <div
                style={{
                  marginTop: 10,
                  border: '1px solid rgba(239,68,68,.3)',
                  background: 'rgba(239,68,68,.08)',
                  color: '#fb7185',
                  padding: 10,
                  fontSize: 10,
                }}
              >
                {error}
              </div>
            )}

            <button
              type="button"
              disabled={saving}
              onClick={() => void submit()}
              style={{
                marginTop: 13,
                width: '100%',
                border: `1px solid ${pink}`,
                background: pink,
                color: '#fff',
                padding: '10px 13px',
                cursor: saving ? 'wait' : 'pointer',
                opacity: saving ? 0.6 : 1,
                fontWeight: 800,
                fontFamily: 'inherit',
              }}
            >
              {saving ? 'Invio...' : 'Invia segnalazione'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}