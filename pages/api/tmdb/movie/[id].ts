import type {
  NextApiRequest,
  NextApiResponse,
} from 'next';

const TMDB_BASE_URL =
  'https://api.themoviedb.org/3';

const TMDB_IMAGE_BASE =
  'https://image.tmdb.org/t/p';

type CandidateSource = {
  recommendation?: boolean;
  similar?: boolean;
  collection?: boolean;
};

type CandidateMovie = {
  id: number;

  title?: string;

  release_date?: string;

  poster_path?: string | null;

  backdrop_path?: string | null;

  vote_average?: number;

  vote_count?: number;

  popularity?: number;

  genre_ids?: number[];

  original_language?: string;

  source?: CandidateSource;

  sourceIndex?: number;
};

type ScoredCandidate = {
  candidate: CandidateMovie;

  detail: any;

  score: number;

  meta: {
    sharedGenres: number;

    genreSimilarity: number;

    sharedCast: number;

    sharedKeywords: number;

    keywordSimilarity: number;

    sharedCompanies: number;

    sameDirector: boolean;

    sameLanguage: boolean;
  };
};

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function getYear(
  date?: string | null
) {
  if (!date) return 0;

  const year =
    Number.parseInt(
      date.split('-')[0],
      10
    );

  return Number.isFinite(year)
    ? year
    : 0;
}

function uniqueNumbers(
  values: number[]
) {
  return Array.from(
    new Set(
      values.filter(
        (value) =>
          typeof value ===
            'number' &&
          Number.isFinite(
            value
          )
      )
    )
  );
}

function intersectionCount(
  first: number[],
  second: number[]
) {
  const secondSet =
    new Set(second);

  return first.reduce(
    (
      count,
      value
    ) =>
      secondSet.has(value)
        ? count + 1
        : count,
    0
  );
}

function jaccardSimilarity(
  first: number[],
  second: number[]
) {
  if (
    first.length === 0 ||
    second.length === 0
  ) {
    return 0;
  }

  const intersection =
    intersectionCount(
      first,
      second
    );

  const union =
    new Set([
      ...first,
      ...second,
    ]).size;

  if (!union) {
    return 0;
  }

  return (
    intersection /
    union
  );
}

async function tmdbFetch(
  path: string,
  apiKey: string
) {
  const url =
    new URL(
      `${TMDB_BASE_URL}${path}`
    );

  url.searchParams.set(
    'api_key',
    apiKey
  );

  const response =
    await fetch(
      url.toString()
    );

  if (!response.ok) {
    throw new Error(
      `TMDB ${response.status}: ${path}`
    );
  }

  return response.json();
}

