'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import AppShell from '@/components/layout/AppShell';
import ReportModal from '@/components/social/ReportModal';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/context/ThemeContext';
import { createBrowserClient } from '@/utils/supabase/browser';
import {
  ArrowLeft,
  ChatCircle,
  DotsThreeVertical,
  FilmSlate,
  Heart,
  Prohibit,
  Star,
  Sparkle,
  UserCircle,
  UserPlus,
  UserCheck,
  UsersThree,
} from '@phosphor-icons/react';

const D = {
  bg: '#0a0806',
  bgSoft: '#14100e',
  card: '#1c1613',
  border: '#2d221c',
  gold: '#f5b92f',
  pink: '#ed3d73',
  pinkGlow: 'rgba(237,61,115,0.15)',
  text: '#f0ebe6',
  textMuted: '#b5a89e',
  textFaint: '#7a6b60',
};

const L = {
  bg: '#f5efe8',
  bgSoft: '#ece3d9',
  card: '#ffffff',
  border: '#d6cbbc',
  gold: '#b8860b',
  pink: '#b83060',
  pinkGlow: 'rgba(184,48,96,0.10)',
  text: '#1f1a16',
  textMuted: '#5c5248',
  textFaint: '#8a7c6e',
};

const FONT = "'Inter','Helvetica Neue',sans-serif";
const FONT_DISPLAY = "'Playfair Display','Georgia',serif";

type PublicProfile = {
  user_id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
};

type PublicLibraryItem = {
  entry_id: string;
  list_type: 'preferiti' | 'watchlist' | 'visti';
  movie_id: string;
  provider: string;
  provider_movie_id: string;
  title: string;
  year: number | null;
  genre: string | null;
  cover: string | null;
  watched_on: string | null;
};

type PublicPrivacy = {
  favorites_visibility: 'private' | 'public';
  watchlist_visibility: 'private' | 'public';
  watched_visibility: 'private' | 'public';
};

type Compatibility = {
  shared_genres: string[];
  shared_genres_count: number;
  shared_favorites_count: number;
  shared_high_ratings_count: number;
  compatibility_score: number;
};

