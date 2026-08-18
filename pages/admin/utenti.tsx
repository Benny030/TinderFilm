'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/context/ThemeContext';
import { createBrowserClient } from '@/utils/supabase/browser';
import {
  ArrowLeft,
  MagnifyingGlass,
  ShieldCheck,
  Trash,
  UserCircle,
  WarningCircle,
} from '@phosphor-icons/react';

const D = {
  bg: '#0a0806',
  bgSoft: '#14100e',
  card: '#1c1613',
  border: '#2d221c',
  gold: '#f5b92f',
  pink: '#ed3d73',
  text: '#f0ebe6',
  textMuted: '#b5a89e',
  textFaint: '#7a6b60',
  error: '#ef4444',
  success: '#22c55e',
};

const L = {
  bg: '#f5efe8',
  bgSoft: '#ece3d9',
  card: '#ffffff',
  border: '#d6cbbc',
  gold: '#b8860b',
  pink: '#b83060',
  text: '#1f1a16',
  textMuted: '#5c5248',
  textFaint: '#8a7c6e',
  error: '#dc2626',
  success: '#16a34a',
};

const FONT = "'Inter','Helvetica Neue',sans-serif";
const FONT_DISPLAY = "'Playfair Display','Georgia',serif";

type AdminUserRow = {
  user_id: string;
  username: string | null;
  email: string | null;
  avatar_url: string | null;
  role: 'user' | 'admin';
  is_suspended: boolean;
};

