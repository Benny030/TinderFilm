import type { Movie, RoomUser } from '@/types';

export type ExtendedMovie = Movie & {
  tmdb_id?: number;
  backdrop?: string | null;
  rating?: number;
  runtime?: string | null;
  tagline?: string | null;
};

export type StreamingSource = {
  name: string;
  type: 'sub' | 'rent' | 'buy' | 'free';
  price?: number;
  url?: string;
  logo: string;
  logoUrl?: string;
  color?: string;
};

export type MatchEntry = {
  movie: ExtendedMovie;
  timestamp: number;
};