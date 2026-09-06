'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { useRouter } from 'next/router';
import {
  ArrowRight,
  BookmarkSimple,
  CaretRight,
  ChatCircle,
  Check,
  FilmSlate,
  Heart,
  MagnifyingGlass,
  PaperPlaneTilt,
  PencilSimple,
  Star,
  Trash,
  UserCheck,
  UserPlus,
  X,
} from '@phosphor-icons/react';

import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/context/ThemeContext';
import { FONT, THEME } from '@/styles/token';
import { createBrowserClient } from '@/utils/supabase/browser';
import { ensureTmdbMovie } from '@/utils/movieEntries';
import {
  moderateText,
  moderationMessage,
} from '@/utils/contentModeration';

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
  return Array.isArray(row.movie_catalog)
    ? row.movie_catalog[0] ?? null
    : row.movie_catalog;
}

function formatRelativeDate(value: string) {
  const date = new Date(value);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.max(0, Math.floor(diff / 3_600_000));

  if (hours < 1) return 'adesso';
  if (hours < 24) return `${hours} ${hours === 1 ? 'ora' : 'ore'} fa`;

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days} ${days === 1 ? 'giorno' : 'giorni'} fa`;
  }

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
  const [failed, setFailed] = useState(false);
  const initial = (username || '?').charAt(0).toUpperCase();

  useEffect(() => {
    setFailed(false);
  }, [url]);

  return (
    <div
      className="cdr-community-avatar"
      style={{ width: size, height: size }}
    >
      {url && !failed ? (
        <img
          src={url}
          alt=""
          referrerPolicy="no-referrer"
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
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
  const P = theme === 'dark' ? THEME.dark : THEME.light;
  const supabase = useRef(createBrowserClient()).current;

  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [followingReviews, setFollowingReviews] = useState<PublicReview[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistRow[]>([]);
  const [likedEntries, setLikedEntries] = useState<Set<string>>(new Set());
  const [authorSocial, setAuthorSocial] = useState<Record<string, AuthorSocial>>(
    {}
  );
  const [followingUserIds, setFollowingUserIds] = useState<Set<string>>(
    new Set()
  );
  const [followBusyUserId, setFollowBusyUserId] = useState<string | null>(null);

  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [openCommentsEntry, setOpenCommentsEntry] = useState<string | null>(
    null
  );
  const [commentsByEntry, setCommentsByEntry] = useState<
    Record<string, ReviewComment[]>
  >({});
  const [commentsLoadingEntry, setCommentsLoadingEntry] = useState<
    string | null
  >(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentSaving, setCommentSaving] = useState(false);
  const [commentError, setCommentError] = useState('');
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
      void router.replace('/auth');
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

      const normalizedReviews = (
        (reviewsResult.data ?? []) as PublicReview[]
      ).map((review) => ({
        ...review,
        likes_count: Number(review.likes_count ?? 0),
      }));

      const normalizedFollowingReviews = (
        (followingReviewsResult.data ?? []) as PublicReview[]
      ).map((review) => ({
        ...review,
        likes_count: Number(review.likes_count ?? 0),
      }));

      setReviews(normalizedReviews);
      setFollowingReviews(normalizedFollowingReviews);
      setFollowingUserIds(
        new Set(normalizedFollowingReviews.map((review) => review.user_id))
      );
      setWatchlist((watchlistResult.data ?? []) as WatchlistRow[]);
      setLikedEntries(
        new Set(
          ((likesResult.data ?? []) as { entry_id: string }[]).map(
            (item) => item.entry_id
          )
        )
      );

      const authorIds = Array.from(
        new Set(
          normalizedReviews
            .map((review) => review.user_id)
            .filter((id) => id !== currentUser.id)
        )
      );

      if (authorIds.length > 0) {
        const { data: socialRows, error: socialError } = await supabase.rpc(
          'get_people_compatibilities',
          { p_user_ids: authorIds }
        );

        if (socialError) {
          console.error(
            'Review author compatibility load failed:',
            socialError
          );
          setAuthorSocial({});
        } else {
          const next: Record<string, AuthorSocial> = {};

          for (const row of socialRows ?? []) {
            if (typeof row.user_id !== 'string') continue;

            next[row.user_id] = {
              compatibility_score: Number(row.compatibility_score ?? 0),
              shared_favorites_count: Number(
                row.shared_favorites_count ?? 0
              ),
              shared_high_ratings_count: Number(
                row.shared_high_ratings_count ?? 0
              ),
              shared_genres_count: Number(row.shared_genres_count ?? 0),
              follows_you: Boolean(row.follows_you),
            };
          }

          setAuthorSocial(next);
        }
      } else {
        setAuthorSocial({});
      }
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

    const q =
      typeof router.query.q === 'string' ? router.query.q.trim() : '';
    const movieParam =
      typeof router.query.movie === 'string'
        ? Number(router.query.movie)
        : null;

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
        if (typeof row.entry_id === 'string') {
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
      const { data, error } = await supabase.rpc('get_review_comments', {
        p_entry_id: entryId,
        p_limit: 100,
        p_offset: 0,
      });

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

    const moderation = moderateText(cleanText, 'comment');

    if (!moderation.allowed) {
      setCommentError(
        moderationMessage(moderation, 'comment')
      );
      return;
    }

    setCommentSaving(true);
    setCommentError('');

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const token = session?.access_token;

      if (!token) {
        throw new Error('Sessione non disponibile.');
      }

      const response = await fetch('/api/reviews/comment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          entry_id: entryId,
          text: cleanText,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error || 'Impossibile pubblicare il commento.'
        );
      }

      setCommentDraft('');
      await loadComments(entryId);
    } catch (error) {
      console.error('Review comment create failed:', error);
      setCommentError(
        error instanceof Error
          ? error.message
          : 'Impossibile pubblicare il commento.'
      );
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

    const moderation = moderateText(cleanText, 'comment');

    if (!moderation.allowed) {
      setCommentError(
        moderationMessage(moderation, 'comment')
      );
      return;
    }

    setCommentSaving(true);
    setCommentError('');

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const token = session?.access_token;

      if (!token) {
        throw new Error('Sessione non disponibile.');
      }

      const response = await fetch('/api/reviews/comment', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          comment_id: commentId,
          text: cleanText,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error || 'Impossibile aggiornare il commento.'
        );
      }

      setEditingCommentId(null);
      setEditingCommentText('');
      await loadComments(entryId);
    } catch (error) {
      console.error('Review comment update failed:', error);
      setCommentError(
        error instanceof Error
          ? error.message
          : 'Impossibile aggiornare il commento.'
      );
    } finally {
      setCommentSaving(false);
    }
  };

  const deleteComment = async (
    entryId: string,
    commentId: string
  ) => {
    if (!currentUser || currentUser.isGuest) return;

    if (!window.confirm('Vuoi eliminare questo commento?')) return;

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
        const { error } = await supabase.from('user_follows').insert({
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

    const moderation = moderateText(cleanText, 'review');

    if (!moderation.allowed) {
      setModalError(
        moderationMessage(moderation, 'review')
      );
      return;
    }

    setSavingReview(true);
    setModalError('');

    try {
      const movie = await ensureTmdbMovie(
        supabase,
        selectedMovie.tmdb_id
      );

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const token = session?.access_token;

      if (!token) {
        throw new Error('Sessione non disponibile.');
      }

      const response = await fetch('/api/reviews/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          movie_id: movie.id,
          review_text: cleanText,
          rating,
          publish_rating: publishRating,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error || 'Impossibile pubblicare la recensione.'
        );
      }

      closeModal();
      await loadPage();
    } catch (error: any) {
      console.error('Review save failed:', error);
      setModalError(
        error.message ?? 'Impossibile pubblicare la recensione.'
      );
    } finally {
      setSavingReview(false);
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
          minHeight: '100dvh',
          background: P.bg,
          color: P.textMuted,
          display: 'grid',
          placeItems: 'center',
          fontFamily: FONT.sans,
        }}
      >
        Caricamento...
      </div>
    );
  }

  const vars = {
    '--cdr-community-bg': P.bg,
    '--cdr-community-soft': P.bgSoft,
    '--cdr-community-surface': P.surface,
    '--cdr-community-hover': P.surfaceHover,
    '--cdr-community-border': P.border,
    '--cdr-community-text': P.text,
    '--cdr-community-muted': P.textMuted,
    '--cdr-community-faint': P.textFaint,
    '--cdr-community-pink': P.primary,
    '--cdr-community-pink-glow': P.primaryGlow,
    '--cdr-community-gold': P.accent,
    '--cdr-community-gold-glow': P.accentGlow,
  } as CSSProperties;

  return (
    <>
      <AppShell activeNav={'recensioni' as any}>
        <main className="cdr-community" style={vars}>
          <style>{`
            .cdr-community {
              width:100%;
              min-height:100dvh;
              overflow-x:hidden;
              background:var(--cdr-community-bg);
              color:var(--cdr-community-text);
              font-family:${FONT.sans};
            }
            .cdr-community * { box-sizing:border-box; }

            .cdr-community-wrap {
              width:min(100%,1180px);
              margin:0 auto;
              padding:24px 24px 56px;
              display:grid;
              grid-template-columns:minmax(0,1fr) 250px;
              gap:18px;
            }

            .cdr-community-main { min-width:0; }

            .cdr-community-hero {
              display:flex;
              align-items:flex-end;
              justify-content:space-between;
              gap:18px;
              margin-bottom:16px;
            }

            .cdr-community-kicker {
              display:flex;
              align-items:center;
              gap:7px;
              color:var(--cdr-community-pink);
              font-size:11px;
              font-weight:850;
              letter-spacing:.11em;
              text-transform:uppercase;
            }

            .cdr-community-title {
              margin:6px 0 0;
              font-family:${FONT.display};
              font-size:clamp(36px,5vw,52px);
              line-height:.98;
              letter-spacing:-.035em;
            }

            .cdr-community-lead {
              max-width:620px;
              margin:9px 0 0;
              color:var(--cdr-community-muted);
              font-size:14px;
              line-height:1.55;
            }

            .cdr-community-hero-actions {
              display:flex;
              gap:7px;
              flex-wrap:wrap;
              justify-content:flex-end;
            }

            .cdr-community-btn {
              min-height:38px;
              display:inline-flex;
              align-items:center;
              justify-content:center;
              gap:6px;
              padding:7px 10px;
              border:1px solid var(--cdr-community-border);
              background:var(--cdr-community-surface);
              color:var(--cdr-community-text);
              font-size:12px;
              font-weight:850;
              cursor:pointer;
            }

            .cdr-community-btn.primary {
              border-color:var(--cdr-community-pink);
              background:var(--cdr-community-pink);
              color:#fff;
            }

            .cdr-community-tabs {
              display:flex;
              gap:18px;
              overflow-x:auto;
              border-bottom:1px solid var(--cdr-community-border);
              scrollbar-width:none;
            }

            .cdr-community-tabs::-webkit-scrollbar { display:none; }

            .cdr-community-tabs button {
              flex:0 0 auto;
              padding:0 2px 9px;
              border:0;
              border-bottom:2px solid transparent;
              background:transparent;
              color:var(--cdr-community-muted);
              font-size:13px;
              cursor:pointer;
            }

            .cdr-community-tabs button.active {
              color:var(--cdr-community-pink);
              border-bottom-color:var(--cdr-community-pink);
              font-weight:850;
            }

            .cdr-community-tabs button.disabled {
              opacity:.5;
            }

            .cdr-community-toolbar {
              display:grid;
              grid-template-columns:minmax(0,1fr) auto;
              gap:8px;
              margin:12px 0 16px;
            }

            .cdr-community-search {
              min-height:42px;
              display:flex;
              align-items:center;
              gap:8px;
              padding:0 11px;
              border:1px solid var(--cdr-community-border);
              background:var(--cdr-community-surface);
              color:var(--cdr-community-faint);
            }

            .cdr-community-search:focus-within {
              border-color:var(--cdr-community-pink);
              box-shadow:0 0 0 2px var(--cdr-community-pink-glow);
            }

            .cdr-community-search input {
              min-width:0;
              flex:1;
              height:40px;
              border:0;
              outline:0;
              background:transparent;
              color:var(--cdr-community-text);
              font:inherit;
              font-size:13px;
            }

            .cdr-community-search button {
              width:28px;
              height:28px;
              display:grid;
              place-items:center;
              border:0;
              background:transparent;
              color:var(--cdr-community-faint);
              cursor:pointer;
            }

            .cdr-community-explore {
              min-height:42px;
              display:inline-flex;
              align-items:center;
              gap:6px;
              padding:0 10px;
              border:1px solid var(--cdr-community-gold);
              background:var(--cdr-community-gold-glow);
              color:var(--cdr-community-gold);
              font-size:12px;
              font-weight:850;
              cursor:pointer;
            }

            .cdr-community-target {
              margin-bottom:12px;
              padding:9px 10px;
              border:1px solid var(--cdr-community-gold);
              background:var(--cdr-community-gold-glow);
              display:flex;
              align-items:center;
              justify-content:space-between;
              gap:10px;
            }

            .cdr-community-target strong {
              display:block;
              color:var(--cdr-community-gold);
              font-size:8px;
              text-transform:uppercase;
              letter-spacing:.08em;
            }

            .cdr-community-target span {
              display:block;
              margin-top:2px;
              font-size:10px;
            }

            .cdr-community-target button {
              border:0;
              background:transparent;
              color:var(--cdr-community-muted);
              font-size:9px;
              font-weight:800;
              cursor:pointer;
            }

            .cdr-community-section {
              margin-top:18px;
            }

            .cdr-community-section-head {
              min-height:30px;
              display:flex;
              align-items:center;
              justify-content:space-between;
              gap:10px;
              margin-bottom:8px;
            }

            .cdr-community-section-title {
              display:flex;
              align-items:center;
              gap:6px;
              font-size:15px;
              font-weight:850;
            }

            .cdr-community-section-meta {
              color:var(--cdr-community-faint);
              font-size:11px;
            }

            .cdr-community-featured {
              display:grid;
              grid-template-columns:repeat(3,minmax(0,1fr));
              gap:7px;
            }

            .cdr-community-feature {
              min-width:0;
              display:grid;
              grid-template-columns:54px minmax(0,1fr);
              gap:9px;
              padding:9px;
              border:1px solid var(--cdr-community-border);
              background:var(--cdr-community-surface);
            }

            .cdr-community-feature:first-child {
              border-color:var(--cdr-community-gold);
            }

            .cdr-community-poster {
              overflow:hidden;
              border:1px solid var(--cdr-community-border);
              background:var(--cdr-community-soft);
              cursor:pointer;
            }

            .cdr-community-poster img {
              width:100%;
              height:100%;
              display:block;
              object-fit:cover;
            }

            .cdr-community-feature-poster {
              width:54px;
              height:81px;
            }

            .cdr-community-feature strong {
              display:block;
              min-width:0;
              overflow:hidden;
              color:var(--cdr-community-text);
              font-size:13px;
              line-height:1.3;
              text-overflow:ellipsis;
              white-space:nowrap;
            }

            .cdr-community-rating {
              display:inline-flex;
              align-items:center;
              gap:4px;
              margin-top:5px;
              color:var(--cdr-community-gold);
              font-size:12px;
              font-weight:850;
            }

            .cdr-community-feature p {
              margin:5px 0 7px;
              color:var(--cdr-community-muted);
              font-size:11px;
              line-height:1.48;
              display:-webkit-box;
              overflow:hidden;
              -webkit-box-orient:vertical;
              -webkit-line-clamp:3;
            }

            .cdr-community-user-link {
              min-width:0;
              display:inline-flex;
              align-items:center;
              gap:5px;
              padding:0;
              border:0;
              background:transparent;
              color:var(--cdr-community-muted);
              font-size:11px;
              cursor:pointer;
            }

            .cdr-community-avatar {
              overflow:hidden;
              flex:0 0 auto;
              display:grid;
              place-items:center;
              border-radius:50%;
              background:linear-gradient(135deg,var(--cdr-community-pink),#8e1740);
              color:#fff;
              font-weight:850;
            }

            .cdr-community-avatar img {
              width:100%;
              height:100%;
              display:block;
              object-fit:cover;
            }

            .cdr-community-list {
              display:grid;
              gap:7px;
            }

            .cdr-community-review {
              display:grid;
              grid-template-columns:64px minmax(0,1fr) 150px;
              align-items:start;
              gap:12px;
              padding:11px;
              border:1px solid var(--cdr-community-border);
              background:var(--cdr-community-surface);
              transition:border-color .16s ease, background .16s ease;
            }

            .cdr-community-review:hover {
              border-color:var(--cdr-community-pink);
              background:var(--cdr-community-hover);
            }

            .cdr-community-review.target {
              border-color:var(--cdr-community-pink);
              box-shadow:0 0 0 1px var(--cdr-community-pink-glow);
            }

            .cdr-community-review-poster {
              width:64px;
              height:96px;
            }

            .cdr-community-review-copy {
              min-width:0;
              display:flex;
              flex-direction:column;
              align-self:stretch;
              padding:2px 2px 1px;
            }

            .cdr-community-review-title {
              display:flex;
              align-items:flex-start;
              justify-content:space-between;
              gap:10px;
              margin-bottom:4px;
            }

            .cdr-community-review-title strong {
              min-width:0;
              flex:1;
              font-family:${FONT.display};
              font-size:17px;
              line-height:1.18;
              letter-spacing:-.015em;
            }

            .cdr-community-film-label {
              flex:0 0 auto;
              margin-top:2px;
              color:var(--cdr-community-pink);
              font-size:9px;
              font-weight:850;
              text-transform:uppercase;
              letter-spacing:.08em;
            }

            .cdr-community-review-copy .cdr-community-rating {
              margin-top:2px;
              margin-bottom:5px;
            }

            .cdr-community-review-text {
              position:relative;
              margin:3px 0 0;
              padding-left:11px;
              color:var(--cdr-community-muted);
              font-size:13.5px;
              line-height:1.58;
              display:-webkit-box;
              overflow:hidden;
              -webkit-box-orient:vertical;
              -webkit-line-clamp:4;
            }

            .cdr-community-review-text::before {
              content:'';
              position:absolute;
              left:0;
              top:3px;
              bottom:3px;
              width:2px;
              background:var(--cdr-community-border);
            }

            .cdr-community-review:hover .cdr-community-review-text::before {
              background:var(--cdr-community-pink);
            }

            .cdr-community-review-meta {
              min-width:0;
              display:grid;
              justify-items:end;
              gap:6px;
            }

            .cdr-community-follow {
              min-height:27px;
              display:inline-flex;
              align-items:center;
              justify-content:center;
              gap:4px;
              padding:4px 6px;
              border:1px solid var(--cdr-community-pink);
              background:var(--cdr-community-pink);
              color:#fff;
              font-size:14px;
              font-weight:850;
              cursor:pointer;
            }

            .cdr-community-follow.following {
              border-color:var(--cdr-community-border);
              background:var(--cdr-community-soft);
              color:var(--cdr-community-muted);
            }

            .cdr-community-social-note {
              color:var(--cdr-community-faint);
              font-size:9px;
              text-align:right;
              line-height:1.35;
            }

            .cdr-community-social-actions {
              display:flex;
              align-items:center;
              gap:4px;
            }

            .cdr-community-social-actions button {
              min-height:28px;
              display:inline-flex;
              align-items:center;
              gap:4px;
              padding:4px 6px;
              border:1px solid var(--cdr-community-border);
              background:transparent;
              color:var(--cdr-community-faint);
              font-size:11px;
              font-weight:800;
              cursor:pointer;
            }

            .cdr-community-social-actions button.liked,
            .cdr-community-social-actions button.active {
              border-color:var(--cdr-community-pink);
              color:var(--cdr-community-pink);
              background:var(--cdr-community-pink-glow);
            }

            .cdr-community-time {
              color:var(--cdr-community-faint);
              font-size:10px;
            }

            .cdr-community-comments {
              grid-column:1 / -1;
              padding-top:9px;
              border-top:1px solid var(--cdr-community-border);
            }

            .cdr-community-comment-list {
              max-height:320px;
              overflow-y:auto;
              display:grid;
              gap:7px;
            }

            .cdr-community-comment {
              display:grid;
              grid-template-columns:28px minmax(0,1fr);
              gap:7px;
            }

            .cdr-community-comment-body {
              padding:7px 8px;
              border:1px solid var(--cdr-community-border);
              background:var(--cdr-community-soft);
            }

            .cdr-community-comment-head {
              display:flex;
              align-items:center;
              justify-content:space-between;
              gap:8px;
              margin-bottom:4px;
            }

            .cdr-community-comment-head button {
              padding:0;
              border:0;
              background:transparent;
              color:var(--cdr-community-text);
              font-size:11px;
              font-weight:850;
              cursor:pointer;
            }

            .cdr-community-comment-head span {
              color:var(--cdr-community-faint);
              font-size:9px;
            }

            .cdr-community-comment-body p {
              margin:0;
              color:var(--cdr-community-muted);
              font-size:12px;
              line-height:1.5;
            }

            .cdr-community-comment-actions {
              display:flex;
              gap:8px;
              margin-top:5px;
            }

            .cdr-community-comment-actions button {
              padding:0;
              border:0;
              background:transparent;
              color:var(--cdr-community-faint);
              font-size:10px;
              font-weight:750;
              cursor:pointer;
            }

            .cdr-community-comment-actions button.delete {
              color:#ef4444;
            }

            .cdr-community-comment-edit textarea,
            .cdr-community-compose textarea {
              width:100%;
              resize:vertical;
              border:1px solid var(--cdr-community-border);
              background:var(--cdr-community-bg);
              color:var(--cdr-community-text);
              outline:0;
              font:inherit;
              font-size:11px;
            }

            .cdr-community-comment-edit textarea {
              min-height:58px;
              padding:7px;
            }

            .cdr-community-comment-edit-actions {
              display:flex;
              justify-content:flex-end;
              gap:5px;
              margin-top:5px;
            }

            .cdr-community-comment-edit-actions button {
              min-height:27px;
              padding:4px 7px;
              border:1px solid var(--cdr-community-border);
              background:var(--cdr-community-surface);
              color:var(--cdr-community-muted);
              font-size:7px;
              font-weight:800;
              cursor:pointer;
            }

            .cdr-community-comment-edit-actions button.save {
              border-color:var(--cdr-community-gold);
              color:var(--cdr-community-gold);
            }

            .cdr-community-compose {
              display:grid;
              grid-template-columns:minmax(0,1fr) 36px;
              gap:6px;
              margin-top:8px;
            }

            .cdr-community-compose textarea {
              min-height:38px;
              max-height:100px;
              padding:8px;
            }

            .cdr-community-compose > button {
              display:grid;
              place-items:center;
              border:1px solid var(--cdr-community-pink);
              background:var(--cdr-community-pink);
              color:#fff;
              cursor:pointer;
            }

            .cdr-community-side {
              padding-top:116px;
              display:grid;
              gap:12px;
              align-content:start;
            }

            .cdr-community-side-card {
              padding:12px;
              border:1px solid var(--cdr-community-border);
              background:var(--cdr-community-surface);
            }

            .cdr-community-side-title {
              display:flex;
              align-items:center;
              gap:6px;
              margin-bottom:10px;
              font-size:14px;
              font-weight:850;
            }

            .cdr-community-watchlist {
              display:grid;
              gap:7px;
            }

            .cdr-community-watch-item {
              width:100%;
              display:grid;
              grid-template-columns:36px minmax(0,1fr) 14px;
              gap:7px;
              align-items:center;
              padding:0;
              border:0;
              background:transparent;
              color:var(--cdr-community-text);
              text-align:left;
              cursor:pointer;
            }

            .cdr-community-watch-poster {
              width:36px;
              height:52px;
              overflow:hidden;
              border:1px solid var(--cdr-community-border);
              background:var(--cdr-community-soft);
            }

            .cdr-community-watch-poster img {
              width:100%;
              height:100%;
              object-fit:cover;
            }

            .cdr-community-watch-copy {
              min-width:0;
            }

            .cdr-community-watch-copy strong,
            .cdr-community-watch-copy span {
              display:block;
              overflow:hidden;
              text-overflow:ellipsis;
              white-space:nowrap;
            }

            .cdr-community-watch-copy strong {
              font-size:11px;
            }

            .cdr-community-watch-copy span {
              margin-top:2px;
              color:var(--cdr-community-faint);
              font-size:9px;
            }

            .cdr-community-side-link {
              margin-top:10px;
              display:inline-flex;
              align-items:center;
              gap:4px;
              padding:0;
              border:0;
              background:transparent;
              color:var(--cdr-community-gold);
              font-size:11px;
              font-weight:850;
              cursor:pointer;
            }

            .cdr-community-opinion {
              background:
                radial-gradient(circle at 100% 0%,var(--cdr-community-pink-glow),transparent 44%),
                var(--cdr-community-surface);
            }

            .cdr-community-opinion h3 {
              margin:8px 0 5px;
              font-family:${FONT.display};
              font-size:18px;
            }

            .cdr-community-opinion p {
              margin:0 0 10px;
              color:var(--cdr-community-muted);
              font-size:11px;
              line-height:1.5;
            }

            .cdr-community-state {
              min-height:150px;
              display:grid;
              place-items:center;
              padding:18px;
              border:1px dashed var(--cdr-community-border);
              background:var(--cdr-community-surface);
              color:var(--cdr-community-muted);
              text-align:center;
              font-size:12px;
              line-height:1.5;
            }

            .cdr-community-error {
              margin-bottom:10px;
              padding:9px 10px;
              border:1px solid rgba(239,68,68,.3);
              background:rgba(239,68,68,.07);
              color:#ef4444;
              font-size:9px;
            }

            .cdr-community-modal-backdrop {
              position:fixed;
              inset:0;
              z-index:10000;
              display:grid;
              place-items:center;
              padding:16px;
              background:rgba(0,0,0,.72);
              backdrop-filter:blur(6px);
            }

            .cdr-community-modal {
              width:min(560px,100%);
              max-height:92dvh;
              overflow-y:auto;
              padding:16px;
              border:1px solid var(--cdr-community-border);
              background:var(--cdr-community-surface);
              color:var(--cdr-community-text);
              box-shadow:0 28px 80px rgba(0,0,0,.42);
            }

            .cdr-community-modal-head {
              display:flex;
              align-items:flex-start;
              justify-content:space-between;
              gap:16px;
              margin-bottom:14px;
            }

            .cdr-community-modal-kicker {
              color:var(--cdr-community-pink);
              font-size:8px;
              font-weight:850;
              text-transform:uppercase;
              letter-spacing:.09em;
            }

            .cdr-community-modal h2 {
              margin:3px 0 0;
              font-family:${FONT.display};
              font-size:24px;
            }

            .cdr-community-close {
              width:32px;
              height:32px;
              display:grid;
              place-items:center;
              border:1px solid var(--cdr-community-border);
              background:var(--cdr-community-soft);
              color:var(--cdr-community-muted);
              cursor:pointer;
            }

            .cdr-community-label {
              display:flex;
              justify-content:space-between;
              margin:13px 0 6px;
              color:var(--cdr-community-muted);
              font-size:8px;
              font-weight:850;
              text-transform:uppercase;
              letter-spacing:.06em;
            }

            .cdr-community-modal-search {
              min-height:42px;
              display:flex;
              align-items:center;
              gap:7px;
              padding:0 10px;
              border:1px solid var(--cdr-community-border);
              background:var(--cdr-community-soft);
              color:var(--cdr-community-faint);
            }

            .cdr-community-modal-search input {
              min-width:0;
              flex:1;
              height:40px;
              border:0;
              outline:0;
              background:transparent;
              color:var(--cdr-community-text);
              font:inherit;
              font-size:9px;
            }

            .cdr-community-results {
              display:grid;
              gap:5px;
              margin-top:6px;
            }

            .cdr-community-movie-result,
            .cdr-community-selected {
              width:100%;
              display:grid;
              grid-template-columns:38px minmax(0,1fr) auto;
              gap:8px;
              align-items:center;
              padding:6px;
              border:1px solid var(--cdr-community-border);
              background:var(--cdr-community-soft);
              color:var(--cdr-community-text);
              text-align:left;
              cursor:pointer;
            }

            .cdr-community-result-poster {
              width:38px;
              height:56px;
              overflow:hidden;
              background:var(--cdr-community-bg);
            }

            .cdr-community-result-poster img {
              width:100%;
              height:100%;
              object-fit:cover;
            }

            .cdr-community-result-copy strong,
            .cdr-community-result-copy span {
              display:block;
            }

            .cdr-community-result-copy strong {
              font-size:9px;
            }

            .cdr-community-result-copy span {
              margin-top:2px;
              color:var(--cdr-community-faint);
              font-size:7px;
            }

            .cdr-community-rating-picker {
              display:grid;
              grid-template-columns:repeat(6,1fr);
              gap:4px;
            }

            .cdr-community-rating-picker button {
              min-height:32px;
              border:1px solid var(--cdr-community-border);
              background:var(--cdr-community-soft);
              color:var(--cdr-community-muted);
              font-size:8px;
              font-weight:750;
              cursor:pointer;
            }

            .cdr-community-rating-picker button.selected {
              border-color:var(--cdr-community-gold);
              background:var(--cdr-community-gold);
              color:#120d05;
            }

            .cdr-community-review-textarea {
              width:100%;
              min-height:120px;
              resize:vertical;
              padding:10px;
              border:1px solid var(--cdr-community-border);
              background:var(--cdr-community-soft);
              color:var(--cdr-community-text);
              outline:0;
              font:inherit;
              font-size:9px;
              line-height:1.55;
            }

            .cdr-community-visibility {
              display:flex;
              align-items:flex-start;
              gap:8px;
              margin:11px 0;
            }

            .cdr-community-check {
              width:20px;
              height:20px;
              flex:0 0 auto;
              display:grid;
              place-items:center;
              padding:0;
              border:1px solid var(--cdr-community-border);
              background:var(--cdr-community-soft);
              color:#120d05;
              cursor:pointer;
            }

            .cdr-community-check.checked {
              border-color:var(--cdr-community-gold);
              background:var(--cdr-community-gold);
            }

            .cdr-community-visibility strong,
            .cdr-community-visibility small {
              display:block;
            }

            .cdr-community-visibility strong {
              font-size:8px;
            }

            .cdr-community-visibility small {
              margin-top:2px;
              color:var(--cdr-community-faint);
              font-size:7px;
              line-height:1.4;
            }

            .cdr-community-publish {
              width:100%;
              min-height:38px;
              border:1px solid var(--cdr-community-pink);
              background:var(--cdr-community-pink);
              color:#fff;
              font-size:12px;
              font-weight:850;
              cursor:pointer;
            }

            .cdr-community-modal-error {
              margin-top:9px;
              padding:8px;
              border:1px solid rgba(239,68,68,.3);
              background:rgba(239,68,68,.07);
              color:#ef4444;
              font-size:8px;
            }

            @media (max-width:980px) {
              .cdr-community-wrap {
                grid-template-columns:1fr;
              }
              .cdr-community-side {
                padding-top:0;
                grid-template-columns:1fr 1fr;
              }
            }

            @media (max-width:760px) {
              .cdr-community-wrap {
                padding:16px 12px 80px;
              }
              .cdr-community-hero {
                align-items:flex-start;
              }
              .cdr-community-featured {
                display:flex;
                overflow-x:auto;
                scroll-snap-type:x mandatory;
              }
              .cdr-community-feature {
                min-width:260px;
                scroll-snap-align:start;
              }
              .cdr-community-review {
                grid-template-columns:56px minmax(0,1fr);
                gap:9px;
                padding:9px;
              }
              .cdr-community-review-poster {
                width:56px;
                height:84px;
              }

              .cdr-community-review-title strong {
                font-size:16px;
              }

              .cdr-community-review-text {
                font-size:12.5px;
                line-height:1.52;
                -webkit-line-clamp:5;
              }
              .cdr-community-review-meta {
                grid-column:1 / -1;
                display:flex;
                align-items:center;
                justify-content:flex-end;
                flex-wrap:wrap;
              }
              .cdr-community-side {
                grid-template-columns:1fr;
              }
            }

            @media (max-width:560px) {
              .cdr-community-wrap {
                padding:10px 8px 76px;
              }
              .cdr-community-hero {
                display:grid;
                grid-template-columns:minmax(0,1fr) auto;
                gap:10px;
              }
              .cdr-community-title {
                font-size:30px;
              }
              .cdr-community-lead {
                font-size:12px;
                line-height:1.5;
              }
              .cdr-community-hero-actions {
                display:grid;
                grid-template-columns:36px 36px;
                gap:5px;
              }
              .cdr-community-btn {
                width:36px;
                min-height:36px;
                padding:0;
                font-size:0;
              }
              .cdr-community-toolbar {
                grid-template-columns:1fr 38px;
              }
              .cdr-community-explore {
                width:38px;
                padding:0;
                justify-content:center;
                font-size:0;
              }
              .cdr-community-tabs {
                gap:14px;
              }
              .cdr-community-review {
                gap:8px;
                padding:8px;
              }
              .cdr-community-review-text {
                -webkit-line-clamp:4;
              }
              .cdr-community-follow {
                min-height:26px;
              }
              .cdr-community-rating-picker {
                grid-template-columns:repeat(4,1fr);
              }
              .cdr-community-modal {
                padding:12px;
              }
            }

            @media (min-width:381px) and (max-width:460px) {
              .cdr-community-wrap {
                padding-inline:8px;
              }
              .cdr-community-title {
                font-size:29px;
              }
              .cdr-community-review {
                grid-template-columns:54px minmax(0,1fr);
              }
              .cdr-community-review-poster {
                width:54px;
                height:81px;
              }
            }

            @media (max-width:380px) {
              .cdr-community-title { font-size:27px; }
              .cdr-community-review {
                grid-template-columns:46px minmax(0,1fr);
              }
              .cdr-community-review-poster {
                width:46px;
                height:69px;
              }
            }
          `}</style>

          <div className="cdr-community-wrap">
            <section className="cdr-community-main">
              <header className="cdr-community-hero">
                <div>
                  <div className="cdr-community-kicker">
                    <ChatCircle size={14} weight="fill" />
                    Community Cinedate
                  </div>
                  <h1 className="cdr-community-title">Recensioni</h1>
                  <p className="cdr-community-lead">
                    Opinioni, gusti e conversazioni intorno ai film.
                    Scopri cosa pensa la community e condividi il tuo punto
                    di vista.
                  </p>
                </div>

                <div className="cdr-community-hero-actions">
                  <button
                    type="button"
                    className="cdr-community-btn"
                    onClick={() => router.push('/persone')}
                    title="Scopri persone"
                  >
                    <UserPlus size={14} weight="bold" />
                    Scopri persone
                  </button>

                  <button
                    type="button"
                    className="cdr-community-btn primary"
                    onClick={() => setModalOpen(true)}
                    title="Scrivi recensione"
                  >
                    <PencilSimple size={14} weight="bold" />
                    Scrivi recensione
                  </button>
                </div>
              </header>

              <nav className="cdr-community-tabs">
                {[
                  ['tutte', 'Tutte'],
                  ['seguiti', 'Seguiti'],
                  ['film', 'Film'],
                  ['serie', 'Serie TV'],
                  ['animazione', 'Animazione'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={`${tab === key ? 'active' : ''} ${
                      key === 'serie' ? 'disabled' : ''
                    }`}
                    onClick={() => setTab(key as Tab)}
                    title={
                      key === 'serie'
                        ? 'Il catalogo Serie TV non è ancora collegato'
                        : undefined
                    }
                  >
                    {label}
                  </button>
                ))}
              </nav>

              <div className="cdr-community-toolbar">
                <div className="cdr-community-search">
                  <MagnifyingGlass size={15} />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Cerca film, utenti o recensioni..."
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      aria-label="Pulisci ricerca"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {!targetMovieId && (
                  <button
                    type="button"
                    className="cdr-community-explore"
                    onClick={() => router.push('/esplora')}
                    title="Scopri film"
                  >
                    Scopri film
                    <ArrowRight size={12} weight="bold" />
                  </button>
                )}
              </div>

              {targetMovieId && (
                <div className="cdr-community-target">
                  <div>
                    <strong>Recensioni del film</strong>
                    <span>{search || 'Film selezionato'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetMovieId(null);
                      setSearch('');
                      void router.replace('/recensioni', undefined, {
                        shallow: true,
                      });
                    }}
                  >
                    Mostra tutto
                  </button>
                </div>
              )}

              {feedError && (
                <div className="cdr-community-error">{feedError}</div>
              )}

              {!loadingFeed && highlightedReviews.length > 0 && (
                <section className="cdr-community-section">
                  <div className="cdr-community-section-head">
                    <div className="cdr-community-section-title">
                      <Star size={14} weight="fill" color={P.accent} />
                      In evidenza
                    </div>
                  </div>

                  <div className="cdr-community-featured">
                    {highlightedReviews.map((review) => (
                      <article
                        key={`featured-${review.entry_id}`}
                        className="cdr-community-feature"
                      >
                        <div
                          className="cdr-community-poster cdr-community-feature-poster"
                          onClick={() =>
                            review.provider === 'tmdb' &&
                            router.push(
                              `/film/${review.provider_movie_id}`
                            )
                          }
                        >
                          {review.cover ? (
                            <img src={review.cover} alt={review.title} />
                          ) : (
                            <FilmSlate
                              size={20}
                              color={P.textFaint}
                              weight="duotone"
                            />
                          )}
                        </div>

                        <div>
                          <strong>{review.title}</strong>

                          {review.rating !== null && (
                            <div className="cdr-community-rating">
                              <Star size={11} weight="fill" />
                              {Number(review.rating).toFixed(1)}
                            </div>
                          )}

                          <p>{review.review_text}</p>

                          <button
                            type="button"
                            className="cdr-community-user-link"
                            onClick={() =>
                              review.username &&
                              router.push(
                                `/utente/${encodeURIComponent(
                                  review.username
                                )}`
                              )
                            }
                          >
                            <Avatar
                              username={review.username}
                              url={review.avatar_url}
                              size={22}
                            />
                            @{review.username || 'utente'}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              <section className="cdr-community-section">
                <div className="cdr-community-section-head">
                  <div className="cdr-community-section-title">
                    <ChatCircle
                      size={14}
                      weight="fill"
                      color={P.primary}
                    />
                    Recensioni recenti
                  </div>
                  <div className="cdr-community-section-meta">
                    {filteredReviews.length}{' '}
                    {filteredReviews.length === 1
                      ? 'recensione'
                      : 'recensioni'}
                  </div>
                </div>

                {loadingFeed ? (
                  <div className="cdr-community-state">
                    Caricamento recensioni...
                  </div>
                ) : filteredReviews.length === 0 ? (
                  <div className="cdr-community-state">
                    {tab === 'serie'
                      ? 'Le Serie TV saranno disponibili quando collegheremo il catalogo TV.'
                      : tab === 'seguiti'
                        ? 'Non ci sono ancora recensioni pubbliche delle persone che segui.'
                        : 'Non ci sono recensioni in questa sezione.'}
                  </div>
                ) : (
                  <div className="cdr-community-list">
                    {filteredReviews.map((review) => {
                      const liked = likedEntries.has(review.entry_id);
                      const following = followingUserIds.has(
                        review.user_id
                      );
                      const social = authorSocial[review.user_id];

                      return (
                        <article
                          id={`review-${review.entry_id}`}
                          key={review.entry_id}
                          className={`cdr-community-review ${
                            router.query.review === review.entry_id
                              ? 'target'
                              : ''
                          }`}
                        >
                          <div
                            className="cdr-community-poster cdr-community-review-poster"
                            onClick={() =>
                              review.provider === 'tmdb' &&
                              router.push(
                                `/film/${review.provider_movie_id}`
                              )
                            }
                          >
                            {review.cover ? (
                              <img
                                src={review.cover}
                                alt={review.title}
                              />
                            ) : (
                              <FilmSlate
                                size={20}
                                color={P.textFaint}
                                weight="duotone"
                              />
                            )}
                          </div>

                          <div className="cdr-community-review-copy">
                            <div className="cdr-community-review-title">
                              <strong>{review.title}</strong>
                              <span className="cdr-community-film-label">
                                Film
                              </span>
                            </div>

                            {review.rating !== null && (
                              <div className="cdr-community-rating">
                                <Star size={11} weight="fill" />
                                {Number(review.rating).toFixed(1)}
                              </div>
                            )}

                            <p className="cdr-community-review-text">
                              {review.review_text}
                            </p>
                          </div>

                          <div className="cdr-community-review-meta">
                            <button
                              type="button"
                              className="cdr-community-user-link"
                              onClick={() =>
                                review.username &&
                                router.push(
                                  `/utente/${encodeURIComponent(
                                    review.username
                                  )}`
                                )
                              }
                            >
                              <Avatar
                                username={review.username}
                                url={review.avatar_url}
                                size={24}
                              />
                              @{review.username || 'utente'}
                            </button>

                            {currentUser.id !== review.user_id && (
                              <button
                                type="button"
                                className={`cdr-community-follow ${
                                  following ? 'following' : ''
                                }`}
                                disabled={
                                  followBusyUserId === review.user_id
                                }
                                onClick={() =>
                                  void toggleFollowAuthor(review)
                                }
                              >
                                {following ? (
                                  <UserCheck size={10} weight="fill" />
                                ) : (
                                  <UserPlus size={10} weight="bold" />
                                )}
                                {following ? 'Segui già' : 'Segui'}
                              </button>
                            )}

                            {currentUser.id !== review.user_id &&
                              (social?.compatibility_score ?? 0) > 0 && (
                                <div className="cdr-community-social-note">
                                  Affinità {social.compatibility_score}
                                  {social.follows_you ? ' · Ti segue' : ''}
                                </div>
                              )}

                            <span className="cdr-community-time">
                              {formatRelativeDate(
                                review.review_updated_at ||
                                  review.created_at
                              )}
                            </span>

                            <div className="cdr-community-social-actions">
                              <button
                                type="button"
                                className={
                                  openCommentsEntry === review.entry_id
                                    ? 'active'
                                    : ''
                                }
                                onClick={() =>
                                  void toggleComments(review.entry_id)
                                }
                              >
                                <ChatCircle
                                  size={13}
                                  weight={
                                    openCommentsEntry === review.entry_id
                                      ? 'fill'
                                      : 'regular'
                                  }
                                />
                                {commentCounts[review.entry_id] ?? 0}
                              </button>

                              <button
                                type="button"
                                className={liked ? 'liked' : ''}
                                onClick={() => void toggleLike(review)}
                              >
                                <Heart
                                  size={13}
                                  weight={liked ? 'fill' : 'regular'}
                                />
                                {review.likes_count}
                              </button>
                            </div>
                          </div>

                          {openCommentsEntry === review.entry_id && (
                            <div className="cdr-community-comments">
                              {commentsLoadingEntry === review.entry_id ? (
                                <div className="cdr-community-state">
                                  Caricamento commenti...
                                </div>
                              ) : (
                                <>
                                  <div className="cdr-community-comment-list">
                                    {(
                                      commentsByEntry[review.entry_id] ?? []
                                    ).length === 0 ? (
                                      <div className="cdr-community-state">
                                        Nessun commento. Puoi essere il
                                        primo.
                                      </div>
                                    ) : (
                                      (
                                        commentsByEntry[review.entry_id] ??
                                        []
                                      ).map((comment) => {
                                        const isMine =
                                          currentUser.id ===
                                          comment.user_id;
                                        const isEditing =
                                          editingCommentId ===
                                          comment.comment_id;

                                        return (
                                          <div
                                            className="cdr-community-comment"
                                            key={comment.comment_id}
                                          >
                                            <button
                                              type="button"
                                              className="cdr-community-user-link"
                                              onClick={() =>
                                                comment.username &&
                                                router.push(
                                                  `/utente/${encodeURIComponent(
                                                    comment.username
                                                  )}`
                                                )
                                              }
                                            >
                                              <Avatar
                                                username={comment.username}
                                                url={comment.avatar_url}
                                                size={28}
                                              />
                                            </button>

                                            <div className="cdr-community-comment-body">
                                              <div className="cdr-community-comment-head">
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    comment.username &&
                                                    router.push(
                                                      `/utente/${encodeURIComponent(
                                                        comment.username
                                                      )}`
                                                    )
                                                  }
                                                >
                                                  @
                                                  {comment.username ||
                                                    'utente'}
                                                </button>
                                                <span>
                                                  {formatRelativeDate(
                                                    comment.updated_at ||
                                                      comment.created_at
                                                  )}
                                                </span>
                                              </div>

                                              {isEditing ? (
                                                <div className="cdr-community-comment-edit">
                                                  <textarea
                                                    value={
                                                      editingCommentText
                                                    }
                                                    maxLength={1000}
                                                    onChange={(event) =>
                                                      setEditingCommentText(
                                                        event.target.value
                                                      )
                                                    }
                                                  />
                                                  <div className="cdr-community-comment-edit-actions">
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
                                                      className="save"
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
                                                <div className="cdr-community-comment-actions">
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
                                                    className="delete"
                                                    onClick={() =>
                                                      void deleteComment(
                                                        review.entry_id,
                                                        comment.comment_id
                                                      )
                                                    }
                                                  >
                                                    <Trash size={9} />
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

                                  {commentError && (
                                    <div
                                      style={{
                                        marginBottom: 7,
                                        color: P.primary,
                                        fontSize: 9,
                                        lineHeight: 1.45,
                                      }}
                                    >
                                      {commentError}
                                    </div>
                                  )}

                                  <div className="cdr-community-compose">
                                    <textarea
                                      value={commentDraft}
                                      maxLength={1000}
                                      placeholder="Scrivi un commento..."
                                      onChange={(event) => {
                                        setCommentDraft(event.target.value);
                                        setCommentError('');
                                      }}
                                      onKeyDown={(event) => {
                                        if (
                                          event.key === 'Enter' &&
                                          !event.shiftKey
                                        ) {
                                          event.preventDefault();
                                          void submitComment(
                                            review.entry_id
                                          );
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
                                        size={14}
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

            <aside className="cdr-community-side">
              <section className="cdr-community-side-card">
                <div className="cdr-community-side-title">
                  <BookmarkSimple
                    size={15}
                    weight="fill"
                    color={P.accent}
                  />
                  I tuoi film da vedere
                </div>

                {watchlist.length === 0 ? (
                  <div className="cdr-community-state">
                    La tua watchlist è ancora vuota.
                  </div>
                ) : (
                  <div className="cdr-community-watchlist">
                    {watchlist.slice(0, 6).map((row) => {
                      const movie = getCatalogMovie(row);
                      if (!movie) return null;

                      return (
                        <button
                          type="button"
                          className="cdr-community-watch-item"
                          key={row.id}
                          onClick={() =>
                            movie.provider === 'tmdb' &&
                            router.push(
                              `/film/${movie.provider_movie_id}`
                            )
                          }
                        >
                          <div className="cdr-community-watch-poster">
                            {movie.cover ? (
                              <img
                                src={movie.cover}
                                alt={movie.title}
                              />
                            ) : (
                              <FilmSlate
                                size={18}
                                color={P.textFaint}
                                weight="duotone"
                              />
                            )}
                          </div>
                          <div className="cdr-community-watch-copy">
                            <strong>{movie.title}</strong>
                            <span>
                              {[movie.year, movie.genre]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          </div>
                          <BookmarkSimple
                            size={13}
                            weight="fill"
                            color={P.accent}
                          />
                        </button>
                      );
                    })}
                  </div>
                )}

                <button
                  type="button"
                  className="cdr-community-side-link"
                  onClick={() =>
                    router.push('/libreria?tab=watchlist')
                  }
                >
                  Vedi tutti
                  <CaretRight size={11} />
                </button>
              </section>

              <section className="cdr-community-side-card cdr-community-opinion">
                <Star size={18} weight="fill" color={P.accent} />
                <h3>La tua opinione conta</h3>
                <p>
                  Condividi cosa hai pensato di un film e aiuta la
                  community a scegliere cosa guardare.
                </p>
                <button
                  type="button"
                  className="cdr-community-btn primary"
                  onClick={() => setModalOpen(true)}
                >
                  <PencilSimple size={12} />
                  Scrivi ora
                </button>
              </section>
            </aside>
          </div>
        </main>
      </AppShell>

      {modalOpen && (
        <div
          className="cdr-community-modal-backdrop"
          style={vars}
          onMouseDown={closeModal}
        >
          <div
            className="cdr-community-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="cdr-community-modal-head">
              <div>
                <div className="cdr-community-modal-kicker">
                  La tua recensione
                </div>
                <h2>Scrivi cosa ne pensi</h2>
              </div>
              <button
                type="button"
                className="cdr-community-close"
                disabled={savingReview}
                onClick={closeModal}
              >
                <X size={16} />
              </button>
            </div>

            {!selectedMovie ? (
              <>
                <label className="cdr-community-label">
                  Cerca il film
                </label>
                <div className="cdr-community-modal-search">
                  <MagnifyingGlass size={14} />
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

                <div className="cdr-community-results">
                  {movieSearching && (
                    <div className="cdr-community-state">
                      Ricerca...
                    </div>
                  )}

                  {!movieSearching &&
                    movieQuery.trim().length >= 2 &&
                    movieResults.length === 0 && (
                      <div className="cdr-community-state">
                        Nessun film trovato.
                      </div>
                    )}

                  {movieResults.map((movie) => (
                    <button
                      type="button"
                      key={movie.id}
                      className="cdr-community-movie-result"
                      onClick={() => {
                        setSelectedMovie(movie);
                        setModalError('');
                      }}
                    >
                      <div className="cdr-community-result-poster">
                        {movie.cover ? (
                          <img src={movie.cover} alt={movie.title} />
                        ) : (
                          <FilmSlate
                            size={18}
                            color={P.textFaint}
                            weight="duotone"
                          />
                        )}
                      </div>
                      <div className="cdr-community-result-copy">
                        <strong>{movie.title}</strong>
                        <span>
                          {[movie.year || null, movie.genre]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </div>
                      <CaretRight size={14} />
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="cdr-community-selected"
                  onClick={() => setSelectedMovie(null)}
                >
                  <div className="cdr-community-result-poster">
                    {selectedMovie.cover ? (
                      <img
                        src={selectedMovie.cover}
                        alt={selectedMovie.title}
                      />
                    ) : (
                      <FilmSlate
                        size={18}
                        color={P.textFaint}
                        weight="duotone"
                      />
                    )}
                  </div>
                  <div className="cdr-community-result-copy">
                    <strong>{selectedMovie.title}</strong>
                    <span>
                      {[selectedMovie.year || null, selectedMovie.genre]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </div>
                  <span
                    style={{
                      color: P.accent,
                      fontSize: 8,
                      fontWeight: 850,
                    }}
                  >
                    Cambia
                  </span>
                </button>

                <label className="cdr-community-label">
                  Il tuo voto
                </label>
                <div className="cdr-community-rating-picker">
                  {[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map(
                    (value) => (
                      <button
                        key={value}
                        type="button"
                        className={rating === value ? 'selected' : ''}
                        onClick={() => setRating(value)}
                      >
                        {value}
                      </button>
                    )
                  )}
                  <button
                    type="button"
                    className={rating === null ? 'selected' : ''}
                    onClick={() => setRating(null)}
                  >
                    —
                  </button>
                </div>

                <label className="cdr-community-label">
                  <span>Recensione</span>
                  <span>{reviewText.length}/3000</span>
                </label>
                <textarea
                  className="cdr-community-review-textarea"
                  value={reviewText}
                  onChange={(event) =>
                    setReviewText(event.target.value.slice(0, 3000))
                  }
                  placeholder="Cosa ti è piaciuto? Cosa non ti ha convinto?"
                />

                <div className="cdr-community-visibility">
                  <button
                    type="button"
                    className={`cdr-community-check ${
                      publishRating ? 'checked' : ''
                    }`}
                    onClick={() =>
                      setPublishRating((value) => !value)
                    }
                  >
                    {publishRating && (
                      <Check size={11} weight="bold" />
                    )}
                  </button>
                  <div>
                    <strong>
                      Mostra pubblicamente anche il voto
                    </strong>
                    <small>
                      La recensione sarà pubblica; watchlist,
                      preferiti e data di visione restano privati.
                    </small>
                  </div>
                </div>

                <button
                  type="button"
                  className="cdr-community-publish"
                  disabled={savingReview}
                  onClick={() => void submitReview()}
                >
                  {savingReview
                    ? 'Pubblicazione...'
                    : 'Pubblica recensione'}
                </button>
              </>
            )}

            {modalError && (
              <div className="cdr-community-modal-error">
                {modalError}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
