'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/context/ThemeContext';
import { createBrowserClient } from '@/utils/supabase/browser';
import {
  ArrowLeft,
  Prohibit,
  UserCircle,
} from '@phosphor-icons/react';

const D = {
  bg: '#0a0806',
  bgSoft: '#14100e',
  card: '#1c1613',
  border: '#2d221c',
  pink: '#ed3d73',
  gold: '#f5b92f',
  text: '#f0ebe6',
  textMuted: '#b5a89e',
  textFaint: '#7a6b60',
};

const L = {
  bg: '#f5efe8',
  bgSoft: '#ece3d9',
  card: '#ffffff',
  border: '#d6cbbc',
  pink: '#b83060',
  gold: '#b8860b',
  text: '#1f1a16',
  textMuted: '#5c5248',
  textFaint: '#8a7c6e',
};

const FONT = "'Inter','Helvetica Neue',sans-serif";
const FONT_DISPLAY = "'Playfair Display','Georgia',serif";

type BlockedUser = {
  user_id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  blocked_at: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function UtentiBloccatiPage() {
  const router = useRouter();
  const { currentUser, isGuest, isLoading } = useAuth();
  const { theme } = useTheme();
  const P = theme === 'dark' ? D : L;

  const supabase = useRef(createBrowserClient()).current;

  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isLoading) return;

    if (!currentUser || currentUser.isGuest || isGuest) {
      void router.replace('/auth');
    }
  }, [currentUser, isGuest, isLoading, router]);

  const loadUsers = async () => {
    if (!currentUser || currentUser.isGuest) return;

    setLoading(true);
    setError('');

    try {
      const { data, error: rpcError } = await supabase.rpc(
        'get_my_blocked_users',
        {
          p_limit: 100,
          p_offset: 0,
        }
      );

      if (rpcError) throw rpcError;

      setUsers((data ?? []) as BlockedUser[]);
    } catch (err: unknown) {
      console.error('Blocked users load failed:', err);

      setError(
        err instanceof Error
          ? err.message
          : 'Impossibile caricare gli utenti bloccati.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser || currentUser.isGuest) return;

    void loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const unblock = async (user: BlockedUser) => {
    if (!currentUser || currentUser.isGuest) return;

    const confirmed = window.confirm(
      `Vuoi sbloccare @${user.username}?`
    );

    if (!confirmed) return;

    setBusyId(user.user_id);
    setError('');

    try {
      const { error: deleteError } = await supabase
        .from('user_blocks')
        .delete()
        .eq('blocker_id', currentUser.id)
        .eq('blocked_id', user.user_id);

      if (deleteError) throw deleteError;

      setUsers((current) =>
        current.filter((item) => item.user_id !== user.user_id)
      );
    } catch (err: unknown) {
      console.error('Unblock failed:', err);

      setError(
        err instanceof Error
          ? err.message
          : 'Impossibile sbloccare questo utente.'
      );
    } finally {
      setBusyId(null);
    }
  };

  if (
    isLoading ||
    !currentUser ||
    currentUser.isGuest ||
    isGuest
  ) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: P.bg,
          color: P.textMuted,
          display: 'grid',
          placeItems: 'center',
          fontFamily: FONT,
        }}
      >
        Caricamento...
      </div>
    );
  }

  return (
    <AppShell activeNav="profilo">
      <main
        style={{
          minHeight: '100vh',
          background: P.bg,
          color: P.text,
          fontFamily: FONT,
          padding: '26px 18px 80px',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 760,
            margin: '0 auto',
          }}
        >
          <button
            type="button"
            onClick={() => router.back()}
            style={{
              border: 0,
              background: 'transparent',
              color: P.textMuted,
              padding: 0,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 18,
              fontWeight: 700,
            }}
          >
            <ArrowLeft size={16} />
            Indietro
          </button>

          <header
            style={{
              marginBottom: 18,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                color: P.textFaint,
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '.09em',
              }}
            >
              <Prohibit
                size={16}
                color={P.pink}
                weight="fill"
              />
              Privacy e sicurezza
            </div>

            <h1
              style={{
                margin: '6px 0 5px',
                color: P.text,
                fontFamily: FONT_DISPLAY,
                fontSize: 30,
              }}
            >
              Utenti bloccati
            </h1>

            <p
              style={{
                margin: 0,
                color: P.textMuted,
                fontSize: 12,
                lineHeight: 1.5,
              }}
            >
              Gli utenti bloccati non possono seguirti né
              interagire con le tue recensioni.
            </p>
          </header>

          {error && (
            <div
              style={{
                marginBottom: 12,
                border: '1px solid rgba(239,68,68,.3)',
                background: 'rgba(239,68,68,.08)',
                color: '#fb7185',
                padding: 11,
                fontSize: 11,
              }}
            >
              {error}
            </div>
          )}

          {loading ? (
            <div
              style={{
                border: `1px solid ${P.border}`,
                background: P.card,
                padding: 34,
                textAlign: 'center',
                color: P.textFaint,
                fontSize: 12,
              }}
            >
              Caricamento...
            </div>
          ) : users.length === 0 ? (
            <div
              style={{
                border: `1px dashed ${P.border}`,
                background: P.card,
                padding: 40,
                textAlign: 'center',
                color: P.textFaint,
              }}
            >
              <UserCircle
                size={34}
                color={P.textFaint}
                style={{ marginBottom: 7 }}
              />

              <div
                style={{
                  color: P.text,
                  fontSize: 13,
                  fontWeight: 800,
                  marginBottom: 4,
                }}
              >
                Nessun utente bloccato
              </div>

              <div
                style={{
                  fontSize: 10,
                  lineHeight: 1.5,
                }}
              >
                Gli account che blocchi compariranno qui.
              </div>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gap: 8,
              }}
            >
              {users.map((user) => {
                const busy = busyId === user.user_id;

                return (
                  <article
                    key={user.user_id}
                    style={{
                      border: `1px solid ${P.border}`,
                      background: P.card,
                      padding: 12,
                      display: 'grid',
                      gridTemplateColumns:
                        '48px minmax(0,1fr) auto',
                      gap: 11,
                      alignItems: 'center',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        void router.push(
                          `/utente/${encodeURIComponent(user.username)}`
                        )
                      }
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        border: 0,
                        padding: 0,
                        overflow: 'hidden',
                        background: P.bgSoft,
                        color: P.pink,
                        display: 'grid',
                        placeItems: 'center',
                        cursor: 'pointer',
                        fontWeight: 900,
                      }}
                    >
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt=""
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                        />
                      ) : (
                        user.username.charAt(0).toUpperCase()
                      )}
                    </button>

                    <div
                      style={{
                        minWidth: 0,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          void router.push(
                            `/utente/${encodeURIComponent(user.username)}`
                          )
                        }
                        style={{
                          border: 0,
                          background: 'transparent',
                          padding: 0,
                          color: P.text,
                          cursor: 'pointer',
                          fontWeight: 800,
                          fontSize: 12,
                          fontFamily: FONT,
                        }}
                      >
                        @{user.username}
                      </button>

                      <div
                        style={{
                          color: P.textFaint,
                          fontSize: 9,
                          marginTop: 3,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {user.bio?.trim() || 'Nessuna bio.'}
                      </div>

                      <div
                        style={{
                          color: P.textFaint,
                          fontSize: 8,
                          marginTop: 4,
                        }}
                      >
                        Bloccato il {formatDate(user.blocked_at)}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => void unblock(user)}
                      disabled={busy}
                      style={{
                        border: `1px solid ${P.gold}`,
                        background: 'transparent',
                        color: P.gold,
                        padding: '8px 10px',
                        cursor: busy ? 'wait' : 'pointer',
                        opacity: busy ? 0.55 : 1,
                        fontFamily: FONT,
                        fontSize: 9,
                        fontWeight: 800,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {busy ? 'Attendi...' : 'Sblocca'}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}