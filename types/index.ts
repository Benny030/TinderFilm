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

export type RoomUser = {
  id: string;
  name: string;
};

export type SwipeState = Record<string, Record<string, boolean>>;

export type JsonMovieRow = {
  title: string;
  year: number;
  genre: string;
  cover?: string | null;
  trailer?: string | null;
  trama_c?: string | null;
  trama_l?: string | null;
};

export type Props = {
  movies: Movie[];
  roomId: string;
};

// ─── Auth ─────────────────────────────────────────────────────────────────────

export type AuthUser = {
  id: string;
  email: string;
  username: string;        // salvato in tabella users
  isGuest: false;
};

export type GuestUser = {
  id: string;              // UUID generato localmente
  name: string;            // nome libero inserito
  isGuest: true;
};

export type CurrentUser = AuthUser | GuestUser;  // unione — usato ovunque nell'app

// ─── Reviews ──────────────────────────────────────────────────────────────────

export type Review = {
  id: string;
  movie_id: string;
  user_id: string;
  username: string;        // denormalizzato per display
  text: string;
  rating: number;          // 1–5
  likes_count: number;
  created_at: string;
};

export type ReviewLike = {
  id: string;
  review_id: string;
  user_id: string;
};

// ─── Matches ──────────────────────────────────────────────────────────────────

export type Match = {
  id: string;
  user_id: string;
  movie_id: string;
  room_id: string | null;
  created_at: string;
};