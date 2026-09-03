'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/context/ThemeContext';
import { createBrowserClient } from '@/utils/supabase/browser';
import { ensureTmdbMovie } from '@/utils/movieEntries';
import {
  BookmarkSimple,
  CaretRight,
  ChatCircle,
  Check,
  PaperPlaneTilt,
  Trash,
  Funnel,
  Heart,
  FilmSlate,
  MagnifyingGlass,
  PencilSimple,
  Star,
  UserCheck,
  UserPlus,
  X,
  ArrowRight,
} from '@phosphor-icons/react';

const D = {
  bg: '#0a0806',
  bgSoft: '#14100e',
  card: '#1c1613',
  cardHover: '#241d19',
  border: '#2d221c',
  gold: '#f5b92f',
  goldSoft: '#ffd875',
  goldGlow: 'rgba(245,185,47,0.12)',
  pink: '#ed3d73',
  pinkDeep: '#8e1740',
  pinkGlow: 'rgba(237,61,115,0.15)',
  text: '#f0ebe6',
  textMuted: '#b5a89e',
  textFaint: '#7a6b60',
  success: '#4ade80',
  danger: '#fb7185',
};

const L = {
  bg: '#f5efe8',
  bgSoft: '#ece3d9',
  card: '#ffffff',
  cardHover: '#faf5ef',
  border: '#d6cbbc',
  gold: '#b8860b',
  goldSoft: '#e8c84a',
  goldGlow: 'rgba(184,134,11,0.10)',
  pink: '#b83060',
  pinkDeep: '#8a1d44',
  pinkGlow: 'rgba(184,48,96,0.10)',
  text: '#1f1a16',
  textMuted: '#5c5248',
  textFaint: '#8a7c6e',
  success: '#16a34a',
  danger: '#dc2626',
};

const FONT = "'Inter','Helvetica Neue',sans-serif";
const FONT_DISPLAY = "'Playfair Display','Georgia',serif";