type PublicReview = {
  entry_id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  movie_id: string;
  provider: string;
  provider_movie_id: string;
  title: string;
  year: number | null;
  genre: string | null;
  cover: string | null;
  review_text: string;
  rating: number | null;
  review_updated_at: string | null;
  created_at: string;
  likes_count: number;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function PublicUserPage() {
  const router = useRouter();
  const { currentUser, isGuest, isLoading } = useAuth();
  const { theme } = useTheme();

  const P = theme === 'dark' ? D : L;
  const supabase = useRef(createBrowserClient()).current;

  const username =
    typeof router.query.username === 'string'
      ? router.query.username
      : null;

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [publicLibrary, setPublicLibrary] = useState<
    PublicLibraryItem[]
  >([]);
  const [privacy, setPrivacy] = useState<PublicPrivacy | null>(null);

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState('');

  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const [isBlocked, setIsBlocked] = useState(false);
  const [blockedByOther, setBlockedByOther] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [compatibility, setCompatibility] = useState<Compatibility | null>(null);


  useEffect(() => {
    if (isLoading) return;

    if (!currentUser || currentUser.isGuest || isGuest) {
      void router.replace('/auth');
    }
  }, [currentUser, isGuest, isLoading, router]);

  useEffect(() => {
    if (
      !router.isReady ||
      !username ||
      !currentUser ||
      currentUser.isGuest
    ) {
      return;
    }

    const load = async () => {
      setLoading(true);
      setError('');
      setNotFound(false);
      setUnavailable(false);

      try {
        const [profileResult, reviewsResult] = await Promise.all([
          supabase.rpc('get_public_user_profile', {
            p_username: username,
          }),

          supabase.rpc('get_public_user_reviews', {
            p_username: username,
            p_limit: 50,
            p_offset: 0,
          }),
        ]);

        if (profileResult.error) throw profileResult.error;
        if (reviewsResult.error) throw reviewsResult.error;

        const profileRow: PublicProfile | null =
          Array.isArray(profileResult.data) &&
          profileResult.data.length > 0
            ? (profileResult.data[0] as PublicProfile)
            : null;

        /*
         * Se get_public_user_profile non restituisce il profilo,
         * controlliamo se non esiste oppure se non è disponibile.
         */
        if (!profileRow) {
          const {
            data: accessStatus,
            error: accessError,
          } = await supabase.rpc(
            'get_public_user_access_status',
            {
              p_username: username,
            }
          );

          if (accessError) throw accessError;

          setProfile(null);
          setReviews([]);
          setPublicLibrary([]);
          setPrivacy(null);
          setCompatibility(null);

          if (accessStatus === 'unavailable') {
            setUnavailable(true);
            setNotFound(false);
          } else {
            setUnavailable(false);
            setNotFound(true);
          }

          return;
        }

        setProfile(profileRow);

        /*
         * COMPATIBILITÀ CON IL PROFILO VISITATO
         * Riutilizza get_people_suggestions v2 e prende solo questo utente.
         */
        if (currentUser.id !== profileRow.user_id) {
          const { data: compatibilityRows, error: compatibilityError } =
            await supabase.rpc('get_people_compatibilities', {
              p_user_ids: [profileRow.user_id],
            });

          if (compatibilityError) {
            console.error('Compatibility load failed:', compatibilityError);
            setCompatibility(null);
          } else {
            const row = ((compatibilityRows ?? []) as Array<
              Compatibility & { user_id: string; follows_you?: boolean }
            >)[0];

            setCompatibility(
              row
                ? {
                    shared_genres: Array.isArray(row.shared_genres)
                      ? row.shared_genres
                      : [],
                    shared_genres_count: Number(row.shared_genres_count ?? 0),
                    shared_favorites_count: Number(
                      row.shared_favorites_count ?? 0
                    ),
                    shared_high_ratings_count: Number(
                      row.shared_high_ratings_count ?? 0
                    ),
                    compatibility_score: Number(row.compatibility_score ?? 0),
                  }
                : null
            );
          }
        } else {
          setCompatibility(null);
        }

        /*
         * PRIVACY + LIBRERIA PUBBLICA
         */
        const [privacyResult, libraryResult] = await Promise.all([
          supabase.rpc('get_public_user_privacy', {
            p_user_id: profileRow.user_id,
          }),

          supabase.rpc('get_public_user_library', {
            p_user_id: profileRow.user_id,
          }),
        ]);

        if (privacyResult.error) throw privacyResult.error;
        if (libraryResult.error) throw libraryResult.error;

        const privacyRow: PublicPrivacy | null =
          Array.isArray(privacyResult.data) &&
          privacyResult.data.length > 0
            ? (privacyResult.data[0] as PublicPrivacy)
            : null;

        setPrivacy(privacyRow);

        setPublicLibrary(
          (libraryResult.data ?? []) as PublicLibraryItem[]
        );

        /*
         * RECENSIONI
         */
        setReviews(
          ((reviewsResult.data ?? []) as PublicReview[]).map(
            (review) => ({
              ...review,
              likes_count: Number(review.likes_count ?? 0),
            })
          )
        );

        /*
         * FOLLOW
         */
        const [
          followersResult,
          followingResult,
          myFollowResult,
        ] = await Promise.all([
          supabase
            .from('user_follows')
            .select('*', {
              count: 'exact',
              head: true,
            })
            .eq('following_id', profileRow.user_id),

          supabase
            .from('user_follows')
            .select('*', {
              count: 'exact',
              head: true,
            })
            .eq('follower_id', profileRow.user_id),

          currentUser.id === profileRow.user_id
            ? Promise.resolve({
                data: null,
                error: null,
              })
            : supabase
                .from('user_follows')
                .select('follower_id')
                .eq('follower_id', currentUser.id)
                .eq('following_id', profileRow.user_id)
                .maybeSingle(),
        ]);

        if (followersResult.error) throw followersResult.error;
        if (followingResult.error) throw followingResult.error;
        if (myFollowResult.error) throw myFollowResult.error;

        setFollowersCount(followersResult.count ?? 0);
        setFollowingCount(followingResult.count ?? 0);
        setIsFollowing(Boolean(myFollowResult.data));

        /*
         * BLOCCO
         */
        if (currentUser.id !== profileRow.user_id) {
          const [myBlockResult, anyBlockResult] =
            await Promise.all([
              supabase
                .from('user_blocks')
                .select('blocker_id')
                .eq('blocker_id', currentUser.id)
                .eq('blocked_id', profileRow.user_id)
                .maybeSingle(),

              supabase.rpc('users_are_blocked', {
                p_user_a: currentUser.id,
                p_user_b: profileRow.user_id,
              }),
            ]);

          if (myBlockResult.error) throw myBlockResult.error;
          if (anyBlockResult.error) throw anyBlockResult.error;

          const iBlockedThem = Boolean(myBlockResult.data);
          const anyBlock = Boolean(anyBlockResult.data);

          setIsBlocked(iBlockedThem);
          setBlockedByOther(anyBlock && !iBlockedThem);

          if (anyBlock) {
            setIsFollowing(false);
          }
        } else {
          setIsBlocked(false);
          setBlockedByOther(false);
        }
      } catch (err: unknown) {
        console.error('Public user profile load failed:', err);

        setError(
          err instanceof Error
            ? err.message
            : 'Impossibile caricare il profilo.'
        );
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [
    router.isReady,
    username,
    currentUser,
    supabase,
  ]);

  /*
   * FOLLOW / UNFOLLOW
   */
  const toggleFollow = async () => {
    if (
      !profile ||
      !currentUser ||
      currentUser.isGuest ||
      currentUser.id === profile.user_id ||
      isBlocked ||
      blockedByOther ||
      followLoading
    ) {
      return;
    }

    setFollowLoading(true);
    setError('');

    try {
      if (isFollowing) {
        const { error: unfollowError } = await supabase
          .from('user_follows')
          .delete()
          .eq('follower_id', currentUser.id)
          .eq('following_id', profile.user_id);

        if (unfollowError) throw unfollowError;

        setIsFollowing(false);

        setFollowersCount((current) =>
          Math.max(0, current - 1)
        );

        return;
      }

      const { error: followError } = await supabase
        .from('user_follows')
        .insert({
          follower_id: currentUser.id,
          following_id: profile.user_id,
        });

      if (followError) throw followError;

      setIsFollowing(true);
      setFollowersCount((current) => current + 1);
    } catch (err: unknown) {
      console.error('Follow update failed:', err);

      setError(
        err instanceof Error
          ? err.message
          : 'Impossibile aggiornare il follow.'
      );
    } finally {
      setFollowLoading(false);
    }
  };

  /*
   * BLOCCA / SBLOCCA
   */
  const toggleBlock = async () => {
    if (
      !profile ||
      !currentUser ||
      currentUser.isGuest ||
      currentUser.id === profile.user_id ||
      blockLoading
    ) {
      return;
    }

    setMenuOpen(false);

    const confirmed = window.confirm(
      isBlocked
        ? `Vuoi sbloccare @${profile.username}?`
        : `Vuoi bloccare @${profile.username}? I follow tra voi verranno rimossi e non potrete più interagire con recensioni e commenti.`
    );

    if (!confirmed) return;

    setBlockLoading(true);
    setError('');

    try {
      if (isBlocked) {
        const { error: unblockError } = await supabase
          .from('user_blocks')
          .delete()
          .eq('blocker_id', currentUser.id)
          .eq('blocked_id', profile.user_id);

        if (unblockError) throw unblockError;

        setIsBlocked(false);
        setBlockedByOther(false);

        return;
      }

      const { error: blockError } = await supabase
        .from('user_blocks')
        .insert({
          blocker_id: currentUser.id,
          blocked_id: profile.user_id,
        });

      if (blockError) throw blockError;

      setIsBlocked(true);
      setIsFollowing(false);

      const [followersResult, followingResult] =
        await Promise.all([
          supabase
            .from('user_follows')
            .select('*', {
              count: 'exact',
              head: true,
            })
            .eq('following_id', profile.user_id),

          supabase
            .from('user_follows')
            .select('*', {
              count: 'exact',
              head: true,
            })
            .eq('follower_id', profile.user_id),
        ]);

      if (!followersResult.error) {
        setFollowersCount(followersResult.count ?? 0);
      }

      if (!followingResult.error) {
        setFollowingCount(followingResult.count ?? 0);
      }
    } catch (err: unknown) {
      console.error('User block update failed:', err);

      setError(
        err instanceof Error
          ? err.message
          : 'Impossibile aggiornare il blocco utente.'
      );
    } finally {
      setBlockLoading(false);
    }
  };

  /*
   * STATISTICHE
   */
  const averageRating = useMemo(() => {
    const rated = reviews.filter(
      (review) => review.rating !== null
    );

    if (rated.length === 0) return null;

    return (
      rated.reduce(
        (total, review) =>
          total + Number(review.rating),
        0
      ) / rated.length
    );
  }, [reviews]);

  const totalLikes = useMemo(
    () =>
      reviews.reduce(
        (total, review) =>
          total + Number(review.likes_count ?? 0),
        0
      ),
    [reviews]
  );


  const recentActivity = useMemo(
    () =>
      [...reviews]
        .sort((a, b) => {
          const aDate = new Date(
            a.review_updated_at || a.created_at
          ).getTime();
          const bDate = new Date(
            b.review_updated_at || b.created_at
          ).getTime();

          return bDate - aDate;
        })
        .slice(0, 3),
    [reviews]
  );

  /*
   * LIBRERIA PUBBLICA
   */
  const publicFavorites = useMemo(
    () =>
      publicLibrary.filter(
        (item) => item.list_type === 'preferiti'
      ),
    [publicLibrary]
  );

  const publicWatchlist = useMemo(
    () =>
      publicLibrary.filter(
        (item) => item.list_type === 'watchlist'
      ),
    [publicLibrary]
  );

  const publicWatched = useMemo(
    () =>
      publicLibrary.filter(
        (item) => item.list_type === 'visti'
      ),
    [publicLibrary]
  );

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
        <FilmSlate
          size={42}
          color={P.pink}
          weight="duotone"
        />
      </div>
    );
  }

  return (
    <AppShell activeNav="recensioni">
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
            maxWidth: 980,
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
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              fontWeight: 700,
              marginBottom: 18,
            }}
          >
            <ArrowLeft size={16} />
            Indietro
          </button>

          {loading ? (
            <div
              style={{
                border: `1px solid ${P.border}`,
                background: P.card,
                padding: 40,
                textAlign: 'center',
                color: P.textFaint,
              }}
            >
              Caricamento profilo...
            </div>
          ) : error ? (
            <div
              style={{
                border: '1px solid rgba(239,68,68,.3)',
                background: 'rgba(239,68,68,.08)',
                color: '#fb7185',
                padding: 18,
              }}
            >
              {error}
            </div>
          ) : unavailable ? (
            <div
              style={{
                border: `1px solid ${P.border}`,
                background: P.card,
                padding: 40,
                textAlign: 'center',
              }}
            >
              <Prohibit
                size={40}
                color={P.textFaint}
                weight="duotone"
              />

              <h1
                style={{
                  fontFamily: FONT_DISPLAY,
                  color: P.text,
                  fontSize: 24,
                  marginBottom: 8,
                }}
              >
                Profilo non disponibile
              </h1>

              <p
                style={{
                  margin: 0,
                  color: P.textMuted,
                  fontSize: 12,
                  lineHeight: 1.6,
                }}
              >
                Questo profilo non è disponibile per il tuo
                account.
              </p>
            </div>
          ) : notFound || !profile ? (
            <div
              style={{
                border: `1px solid ${P.border}`,
                background: P.card,
                padding: 40,
                textAlign: 'center',
              }}
            >
              <UserCircle size={40} color={P.textFaint} />

              <h1
                style={{
                  fontFamily: FONT_DISPLAY,
                  color: P.text,
                  fontSize: 24,
                }}
              >
                Profilo non trovato
              </h1>
            </div>
          ) : (
            <>
              {/* PROFILO */}

              <section
                className="public-profile-head"
                style={{
                  border: `1px solid ${P.border}`,
                  background: P.card,
                  padding: 24,
                  display: 'grid',
                  gridTemplateColumns: '96px minmax(0,1fr)',
                  gap: 20,
                  alignItems: 'center',
                  marginBottom: 18,
                }}
              >
                <div
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: '50%',
                    overflow: 'hidden',
                    background: P.pinkGlow,
                    display: 'grid',
                    placeItems: 'center',
                    color: P.pink,
                    fontSize: 36,
                    fontWeight: 900,
                  }}
                >
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={`Avatar di ${profile.username}`}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  ) : (
                    profile.username.charAt(0).toUpperCase()
                  )}
                </div>

                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      color: P.textFaint,
                      fontSize: 10,
                      textTransform: 'uppercase',
                      letterSpacing: '.1em',
                    }}
                  >
                    Profilo pubblico
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 14,
                      flexWrap: 'wrap',
                    }}
                  >
                    <h1
                      style={{
                        margin: '4px 0 7px',
                        fontFamily: FONT_DISPLAY,
                        color: P.text,
                        fontSize: 'clamp(26px,4vw,36px)',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      @{profile.username}
                    </h1>

                    {currentUser.id !== profile.user_id && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 7,
                          position: 'relative',
                        }}
                      >
                        {!isBlocked && !blockedByOther && (
                          <button
                            type="button"
                            onClick={() => void toggleFollow()}
                            disabled={followLoading}
                            style={{
                              border: `1px solid ${
                                isFollowing
                                  ? P.border
                                  : P.pink
                              }`,
                              background: isFollowing
                                ? P.bgSoft
                                : P.pink,
                              color: isFollowing
                                ? P.textMuted
                                : '#ffffff',
                              padding: '10px 14px',
                              cursor: followLoading
                                ? 'wait'
                                : 'pointer',
                              opacity: followLoading ? 0.6 : 1,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 7,
                              fontFamily: FONT,
                              fontSize: 11,
                              fontWeight: 800,
                            }}
                          >
                            {isFollowing ? (
                              <UserCheck
                                size={16}
                                weight="fill"
                              />
                            ) : (
                              <UserPlus
                                size={16}
                                weight="bold"
                              />
                            )}

                            {followLoading
                              ? 'Attendi...'
                              : isFollowing
                              ? 'Segui già'
                              : 'Segui'}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            setMenuOpen((open) => !open)
                          }
                          aria-label="Altre azioni"
                          style={{
                            width: 38,
                            height: 38,
                            border: `1px solid ${P.border}`,
                            background: P.bgSoft,
                            color: P.textMuted,
                            cursor: 'pointer',
                            display: 'grid',
                            placeItems: 'center',
                          }}
                        >
                          <DotsThreeVertical
                            size={18}
                            weight="bold"
                          />
                        </button>

                        {menuOpen && (
                          <div
                            style={{
                              position: 'absolute',
                              right: 0,
                              top: 44,
                              zIndex: 30,
                              minWidth: 180,
                              border: `1px solid ${P.border}`,
                              background: P.card,
                              padding: 5,
                              boxShadow:
                                '0 14px 36px rgba(0,0,0,.28)',
                            }}
                          >
                            {!isBlocked && (
                              <button
                                type="button"
                                onClick={() => {
                                  setMenuOpen(false);
                                  setReportOpen(true);
                                }}
                                style={{
                                  width: '100%',
                                  border: 0,
                                  background: 'transparent',
                                  color: P.textMuted,
                                  padding: '9px 10px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 7,
                                  textAlign: 'left',
                                  fontFamily: FONT,
                                  fontSize: 10,
                                  fontWeight: 800,
                                }}
                              >
                                Segnala utente
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() =>
                                void toggleBlock()
                              }
                              disabled={blockLoading}
                              style={{
                                width: '100%',
                                border: 0,
                                background: 'transparent',
                                color: isBlocked
                                  ? P.gold
                                  : '#ef4444',
                                padding: '9px 10px',
                                cursor: blockLoading
                                  ? 'wait'
                                  : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 7,
                                textAlign: 'left',
                                fontFamily: FONT,
                                fontSize: 10,
                                fontWeight: 800,
                              }}
                            >
                              <Prohibit
                                size={15}
                                weight="bold"
                              />

                              {blockLoading
                                ? 'Attendi...'
                                : isBlocked
                                ? 'Sblocca utente'
                                : 'Blocca utente'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <p
                    style={{
                      margin: 0,
                      color: P.textMuted,
                      fontSize: 13,
                      lineHeight: 1.6,
                      maxWidth: 620,
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {profile.bio?.trim() ||
                      'Nessuna bio pubblica.'}
                  </p>

                  {(isBlocked || blockedByOther) && (
                    <div
                      style={{
                        marginTop: 10,
                        border: `1px solid ${P.border}`,
                        background: P.bgSoft,
                        color: P.textFaint,
                        padding: '8px 10px',
                        fontSize: 10,
                        lineHeight: 1.5,
                      }}
                    >
                      {isBlocked
                        ? 'Hai bloccato questo utente. Le interazioni tra voi sono disattivate.'
                        : 'Le interazioni con questo utente non sono disponibili.'}
                    </div>
                  )}

                  {!isBlocked && !blockedByOther && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 18,
                        marginTop: 12,
                        flexWrap: 'wrap',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          void router.push(
                            `/utente/${encodeURIComponent(
                              profile.username
                            )}/connessioni?tab=follower`
                          )
                        }
                        style={{
                          border: 0,
                          background: 'transparent',
                          padding: 0,
                          color: P.textMuted,
                          fontSize: 11,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          fontFamily: FONT,
                        }}
                      >
                        <UsersThree
                          size={14}
                          color={P.pink}
                          weight="fill"
                        />

                        <strong style={{ color: P.text }}>
                          {followersCount}
                        </strong>

                        follower
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void router.push(
                            `/utente/${encodeURIComponent(
                              profile.username
                            )}/connessioni?tab=seguiti`
                          )
                        }
                        style={{
                          border: 0,
                          background: 'transparent',
                          padding: 0,
                          color: P.textMuted,
                          fontSize: 11,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          fontFamily: FONT,
                        }}
                      >
                        <UserCheck
                          size={14}
                          color={P.gold}
                          weight="fill"
                        />

                        <strong style={{ color: P.text }}>
                          {followingCount}
                        </strong>

                        seguiti
                      </button>
                    </div>
                  )}
                </div>
              </section>

              {!isBlocked &&
                !blockedByOther &&
                currentUser.id !== profile.user_id &&
                compatibility &&
                compatibility.compatibility_score > 0 && (
                  <section
                    style={{
                      border: `1px solid ${P.border}`,
                      background: P.card,
                      padding: 16,
                      marginBottom: 18,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 7,
                        color: P.gold,
                        fontSize: 10,
                        fontWeight: 900,
                        textTransform: 'uppercase',
                        letterSpacing: '.09em',
                        marginBottom: 10,
                      }}
                    >
                      <Sparkle size={15} weight="fill" />
                      Gusti in comune
                    </div>

                    <div
                      className="compatibility-grid"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3,minmax(0,1fr))',
                        gap: 8,
                      }}
                    >
                      {[
                        {
                          value: compatibility.shared_favorites_count,
                          label: 'Preferiti condivisi',
                        },
                        {
                          value: compatibility.shared_high_ratings_count,
                          label: 'Film amati da entrambi',
                        },
                        {
                          value: compatibility.shared_genres_count,
                          label: 'Generi in comune',
                        },
                      ].map((item) => (
                        <div
                          key={item.label}
                          style={{
                            border: `1px solid ${P.border}`,
                            background: P.bgSoft,
                            padding: 11,
                          }}
                        >
                          <strong
                            style={{
                              display: 'block',
                              color: P.text,
                              fontSize: 18,
                            }}
                          >
                            {item.value}
                          </strong>
                          <span
                            style={{
                              color: P.textFaint,
                              fontSize: 9,
                            }}
                          >
                            {item.label}
                          </span>
                        </div>
                      ))}
                    </div>

                    {compatibility.shared_genres.length > 0 && (
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 6,
                          marginTop: 10,
                        }}
                      >
                        {compatibility.shared_genres.slice(0, 5).map((genre) => (
                          <span
                            key={genre}
                            style={{
                              border: `1px solid ${P.gold}55`,
                              background: `${P.gold}12`,
                              color: P.gold,
                              padding: '4px 7px',
                              fontSize: 9,
                              fontWeight: 800,
                            }}
                          >
                            {genre}
                          </span>
                        ))}
                      </div>
                    )}
                  </section>
                )}

              {!isBlocked &&
                !blockedByOther &&
                recentActivity.length > 0 && (
                  <section
                    style={{
                      border: `1px solid ${P.border}`,
                      background: P.card,
                      padding: 16,
                      marginBottom: 18,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        marginBottom: 10,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 7,
                          color: P.gold,
                          fontSize: 10,
                          fontWeight: 900,
                          textTransform: 'uppercase',
                          letterSpacing: '.09em',
                        }}
                      >
                        <ChatCircle size={15} weight="fill" />
                        Attività recente
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          router.push(
                            `/recensioni?utente=${encodeURIComponent(
                              profile.username
                            )}`
                          )
                        }
                        style={{
                          border: 0,
                          background: 'transparent',
                          color: P.textFaint,
                          cursor: 'pointer',
                          fontFamily: FONT,
                          fontSize: 9,
                          fontWeight: 800,
                          padding: 0,
                        }}
                      >
                        Vedi recensioni
                      </button>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gap: 8,
                      }}
                    >
                      {recentActivity.map((review) => (
                        <button
                          key={`activity-${review.entry_id}`}
                          type="button"
                          onClick={() =>
                            router.push(
                              `/recensioni?review=${encodeURIComponent(
                                review.entry_id
                              )}`
                            )
                          }
                          style={{
                            width: '100%',
                            border: `1px solid ${P.border}`,
                            background: P.bgSoft,
                            color: P.text,
                            padding: 9,
                            display: 'grid',
                            gridTemplateColumns:
                              '42px minmax(0,1fr) auto',
                            gap: 9,
                            alignItems: 'center',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontFamily: FONT,
                          }}
                        >
                          <div
                            style={{
                              width: 42,
                              aspectRatio: '2 / 3',
                              background: P.card,
                              overflow: 'hidden',
                              display: 'grid',
                              placeItems: 'center',
                              color: P.textFaint,
                            }}
                          >
                            {review.cover ? (
                              <img
                                src={review.cover}
                                alt={review.title}
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                }}
                              />
                            ) : (
                              <FilmSlate
                                size={18}
                                weight="duotone"
                              />
                            )}
                          </div>

                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: 11,
                                fontWeight: 850,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {review.title}
                            </div>

                            <div
                              style={{
                                color: P.textFaint,
                                fontSize: 9,
                                marginTop: 3,
                                overflow: 'hidden',
                                whiteSpace: 'nowrap',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {review.review_text}
                            </div>
                          </div>

                          <div
                            style={{
                              color: P.textFaint,
                              fontSize: 8,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {formatDate(
                              review.review_updated_at ||
                                review.created_at
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

              {!isBlocked && !blockedByOther && (
                <>
                  {/* STATISTICHE */}

                  <div
                    className="public-stats"
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        'repeat(3,minmax(0,1fr))',
                      gap: 10,
                      marginBottom: 22,
                    }}
                  >
                    <div
                      style={{
                        border: `1px solid ${P.border}`,
                        background: P.card,
                        padding: 14,
                      }}
                    >
                      <ChatCircle
                        size={17}
                        color={P.pink}
                        weight="fill"
                      />

                      <strong
                        style={{
                          display: 'block',
                          fontSize: 21,
                          color: P.text,
                          marginTop: 7,
                        }}
                      >
                        {reviews.length}
                      </strong>

                      <span
                        style={{
                          color: P.textFaint,
                          fontSize: 10,
                        }}
                      >
                        Recensioni pubbliche
                      </span>
                    </div>

                    <div
                      style={{
                        border: `1px solid ${P.border}`,
                        background: P.card,
                        padding: 14,
                      }}
                    >
                      <Star
                        size={17}
                        color={P.gold}
                        weight="fill"
                      />

                      <strong
                        style={{
                          display: 'block',
                          fontSize: 21,
                          color: P.text,
                          marginTop: 7,
                        }}
                      >
                        {averageRating !== null
                          ? averageRating.toFixed(1)
                          : '—'}
                      </strong>

                      <span
                        style={{
                          color: P.textFaint,
                          fontSize: 10,
                        }}
                      >
                        Media voti pubblici
                      </span>
                    </div>

                    <div
                      style={{
                        border: `1px solid ${P.border}`,
                        background: P.card,
                        padding: 14,
                      }}
                    >
                      <Heart
                        size={17}
                        color={P.pink}
                        weight="fill"
                      />

                      <strong
                        style={{
                          display: 'block',
                          fontSize: 21,
                          color: P.text,
                          marginTop: 7,
                        }}
                      >
                        {totalLikes}
                      </strong>

                      <span
                        style={{
                          color: P.textFaint,
                          fontSize: 10,
                        }}
                      >
                        Like ricevuti
                      </span>
                    </div>
                  </div>

                  {/* LIBRERIA PUBBLICA */}

                  {(privacy?.favorites_visibility ===
                    'public' ||
                    privacy?.watchlist_visibility ===
                      'public' ||
                    privacy?.watched_visibility ===
                      'public') && (
                    <div
                      style={{
                        display: 'grid',
                        gap: 14,
                        marginBottom: 22,
                      }}
                    >
                      {[
                        {
                          key: 'preferiti',
                          title: 'Preferiti',
                          visible:
                            privacy?.favorites_visibility ===
                            'public',
                          items: publicFavorites,
                          color: P.pink,
                          empty:
                            'Nessun film preferito pubblico.',
                        },
                        {
                          key: 'watchlist',
                          title: 'Watchlist',
                          visible:
                            privacy?.watchlist_visibility ===
                            'public',
                          items: publicWatchlist,
                          color: P.gold,
                          empty:
                            'La watchlist pubblica è vuota.',
                        },
                        {
                          key: 'visti',
                          title: 'Visti',
                          visible:
                            privacy?.watched_visibility ===
                            'public',
                          items: publicWatched,
                          color: P.textMuted,
                          empty:
                            'Nessun film visto pubblico.',
                        },
                      ]
                        .filter((section) => section.visible)
                        .map((section) => (
                          <section
                            key={section.key}
                            style={{
                              border: `1px solid ${P.border}`,
                              background: P.card,
                              padding: 16,
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent:
                                  'space-between',
                                gap: 12,
                                marginBottom: 12,
                              }}
                            >
                              <h2
                                style={{
                                  margin: 0,
                                  color: P.text,
                                  fontFamily: FONT_DISPLAY,
                                  fontSize: 19,
                                }}
                              >
                                {section.title}
                              </h2>

                              <span
                                style={{
                                  color: section.color,
                                  fontSize: 10,
                                  fontWeight: 800,
                                }}
                              >
                                {section.items.length}
                              </span>
                            </div>

                            {section.items.length === 0 ? (
                              <div
                                style={{
                                  border: `1px dashed ${P.border}`,
                                  background: P.bgSoft,
                                  color: P.textFaint,
                                  padding: 18,
                                  textAlign: 'center',
                                  fontSize: 10,
                                }}
                              >
                                {section.empty}
                              </div>
                            ) : (
                              <div
                                style={{
                                  display: 'flex',
                                  gap: 10,
                                  overflowX: 'auto',
                                  paddingBottom: 4,
                                }}
                              >
                                {section.items.map((item) => (
                                  <button
                                    key={`${section.key}-${item.entry_id}`}
                                    type="button"
                                    onClick={() => {
                                      if (
                                        item.provider === 'tmdb'
                                      ) {
                                        void router.push(
                                          `/film/${item.provider_movie_id}`
                                        );
                                      }
                                    }}
                                    style={{
                                      width: 94,
                                      minWidth: 94,
                                      border: 0,
                                      padding: 0,
                                      background:
                                        'transparent',
                                      color: P.text,
                                      textAlign: 'left',
                                      cursor:
                                        item.provider === 'tmdb'
                                          ? 'pointer'
                                          : 'default',
                                    }}
                                  >
                                    <div
                                      style={{
                                        width: 94,
                                        aspectRatio: '2/3',
                                        border: `1px solid ${P.border}`,
                                        background: P.bgSoft,
                                        overflow: 'hidden',
                                      }}
                                    >
                                      {item.cover ? (
                                        <img
                                          src={item.cover}
                                          alt={item.title}
                                          style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                          }}
                                        />
                                      ) : (
                                        <div
                                          style={{
                                            width: '100%',
                                            height: '100%',
                                            display: 'grid',
                                            placeItems:
                                              'center',
                                          }}
                                        >
                                          <FilmSlate size={24} color={P.textFaint} weight="duotone" />
                                        </div>
                                      )}
                                    </div>

                                    <strong
                                      style={{
                                        display: 'block',
                                        marginTop: 6,
                                        color: P.text,
                                        fontSize: 10,
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow:
                                          'ellipsis',
                                      }}
                                    >
                                      {item.title}
                                    </strong>

                                    <span
                                      style={{
                                        display: 'block',
                                        marginTop: 2,
                                        color: P.textFaint,
                                        fontSize: 8,
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow:
                                          'ellipsis',
                                      }}
                                    >
                                      {[item.year, item.genre]
                                        .filter(Boolean)
                                        .join(' · ')}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </section>
                        ))}
                    </div>
                  )}

                  {/* RECENSIONI */}

                  <section>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 12,
                      }}
                    >
                      <ChatCircle
                        size={18}
                        color={P.gold}
                        weight="fill"
                      />

                      <h2
                        style={{
                          margin: 0,
                          fontFamily: FONT_DISPLAY,
                          fontSize: 21,
                        }}
                      >
                        Recensioni pubbliche
                      </h2>
                    </div>

                    {reviews.length === 0 ? (
                      <div
                        style={{
                          border: `1px dashed ${P.border}`,
                          background: P.card,
                          padding: 30,
                          textAlign: 'center',
                          color: P.textFaint,
                          fontSize: 12,
                        }}
                      >
                        Questo utente non ha ancora pubblicato
                        recensioni.
                      </div>
                    ) : (
                      <div
                        style={{
                          display: 'grid',
                          gap: 10,
                        }}
                      >
                        {reviews.map((review) => (
                          <article
                            key={review.entry_id}
                            style={{
                              border: `1px solid ${P.border}`,
                              background: P.card,
                              padding: 12,
                              display: 'grid',
                              gridTemplateColumns:
                                '62px minmax(0,1fr)',
                              gap: 13,
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                if (
                                  review.provider === 'tmdb'
                                ) {
                                  void router.push(
                                    `/film/${review.provider_movie_id}`
                                  );
                                }
                              }}
                              style={{
                                width: 62,
                                height: 92,
                                border: `1px solid ${P.border}`,
                                background: P.bgSoft,
                                padding: 0,
                                overflow: 'hidden',
                                cursor:
                                  review.provider === 'tmdb'
                                    ? 'pointer'
                                    : 'default',
                              }}
                            >
                              {review.cover ? (
                                <img
                                  src={review.cover}
                                  alt={review.title}
                                  style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                  }}
                                />
                              ) : (
                                <span
                                  style={{
                                    fontSize: 24,
                                  }}
                                >
                                  <FilmSlate size={24} color={P.textFaint} weight="duotone" />
                                </span>
                              )}
                            </button>

                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent:
                                    'space-between',
                                  gap: 12,
                                  alignItems: 'flex-start',
                                }}
                              >
                                <div style={{ minWidth: 0 }}>
                                  <strong
                                    style={{
                                      display: 'block',
                                      color: P.text,
                                      fontSize: 13,
                                      overflowWrap:
                                        'anywhere',
                                    }}
                                  >
                                    {review.title}
                                  </strong>

                                  <div
                                    style={{
                                      color: P.textFaint,
                                      fontSize: 9,
                                      marginTop: 3,
                                    }}
                                  >
                                    {[
                                      review.year,
                                      review.genre,
                                    ]
                                      .filter(Boolean)
                                      .join(' · ')}
                                  </div>
                                </div>

                                {review.rating !== null && (
                                  <span
                                    style={{
                                      color: P.gold,
                                      fontSize: 11,
                                      fontWeight: 800,
                                      display:
                                        'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                      flexShrink: 0,
                                    }}
                                  >
                                    <Star
                                      size={12}
                                      weight="fill"
                                    />

                                    {Number(
                                      review.rating
                                    ).toFixed(1)}
                                  </span>
                                )}
                              </div>

                              <p
                                style={{
                                  color: P.textMuted,
                                  fontSize: 11,
                                  lineHeight: 1.6,
                                  margin: '9px 0',
                                  whiteSpace: 'pre-wrap',
                                  overflowWrap: 'anywhere',
                                }}
                              >
                                {review.review_text}
                              </p>

                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent:
                                    'space-between',
                                  gap: 12,
                                  color: P.textFaint,
                                  fontSize: 9,
                                }}
                              >
                                <span>
                                  {formatDate(
                                    review.review_updated_at ||
                                      review.created_at
                                  )}
                                </span>

                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                  }}
                                >
                                  <Heart
                                    size={12}
                                    weight={
                                      review.likes_count > 0
                                        ? 'fill'
                                        : 'regular'
                                    }
                                    color={P.pink}
                                  />

                                  {review.likes_count}
                                </span>
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                </>
              )}
            </>
          )}
        </div>

        <style jsx global>{`
          @media (max-width: 620px) {
            .public-profile-head {
              grid-template-columns: 1fr !important;
              text-align: center;
              justify-items: center;
            }

            .public-profile-head > div:last-child {
              width: 100%;
            }

            .public-stats {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </main>

      <ReportModal
        open={reportOpen}
        target={
          profile
            ? {
                type: 'user',
                userId: profile.user_id,
                label: `@${profile.username}`,
              }
            : null
        }
        onClose={() => setReportOpen(false)}
      />
    </AppShell>
  );
}