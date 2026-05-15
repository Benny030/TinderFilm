// ─── Film ─────────────────────────────────────────────────────────────────────
export type Movie = {
  id: string | number;
  title: string;
  year: number;
  genre: string;
  cover: string | null;
  trailer: string | null;
  trama_c: string | null;
  trama_l: string | null;
};

export type JsonMovieRow = {
  title: string;
  year: number;
  genre: string;
  cover?: string | null;
  trailer?: string | null;
  trama_c?: string | null;
  trama_l?: string | null;
};

// ─── Stanza ───────────────────────────────────────────────────────────────────
export type RoomUser = {
  id: string;
  name: string;
};

export type SwipeState = Record<string, Record<string, boolean>>;

// ─── Auth ─────────────────────────────────────────────────────────────────────
export type AuthUser = {
  id: string;
  email: string;
  username: string;
  isGuest: false;
};

export type GuestUser = {
  id: string;
  name: string;
  isGuest: true;
};

export type CurrentUser = AuthUser | GuestUser;

// ─── Recensioni ───────────────────────────────────────────────────────────────
export type Review = {
  id: string;
  movie_id: string;
  user_id: string;
  username: string;
  text: string;
  rating: number;
  likes_count: number;
  created_at: string;
};

export type ReviewLike = {
  id: string;
  review_id: string;
  user_id: string;
};

// ─── Match ────────────────────────────────────────────────────────────────────
export type Match = {
  id: string;
  user_id: string;
  movie_id: string;
  room_id: string | null;
  created_at: string;
};

// ─── Page props ───────────────────────────────────────────────────────────────
export type Props = {
  movies: Movie[];
  roomId: string;
};