type PublicReview = {
  entry_id: string;
  user_id: string;
  username: string | null;
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

type ReviewComment = {
  comment_id: string;
  entry_id: string;
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  text: string;
  created_at: string;
  updated_at: string;
};

type WatchlistRow = {
  id: string;
  movie_id: string;
  movie_catalog:
    | {
        id: string;
        provider: string;
        provider_movie_id: string;
        title: string;
        year: number | null;
        genre: string | null;
        cover: string | null;
      }
    | {
        id: string;
        provider: string;
        provider_movie_id: string;
        title: string;
        year: number | null;
        genre: string | null;
        cover: string | null;
      }[]
    | null;
};

type SearchMovie = {
  id: string;
  tmdb_id: number;
  title: string;
  year: number;
  genre: string;
  cover: string | null;
  rating: number;
};

type Tab = 'tutte' | 'seguiti' | 'film' | 'animazione' | 'serie';

type AuthorSocial = {
  compatibility_score: number;
  shared_favorites_count: number;
  shared_high_ratings_count: number;
  shared_genres_count: number;
  follows_you: boolean;
};

function getCatalogMovie(row: WatchlistRow) {
  if (Array.isArray(row.movie_catalog)) {
    return row.movie_catalog[0] ?? null;
  }

  return row.movie_catalog;
}

function formatRelativeDate(value: string) {
  const date = new Date(value);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.max(0, Math.floor(diff / 3_600_000));

  if (hours < 1) return 'adesso';
  if (hours < 24) return `${hours} ${hours === 1 ? 'ora' : 'ore'} fa`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ${days === 1 ? 'giorno' : 'giorni'} fa`;

  return date.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function Avatar({
  username,
  url,
  size = 30,
}: {
  username: string | null;
  url: string | null;
  size?: number;
}) {
  const initial = (username || '?').charAt(0).toUpperCase();

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        flexShrink: 0,
        display: 'grid',
        placeItems: 'center',
        background: 'linear-gradient(135deg,#ed3d73,#8e1740)',
        color: '#fff',
        fontWeight: 800,
        fontSize: Math.max(10, size * 0.4),
      }}
    >
      {url ? (
        <img
          src={url}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        initial
      )}
    </div>
  );
}

export default function RecensioniPage() {
  const router = useRouter();
  const { currentUser, isGuest, isLoading } = useAuth();
  const { theme } = useTheme();
  const P = theme === 'dark' ? D : L;
  const supabase = useRef(createBrowserClient()).current;

  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [followingReviews, setFollowingReviews] = useState<PublicReview[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistRow[]>([]);
  const [likedEntries, setLikedEntries] = useState<Set<string>>(new Set());
  const [authorSocial, setAuthorSocial] = useState<Record<string, AuthorSocial>>({});
  const [followingUserIds, setFollowingUserIds] = useState<Set<string>>(new Set());
  const [followBusyUserId, setFollowBusyUserId] = useState<string | null>(null);

  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [openCommentsEntry, setOpenCommentsEntry] = useState<string | null>(null);
  const [commentsByEntry, setCommentsByEntry] = useState<Record<string, ReviewComment[]>>({});
  const [commentsLoadingEntry, setCommentsLoadingEntry] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentSaving, setCommentSaving] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');

  const [loadingFeed, setLoadingFeed] = useState(true);
  const [feedError, setFeedError] = useState('');

  const [tab, setTab] = useState<Tab>('tutte');
  const [search, setSearch] = useState('');
  const [targetMovieId, setTargetMovieId] = useState<number | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [movieQuery, setMovieQuery] = useState('');
  const [movieResults, setMovieResults] = useState<SearchMovie[]>([]);
  const [movieSearching, setMovieSearching] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<SearchMovie | null>(null);
  const [reviewText, setReviewText] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [publishRating, setPublishRating] = useState(true);
  const [savingReview, setSavingReview] = useState(false);
  const [modalError, setModalError] = useState('');

  useEffect(() => {
    if (isLoading) return;

    if (!currentUser || currentUser.isGuest || isGuest) {
      router.replace('/auth');
    }
  }, [currentUser, isGuest, isLoading, router]);

  const loadPage = async () => {
    if (!currentUser || currentUser.isGuest) return;

    setLoadingFeed(true);
    setFeedError('');

    try {
      const [
        reviewsResult,
        followingReviewsResult,
        watchlistResult,
        likesResult,
      ] = await Promise.all([
        supabase.rpc('get_public_reviews', {
          p_limit: 50,
          p_offset: 0,
        }),
        supabase.rpc('get_following_reviews', {
          p_limit: 50,
          p_offset: 0,
        }),
        supabase
          .from('user_movie_entries')
          .select(
            'id,movie_id,movie_catalog(id,provider,provider_movie_id,title,year,genre,cover)'
          )
          .eq('user_id', currentUser.id)
          .eq('in_watchlist', true)
          .order('updated_at', { ascending: false })
          .limit(8),
        supabase.rpc('get_my_review_likes'),
      ]);

      if (reviewsResult.error) throw reviewsResult.error;
      if (followingReviewsResult.error) throw followingReviewsResult.error;
      if (watchlistResult.error) throw watchlistResult.error;
      if (likesResult.error) throw likesResult.error;

      const normalizedReviews =
        ((reviewsResult.data ?? []) as PublicReview[]).map((review) => ({
          ...review,
          likes_count: Number(review.likes_count ?? 0),
        }));

      setReviews(normalizedReviews);

      const normalizedFollowingReviews =
        ((followingReviewsResult.data ?? []) as PublicReview[]).map(
          (review) => ({
            ...review,
            likes_count: Number(review.likes_count ?? 0),
          })
        );

      setFollowingReviews(normalizedFollowingReviews);
      setFollowingUserIds(
        new Set(normalizedFollowingReviews.map((review) => review.user_id))
      );

      const authorIds = Array.from(
        new Set(
          normalizedReviews
            .map((review) => review.user_id)
            .filter((id) => id !== currentUser.id)
        )
      );

      if (authorIds.length > 0) {
        const { data: socialRows, error: socialError } =
          await supabase.rpc('get_people_compatibilities', {
            p_user_ids: authorIds,
          });

        if (socialError) {
          console.error('Review author compatibility load failed:', socialError);
          setAuthorSocial({});
        } else {
          const next: Record<string, AuthorSocial> = {};

          for (const row of socialRows ?? []) {
            if (typeof row.user_id !== 'string') continue;

            next[row.user_id] = {
              compatibility_score: Number(row.compatibility_score ?? 0),
              shared_favorites_count: Number(row.shared_favorites_count ?? 0),
              shared_high_ratings_count: Number(row.shared_high_ratings_count ?? 0),
              shared_genres_count: Number(row.shared_genres_count ?? 0),
              follows_you: Boolean(row.follows_you),
            };
          }

          setAuthorSocial(next);
        }
      } else {
        setAuthorSocial({});
      }

      setWatchlist((watchlistResult.data ?? []) as WatchlistRow[]);

      setLikedEntries(
        new Set(
          ((likesResult.data ?? []) as { entry_id: string }[]).map(
            (item) => item.entry_id
          )
        )
      );
    } catch (error: any) {
      console.error('Reviews page load failed:', error);
      setFeedError(error.message ?? 'Impossibile caricare le recensioni.');
    } finally {
      setLoadingFeed(false);
    }
  };

  useEffect(() => {
    if (!currentUser || currentUser.isGuest) return;
    void loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  useEffect(() => {
    if (!modalOpen || movieQuery.trim().length < 2) {
      setMovieResults([]);
      setMovieSearching(false);
      return;
    }

    const controller = new AbortController();

    const timer = window.setTimeout(async () => {
      setMovieSearching(true);

      try {
        const response = await fetch(
          `/api/tmdb/search?q=${encodeURIComponent(movieQuery.trim())}`,
          { signal: controller.signal }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error ?? 'Ricerca non disponibile.');
        }

        setMovieResults(data.movies ?? []);
      } catch (error: any) {
        if (error?.name !== 'AbortError') {
          setModalError(error.message ?? 'Errore durante la ricerca.');
        }
      } finally {
        setMovieSearching(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [movieQuery, modalOpen]);

  useEffect(() => {
    if (!router.isReady) return;

    const q = typeof router.query.q === 'string' ? router.query.q.trim() : '';
    const movieParam =
      typeof router.query.movie === 'string' ? Number(router.query.movie) : null;

    if (q) setSearch(q);
    setTargetMovieId(
      movieParam && Number.isInteger(movieParam) && movieParam > 0
        ? movieParam
        : null
    );
  }, [router.isReady, router.query.q, router.query.movie]);

  const filteredReviews = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const source = tab === 'seguiti' ? followingReviews : reviews;

    return source.filter((review) => {
      if (tab === 'serie') return false;

      if (
        tab === 'animazione' &&
        !review.genre?.toLowerCase().includes('animazione')
      ) {
        return false;
      }

      if (
        targetMovieId &&
        Number(review.provider_movie_id) !== targetMovieId
      ) {
        return false;
      }

      if (needle) {
        const haystack = [
          review.title,
          review.username ?? '',
          review.review_text,
          review.genre ?? '',
        ]
          .join(' ')
          .toLowerCase();

        if (!haystack.includes(needle)) return false;
      }

      return true;
    });
  }, [reviews, followingReviews, search, tab, targetMovieId]);

  useEffect(() => {
    const ids = Array.from(
      new Set(
        [...reviews, ...followingReviews].map((review) => review.entry_id)
      )
    );

    if (ids.length === 0) {
      setCommentCounts({});
      return;
    }

    let cancelled = false;

    const loadCommentCounts = async () => {
      const { data, error } = await supabase.rpc(
        'get_review_comment_counts',
        {
          p_entry_ids: ids,
        }
      );

      if (cancelled || error) return;

      const next: Record<string, number> = {};

      for (const row of data ?? []) {
        if (
          typeof row.entry_id === 'string'
        ) {
          next[row.entry_id] = Number(row.comments_count ?? 0);
        }
      }

      setCommentCounts(next);
    };

    void loadCommentCounts();

    return () => {
      cancelled = true;
    };
  }, [reviews, followingReviews, supabase]);

  const loadComments = async (entryId: string) => {
    setCommentsLoadingEntry(entryId);

    try {
      const { data, error } = await supabase.rpc(
        'get_review_comments',
        {
          p_entry_id: entryId,
          p_limit: 100,
          p_offset: 0,
        }
      );

      if (error) throw error;

      setCommentsByEntry((current) => ({
        ...current,
        [entryId]: (data ?? []) as ReviewComment[],
      }));

      setCommentCounts((current) => ({
        ...current,
        [entryId]: (data ?? []).length,
      }));
    } catch (error) {
      console.error('Review comments load failed:', error);
    } finally {
      setCommentsLoadingEntry(null);
    }
  };

  const toggleComments = async (entryId: string) => {
    if (openCommentsEntry === entryId) {
      setOpenCommentsEntry(null);
      setCommentDraft('');
      setEditingCommentId(null);
      setEditingCommentText('');
      return;
    }

    setOpenCommentsEntry(entryId);
    setCommentDraft('');
    setEditingCommentId(null);
    setEditingCommentText('');

    if (!commentsByEntry[entryId]) {
      await loadComments(entryId);
    }
  };

  const submitComment = async (entryId: string) => {
    if (!currentUser || currentUser.isGuest) return;

    const cleanText = commentDraft.trim();
    if (!cleanText || commentSaving) return;

    setCommentSaving(true);

    try {
      const { error } = await supabase
        .from('user_movie_review_comments')
        .insert({
          entry_id: entryId,
          user_id: currentUser.id,
          text: cleanText,
        });

      if (error) throw error;

      setCommentDraft('');
      await loadComments(entryId);
    } catch (error) {
      console.error('Review comment create failed:', error);
    } finally {
      setCommentSaving(false);
    }
  };

  const saveCommentEdit = async (
    entryId: string,
    commentId: string
  ) => {
    if (!currentUser || currentUser.isGuest) return;

    const cleanText = editingCommentText.trim();
    if (!cleanText || commentSaving) return;

    setCommentSaving(true);

    try {
      const { error } = await supabase
        .from('user_movie_review_comments')
        .update({
          text: cleanText,
        })
        .eq('id', commentId)
        .eq('user_id', currentUser.id);

      if (error) throw error;

      setEditingCommentId(null);
      setEditingCommentText('');
      await loadComments(entryId);
    } catch (error) {
      console.error('Review comment update failed:', error);
    } finally {
      setCommentSaving(false);
    }
  };

  const deleteComment = async (
    entryId: string,
    commentId: string
  ) => {
    if (!currentUser || currentUser.isGuest) return;

    const confirmed = window.confirm(
      'Vuoi eliminare questo commento?'
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('user_movie_review_comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', currentUser.id);

      if (error) throw error;

      await loadComments(entryId);
    } catch (error) {
      console.error('Review comment delete failed:', error);
    }
  };

  useEffect(() => {
    if (!router.isReady || reviews.length === 0) return;

    const targetEntry =
      typeof router.query.review === 'string'
        ? router.query.review
        : null;

    if (!targetEntry) return;

    if (tab !== 'tutte') setTab('tutte');
    if (search) setSearch('');

    if (!reviews.some((review) => review.entry_id === targetEntry)) {
      return;
    }

    window.setTimeout(() => {
      document
        .getElementById(`review-${targetEntry}`)
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
    }, 120);

    if (router.query.comments === '1') {
      setOpenCommentsEntry(targetEntry);

      if (!commentsByEntry[targetEntry]) {
        void loadComments(targetEntry);
      }
    }
  }, [
    router.isReady,
    router.query.review,
    router.query.comments,
    reviews,
    commentsByEntry,
    tab,
    search,
  ]);

  const highlightedReviews = useMemo(
    () =>
      [...filteredReviews]
        .sort((a, b) => b.likes_count - a.likes_count)
        .slice(0, 3),
    [filteredReviews]
  );

  const toggleFollowAuthor = async (review: PublicReview) => {
    if (
      !currentUser ||
      currentUser.isGuest ||
      currentUser.id === review.user_id
    ) {
      return;
    }

    setFollowBusyUserId(review.user_id);

    try {
      const alreadyFollowing = followingUserIds.has(review.user_id);

      if (alreadyFollowing) {
        const { error } = await supabase
          .from('user_follows')
          .delete()
          .eq('follower_id', currentUser.id)
          .eq('following_id', review.user_id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_follows')
          .insert({
            follower_id: currentUser.id,
            following_id: review.user_id,
          });

        if (error) throw error;
      }

      setFollowingUserIds((current) => {
        const next = new Set(current);

        if (alreadyFollowing) next.delete(review.user_id);
        else next.add(review.user_id);

        return next;
      });
    } catch (error) {
      console.error('Review author follow failed:', error);
    } finally {
      setFollowBusyUserId(null);
    }
  };

  const toggleLike = async (review: PublicReview) => {
    if (!currentUser || currentUser.isGuest) return;

    const liked = likedEntries.has(review.entry_id);

    try {
      if (liked) {
        const { error } = await supabase
          .from('user_movie_review_likes')
          .delete()
          .eq('entry_id', review.entry_id)
          .eq('user_id', currentUser.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_movie_review_likes')
          .insert({
            entry_id: review.entry_id,
            user_id: currentUser.id,
          });

        if (error) throw error;
      }

      setLikedEntries((current) => {
        const next = new Set(current);

        if (liked) next.delete(review.entry_id);
        else next.add(review.entry_id);

        return next;
      });

      const updateLikes = (current: PublicReview[]) =>
        current.map((item) =>
          item.entry_id === review.entry_id
            ? {
                ...item,
                likes_count: Math.max(
                  0,
                  item.likes_count + (liked ? -1 : 1)
                ),
              }
            : item
        );

      setReviews(updateLikes);
      setFollowingReviews(updateLikes);
    } catch (error) {
      console.error('Review like failed:', error);
    }
  };

  const closeModal = () => {
    if (savingReview) return;

    setModalOpen(false);
    setMovieQuery('');
    setMovieResults([]);
    setSelectedMovie(null);
    setReviewText('');
    setRating(null);
    setPublishRating(true);
    setModalError('');
  };

  const submitReview = async () => {
    if (!currentUser || currentUser.isGuest) return;

    if (!selectedMovie) {
      setModalError('Scegli prima un film.');
      return;
    }

    const cleanText = reviewText.trim();

    if (!cleanText) {
      setModalError('Scrivi la tua recensione.');
      return;
    }

    if (cleanText.length > 3000) {
      setModalError('La recensione può contenere massimo 3000 caratteri.');
      return;
    }

    setSavingReview(true);
    setModalError('');

    try {
      const movie = await ensureTmdbMovie(
        supabase,
        selectedMovie.tmdb_id
      );

      const { data: existing, error: existingError } = await supabase
        .from('user_movie_entries')
        .select('id')
        .eq('user_id', currentUser.id)
        .eq('movie_id', movie.id)
        .maybeSingle();

      if (existingError) throw existingError;

      const payload = {
        rating,
        review_text: cleanText,
        review_visibility: 'public',
        rating_visibility:
          rating !== null && publishRating ? 'public' : 'private',
      };

      if (existing?.id) {
        const { error } = await supabase
          .from('user_movie_entries')
          .update(payload)
          .eq('id', existing.id)
          .eq('user_id', currentUser.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_movie_entries')
          .insert({
            user_id: currentUser.id,
            movie_id: movie.id,
            ...payload,
          });

        if (error) throw error;
      }

      closeModal();
      await loadPage();
    } catch (error: any) {
      console.error('Review save failed:', error);
      setModalError(error.message ?? 'Impossibile pubblicare la recensione.');
    } finally {
      setSavingReview(false);
    }
  };

  if (isLoading || !currentUser || currentUser.isGuest || isGuest) {
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

  return (
    <>
      <AppShell activeNav={'recensioni' as any}>
        <main
          className="reviews-page"
          style={
            {
              '--r-bg': P.bg,
              '--r-bg-soft': P.bgSoft,
              '--r-card': P.card,
              '--r-card-hover': P.cardHover,
              '--r-border': P.border,
              '--r-gold': P.gold,
              '--r-gold-soft': P.goldSoft,
              '--r-pink': P.pink,
              '--r-pink-deep': P.pinkDeep,
              '--r-text': P.text,
              '--r-muted': P.textMuted,
              '--r-faint': P.textFaint,
              '--r-pink-glow': P.pinkGlow,
              '--r-gold-glow': P.goldGlow,
              minHeight: '100vh',
              background: P.bg,
              color: P.text,
              fontFamily: FONT,
            } as React.CSSProperties
          }
        >
          <div className="reviews-wrap">
            <section className="reviews-main">
              <header className="page-header">
                <div>
                  <div className="title-row">
                    <ChatCircle size={27} weight="fill" color={P.pink} />
                    <h1>Recensioni</h1>
                  </div>
                  <p>
                    Scopri cosa pensa la community e condividi le tue opinioni.
                  </p>
                </div>

                <div className="header-actions">
                  <button
                    className="discover-btn"
                    onClick={() => router.push('/persone')}
                  >
                    <UserPlus size={16} weight="bold" />
                    Scopri persone
                  </button>

                  <button
                    className="write-btn"
                    onClick={() => setModalOpen(true)}
                  >
                    <PencilSimple size={16} weight="bold" />
                    Scrivi una recensione
                  </button>
                </div>
              </header>

              <div className="tabs">
                <button
                  className={tab === 'tutte' ? 'active' : ''}
                  onClick={() => setTab('tutte')}
                >
                  Tutte
                </button>
                <button
                  className={tab === 'seguiti' ? 'active' : ''}
                  onClick={() => setTab('seguiti')}
                >
                  Seguiti
                </button>
                <button
                  className={tab === 'film' ? 'active' : ''}
                  onClick={() => setTab('film')}
                >
                  Film
                </button>
                <button
                  className={tab === 'serie' ? 'active disabled-tab' : 'disabled-tab'}
                  onClick={() => setTab('serie')}
                  title="Il catalogo Serie TV non è ancora collegato"
                >
                  Serie TV
                </button>
                <button
                  className={tab === 'animazione' ? 'active' : ''}
                  onClick={() => setTab('animazione')}
                >
                  Animazione
                </button>
              </div>

              {!targetMovieId && (
                <button
                  type="button"
                  onClick={()=>router.push('/esplora')}
                  style={{
                    width:'100%',
                    marginBottom:10,
                    border:`1px solid ${P.gold}60`,
                    background:P.goldGlow,
                    color:P.text,
                    padding:'10px 12px',
                    display:'flex',
                    alignItems:'center',
                    justifyContent:'space-between',
                    gap:10,
                    fontFamily:FONT,
                    fontSize:10.5,
                    fontWeight:850,
                    cursor:'pointer',
                  }}
                >
                  <span>Scopri un film e leggi cosa ne pensa la community</span>
                  <ArrowRight size={13} color={P.gold} weight="bold"/>
                </button>
              )}

              <div className="toolbar">
                <div className="search-box">
                  <MagnifyingGlass size={16} />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Cerca recensioni..."
                  />
                  {search && (
                    <button onClick={() => setSearch('')} aria-label="Pulisci">
                      <X size={13} />
                    </button>
                  )}
                </div>

                <button className="filter-btn" disabled>
                  <Funnel size={16} />
                  Filtri
                </button>
              </div>

              {targetMovieId && (
                <div style={{
                  border:`1px solid ${P.gold}70`,
                  background:P.goldGlow,
                  padding:'11px 12px',
                  marginBottom:12,
                  display:'flex',
                  alignItems:'center',
                  justifyContent:'space-between',
                  gap:10,
                }}>
                  <div>
                    <div style={{fontSize:9,fontWeight:900,color:P.gold,textTransform:'uppercase',letterSpacing:'.1em'}}>
                      Recensioni del film
                    </div>
                    <div style={{fontSize:11,color:P.text,marginTop:2}}>
                      {search || 'Film selezionato'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetMovieId(null);
                      setSearch('');
                      router.replace('/recensioni', undefined, { shallow: true });
                    }}
                    style={{
                      border:0,
                      background:'transparent',
                      color:P.textMuted,
                      fontSize:10,
                      fontWeight:800,
                      cursor:'pointer',
                    }}
                  >
                    Mostra tutto
                  </button>
                </div>
              )}

              {feedError && (
                <div className="error-box">{feedError}</div>
              )}

              {!loadingFeed && highlightedReviews.length > 0 && (
                <section className="featured-section">
                  <div className="section-heading">
                    <span>
                      <Star size={17} weight="fill" color={P.gold} />
                      In evidenza
                    </span>
                  </div>

                  <div className="featured-grid">
                    {highlightedReviews.map((review) => (
                      <article
                        key={`featured-${review.entry_id}`}
                        className="featured-card"
                      >
                        <div
                          className="poster poster-small"
                          onClick={() =>
                            review.provider === 'tmdb' &&
                            router.push(`/film/${review.provider_movie_id}`)
                          }
                        >
                          {review.cover ? (
                            <img src={review.cover} alt={review.title} />
                          ) : (
                            <FilmSlate size={22} color={P.textFaint} weight="duotone" />
                          )}
                        </div>

                        <div className="featured-body">
                          <div className="movie-title-line">
                            <strong>{review.title}</strong>
                            <span className="type-chip">Film</span>
                          </div>

                          {review.rating !== null && (
                            <div className="rating-line">
                              <Star size={14} weight="fill" />
                              {Number(review.rating).toFixed(1)}
                            </div>
                          )}

                          <p>{review.review_text}</p>

                          <button
                            type="button"
                            className="reviewer-line reviewer-link"
                            onClick={() => {
                              if (review.username) {
                                router.push(`/utente/${encodeURIComponent(review.username)}`);
                              }
                            }}
                          >
                            <Avatar
                              username={review.username}
                              url={review.avatar_url}
                              size={24}
                            />
                            <span>@{review.username || 'utente'}</span>
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              <section className="recent-section">
                <div className="section-heading">
                  <span>
                    <ChatCircle size={17} weight="fill" color={P.gold} />
                    Recensioni recenti
                  </span>
                  <span className="sort-label">Più recenti⌄</span>
                </div>

                {loadingFeed ? (
                  <div className="empty-box">Caricamento recensioni...</div>
                ) : filteredReviews.length === 0 ? (
                  <div className="empty-box">
                    {tab === 'serie' ? (
                      'Le Serie TV saranno disponibili quando collegheremo il catalogo TV.'
                    ) : tab === 'seguiti' ? (
                      <>
                        <span>
                          Non ci sono ancora recensioni pubbliche delle persone che segui.
                        </span>
                        <button
                          className="empty-discover-btn"
                          onClick={() => router.push('/persone')}
                        >
                          <UserPlus size={14} weight="bold" />
                          Scopri persone
                        </button>
                      </>
                    ) : (
                      'Non ci sono ancora recensioni in questa sezione.'
                    )}
                  </div>
                ) : (
                  <div className="review-list">
                    {filteredReviews.map((review) => {
                      const liked = likedEntries.has(review.entry_id);

                      return (
                        <article
                          id={`review-${review.entry_id}`}
                          className={`review-row ${
                            router.query.review === review.entry_id
                              ? 'review-row-target'
                              : ''
                          }`}
                          key={review.entry_id}
                        >
                          <div
                            className="poster review-poster"
                            onClick={() =>
                              review.provider === 'tmdb' &&
                              router.push(`/film/${review.provider_movie_id}`)
                            }
                          >
                            {review.cover ? (
                              <img src={review.cover} alt={review.title} />
                            ) : (
                              <FilmSlate size={22} color={P.textFaint} weight="duotone" />
                            )}
                          </div>

                          <div className="review-copy">
                            <div className="review-top">
                              <strong>{review.title}</strong>
                              <span className="type-chip">Film</span>
                            </div>

                            <div className="review-mid">
                              {review.rating !== null && (
                                <span className="rating-line">
                                  <Star size={13} weight="fill" />
                                  {Number(review.rating).toFixed(1)}
                                </span>
                              )}
                              <p>{review.review_text}</p>
                            </div>
                          </div>

                          <div className="review-meta">
                            <button
                              type="button"
                              className="review-user reviewer-link"
                              onClick={() => {
                                if (review.username) {
                                  router.push(`/utente/${encodeURIComponent(review.username)}`);
                                }
                              }}
                            >
                              <Avatar
                                username={review.username}
                                url={review.avatar_url}
                                size={25}
                              />
                              <span>@{review.username || 'utente'}</span>
                            </button>

                            {currentUser?.id !== review.user_id && (
                              <button
                                type="button"
                                onClick={() => void toggleFollowAuthor(review)}
                                disabled={followBusyUserId === review.user_id}
                                style={{
                                  border: `1px solid ${
                                    followingUserIds.has(review.user_id)
                                      ? P.border
                                      : P.pink
                                  }`,
                                  background: followingUserIds.has(review.user_id)
                                    ? P.bgSoft
                                    : P.pinkGlow,
                                  color: followingUserIds.has(review.user_id)
                                    ? P.textMuted
                                    : P.pink,
                                  padding: '4px 7px',
                                  cursor:
                                    followBusyUserId === review.user_id
                                      ? 'wait'
                                      : 'pointer',
                                  fontFamily: FONT,
                                  fontSize: 8,
                                  fontWeight: 850,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                              >
                                {followingUserIds.has(review.user_id) ? (
                                  <UserCheck size={10} weight="fill" />
                                ) : (
                                  <UserPlus size={10} weight="bold" />
                                )}
                                {followingUserIds.has(review.user_id)
                                  ? 'Segui già'
                                  : 'Segui'}
                              </button>
                            )}

                            {currentUser?.id !== review.user_id && (
                              <div
                                style={{
                                  display: 'flex',
                                  gap: 5,
                                  flexWrap: 'wrap',
                                  alignItems: 'center',
                                }}
                              >
                                {followingUserIds.has(review.user_id) && (
                                  <span
                                    style={{
                                      border: `1px solid ${P.gold}55`,
                                      background: P.goldGlow,
                                      color: P.gold,
                                      padding: '3px 6px',
                                      fontSize: 8,
                                      fontWeight: 850,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 3,
                                    }}
                                  >
                                    <UserCheck size={10} weight="fill" />
                                    Segui
                                  </span>
                                )}

                                {authorSocial[review.user_id]?.follows_you && (
                                  <span
                                    style={{
                                      border: `1px solid ${P.pink}55`,
                                      background: P.pinkGlow,
                                      color: P.pink,
                                      padding: '3px 6px',
                                      fontSize: 8,
                                      fontWeight: 850,
                                    }}
                                  >
                                    Ti segue
                                  </span>
                                )}

                                {(authorSocial[review.user_id]?.compatibility_score ?? 0) > 0 && (
                                  <span
                                    title={`${authorSocial[review.user_id]?.shared_favorites_count ?? 0} preferiti, ${authorSocial[review.user_id]?.shared_high_ratings_count ?? 0} voti alti e ${authorSocial[review.user_id]?.shared_genres_count ?? 0} generi in comune`}
                                    style={{
                                      border: `1px solid ${P.border}`,
                                      background: P.bgSoft,
                                      color: P.textMuted,
                                      padding: '3px 6px',
                                      fontSize: 8,
                                      fontWeight: 800,
                                    }}
                                  >
                                    Affinità {authorSocial[review.user_id]?.compatibility_score}
                                  </span>
                                )}
                              </div>
                            )}

                            <span className="time">
                              {formatRelativeDate(
                                review.review_updated_at ||
                                  review.created_at
                              )}
                            </span>

                            <div className="review-social-actions">
                              <button
                                className={`comment-btn ${
                                  openCommentsEntry === review.entry_id
                                    ? 'active'
                                    : ''
                                }`}
                                onClick={() =>
                                  void toggleComments(review.entry_id)
                                }
                                aria-label="Apri commenti"
                              >
                                <ChatCircle
                                  size={16}
                                  weight={
                                    openCommentsEntry === review.entry_id
                                      ? 'fill'
                                      : 'regular'
                                  }
                                />
                                {commentCounts[review.entry_id] ?? 0}
                              </button>

                              <button
                                className={`like-btn ${liked ? 'liked' : ''}`}
                                onClick={() => void toggleLike(review)}
                                aria-label={
                                  liked ? 'Rimuovi like' : 'Metti like'
                                }
                              >
                                <Heart
                                  size={16}
                                  weight={liked ? 'fill' : 'regular'}
                                />
                                {review.likes_count}
                              </button>
                            </div>
                          </div>

                          {openCommentsEntry === review.entry_id && (
                            <div className="comments-panel">
                              {commentsLoadingEntry === review.entry_id ? (
                                <div className="comments-loading">
                                  Caricamento commenti...
                                </div>
                              ) : (
                                <>
                                  <div className="comments-list">
                                    {(commentsByEntry[review.entry_id] ?? [])
                                      .length === 0 ? (
                                      <div className="comments-empty">
                                        Nessun commento. Puoi essere il primo.
                                      </div>
                                    ) : (
                                      (
                                        commentsByEntry[review.entry_id] ?? []
                                      ).map((comment) => {
                                        const isMine =
                                          currentUser?.id === comment.user_id;
                                        const isEditing =
                                          editingCommentId ===
                                          comment.comment_id;

                                        return (
                                          <div
                                            className="comment-row"
                                            key={comment.comment_id}
                                          >
                                            <button
                                              type="button"
                                              className="comment-avatar"
                                              onClick={() => {
                                                if (comment.username) {
                                                  router.push(
                                                    `/utente/${encodeURIComponent(
                                                      comment.username
                                                    )}`
                                                  );
                                                }
                                              }}
                                            >
                                              <Avatar
                                                username={comment.username}
                                                url={comment.avatar_url}
                                                size={28}
                                              />
                                            </button>

                                            <div className="comment-body">
                                              <div className="comment-head">
                                                <button
                                                  type="button"
                                                  className="comment-username"
                                                  onClick={() => {
                                                    if (comment.username) {
                                                      router.push(
                                                        `/utente/${encodeURIComponent(
                                                          comment.username
                                                        )}`
                                                      );
                                                    }
                                                  }}
                                                >
                                                  @{comment.username || 'utente'}
                                                </button>

                                                <span>
                                                  {formatRelativeDate(
                                                    comment.updated_at ||
                                                      comment.created_at
                                                  )}
                                                </span>
                                              </div>

                                              {isEditing ? (
                                                <div className="comment-edit">
                                                  <textarea
                                                    value={editingCommentText}
                                                    maxLength={1000}
                                                    onChange={(event) =>
                                                      setEditingCommentText(
                                                        event.target.value
                                                      )
                                                    }
                                                  />

                                                  <div>
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        setEditingCommentId(
                                                          null
                                                        );
                                                        setEditingCommentText(
                                                          ''
                                                        );
                                                      }}
                                                    >
                                                      Annulla
                                                    </button>

                                                    <button
                                                      type="button"
                                                      className="comment-save"
                                                      disabled={
                                                        commentSaving ||
                                                        !editingCommentText.trim()
                                                      }
                                                      onClick={() =>
                                                        void saveCommentEdit(
                                                          review.entry_id,
                                                          comment.comment_id
                                                        )
                                                      }
                                                    >
                                                      Salva
                                                    </button>
                                                  </div>
                                                </div>
                                              ) : (
                                                <p>{comment.text}</p>
                                              )}

                                              {isMine && !isEditing && (
                                                <div className="comment-own-actions">
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      setEditingCommentId(
                                                        comment.comment_id
                                                      );
                                                      setEditingCommentText(
                                                        comment.text
                                                      );
                                                    }}
                                                  >
                                                    Modifica
                                                  </button>

                                                  <button
                                                    type="button"
                                                    className="comment-delete"
                                                    onClick={() =>
                                                      void deleteComment(
                                                        review.entry_id,
                                                        comment.comment_id
                                                      )
                                                    }
                                                  >
                                                    <Trash
                                                      size={11}
                                                      weight="bold"
                                                    />
                                                    Elimina
                                                  </button>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>

                                  <div className="comment-compose">
                                    <textarea
                                      value={commentDraft}
                                      maxLength={1000}
                                      placeholder="Scrivi un commento..."
                                      onChange={(event) =>
                                        setCommentDraft(event.target.value)
                                      }
                                      onKeyDown={(event) => {
                                        if (
                                          event.key === 'Enter' &&
                                          !event.shiftKey
                                        ) {
                                          event.preventDefault();
                                          void submitComment(review.entry_id);
                                        }
                                      }}
                                    />

                                    <button
                                      type="button"
                                      disabled={
                                        commentSaving ||
                                        !commentDraft.trim()
                                      }
                                      onClick={() =>
                                        void submitComment(review.entry_id)
                                      }
                                      aria-label="Pubblica commento"
                                    >
                                      <PaperPlaneTilt
                                        size={16}
                                        weight="fill"
                                      />
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            </section>

            <aside className="reviews-side">
              <section className="watchlist-card">
                <div className="side-title">
                  <BookmarkSimple size={18} weight="fill" color={P.gold} />
                  I tuoi film da vedere
                </div>

                {watchlist.length === 0 ? (
                  <div className="watchlist-empty">
                    La tua watchlist è ancora vuota.
                  </div>
                ) : (
                  <div className="watchlist-items">
                    {watchlist.slice(0, 6).map((row) => {
                      const movie = getCatalogMovie(row);
                      if (!movie) return null;

                      return (
                        <button
                          className="watchlist-item"
                          key={row.id}
                          onClick={() => {
                            if (movie.provider === 'tmdb') {
                              router.push(
                                `/film/${movie.provider_movie_id}`
                              );
                            }
                          }}
                        >
                          <div className="watchlist-poster">
                            {movie.cover ? (
                              <img src={movie.cover} alt={movie.title} />
                            ) : (
                              <FilmSlate size={22} color={P.textFaint} weight="duotone" />
                            )}
                          </div>

                          <div className="watchlist-copy">
                            <strong>{movie.title}</strong>
                            <span>
                              {[movie.year, movie.genre]
                                .filter(Boolean)
                                .join(', ')}
                            </span>
                          </div>

                          <BookmarkSimple
                            size={17}
                            weight="fill"
                            color={P.gold}
                          />
                        </button>
                      );
                    })}
                  </div>
                )}

                <button
                  className="view-all"
                  onClick={() => router.push('/libreria?tab=watchlist')}
                >
                  Vedi tutti
                  <CaretRight size={14} />
                </button>
              </section>

              <section className="opinion-card">
                <Star size={22} weight="fill" />
                <h3>La tua opinione conta!</h3>
                <p>
                  Scrivi una recensione e aiuta altri utenti a scegliere cosa
                  guardare.
                </p>
                <button onClick={() => setModalOpen(true)}>
                  Scrivi ora
                </button>
              </section>
            </aside>
          </div>
        </main>
      </AppShell>

      {modalOpen && (
        <div className="modal-backdrop" onMouseDown={closeModal}>
          <div
            className="review-modal"
            onMouseDown={(event) => event.stopPropagation()}
            style={
              {
                '--r-bg': P.bg,
                '--r-bg-soft': P.bgSoft,
                '--r-card': P.card,
                '--r-card-hover': P.cardHover,
                '--r-border': P.border,
                '--r-gold': P.gold,
                '--r-pink': P.pink,
                '--r-text': P.text,
                '--r-muted': P.textMuted,
                '--r-faint': P.textFaint,
              } as React.CSSProperties
            }
          >
            <div className="modal-head">
              <div>
                <span>La tua recensione</span>
                <h2>Scrivi cosa ne pensi</h2>
              </div>
              <button onClick={closeModal} disabled={savingReview}>
                <X size={19} />
              </button>
            </div>

            {!selectedMovie ? (
              <>
                <label className="field-label">Cerca il film</label>
                <div className="modal-search">
                  <MagnifyingGlass size={17} />
                  <input
                    autoFocus
                    value={movieQuery}
                    onChange={(event) => {
                      setMovieQuery(event.target.value);
                      setModalError('');
                    }}
                    placeholder="Es. Interstellar..."
                  />
                </div>

                <div className="movie-results">
                  {movieSearching && (
                    <div className="result-message">Ricerca...</div>
                  )}

                  {!movieSearching &&
                    movieQuery.trim().length >= 2 &&
                    movieResults.length === 0 && (
                      <div className="result-message">
                        Nessun film trovato.
                      </div>
                    )}

                  {movieResults.map((movie) => (
                    <button
                      key={movie.id}
                      className="movie-result"
                      onClick={() => {
                        setSelectedMovie(movie);
                        setModalError('');
                      }}
                    >
                      <div className="result-poster">
                        {movie.cover ? (
                          <img src={movie.cover} alt={movie.title} />
                        ) : (
                          <FilmSlate size={22} color={P.textFaint} weight="duotone" />
                        )}
                      </div>
                      <div>
                        <strong>{movie.title}</strong>
                        <span>
                          {[movie.year || null, movie.genre]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </div>
                      <CaretRight size={16} />
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <button
                  className="selected-movie"
                  onClick={() => setSelectedMovie(null)}
                >
                  <div className="result-poster">
                    {selectedMovie.cover ? (
                      <img
                        src={selectedMovie.cover}
                        alt={selectedMovie.title}
                      />
                    ) : (
                      <FilmSlate size={22} color={P.textFaint} weight="duotone" />
                    )}
                  </div>
                  <div>
                    <span>Film scelto</span>
                    <strong>{selectedMovie.title}</strong>
                    <small>
                      {[selectedMovie.year || null, selectedMovie.genre]
                        .filter(Boolean)
                        .join(' · ')}
                    </small>
                  </div>
                  <span className="change-film">Cambia</span>
                </button>

                <label className="field-label">Il tuo voto</label>
                <div className="rating-picker">
                  {[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map(
                    (value) => (
                      <button
                        key={value}
                        className={rating === value ? 'selected' : ''}
                        onClick={() => setRating(value)}
                      >
                        {value}
                      </button>
                    )
                  )}
                  <button
                    className={rating === null ? 'selected clear-rating' : 'clear-rating'}
                    onClick={() => setRating(null)}
                  >
                    —
                  </button>
                </div>

                <label className="field-label">
                  Recensione
                  <span>{reviewText.length}/3000</span>
                </label>
                <textarea
                  value={reviewText}
                  onChange={(event) =>
                    setReviewText(event.target.value.slice(0, 3000))
                  }
                  placeholder="Cosa ti è piaciuto? Cosa non ti ha convinto?"
                  rows={6}
                />

                <label className="visibility-toggle">
                  <button
                    type="button"
                    className={publishRating ? 'checked' : ''}
                    onClick={() => setPublishRating((value) => !value)}
                  >
                    {publishRating && <Check size={13} weight="bold" />}
                  </button>
                  <span>
                    <strong>Mostra pubblicamente anche il voto</strong>
                    <small>
                      La recensione sarà pubblica; watchlist, preferiti e data
                      di visione restano privati.
                    </small>
                  </span>
                </label>

                <button
                  className="publish-btn"
                  onClick={() => void submitReview()}
                  disabled={savingReview}
                >
                  {savingReview
                    ? 'Pubblicazione...'
                    : 'Pubblica recensione'}
                </button>
              </>
            )}

            {modalError && (
              <div className="modal-error">{modalError}</div>
            )}
          </div>
        </div>
      )}

      <style jsx global>{`
        .reviews-page * {
          box-sizing: border-box;
        }

        .reviews-page button,
        .review-modal button,
        .review-modal input,
        .review-modal textarea {
          font-family: ${FONT};
        }

        .reviews-wrap {
          width: 100%;
          max-width: 1180px;
          margin: 0 auto;
          padding: 30px 24px 50px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) 250px;
          gap: 26px;
        }

        .reviews-main {
          min-width: 0;
        }

        .page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 22px;
        }

        .title-row {
          display: flex;
          align-items: center;
          gap: 11px;
        }

        .page-header h1 {
          margin: 0;
          font-family: ${FONT_DISPLAY};
          font-size: 30px;
          line-height: 1;
          color: var(--r-text);
        }

        .page-header p {
          margin: 8px 0 0;
          color: var(--r-muted);
          font-size: 12px;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .discover-btn {
          border: 1px solid var(--r-border);
          background: var(--r-card);
          color: var(--r-text);
          font-weight: 800;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 11px 14px;
        }

        .discover-btn:hover {
          border-color: var(--r-pink);
          color: var(--r-pink);
          background: var(--r-pink-glow);
        }

        .write-btn,
        .opinion-card button,
        .publish-btn {
          border: 1px solid rgba(245,185,47,.65);
          background: linear-gradient(180deg,var(--r-gold),#e99b16);
          color: #120d05;
          font-weight: 800;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 11px 16px;
          box-shadow: 0 5px 22px rgba(245,185,47,.13);
        }

        .tabs {
          display: flex;
          gap: 24px;
          border-bottom: 1px solid var(--r-border);
          margin-bottom: 18px;
        }

        .tabs button {
          background: transparent;
          color: var(--r-muted);
          border: 0;
          border-bottom: 2px solid transparent;
          padding: 0 5px 10px;
          cursor: pointer;
          font-size: 12px;
        }

        .tabs button.active {
          color: var(--r-pink);
          border-bottom-color: var(--r-pink);
          font-weight: 700;
        }

        .tabs .disabled-tab {
          opacity: .55;
        }

        .toolbar {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 26px;
        }

        .search-box {
          width: min(430px,100%);
          height: 40px;
          border: 1px solid var(--r-border);
          background: var(--r-bg-soft);
          display: flex;
          align-items: center;
          padding: 0 12px;
          color: var(--r-faint);
        }

        .search-box input {
          flex: 1;
          min-width: 0;
          height: 100%;
          border: 0;
          outline: 0;
          background: transparent;
          color: var(--r-text);
          padding: 0 9px;
          font-size: 12px;
        }

        .search-box button {
          border: 0;
          background: transparent;
          color: var(--r-faint);
          cursor: pointer;
        }

        .filter-btn {
          height: 40px;
          border: 1px solid var(--r-border);
          background: var(--r-bg-soft);
          color: var(--r-muted);
          padding: 0 14px;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          opacity: .55;
        }

        .section-heading {
          min-height: 34px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
        }

        .section-heading > span:first-child {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: var(--r-text);
          font-weight: 800;
          font-size: 13px;
        }

        .sort-label {
          color: var(--r-faint);
          font-size: 10px;
        }

        .featured-section {
          margin-bottom: 30px;
        }

        .featured-grid {
          display: grid;
          grid-template-columns: repeat(3,minmax(0,1fr));
          gap: 12px;
        }

        .featured-card {
          border: 1px solid var(--r-border);
          background: linear-gradient(145deg,var(--r-card),var(--r-bg-soft));
          padding: 11px;
          display: grid;
          grid-template-columns: 58px minmax(0,1fr);
          gap: 12px;
          min-height: 148px;
        }

        .featured-card:first-child {
          border-color: rgba(245,185,47,.48);
          box-shadow: inset 0 0 35px rgba(245,185,47,.035);
        }

        .poster {
          background: var(--r-card-hover);
          border: 1px solid var(--r-border);
          overflow: hidden;
          display: grid;
          place-items: center;
          color: var(--r-faint);
          cursor: pointer;
        }

        .poster img,
        .watchlist-poster img,
        .result-poster img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .poster-small {
          width: 58px;
          height: 88px;
        }

        .featured-body {
          min-width: 0;
        }

        .movie-title-line,
        .review-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 8px;
        }

        .movie-title-line strong,
        .review-top strong {
          color: var(--r-text);
          font-size: 12px;
          line-height: 1.35;
        }

        .type-chip {
          border: 1px solid rgba(237,61,115,.55);
          color: var(--r-pink);
          padding: 2px 5px;
          font-size: 8px;
          white-space: nowrap;
        }

        .rating-line {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          color: var(--r-gold);
          font-size: 11px;
          font-weight: 800;
          margin-top: 7px;
        }

        .featured-body p {
          color: var(--r-muted);
          font-size: 10px;
          line-height: 1.5;
          margin: 7px 0 9px;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .reviewer-line {
          display: flex;
          align-items: center;
          gap: 7px;
          color: var(--r-muted);
          font-size: 9px;
        }

        .reviewer-link {
          border: 0;
          background: transparent;
          padding: 0;
          cursor: pointer;
          text-align: left;
          font-family: inherit;
        }

        .reviewer-link:hover {
          color: var(--r-pink);
        }

        .review-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .review-row {
          border: 1px solid var(--r-border);
          background: var(--r-card);
          display: grid;
          grid-template-columns: 52px minmax(0,1fr) auto;
          align-items: center;
          gap: 12px;
          padding: 9px;
          transition: border-color .2s,background .2s;
        }

        .review-row-target {
          border-color: var(--r-pink) !important;
          box-shadow: 0 0 0 1px var(--r-pink-glow);
        }


        .review-row:hover {
          background: var(--r-card-hover);
          border-color: rgba(245,185,47,.22);
        }

        .review-poster {
          width: 52px;
          height: 69px;
        }

        .review-copy {
          min-width: 0;
        }

        .review-mid {
          margin-top: 5px;
          display: flex;
          gap: 11px;
          align-items: flex-start;
        }

        .review-mid .rating-line {
          margin-top: 1px;
          flex-shrink: 0;
        }

        .review-mid p {
          color: var(--r-muted);
          font-size: 10px;
          line-height: 1.5;
          margin: 0;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .review-meta {
          display: grid;
          grid-template-columns: auto auto;
          align-items: center;
          gap: 6px 10px;
          min-width: 138px;
        }

        .review-user {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--r-muted);
          font-size: 9px;
        }

        .time {
          color: var(--r-faint);
          font-size: 9px;
          white-space: nowrap;
        }

        .like-btn {
          grid-column: 1 / -1;
          justify-self: end;
          border: 1px solid var(--r-border);
          background: transparent;
          color: var(--r-faint);
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 7px;
          cursor: pointer;
          font-size: 9px;
        }

        .like-btn.liked {
          color: var(--r-pink);
          border-color: rgba(237,61,115,.4);
          background: var(--r-pink-glow);
        }

        .review-social-actions {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .comment-btn {
          border: 0;
          background: transparent;
          color: var(--r-faint);
          padding: 4px 5px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          cursor: pointer;
          font-size: 9px;
          font-weight: 800;
        }

        .comment-btn:hover,
        .comment-btn.active {
          color: var(--r-gold);
        }

        .comments-panel {
          grid-column: 1 / -1;
          margin-top: 11px;
          padding-top: 11px;
          border-top: 1px solid var(--r-border);
        }

        .comments-loading,
        .comments-empty {
          color: var(--r-faint);
          font-size: 10px;
          padding: 10px 0;
        }

        .comments-list {
          display: grid;
          gap: 9px;
          max-height: 330px;
          overflow-y: auto;
          padding-right: 3px;
        }

        .comment-row {
          display: grid;
          grid-template-columns: 30px minmax(0,1fr);
          gap: 8px;
        }

        .comment-avatar,
        .comment-username {
          border: 0;
          background: transparent;
          padding: 0;
          cursor: pointer;
        }

        .comment-body {
          min-width: 0;
          background: var(--r-soft);
          border: 1px solid var(--r-border);
          padding: 8px 9px;
        }

        .comment-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 4px;
        }

        .comment-username {
          color: var(--r-text);
          font-size: 9px;
          font-weight: 800;
        }

        .comment-head > span {
          color: var(--r-faint);
          font-size: 8px;
        }

        .comment-body p {
          margin: 0;
          color: var(--r-muted);
          font-size: 10px;
          line-height: 1.5;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }

        .comment-own-actions {
          display: flex;
          gap: 8px;
          margin-top: 6px;
        }

        .comment-own-actions button {
          border: 0;
          background: transparent;
          padding: 0;
          color: var(--r-faint);
          cursor: pointer;
          font-size: 8px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 3px;
        }

        .comment-own-actions .comment-delete {
          color: var(--r-danger);
        }

        .comment-edit textarea,
        .comment-compose textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid var(--r-border);
          background: var(--r-bg);
          color: var(--r-text);
          resize: vertical;
          outline: 0;
          font-family: inherit;
        }

        .comment-edit textarea {
          min-height: 62px;
          padding: 8px;
          font-size: 10px;
        }

        .comment-edit > div {
          display: flex;
          justify-content: flex-end;
          gap: 6px;
          margin-top: 5px;
        }

        .comment-edit button {
          border: 1px solid var(--r-border);
          background: var(--r-card);
          color: var(--r-muted);
          padding: 5px 7px;
          cursor: pointer;
          font-size: 8px;
          font-weight: 800;
        }

        .comment-edit .comment-save {
          border-color: var(--r-gold);
          color: var(--r-gold);
        }

        .comment-compose {
          display: grid;
          grid-template-columns: minmax(0,1fr) 38px;
          gap: 7px;
          margin-top: 10px;
          align-items: stretch;
        }

        .comment-compose textarea {
          min-height: 42px;
          max-height: 110px;
          padding: 9px 10px;
          font-size: 10px;
        }

        .comment-compose > button {
          border: 1px solid var(--r-pink);
          background: var(--r-pink);
          color: #fff;
          cursor: pointer;
          display: grid;
          place-items: center;
        }

        .comment-compose > button:disabled,
        .comment-edit button:disabled {
          opacity: .45;
          cursor: default;
        }

        .reviews-side {
          padding-top: 164px;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .watchlist-card {
          border: 1px solid var(--r-border);
          background: var(--r-card);
          padding: 16px;
        }

        .side-title {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 12px;
          font-weight: 800;
          color: var(--r-text);
          margin-bottom: 13px;
        }

        .watchlist-items {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .watchlist-item {
          width: 100%;
          border: 0;
          background: transparent;
          color: inherit;
          padding: 0;
          display: grid;
          grid-template-columns: 38px minmax(0,1fr) 18px;
          align-items: center;
          gap: 9px;
          text-align: left;
          cursor: pointer;
        }

        .watchlist-poster {
          width: 38px;
          height: 54px;
          background: var(--r-card-hover);
          border: 1px solid var(--r-border);
          display: grid;
          place-items: center;
          overflow: hidden;
        }

        .watchlist-copy {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .watchlist-copy strong {
          color: var(--r-text);
          font-size: 10px;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .watchlist-copy span {
          color: var(--r-faint);
          font-size: 8px;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .view-all {
          margin-top: 14px;
          border: 0;
          background: transparent;
          color: var(--r-gold);
          font-size: 10px;
          font-weight: 800;
          padding: 0;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          cursor: pointer;
        }

        .watchlist-empty {
          color: var(--r-faint);
          font-size: 10px;
          line-height: 1.5;
          padding: 10px 0;
        }

        .opinion-card {
          border: 1px solid rgba(237,61,115,.45);
          background:
            radial-gradient(circle at 100% 0%,rgba(237,61,115,.22),transparent 34%),
            linear-gradient(135deg,#5c0626,#260612);
          padding: 18px;
          color: #fff;
        }

        .opinion-card > svg {
          color: var(--r-gold);
        }

        .opinion-card h3 {
          font-size: 14px;
          margin: 12px 0 7px;
        }

        .opinion-card p {
          font-size: 10px;
          line-height: 1.55;
          opacity: .82;
          margin: 0 0 14px;
        }

        .opinion-card button {
          padding: 8px 13px;
          font-size: 10px;
        }

        .empty-box,
        .error-box {
          border: 1px solid var(--r-border);
          background: var(--r-card);
          color: var(--r-faint);
          padding: 24px;
          text-align: center;
          font-size: 11px;
        }

        .empty-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        .empty-discover-btn {
          border: 1px solid rgba(237,61,115,.45);
          background: var(--r-pink-glow);
          color: var(--r-pink);
          padding: 8px 11px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          font-size: 10px;
          font-weight: 800;
        }

        .error-box {
          color: #fb7185;
          border-color: rgba(251,113,133,.3);
          margin-bottom: 18px;
        }

        .modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 10000;
          background: rgba(0,0,0,.75);
          backdrop-filter: blur(6px);
          display: grid;
          place-items: center;
          padding: 20px;
        }

        .review-modal {
          width: min(560px,100%);
          max-height: min(760px,92vh);
          overflow-y: auto;
          border: 1px solid var(--r-border);
          background: var(--r-card);
          color: var(--r-text);
          box-shadow: 0 30px 100px rgba(0,0,0,.55);
          padding: 22px;
        }

        .modal-head {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          align-items: flex-start;
          margin-bottom: 20px;
        }

        .modal-head span {
          color: var(--r-pink);
          text-transform: uppercase;
          letter-spacing: .12em;
          font-size: 9px;
          font-weight: 800;
        }

        .modal-head h2 {
          margin: 4px 0 0;
          font-family: ${FONT_DISPLAY};
          font-size: 23px;
        }

        .modal-head > button {
          width: 32px;
          height: 32px;
          border: 1px solid var(--r-border);
          background: var(--r-bg-soft);
          color: var(--r-muted);
          display: grid;
          place-items: center;
          cursor: pointer;
        }

        .field-label {
          color: var(--r-muted);
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .07em;
          display: flex;
          justify-content: space-between;
          margin: 16px 0 7px;
        }

        .modal-search {
          height: 44px;
          display: flex;
          align-items: center;
          gap: 8px;
          border: 1px solid var(--r-border);
          background: var(--r-bg-soft);
          padding: 0 12px;
          color: var(--r-faint);
        }

        .modal-search input {
          flex: 1;
          border: 0;
          outline: 0;
          background: transparent;
          color: var(--r-text);
          height: 100%;
        }

        .movie-results {
          margin-top: 8px;
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .movie-result,
        .selected-movie {
          width: 100%;
          border: 1px solid var(--r-border);
          background: var(--r-bg-soft);
          color: var(--r-text);
          display: grid;
          grid-template-columns: 38px minmax(0,1fr) auto;
          align-items: center;
          gap: 10px;
          text-align: left;
          padding: 7px;
          cursor: pointer;
        }

        .movie-result:hover {
          border-color: var(--r-gold);
          background: var(--r-card-hover);
        }

        .result-poster {
          width: 38px;
          height: 55px;
          overflow: hidden;
          background: var(--r-card-hover);
          display: grid;
          place-items: center;
        }

        .movie-result strong,
        .selected-movie strong {
          display: block;
          font-size: 11px;
          margin-bottom: 4px;
        }

        .movie-result span,
        .selected-movie small {
          color: var(--r-faint);
          font-size: 9px;
        }

        .selected-movie > div:nth-child(2) > span {
          display: block;
          color: var(--r-pink);
          font-size: 8px;
          text-transform: uppercase;
          letter-spacing: .08em;
          margin-bottom: 2px;
        }

        .change-film {
          color: var(--r-gold) !important;
          font-weight: 800;
        }

        .result-message {
          padding: 18px;
          text-align: center;
          color: var(--r-faint);
          font-size: 10px;
        }

        .rating-picker {
          display: grid;
          grid-template-columns: repeat(6,1fr);
          gap: 5px;
        }

        .rating-picker button {
          height: 34px;
          border: 1px solid var(--r-border);
          background: var(--r-bg-soft);
          color: var(--r-muted);
          cursor: pointer;
          font-size: 10px;
          font-weight: 700;
        }

        .rating-picker button.selected {
          color: #120d05;
          background: var(--r-gold);
          border-color: var(--r-gold);
        }

        .review-modal textarea {
          width: 100%;
          resize: vertical;
          border: 1px solid var(--r-border);
          background: var(--r-bg-soft);
          color: var(--r-text);
          outline: 0;
          padding: 12px;
          line-height: 1.55;
          min-height: 125px;
        }

        .review-modal textarea:focus,
        .modal-search:focus-within {
          border-color: var(--r-gold);
        }

        .visibility-toggle {
          margin: 14px 0;
          display: flex;
          align-items: flex-start;
          gap: 10px;
          cursor: pointer;
        }

        .visibility-toggle > button {
          width: 20px;
          height: 20px;
          border: 1px solid var(--r-border);
          background: var(--r-bg-soft);
          color: #120d05;
          display: grid;
          place-items: center;
          cursor: pointer;
          flex-shrink: 0;
        }

        .visibility-toggle > button.checked {
          background: var(--r-gold);
          border-color: var(--r-gold);
        }

        .visibility-toggle span {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .visibility-toggle strong {
          color: var(--r-text);
          font-size: 10px;
        }

        .visibility-toggle small {
          color: var(--r-faint);
          font-size: 9px;
          line-height: 1.45;
        }

        .publish-btn {
          width: 100%;
          margin-top: 4px;
        }

        .publish-btn:disabled {
          opacity: .55;
          cursor: wait;
        }

        .modal-error {
          margin-top: 12px;
          padding: 9px 11px;
          color: #fb7185;
          border: 1px solid rgba(251,113,133,.28);
          background: rgba(251,113,133,.07);
          font-size: 10px;
        }

        @media (max-width: 980px) {
          .reviews-wrap {
            grid-template-columns: 1fr;
          }

          .reviews-side {
            padding-top: 0;
            display: grid;
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 720px) {
          .reviews-wrap {
            padding: 20px 14px 90px;
          }

          .page-header {
            align-items: flex-start;
          }

          .page-header h1 {
            font-size: 25px;
          }

          .header-actions {
            gap: 6px;
          }

          .discover-btn {
            font-size: 0;
            width: 42px;
            height: 42px;
            padding: 0;
            flex-shrink: 0;
          }

          .write-btn {
            font-size: 0;
            width: 42px;
            height: 42px;
            padding: 0;
            flex-shrink: 0;
          }

          .discover-btn svg,
          .write-btn svg {
            width: 18px;
            height: 18px;
          }

          .tabs {
            gap: 13px;
            overflow-x: auto;
          }

          .tabs button {
            white-space: nowrap;
          }

          .featured-grid {
            display: flex;
            overflow-x: auto;
            scroll-snap-type: x mandatory;
            padding-bottom: 6px;
          }

          .featured-card {
            min-width: 285px;
            scroll-snap-align: start;
          }

          .review-row {
            grid-template-columns: 46px minmax(0,1fr);
          }

          .review-poster {
            width: 46px;
            height: 64px;
          }

          .review-meta {
            grid-column: 1 / -1;
            display: flex;
            justify-content: flex-end;
            flex-wrap: wrap;
            min-width: 0;
          }

          .like-btn {
            grid-column: auto;
          }

          .reviews-side {
            grid-template-columns: 1fr;
          }

          .rating-picker {
            grid-template-columns: repeat(4,1fr);
          }
        }
      `}</style>
    </>
  );
}