export default function AdminUtentiPage() {
  const router = useRouter();
  const { currentUser, isGuest, isLoading } =
    useAuth();

  const { theme } = useTheme();
  const P = theme === 'dark' ? D : L;

  const supabase =
    useRef(createBrowserClient()).current;

  const [isAdmin, setIsAdmin] =
    useState<boolean | null>(null);

  const [query, setQuery] = useState('');
  const [users, setUsers] =
    useState<AdminUserRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedUser, setSelectedUser] =
    useState<AdminUserRow | null>(null);

  const [deleteStep, setDeleteStep] =
    useState<1 | 2>(1);

  const [
    confirmationUsername,
    setConfirmationUsername,
  ] = useState('');

  const [deleting, setDeleting] =
    useState(false);

  useEffect(() => {
    if (isLoading) return;

    if (
      !currentUser ||
      currentUser.isGuest ||
      isGuest
    ) {
      void router.replace('/auth');
    }
  }, [
    currentUser,
    isGuest,
    isLoading,
    router,
  ]);

  useEffect(() => {
    if (
      !currentUser ||
      currentUser.isGuest
    ) {
      return;
    }

    const checkAdmin = async () => {
      try {
        const {
          data,
          error: adminError,
        } = await supabase.rpc(
          'is_current_user_admin'
        );

        if (adminError) {
          throw adminError;
        }

        const allowed =
          data === true;

        setIsAdmin(allowed);

        if (!allowed) {
          setLoading(false);
        }
      } catch (err: unknown) {
        console.error(
          'Admin check failed:',
          err
        );

        setIsAdmin(false);
        setLoading(false);

        setError(
          err instanceof Error
            ? err.message
            : 'Impossibile verificare i permessi admin.'
        );
      }
    };

    void checkAdmin();
  }, [currentUser, supabase]);

  const loadUsers = async (
    search = query
  ) => {
    if (!isAdmin) return;

    setLoading(true);
    setError('');

    try {
      const {
        data,
        error: searchError,
      } = await supabase.rpc(
        'admin_search_users',
        {
          p_query: search.trim(),
          p_limit: 100,
          p_offset: 0,
        }
      );

      if (searchError) {
        throw searchError;
      }

      setUsers(
        (data ?? []) as AdminUserRow[]
      );
    } catch (err: unknown) {
      console.error(
        'Admin users load failed:',
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : 'Impossibile caricare gli utenti.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;

    void loadUsers('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const openDelete = (
    user: AdminUserRow
  ) => {
    setSelectedUser(user);
    setDeleteStep(1);
    setConfirmationUsername('');
    setError('');
  };

  const closeDelete = () => {
    if (deleting) return;

    setSelectedUser(null);
    setDeleteStep(1);
    setConfirmationUsername('');
  };

  const deleteUser = async () => {
    if (
      !selectedUser ||
      !currentUser ||
      currentUser.isGuest ||
      deleting
    ) {
      return;
    }

    const expectedUsername =
      selectedUser.username ?? '';

    if (
      confirmationUsername !==
      expectedUsername
    ) {
      setError(
        'Lo username di conferma non corrisponde.'
      );
      return;
    }

    const confirmed =
      window.confirm(
        `ULTIMA CONFERMA: eliminare definitivamente @${expectedUsername}? Tutti i dati dell'account verranno persi.`
      );

    if (!confirmed) return;

    setDeleting(true);
    setError('');

    try {
      const {
        data: { session },
        error: sessionError,
      } =
        await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (!session?.access_token) {
        throw new Error(
          'Sessione admin non valida.'
        );
      }

      const response = await fetch(
        '/api/admin/users/delete',
        {
          method: 'DELETE',
          headers: {
            'Content-Type':
              'application/json',
            Authorization:
              `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            targetUserId:
              selectedUser.user_id,
            confirmationUsername:
              confirmationUsername,
          }),
        }
      );

      const result =
        (await response.json()) as {
          success?: boolean;
          error?: string;
        };

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.error ||
            'Impossibile eliminare l’utente.'
        );
      }

      setSelectedUser(null);
      setDeleteStep(1);
      setConfirmationUsername('');

      await loadUsers();
    } catch (err: unknown) {
      console.error(
        'Admin delete user failed:',
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : 'Impossibile eliminare definitivamente l’utente.'
      );
    } finally {
      setDeleting(false);
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
          display: 'grid',
          placeItems: 'center',
          color: P.textMuted,
          fontFamily: FONT,
        }}
      >
        Caricamento...
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <AppShell activeNav="profilo">
        <main
          style={{
            minHeight: '100vh',
            background: P.bg,
            color: P.text,
            fontFamily: FONT,
            padding:
              '26px 18px 80px',
          }}
        >
          <div
            style={{
              maxWidth: 720,
              margin: '0 auto',
            }}
          >
            <div
              style={{
                border:
                  `1px solid ${P.border}`,
                background:
                  P.card,
                padding:
                  40,
                textAlign:
                  'center',
              }}
            >
              <ShieldCheck
                size={42}
                color={P.textFaint}
                weight="duotone"
              />

              <h1
                style={{
                  fontFamily:
                    FONT_DISPLAY,
                  fontSize:
                    25,
                }}
              >
                Accesso non autorizzato
              </h1>
            </div>
          </div>
        </main>
      </AppShell>
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
            maxWidth: 920,
            margin: '0 auto',
          }}
        >
          <button
            type="button"
            onClick={() =>
              router.back()
            }
            style={{
              border: 0,
              background:
                'transparent',
              color:
                P.textMuted,
              padding: 0,
              cursor:
                'pointer',
              display:
                'inline-flex',
              alignItems:
                'center',
              gap: 6,
              marginBottom:
                18,
              fontFamily:
                FONT,
              fontWeight:
                700,
            }}
          >
            <ArrowLeft size={16} />
            Indietro
          </button>

          <header
            style={{
              marginBottom:
                18,
            }}
          >
            <div
              style={{
                display:
                  'flex',
                alignItems:
                  'center',
                gap:
                  7,
                color:
                  P.textFaint,
                fontSize:
                  10,
                textTransform:
                  'uppercase',
                letterSpacing:
                  '.09em',
              }}
            >
              <UserCircle
                size={16}
                color={P.gold}
                weight="fill"
              />
              Amministrazione
            </div>

            <h1
              style={{
                margin:
                  '6px 0 5px',
                fontFamily:
                  FONT_DISPLAY,
                fontSize:
                  31,
              }}
            >
              Gestione utenti
            </h1>

            <p
              style={{
                margin: 0,
                color:
                  P.textMuted,
                fontSize:
                  12,
                lineHeight:
                  1.6,
              }}
            >
              Cerca un account e gestiscine
              l'eliminazione definitiva.
            </p>
          </header>

          {error && (
            <div
              style={{
                marginBottom:
                  12,
                border:
                  `1px solid ${P.error}45`,
                background:
                  'rgba(239,68,68,.08)',
                color:
                  P.error,
                padding:
                  11,
                fontSize:
                  11,
              }}
            >
              {error}
            </div>
          )}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void loadUsers(query);
            }}
            style={{
              display: 'flex',
              gap: 7,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                flex: 1,
                position:
                  'relative',
              }}
            >
              <MagnifyingGlass
                size={16}
                color={
                  P.textFaint
                }
                style={{
                  position:
                    'absolute',
                  left: 11,
                  top: '50%',
                  transform:
                    'translateY(-50%)',
                }}
              />

              <input
                value={query}
                onChange={(event) =>
                  setQuery(
                    event.target.value
                  )
                }
                placeholder="Cerca username o email..."
                style={{
                  width: '100%',
                  boxSizing:
                    'border-box',
                  border:
                    `1px solid ${P.border}`,
                  background:
                    P.card,
                  color:
                    P.text,
                  padding:
                    '11px 12px 11px 36px',
                  outline:
                    'none',
                  fontFamily:
                    FONT,
                }}
              />
            </div>

            <button
              type="submit"
              style={{
                border:
                  `1px solid ${P.gold}`,
                background:
                  P.gold,
                color:
                  '#111',
                padding:
                  '0 15px',
                cursor:
                  'pointer',
                fontWeight:
                  900,
                fontFamily:
                  FONT,
              }}
            >
              Cerca
            </button>
          </form>

          {loading ? (
            <div
              style={{
                border:
                  `1px solid ${P.border}`,
                background:
                  P.card,
                padding:
                  35,
                textAlign:
                  'center',
                color:
                  P.textFaint,
              }}
            >
              Caricamento utenti...
            </div>
          ) : users.length === 0 ? (
            <div
              style={{
                border:
                  `1px dashed ${P.border}`,
                background:
                  P.card,
                padding:
                  35,
                textAlign:
                  'center',
                color:
                  P.textFaint,
              }}
            >
              Nessun utente trovato.
            </div>
          ) : (
            <div
              style={{
                display:
                  'grid',
                gap:
                  8,
              }}
            >
              {users.map((user) => {
                const isMe =
                  user.user_id ===
                  currentUser.id;

                return (
                  <article
                    key={
                      user.user_id
                    }
                    style={{
                      border:
                        `1px solid ${P.border}`,
                      background:
                        P.card,
                      padding:
                        13,
                      display:
                        'flex',
                      alignItems:
                        'center',
                      gap:
                        12,
                      flexWrap:
                        'wrap',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          user.username
                        ) {
                          void router.push(
                            `/utente/${encodeURIComponent(
                              user.username
                            )}`
                          );
                        }
                      }}
                      style={{
                        width:
                          44,
                        height:
                          44,
                        borderRadius:
                          '50%',
                        overflow:
                          'hidden',
                        border:
                          0,
                        background:
                          P.bgSoft,
                        color:
                          P.pink,
                        padding:
                          0,
                        display:
                          'grid',
                        placeItems:
                          'center',
                        fontWeight:
                          900,
                        cursor:
                          user.username
                            ? 'pointer'
                            : 'default',
                      }}
                    >
                      {user.avatar_url ? (
                        <img
                          src={
                            user.avatar_url
                          }
                          alt=""
                          style={{
                            width:
                              '100%',
                            height:
                              '100%',
                            objectFit:
                              'cover',
                          }}
                        />
                      ) : (
                        (
                          user.username ||
                          user.email ||
                          '?'
                        )
                          .charAt(0)
                          .toUpperCase()
                      )}
                    </button>

                    <div
                      style={{
                        flex:
                          1,
                        minWidth:
                          180,
                      }}
                    >
                      <div
                        style={{
                          display:
                            'flex',
                          alignItems:
                            'center',
                          gap:
                            6,
                          flexWrap:
                            'wrap',
                        }}
                      >
                        <strong
                          style={{
                            color:
                              P.text,
                            fontSize:
                              12,
                          }}
                        >
                          @
                          {user.username ||
                            'senza_username'}
                        </strong>

                        {user.role ===
                          'admin' && (
                          <span
                            style={{
                              color:
                                P.gold,
                              fontSize:
                                8,
                              fontWeight:
                                900,
                            }}
                          >
                            ADMIN
                          </span>
                        )}

                        {user.is_suspended && (
                          <span
                            style={{
                              color:
                                P.error,
                              fontSize:
                                8,
                              fontWeight:
                                900,
                            }}
                          >
                            SOSPESO
                          </span>
                        )}

                        {isMe && (
                          <span
                            style={{
                              color:
                                P.textFaint,
                              fontSize:
                                8,
                            }}
                          >
                            TU
                          </span>
                        )}
                      </div>

                      <div
                        style={{
                          color:
                            P.textFaint,
                          fontSize:
                            9,
                          marginTop:
                            3,
                        }}
                      >
                        {user.email ||
                          'Email non disponibile'}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isMe}
                      onClick={() =>
                        openDelete(user)
                      }
                      style={{
                        border:
                          `1px solid ${P.error}`,
                        background:
                          'transparent',
                        color:
                          P.error,
                        padding:
                          '8px 10px',
                        cursor:
                          isMe
                            ? 'not-allowed'
                            : 'pointer',
                        opacity:
                          isMe
                            ? 0.35
                            : 1,
                        display:
                          'inline-flex',
                        alignItems:
                          'center',
                        gap:
                          5,
                        fontFamily:
                          FONT,
                        fontSize:
                          9,
                        fontWeight:
                          900,
                      }}
                    >
                      <Trash
                        size={13}
                        weight="bold"
                      />
                      Elimina account
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {selectedUser && (
          <div
            onMouseDown={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                closeDelete();
              }
            }}
            style={{
              position:
                'fixed',
              inset:
                0,
              zIndex:
                1000,
              background:
                'rgba(0,0,0,.72)',
              display:
                'grid',
              placeItems:
                'center',
              padding:
                18,
            }}
          >
            <div
              style={{
                width:
                  'min(500px,100%)',
                border:
                  `1px solid ${P.error}55`,
                background:
                  P.card,
                padding:
                  20,
              }}
            >
              <WarningCircle
                size={34}
                color={P.error}
                weight="fill"
              />

              {deleteStep === 1 ? (
                <>
                  <h2
                    style={{
                      margin:
                        '10px 0 7px',
                      fontFamily:
                        FONT_DISPLAY,
                      fontSize:
                        23,
                    }}
                  >
                    Eliminare @
                    {selectedUser.username}?
                  </h2>

                  <p
                    style={{
                      margin:
                        0,
                      color:
                        P.textMuted,
                      fontSize:
                        11,
                      lineHeight:
                        1.65,
                    }}
                  >
                    Verranno eliminati definitivamente
                    account Auth, profilo, libreria,
                    recensioni, commenti, like, follow,
                    notifiche e gli altri dati collegati.
                    Lo storico di moderazione già esistente
                    verrà conservato.
                  </p>

                  <div
                    style={{
                      display:
                        'grid',
                      gridTemplateColumns:
                        '1fr 1fr',
                      gap:
                        8,
                      marginTop:
                        17,
                    }}
                  >
                    <button
                      type="button"
                      onClick={
                        closeDelete
                      }
                      style={{
                        border:
                          `1px solid ${P.border}`,
                        background:
                          P.bgSoft,
                        color:
                          P.textMuted,
                        padding:
                          '10px 12px',
                        cursor:
                          'pointer',
                        fontFamily:
                          FONT,
                        fontWeight:
                          800,
                      }}
                    >
                      Annulla
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setDeleteStep(
                          2
                        )
                      }
                      style={{
                        border:
                          `1px solid ${P.error}`,
                        background:
                          P.error,
                        color:
                          '#fff',
                        padding:
                          '10px 12px',
                        cursor:
                          'pointer',
                        fontFamily:
                          FONT,
                        fontWeight:
                          900,
                      }}
                    >
                      Continua
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h2
                    style={{
                      margin:
                        '10px 0 7px',
                      fontFamily:
                        FONT_DISPLAY,
                      fontSize:
                        23,
                    }}
                  >
                    Conferma definitiva
                  </h2>

                  <p
                    style={{
                      margin:
                        0,
                      color:
                        P.textMuted,
                      fontSize:
                        11,
                      lineHeight:
                        1.6,
                    }}
                  >
                    Scrivi esattamente{' '}
                    <strong
                      style={{
                        color:
                          P.text,
                      }}
                    >
                      {
                        selectedUser.username
                      }
                    </strong>{' '}
                    per abilitare la cancellazione.
                  </p>

                  <input
                    value={
                      confirmationUsername
                    }
                    disabled={
                      deleting
                    }
                    onChange={(event) =>
                      setConfirmationUsername(
                        event.target.value
                      )
                    }
                    autoComplete="off"
                    style={{
                      width:
                        '100%',
                      boxSizing:
                        'border-box',
                      marginTop:
                        12,
                      border:
                        `1px solid ${
                          confirmationUsername &&
                          confirmationUsername !==
                            (selectedUser.username ??
                              '')
                            ? P.error
                            : P.border
                        }`,
                      background:
                        P.bgSoft,
                      color:
                        P.text,
                      padding:
                        '11px 12px',
                      outline:
                        'none',
                      fontFamily:
                        FONT,
                    }}
                  />

                  <div
                    style={{
                      display:
                        'grid',
                      gridTemplateColumns:
                        '1fr 1fr',
                      gap:
                        8,
                      marginTop:
                        15,
                    }}
                  >
                    <button
                      type="button"
                      disabled={
                        deleting
                      }
                      onClick={() => {
                        setDeleteStep(
                          1
                        );
                        setConfirmationUsername(
                          ''
                        );
                      }}
                      style={{
                        border:
                          `1px solid ${P.border}`,
                        background:
                          P.bgSoft,
                        color:
                          P.textMuted,
                        padding:
                          '10px 12px',
                        cursor:
                          deleting
                            ? 'wait'
                            : 'pointer',
                        fontFamily:
                          FONT,
                        fontWeight:
                          800,
                      }}
                    >
                      Indietro
                    </button>

                    <button
                      type="button"
                      disabled={
                        deleting ||
                        confirmationUsername !==
                          (selectedUser.username ??
                            '')
                      }
                      onClick={() =>
                        void deleteUser()
                      }
                      style={{
                        border:
                          `1px solid ${P.error}`,
                        background:
                          P.error,
                        color:
                          '#fff',
                        padding:
                          '10px 12px',
                        cursor:
                          deleting
                            ? 'wait'
                            : 'pointer',
                        opacity:
                          deleting ||
                          confirmationUsername !==
                            (selectedUser.username ??
                              '')
                            ? 0.45
                            : 1,
                        fontFamily:
                          FONT,
                        fontWeight:
                          900,
                      }}
                    >
                      {deleting
                        ? 'Eliminazione...'
                        : 'Elimina definitivamente'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </AppShell>
  );
}