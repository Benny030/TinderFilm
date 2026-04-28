export type Movie = {
  id: string | number;
  title: string;
  year: number;
  genre: string;
  cover: string | null;
  trailer: string | null;
  trama_c?: string | null;
  trama_l?: string | null;
};

export type RoomUser = {
     id: string;
      name: string };

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