// ─────────────────────────────────────────────
// API
// ─────────────────────────────────────────────

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (
    req.method !== 'GET'
  ) {
    return res
      .status(405)
      .json({
        error:
          'Method not allowed',
      });
  }

  const rawId =
    req.query.id;

  const movieId =
    Array.isArray(rawId)
      ? rawId[0]
      : rawId;

  if (!movieId) {
    return res
      .status(400)
      .json({
        error:
          'ID film mancante',
      });
  }

  const apiKey =
    process.env
      .TMDB_API_KEY;

  if (!apiKey) {
    return res
      .status(500)
      .json({
        error:
          'TMDB API key mancante',
      });
  }

  try {
    // ─────────────────────────────────────────
    // DATI PRINCIPALI FILM
    // ─────────────────────────────────────────

    const [
      movieRes,
      videosRes,
      creditsRes,
      similarRes,
      recommendationsRes,
      keywordsRes,
    ] =
      await Promise.all([
        fetch(
          `${TMDB_BASE_URL}/movie/${encodeURIComponent(
            movieId
          )}?api_key=${apiKey}&language=it-IT`
        ),

        fetch(
          `${TMDB_BASE_URL}/movie/${encodeURIComponent(
            movieId
          )}/videos?api_key=${apiKey}&language=it-IT`
        ),

        fetch(
          `${TMDB_BASE_URL}/movie/${encodeURIComponent(
            movieId
          )}/credits?api_key=${apiKey}&language=it-IT`
        ),

        fetch(
          `${TMDB_BASE_URL}/movie/${encodeURIComponent(
            movieId
          )}/similar?api_key=${apiKey}&language=it-IT&page=1`
        ),

        fetch(
          `${TMDB_BASE_URL}/movie/${encodeURIComponent(
            movieId
          )}/recommendations?api_key=${apiKey}&language=it-IT&page=1`
        ),

        fetch(
          `${TMDB_BASE_URL}/movie/${encodeURIComponent(
            movieId
          )}/keywords?api_key=${apiKey}`
        ),
      ]);

    if (!movieRes.ok) {
      throw new Error(
        `TMDB movie error: ${movieRes.status}`
      );
    }

    const movie =
      await movieRes.json();

    const videos =
      videosRes.ok
        ? await videosRes.json()
        : {
            results: [],
          };

    const credits =
      creditsRes.ok
        ? await creditsRes.json()
        : {
            cast: [],
            crew: [],
          };

    const similarData =
      similarRes.ok
        ? await similarRes.json()
        : {
            results: [],
          };

    const recommendationsData =
      recommendationsRes.ok
        ? await recommendationsRes.json()
        : {
            results: [],
          };

    const keywordsData =
      keywordsRes.ok
        ? await keywordsRes.json()
        : {
            keywords: [],
          };

    // ─────────────────────────────────────────
    // TRAILER
    // ─────────────────────────────────────────

    const trailer =
      videos.results?.find(
        (video: any) =>
          video.type ===
            'Trailer' &&
          video.site ===
            'YouTube' &&
          video.official ===
            true
      ) ??
      videos.results?.find(
        (video: any) =>
          video.type ===
            'Trailer' &&
          video.site ===
            'YouTube'
      ) ??
      videos.results?.find(
        (video: any) =>
          video.site ===
          'YouTube'
      ) ??
      null;

    const trailerUrl =
      trailer?.key
        ? `https://www.youtube.com/watch?v=${trailer.key}`
        : null;

    // ─────────────────────────────────────────
    // GENERI
    // ─────────────────────────────────────────

    const genres =
      (
        movie.genres ??
        []
      )
        .map(
          (genre: any) =>
            genre.name
        )
        .join(', ');

    const currentGenreIds =
      uniqueNumbers(
        (
          movie.genres ??
          []
        ).map(
          (genre: any) =>
            Number(
              genre.id
            )
        )
      );

    // ─────────────────────────────────────────
    // RUNTIME
    // ─────────────────────────────────────────

    const runtime =
      movie.runtime
        ? `${Math.floor(
            movie.runtime /
              60
          )}h ${
            movie.runtime %
            60
          }min`
        : null;

    // ─────────────────────────────────────────
    // REGISTA
    // ─────────────────────────────────────────

    const director =
      (
        credits.crew ??
        []
      ).find(
        (person: any) =>
          person.job ===
          'Director'
      ) ?? null;

    // ─────────────────────────────────────────
    // CAST PRINCIPALE
    //
    // Serve SOLO per il calcolo
    // dei film simili.
    //
    // Il cast restituito al frontend
    // più sotto resta COMPLETO.
    // ─────────────────────────────────────────

    const currentMainCast =
      (
        credits.cast ??
        []
      )
        .sort(
          (
            a: any,
            b: any
          ) =>
            (
              a.order ??
              999
            ) -
            (
              b.order ??
              999
            )
        )
        .slice(
          0,
          12
        );

    const currentMainCastIds =
      uniqueNumbers(
        currentMainCast.map(
          (person: any) =>
            Number(
              person.id
            )
        )
      );

    // ─────────────────────────────────────────
    // KEYWORD
    // ─────────────────────────────────────────

    const currentKeywordIds =
      uniqueNumbers(
        (
          keywordsData.keywords ??
          []
        ).map(
          (keyword: any) =>
            Number(
              keyword.id
            )
        )
      );

    // ─────────────────────────────────────────
    // CASE DI PRODUZIONE
    // ─────────────────────────────────────────

    const currentCompanyIds =
      uniqueNumbers(
        (
          movie.production_companies ??
          []
        ).map(
          (company: any) =>
            Number(
              company.id
            )
        )
      );

    const currentLanguage =
      movie.original_language ??
      '';

    const currentYear =
      getYear(
        movie.release_date
      );

    // ─────────────────────────────────────────
    // COLLECTION / SAGA
    // ─────────────────────────────────────────

    let collectionMovies:
      any[] = [];

    if (
      movie
        .belongs_to_collection
        ?.id
    ) {
      try {
        const collectionData =
          await tmdbFetch(
            `/collection/${movie.belongs_to_collection.id}?language=it-IT`,
            apiKey
          );

        collectionMovies =
          collectionData.parts ??
          [];
      } catch (
        error
      ) {
        console.error(
          'TMDB collection error:',
          error
        );

        collectionMovies =
          [];
      }
    }

    // ─────────────────────────────────────────
    // CREA POOL DI CANDIDATI
    //
    // Usiamo:
    //
    // 1. recommendations
    // 2. similar
    // 3. stessa saga
    // ─────────────────────────────────────────

    const candidateMap =
      new Map<
        number,
        CandidateMovie
      >();

    const addCandidates =
      (
        items: any[],
        source:
          keyof CandidateSource
      ) => {
        items.forEach(
          (
            item: any,
            index: number
          ) => {
            const candidateId =
              Number(
                item.id
              );

            if (
              !candidateId ||
              candidateId ===
                Number(
                  movie.id
                )
            ) {
              return;
            }

            const existing =
              candidateMap.get(
                candidateId
              );

            if (existing) {
              candidateMap.set(
                candidateId,
                {
                  ...existing,
                  ...item,

                  source: {
                    ...existing.source,

                    [source]:
                      true,
                  },

                  sourceIndex:
                    Math.min(
                      existing.sourceIndex ??
                        999,

                      index
                    ),
                }
              );

              return;
            }

            candidateMap.set(
              candidateId,
              {
                ...item,

                source: {
                  [source]:
                    true,
                },

                sourceIndex:
                  index,
              }
            );
          }
        );
      };

    addCandidates(
      recommendationsData.results ??
        [],
      'recommendation'
    );

    addCandidates(
      similarData.results ??
        [],
      'similar'
    );

    addCandidates(
      collectionMovies,
      'collection'
    );

    // ─────────────────────────────────────────
    // PRIMA CLASSIFICA
    //
    // Serve per decidere quali film vale
    // la pena analizzare più approfonditamente.
    //
    // Così non facciamo 40 richieste TMDB.
    // ─────────────────────────────────────────

    const preliminaryCandidates =
      Array.from(
        candidateMap.values()
      )
        .filter(
          (candidate) =>
            candidate.id &&
            candidate.poster_path
        )
        .map(
          (
            candidate
          ) => {
            const candidateGenreIds =
              uniqueNumbers(
                (
                  candidate.genre_ids ??
                  []
                ).map(
                  Number
                )
              );

            const sharedGenres =
              intersectionCount(
                currentGenreIds,
                candidateGenreIds
              );

            const genreSimilarity =
              jaccardSimilarity(
                currentGenreIds,
                candidateGenreIds
              );

            let preliminaryScore =
              0;

            // Stessa saga:
            // praticamente certezza
            // di relazione.
            if (
              candidate.source
                ?.collection
            ) {
              preliminaryScore +=
                250;
            }

            // Recommendation TMDB
            // è più utile di similar.
            if (
              candidate.source
                ?.recommendation
            ) {
              preliminaryScore +=
                60;
            }

            if (
              candidate.source
                ?.similar
            ) {
              preliminaryScore +=
                25;
            }

            // Generi.
            preliminaryScore +=
              sharedGenres *
              20;

            preliminaryScore +=
              genreSimilarity *
              35;

            // Piccolissimo bonus
            // alla posizione originale TMDB.
            preliminaryScore +=
              Math.max(
                0,
                12 -
                  (
                    candidate.sourceIndex ??
                    20
                  ) *
                    0.5
              );

            // Penalità se TMDB lo propone
            // ma non condivide nemmeno
            // un genere.
            if (
              sharedGenres ===
                0 &&
              !candidate.source
                ?.collection
            ) {
              preliminaryScore -=
                25;
            }

            return {
              ...candidate,

              preliminaryScore,
            };
          }
        )
        .sort(
          (a, b) =>
            b.preliminaryScore -
            a.preliminaryScore
        )
        // Analizziamo solo
        // i candidati migliori.
        .slice(
          0,
          24
        );

    // ─────────────────────────────────────────
    // ARRICCHISCI I CANDIDATI
    //
    // Una richiesta per film:
    //
    // - dettagli
    // - credits
    // - keywords
    //
    // production_companies e lingua
    // sono già nei dettagli normali.
    // ─────────────────────────────────────────

    const enrichedCandidates =
      await Promise.all(
        preliminaryCandidates.map(
          async (
            candidate
          ) => {
            try {
              const detail =
                await tmdbFetch(
                  `/movie/${candidate.id}?language=it-IT&append_to_response=credits,keywords`,
                  apiKey
                );

              return {
                candidate,
                detail,
              };
            } catch (
              error
            ) {
              console.error(
                `Errore analisi film simile ${candidate.id}:`,
                error
              );

              return {
                candidate,
                detail:
                  null,
              };
            }
          }
        )
      );

    // ─────────────────────────────────────────
    // PUNTEGGIO FINALE
    // ─────────────────────────────────────────

    const scoredSimilar:
      ScoredCandidate[] =
      enrichedCandidates
        .map(
          ({
            candidate,
            detail,
          }) => {
            // ─────────────────────────────
            // GENERI
            // ─────────────────────────────

            const candidateGenreIds =
              uniqueNumbers(
                (
                  detail?.genres ??
                  (
                    candidate.genre_ids ??
                    []
                  ).map(
                    (id) => ({
                      id,
                    })
                  )
                ).map(
                  (
                    genre: any
                  ) =>
                    Number(
                      genre.id
                    )
                )
              );

            const sharedGenres =
              intersectionCount(
                currentGenreIds,
                candidateGenreIds
              );

            const genreSimilarity =
              jaccardSimilarity(
                currentGenreIds,
                candidateGenreIds
              );

            // ─────────────────────────────
            // CAST
            // ─────────────────────────────

            const candidateMainCast =
              (
                detail?.credits
                  ?.cast ??
                []
              )
                .sort(
                  (
                    a: any,
                    b: any
                  ) =>
                    (
                      a.order ??
                      999
                    ) -
                    (
                      b.order ??
                      999
                    )
                )
                .slice(
                  0,
                  12
                );

            const candidateMainCastIds =
              uniqueNumbers(
                candidateMainCast.map(
                  (
                    person: any
                  ) =>
                    Number(
                      person.id
                    )
                )
              );

            const sharedCast =
              intersectionCount(
                currentMainCastIds,
                candidateMainCastIds
              );

            // Più un attore è importante
            // nel cast dei due film,
            // maggiore è il bonus.
            let castScore =
              0;

            candidateMainCast.forEach(
              (
                person: any,
                candidateIndex: number
              ) => {
                const currentIndex =
                  currentMainCastIds.indexOf(
                    Number(
                      person.id
                    )
                  );

                if (
                  currentIndex ===
                  -1
                ) {
                  return;
                }

                let personScore =
                  0;

                if (
                  currentIndex <=
                    2 &&
                  candidateIndex <=
                    2
                ) {
                  personScore =
                    28;
                } else if (
                  currentIndex <=
                    5 &&
                  candidateIndex <=
                    5
                ) {
                  personScore =
                    18;
                } else {
                  personScore =
                    9;
                }

                castScore +=
                  personScore;
              }
            );

            castScore =
              Math.min(
                castScore,
                65
              );

            // ─────────────────────────────
            // REGISTA
            // ─────────────────────────────

            const candidateDirector =
              (
                detail?.credits
                  ?.crew ??
                []
              ).find(
                (
                  person: any
                ) =>
                  person.job ===
                  'Director'
              );

            const sameDirector =
              Boolean(
                director?.id &&
                  candidateDirector
                    ?.id &&
                  Number(
                    director.id
                  ) ===
                    Number(
                      candidateDirector.id
                    )
              );

            // ─────────────────────────────
            // KEYWORDS
            // ─────────────────────────────

            const candidateKeywordIds =
              uniqueNumbers(
                (
                  detail?.keywords
                    ?.keywords ??
                  []
                ).map(
                  (
                    keyword: any
                  ) =>
                    Number(
                      keyword.id
                    )
                )
              );

            const sharedKeywords =
              intersectionCount(
                currentKeywordIds,
                candidateKeywordIds
              );

            const keywordSimilarity =
              jaccardSimilarity(
                currentKeywordIds,
                candidateKeywordIds
              );

            // ─────────────────────────────
            // PRODUCTION COMPANIES
            // ─────────────────────────────

            const candidateCompanyIds =
              uniqueNumbers(
                (
                  detail
                    ?.production_companies ??
                  []
                ).map(
                  (
                    company: any
                  ) =>
                    Number(
                      company.id
                    )
                )
              );

            const sharedCompanies =
              intersectionCount(
                currentCompanyIds,
                candidateCompanyIds
              );

            // ─────────────────────────────
            // LINGUA
            // ─────────────────────────────

            const candidateLanguage =
              detail
                ?.original_language ??
              candidate
                .original_language ??
              '';

            const sameLanguage =
              Boolean(
                currentLanguage &&
                  candidateLanguage &&
                  currentLanguage ===
                    candidateLanguage
              );

            // ─────────────────────────────
            // ANNO
            // ─────────────────────────────

            const candidateYear =
              getYear(
                detail?.release_date ??
                  candidate.release_date
              );

            const yearDistance =
              currentYear &&
              candidateYear
                ? Math.abs(
                    currentYear -
                      candidateYear
                  )
                : 999;

            // ─────────────────────────────
            // VOTO
            // ─────────────────────────────

            const voteAverage =
              Number(
                detail
                  ?.vote_average ??
                  candidate
                    .vote_average ??
                  0
              );

            const voteCount =
              Number(
                detail
                  ?.vote_count ??
                  candidate
                    .vote_count ??
                  0
              );

            // ─────────────────────────────
            // SCORE
            // ─────────────────────────────

            let score =
              0;

            // ═════════════════════════════
            // STESSA SAGA
            // ═════════════════════════════

            if (
              candidate.source
                ?.collection
            ) {
              score +=
                250;
            }

            // ═════════════════════════════
            // RECOMMENDATIONS TMDB
            // ═════════════════════════════

            if (
              candidate.source
                ?.recommendation
            ) {
              score +=
                38;
            }

            // ═════════════════════════════
            // SIMILAR TMDB
            // ═════════════════════════════

            if (
              candidate.source
                ?.similar
            ) {
              score +=
                12;
            }

            // Se appare sia nelle recommendations
            // sia nei similar, è un segnale
            // particolarmente forte.
            if (
              candidate.source
                ?.recommendation &&
              candidate.source
                ?.similar
            ) {
              score +=
                15;
            }

            // ═════════════════════════════
            // KEYWORDS
            //
            // Peso molto alto perché descrivono
            // davvero temi e contenuto.
            // ═════════════════════════════

            score +=
              Math.min(
                sharedKeywords,
                8
              ) *
              13;

            score +=
              keywordSimilarity *
              70;

            if (
              sharedKeywords >=
              4
            ) {
              score +=
                18;
            }

            if (
              sharedKeywords >=
              7
            ) {
              score +=
                20;
            }

            // ═════════════════════════════
            // GENERI
            // ═════════════════════════════

            score +=
              sharedGenres *
              14;

            score +=
              genreSimilarity *
              42;

            if (
              genreSimilarity >=
              0.66
            ) {
              score +=
                15;
            }

            if (
              sharedGenres ===
                0 &&
              !candidate.source
                ?.collection
            ) {
              score -=
                85;
            }

            // Se i film hanno tanti generi
            // ma ne condividono solo uno,
            // significa spesso che sono
            // abbastanza diversi.
            if (
              sharedGenres ===
                1 &&
              currentGenreIds.length >=
                3 &&
              candidateGenreIds.length >=
                3
            ) {
              score -=
                14;
            }

            // ═════════════════════════════
            // CAST
            // ═════════════════════════════

            score +=
              castScore;

            // Un solo attore condiviso
            // non basta se tutto il resto
            // non c'entra.
            if (
              sharedCast ===
                1 &&
              sharedKeywords ===
                0 &&
              sharedGenres <=
                1
            ) {
              score -=
                25;
            }

            // ═════════════════════════════
            // REGISTA
            // ═════════════════════════════

            if (
              sameDirector
            ) {
              score +=
                42;
            }

            // Stesso regista + almeno
            // un genere comune:
            // relazione creativa forte.
            if (
              sameDirector &&
              sharedGenres >
                0
            ) {
              score +=
                10;
            }

            // ═════════════════════════════
            // CASE DI PRODUZIONE
            // ═════════════════════════════

            if (
              sharedCompanies >
              0
            ) {
              score +=
                Math.min(
                  sharedCompanies,
                  2
                ) *
                8;
            }

            // ═════════════════════════════
            // LINGUA
            //
            // Solo bonus minimo.
            // ═════════════════════════════

            if (
              sameLanguage
            ) {
              score +=
                2;
            }

            // ═════════════════════════════
            // ANNO
            //
            // L'anno NON determina
            // la similarità.
            // Serve soltanto da spareggio.
            // ═════════════════════════════

            if (
              yearDistance <=
              2
            ) {
              score +=
                3;
            } else if (
              yearDistance <=
              5
            ) {
              score +=
                1;
            }

            // ═════════════════════════════
            // VOTO
            //
            // Il voto NON rende due
            // film simili.
            //
            // Serve soltanto a evitare
            // risultati troppo scadenti.
            // ═════════════════════════════

            if (
              voteCount >=
              100
            ) {
              score +=
                Math.min(
                  voteAverage,
                  10
                ) *
                0.45;
            }

            if (
              voteCount <
              10
            ) {
              score -=
                7;
            }

            // ═════════════════════════════
            // PENALITÀ COERENZA
            // ═════════════════════════════

            const hasStrongThemeMatch =
              sharedKeywords >=
                2 ||
              keywordSimilarity >=
                0.2;

            const hasStrongGenreMatch =
              sharedGenres >=
                2 ||
              genreSimilarity >=
                0.5;

            const hasCreativeMatch =
              sameDirector ||
              sharedCast >=
                2;

            // Se TMDB lo consiglia ma
            // noi non troviamo quasi nessun
            // legame reale, lo abbassiamo.
            if (
              !candidate.source
                ?.collection &&
              !hasStrongThemeMatch &&
              !hasStrongGenreMatch &&
              !hasCreativeMatch
            ) {
              score -=
                35;
            }

            // Nessun genere,
            // nessuna keyword,
            // nessun cast,
            // regista diverso:
            // praticamente non c'entra nulla.
            if (
              sharedGenres ===
                0 &&
              sharedKeywords ===
                0 &&
              sharedCast ===
                0 &&
              !sameDirector &&
              !candidate.source
                ?.collection
            ) {
              score -=
                100;
            }

            return {
              candidate,

              detail,

              score,

              meta: {
                sharedGenres,

                genreSimilarity,

                sharedCast,

                sharedKeywords,

                keywordSimilarity,

                sharedCompanies,

                sameDirector,

                sameLanguage,
              },
            };
          }
        )
        // ─────────────────────────────────────
        // FILTRO QUALITÀ
        // ─────────────────────────────────────
        .filter(
          ({
            candidate,
            score,
            meta,
          }) => {
            // Film della stessa saga:
            // sempre accettati.
            if (
              candidate.source
                ?.collection
            ) {
              return true;
            }

            const hasRealConnection =
              meta.sharedGenres >
                0 ||
              meta.sharedKeywords >
                0 ||
              meta.sharedCast >
                0 ||
              meta.sameDirector;

            if (
              !hasRealConnection
            ) {
              return false;
            }

            return (
              score >=
              18
            );
          }
        )
        .sort(
          (
            a,
            b
          ) =>
            b.score -
            a.score
        );

    // ─────────────────────────────────────────
    // DIVERSIFICAZIONE
    //
    // Evita una lista monotona,
    // ma NON penalizza la stessa saga.
    // ─────────────────────────────────────────

    const smartSimilar:
      ScoredCandidate[] =
      [];

    const directorCounts =
      new Map<
        number,
        number
      >();

    for (
      const item of scoredSimilar
    ) {
      if (
        smartSimilar.length >=
        18
      ) {
        break;
      }

      const candidateDirector =
        (
          item.detail
            ?.credits
            ?.crew ??
          []
        ).find(
          (
            person: any
          ) =>
            person.job ===
            'Director'
        );

      const directorId =
        candidateDirector?.id
          ? Number(
              candidateDirector.id
            )
          : null;

      // Stessa saga:
      // sempre dentro.
      if (
        item.candidate
          .source
          ?.collection
      ) {
        smartSimilar.push(
          item
        );

        if (
          directorId
        ) {
          directorCounts.set(
            directorId,

            (
              directorCounts.get(
                directorId
              ) ??
              0
            ) + 1
          );
        }

        continue;
      }

      // Non facciamo dominare
      // completamente la lista
      // dallo stesso regista.
      if (
        directorId &&
        (
          directorCounts.get(
            directorId
          ) ??
          0
        ) >= 4
      ) {
        continue;
      }

      smartSimilar.push(
        item
      );

      if (
        directorId
      ) {
        directorCounts.set(
          directorId,

          (
            directorCounts.get(
              directorId
            ) ??
            0
          ) + 1
        );
      }
    }

    // ─────────────────────────────────────────
    // FALLBACK
    //
    // Se i filtri sono stati troppo rigidi
    // e abbiamo pochi risultati,
    // recuperiamo i migliori candidati
    // rimasti.
    // ─────────────────────────────────────────

    if (
      smartSimilar.length <
      8
    ) {
      for (
        const item of scoredSimilar
      ) {
        if (
          smartSimilar.length >=
          12
        ) {
          break;
        }

        const alreadyAdded =
          smartSimilar.some(
            (
              existing
            ) =>
              existing.candidate
                .id ===
              item.candidate.id
          );

        if (
          !alreadyAdded
        ) {
          smartSimilar.push(
            item
          );
        }
      }
    }

    // ─────────────────────────────────────────
    // CAST COMPLETO
    //
    // IMPORTANTE:
    //
    // Non facciamo più slice(0, 6).
    //
    // L'API restituisce TUTTI.
    // Il frontend ne mostra 6 alla volta.
    // ─────────────────────────────────────────

    const fullCast =
      (
        credits.cast ??
        []
      )
        .sort(
          (
            a: any,
            b: any
          ) =>
            (
              a.order ??
              999
            ) -
            (
              b.order ??
              999
            )
        )
        .map(
          (
            person: any
          ) => ({
            id:
              person.id,

            name:
              person.name,

            character:
              person.character ??
              '',

            order:
              person.order ??
              999,

            profile:
              person.profile_path
                ? `${TMDB_IMAGE_BASE}/w185${person.profile_path}`
                : null,
          })
        );

    // ─────────────────────────────────────────
    // RISPOSTA
    // ─────────────────────────────────────────

    return res
      .status(200)
      .json({
        id:
          `tmdb_${movie.id}`,

        tmdb_id:
          movie.id,

        title:
          movie.title,

        year:
          getYear(
            movie.release_date
          ),

        genre:
          genres,

        genre_ids:
          currentGenreIds,

        cover:
          movie.poster_path
            ? `${TMDB_IMAGE_BASE}/w500${movie.poster_path}`
            : null,

        backdrop:
          movie.backdrop_path
            ? `${TMDB_IMAGE_BASE}/w1280${movie.backdrop_path}`
            : null,

        trailer:
          trailerUrl,

        trama_c:
          movie.overview ??
          null,

        trama_l:
          movie.overview ??
          null,

        rating:
          movie.vote_average ??
          0,

        runtime,

        tagline:
          movie.tagline ??
          null,

        release_date:
          movie.release_date ??
          null,

        vote_count:
          movie.vote_count ??
          0,

        director:
          director?.name ??
          null,

        director_id:
          director?.id ??
          null,

        // TUTTO IL CAST
        cast:
          fullCast,

        // FILM SIMILI
        similar:
          smartSimilar.map(
            ({
              candidate,
              detail,
            }) => {
              const posterPath =
                detail?.poster_path ??
                candidate.poster_path;

              return {
                tmdb_id:
                  candidate.id,

                title:
                  detail?.title ??
                  candidate.title ??
                  '',

                year:
                  getYear(
                    detail?.release_date ??
                      candidate.release_date
                  ),

                cover:
                  posterPath
                    ? `${TMDB_IMAGE_BASE}/w342${posterPath}`
                    : null,

                rating:
                  detail?.vote_average ??
                  candidate.vote_average ??
                  0,
              };
            }
          ),
      });
  } catch (
    err: any
  ) {
    console.error(
      'TMDB movie error:',
      err
    );

    return res
      .status(500)
      .json({
        error:
          err?.message ??
          'Errore TMDB',
      });
  }
}