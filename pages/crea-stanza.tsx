'use client';

import { useState, useEffect, type FormEvent, type CSSProperties } from 'react';
import { useRouter } from 'next/router';
import AppShell from '@/components/layout/AppShell';
import { generateRoomCode, normalizeRoomCode } from '@/utils/roomCode';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import {
  FilmSlate,
  Television,
  Ticket,
  Funnel,
  TrendUp,
  ArrowRight,
  ArrowLeft,
  Check,
  Warning,
  Door,
  Plus,
  Users,
  Armchair,
  Popcorn,
  InstagramLogo,
  TiktokLogo,
  XLogo,
  Heart,
  Fire,          // per il badge "Hot"
  // Icone per i generi
  Bomb,
  MapTrifold,
  PaintBrush,
  Smiley,
  PoliceCar,
  MaskSad,
  MagicWand,
  Ghost,
  Rocket,
  Eye,
  MusicNote,
  Calendar,
  CaretDown,
  MapPin,
  Crosshair,
  Gear,         // per il badge "Personalizzato"
  Star,
} from '@phosphor-icons/react';

// ─── Palette dark "cinema elegante" ──────────────────────────────────────
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
  success: '#22c55e',
  purple: '#8b5cf6',
};

// ─── Palette light "cinema elegante" ──────────────────────────────────────
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
  purple: '#7c3aed',
};

const FONT = "'Inter','Helvetica Neue',sans-serif";
const FONT_DISPLAY = "'Playfair Display','Georgia',serif";
const FONT_MONO = "'JetBrains Mono','Courier New',monospace";

const convertHexToRgb = (hex: string) => {
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map((char) => char + char).join('')
    : clean;
  const value = Number.parseInt(full, 16);
  return `${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}`;
};

// Mappatura id genere → icona Phosphor
const genreIconMap: Record<number, React.ReactNode> = {
  28: <Bomb size={16} weight="duotone" />,
  12: <MapTrifold size={16} weight="duotone" />,
  16: <PaintBrush size={16} weight="duotone" />,
  35: <Smiley size={16} weight="duotone" />,
  80: <PoliceCar size={16} weight="duotone" />,
  18: <MaskSad size={16} weight="duotone" />,
  10751: <Users size={16} weight="duotone" />,
  14: <MagicWand size={16} weight="duotone" />,
  27: <Ghost size={16} weight="duotone" />,
  10749: <Heart size={16} weight="duotone" />,
  878: <Rocket size={16} weight="duotone" />,
  53: <Eye size={16} weight="duotone" />,
  99: <FilmSlate size={16} weight="duotone" />,
  10402: <MusicNote size={16} weight="duotone" />,
};

const GENRES = [
  { id: 28, label: 'Azione' },
  { id: 12, label: 'Avventura' },
  { id: 16, label: 'Animazione' },
  { id: 35, label: 'Commedia' },
  { id: 80, label: 'Crime' },
  { id: 18, label: 'Dramma' },
  { id: 10751, label: 'Famiglia' },
  { id: 14, label: 'Fantasy' },
  { id: 27, label: 'Horror' },
  { id: 10749, label: 'Romantico' },
  { id: 878, label: 'Fantascienza' },
  { id: 53, label: 'Thriller' },
  { id: 99, label: 'Documentario' },
  { id: 10402, label: 'Musica' },
];

type Mode = 'trending' | 'cinema' | 'streaming' | 'discover';
type RoomKind = 'private' | 'group';
type RoomVisibility = 'private' | 'public';
type DiscoverFilter = 'for_you' | 'following' | 'followers' | 'local';
type DiscoveredRoom = {
  id: string;
  room_type: 'cinema_pair' | 'cinema_group';
  city: string | null;
  province: string | null;
  min_members: number;
  max_members: number;
  participant_count: number;
  available_spots: number;
  visibility: string;
  requires_approval: boolean;
  host_actor_id: string | null;
  host_actor_type: 'user' | 'guest' | null;
  host_name: string;
  relation: 'mutual' | 'following' | 'follower' | 'local';
  common_following_count: number;
  distance_km: number | null;
};
type Tab = 'create' | 'join';
type Step = 1 | 2 | 3 | 4;

export default function CreaStanzaPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const { currentUser, isGuest, guestId, guestName } = useAuth();
  const isDark = theme === 'dark';
  const P = isDark ? D : L;
  const creatorId = currentUser?.id ?? guestId ?? null;
  const creatorType: 'user' | 'guest' | null =
    currentUser && !currentUser.isGuest ? 'user' : (isGuest && guestId ? 'guest' : null);
  const creatorName =
    currentUser && !currentUser.isGuest ? currentUser.username : (guestName ?? null);
  const [mounted, setMounted] = useState(false);
  const currentYear = new Date().getFullYear();

  const [tab, setTab] = useState<Tab>('create');

  useEffect(() => {
    if (!router.isReady) return;
    const requestedTab = router.query.tab;
    if (requestedTab === 'join') {
      setTab('join');
    } else {
      setTab('create');
    }
  }, [router.isReady, router.query.tab]);

  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState('');

  const [step, setStep] = useState<Step>(1);
  const [mode, setMode] = useState<Mode | null>(null);
  const [roomKind, setRoomKind] = useState<RoomKind>('private');
  const [minMembers, setMinMembers] = useState(2);
  const [maxMembers, setMaxMembers] = useState(2);
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [countryCode, setCountryCode] = useState('IT');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [radiusKm, setRadiusKm] = useState(25);
  const [roomVisibility, setRoomVisibility] = useState<RoomVisibility>('public');
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [discoverFilter, setDiscoverFilter] = useState<DiscoverFilter>('for_you');
  const [discoveredRooms, setDiscoveredRooms] = useState<DiscoveredRoom[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverError, setDiscoverError] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
  const [yearFromStr, setYearFromStr] = useState('2010');
  const [yearToStr, setYearToStr] = useState(String(currentYear));
  const [yearError, setYearError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const yearFrom = parseInt(yearFromStr) || 1900;
  const yearTo = parseInt(yearToStr) || currentYear;

  const yearOptions = Array.from({ length: currentYear + 2 - 1900 }, (_, i) => 1900 + i);

  useEffect(() => {
    setMounted(true);
  }, []);

  const validateYears = (): boolean => {
    if (yearFrom < 1900 || yearFrom > currentYear + 1) {
      setYearError(`Anno "dal" deve essere tra 1900 e ${currentYear + 1}`);
      return false;
    }
    if (yearTo < 1900 || yearTo > currentYear + 1) {
      setYearError(`Anno "al" deve essere tra 1900 e ${currentYear + 1}`);
      return false;
    }
    if (yearFrom > yearTo) {
      setYearError('L\'anno "dal" non può essere maggiore dell\'anno "al"');
      return false;
    }
    setYearError('');
    return true;
  };

  const toggleGenre = (id: number) => {
    setSelectedGenres((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  };

  const handleJoin = (e: FormEvent) => {
    e.preventDefault();
    const code = normalizeRoomCode(codeInput);
    if (code.length < 4) {
      setCodeError('Codice non valido');
      return;
    }
    setCodeError('');
    router.push(`/stanza?room=${code}`);
  };

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('La geolocalizzazione non è supportata dal browser.');
      return;
    }

    setLocationLoading(true);
    setLocationError('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;

        try {
          const response = await fetch(
            `/api/location/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`
          );
          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || 'Posizione non riconosciuta');
          }

          setCity(data.city || '');
          setProvince(data.province || '');
          setCountryCode(data.country_code || 'IT');
          setLatitude(lat);
          setLongitude(lon);
        } catch (error) {
          setLatitude(lat);
          setLongitude(lon);
          setLocationError(
            error instanceof Error
              ? `${error.message}. Puoi inserire la città manualmente.`
              : 'Posizione non riconosciuta. Inserisci la città manualmente.'
          );
        } finally {
          setLocationLoading(false);
        }
      },
      (error) => {
        setLocationLoading(false);
        if (error.code === error.PERMISSION_DENIED) {
          setLocationError('Permesso posizione negato. Inserisci la città manualmente.');
        } else {
          setLocationError('Non riesco a leggere la posizione. Inserisci la città manualmente.');
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 }
    );
  };

  const searchCinemaRooms = async (filter: DiscoverFilter = discoverFilter) => {
    if (!city.trim() && (latitude === null || longitude === null)) {
      setDiscoverError('Inserisci una città oppure usa la tua posizione.');
      return;
    }

    setDiscoverLoading(true);
    setDiscoverError('');
    setDiscoverFilter(filter);

    try {
      const params = new URLSearchParams({
        city: city.trim(),
        radiusKm: String(radiusKm),
        filter,
      });

      if (creatorId) params.set('actorId', creatorId);
      if (latitude !== null) params.set('lat', String(latitude));
      if (longitude !== null) params.set('lon', String(longitude));

      const response = await fetch(`/api/rooms/discover?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ricerca stanze non riuscita');
      }

      setDiscoveredRooms(Array.isArray(data.rooms) ? data.rooms : []);
    } catch (error) {
      setDiscoverError(
        error instanceof Error ? error.message : 'Ricerca stanze non riuscita'
      );
      setDiscoveredRooms([]);
    } finally {
      setDiscoverLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!mode) return;
    if (mode === 'discover' && !validateYears()) return;
    if (mode === 'cinema' && !city.trim()) {
      setLocationError('Inserisci una città oppure usa la tua posizione.');
      return;
    }
    if (roomKind === 'group' && (minMembers < 2 || maxMembers < minMembers || maxMembers > 10)) return;

    if (!creatorId || !creatorType) {
      setCodeError('Sessione non valida. Accedi di nuovo o rientra come ospite.');
      return;
    }

    setIsCreating(true);
    const roomId = generateRoomCode();

    try {
      let resolvedLatitude = latitude;
      let resolvedLongitude = longitude;
      let resolvedProvince = province;
      let resolvedCountryCode = countryCode;

      // Se la città è stata scritta a mano, trasformiamola in coordinate
      // PRIMA di creare la stanza. Così "Parma" è davvero il centro
      // geografico usato per cercare cinema e spettacoli.
      if (
        mode === 'cinema' &&
        city.trim() &&
        (resolvedLatitude === null || resolvedLongitude === null)
      ) {
        const geoRes = await fetch(
          `/api/location/search?city=${encodeURIComponent(city.trim())}`
        );

        const geo = await geoRes.json().catch(() => ({}));

        if (!geoRes.ok) {
          throw new Error(
            geo.error || 'Non riesco a localizzare la città inserita'
          );
        }

        resolvedLatitude = Number(geo.latitude);
        resolvedLongitude = Number(geo.longitude);

        if (typeof geo.province === 'string' && geo.province.trim()) {
          resolvedProvince = geo.province.trim();
        }

        if (typeof geo.country_code === 'string' && geo.country_code.trim()) {
          resolvedCountryCode = geo.country_code.trim().toUpperCase();
        }
      }

      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: roomId,
          mode,
          genres: selectedGenres.length > 0 ? selectedGenres.join(',') : null,
          year_from: mode === 'discover' ? yearFrom : null,
          year_to: mode === 'discover' ? yearTo : null,
          room_type: roomKind === 'group'
            ? (mode === 'cinema' ? 'cinema_group' : 'group')
            : (mode === 'cinema' ? 'cinema_pair' : 'private'),
          min_members: roomKind === 'group' ? minMembers : 2,
          max_members: roomKind === 'group' ? maxMembers : 2,
          match_threshold_percent: roomKind === 'group' ? 70 : 100,
          visibility: roomVisibility,
          requires_approval: roomVisibility === 'private',
          host_actor_id: creatorId,
          host_actor_type: creatorType,
          host_display_name: creatorName,
          city: mode === 'cinema' ? city.trim() : null,
          province: mode === 'cinema' ? (resolvedProvince.trim() || null) : null,
          country_code: mode === 'cinema' ? resolvedCountryCode : 'IT',
          latitude: mode === 'cinema' ? resolvedLatitude : null,
          longitude: mode === 'cinema' ? resolvedLongitude : null,
          radius_km: mode === 'cinema' ? radiusKm : 25,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Creazione stanza non riuscita');
      }

      const params = new URLSearchParams({ room: roomId, mode });
      if (mode === 'discover') {
        if (selectedGenres.length > 0) params.set('genres', selectedGenres.join(','));
        params.set('year_from', yearFrom.toString());
        params.set('year_to', yearTo.toString());
      }

      await router.push(`/stanza?${params.toString()}`);
    } catch (err) {
      console.error('Room configuration save failed:', err);
      setCodeError(err instanceof Error ? err.message : 'Creazione stanza non riuscita');
      setIsCreating(false);
    }
  };

  const switchToCreate = () => {
    setTab('create');
    setStep(1);
  };
  const switchToJoin = () => {
    setTab('join');
    setStep(1);
  };
  const handleCreateAction = () => {
    if (!mode) return;
    // Prima scegliamo se la stanza è per 2 persone o per un gruppo.
    setStep(2);
  };

  const handleRoomKindContinue = () => {
    setStep(3);
  };

  const handleVisibilityContinue = () => {
    if (mode === 'cinema' || mode === 'discover') {
      setStep(4);
      return;
    }
    void handleCreate();
  };

  // Badge con icone al posto delle emoji
  const modeCards = [
    {
      id: 'trending' as Mode,
      icon: <TrendUp size={26} color={P.pink} weight="duotone" />,
      title: 'In tendenza',
      desc: 'I più popolari questa settimana.',
      badge: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Fire size={14} weight="fill" color={P.pink} /> Hot
        </span>
      ),
      color: P.pink,
    },
    {
      id: 'cinema' as Mode,
      icon: <Ticket size={26} color={P.gold} weight="duotone" />,
      title: 'Al cinema',
      desc: 'Nelle sale italiane adesso.',
      badge: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Ticket size={14} weight="fill" color={P.gold} /> Ora al cinema
        </span>
      ),
      color: P.gold,
    },
    {
      id: 'streaming' as Mode,
      icon: <Television size={26} color={P.success} weight="duotone" />,
      title: 'In streaming',
      desc: 'Su Netflix, Prime, Disney+ e altri.',
      badge: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Television size={14} weight="fill" color={P.success} /> Subito disponibile
        </span>
      ),
      color: P.success,
    },
    {
      id: 'discover' as Mode,
      icon: <Funnel size={26} color={P.purple} weight="duotone" />,
      title: 'Filtri personalizzati',
      desc: 'Scegli genere, anno e molto altro.',
      badge: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Gear size={14} weight="fill" color={P.purple} /> Personalizzato
        </span>
      ),
      color: P.purple,
    },
  ];

  const pageThemeVars: CSSProperties = {
    ['--home-bg' as any]: P.bg,
    ['--home-bg-soft' as any]: P.bgSoft,
    ['--home-card' as any]: P.card,
    ['--home-card-hover' as any]: P.cardHover,
    ['--home-border' as any]: P.border,
    ['--home-border-rgb' as any]: convertHexToRgb(P.border),
    ['--home-gold' as any]: P.gold,
    ['--home-gold-soft' as any]: P.goldSoft,
    ['--home-gold-rgb' as any]: convertHexToRgb(P.gold),
    ['--home-pink' as any]: P.pink,
    ['--home-pink-deep' as any]: P.pinkDeep,
    ['--home-pink-rgb' as any]: convertHexToRgb(P.pink),
    ['--home-text' as any]: P.text,
    ['--home-text-muted' as any]: P.textMuted,
    ['--home-text-faint' as any]: P.textFaint,
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,800;1,400&display=swap');

        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; display: inline-block; }

        .crea-stanza-page {
          --home-font: 'Inter','Helvetica Neue',sans-serif;
          --home-font-display: 'Playfair Display',Georgia,serif;
          --home-font-mono: 'JetBrains Mono','Courier New',monospace;
          font-family: var(--home-font);
          background: var(--home-bg);
          color: var(--home-text);
          min-height: 100%;
          letter-spacing: -0.01em;
        }
        .crea-stanza-page *,
        .crea-stanza-page *::before,
        .crea-stanza-page *::after {
          box-sizing: border-box;
        }
        .crea-stanza-page button,
        .crea-stanza-page input,
        .crea-stanza-page select {
          border-radius: 0 !important;
          font-family: var(--home-font);
        }
        .crea-stanza-page ::selection {
          background: var(--home-pink);
          color: #fff;
        }

        .main-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 24px 20px 64px;
        }
        @media (max-width: 768px) {
          .main-container { padding: 16px; }
        }

        .page-title {
          font-family: var(--home-font-display);
          font-size: 32px;
          font-weight: 800;
          color: var(--home-text);
          letter-spacing: -0.02em;
        }

        .ticket-card {
          background: var(--home-card);
          border: 1px solid var(--home-border);
          position: relative;
          transition: transform 0.25s cubic-bezier(0.2,0,0,1), box-shadow 0.3s ease;
          cursor: pointer;
          overflow: hidden;
        }
        .ticket-card::after {
          content: '';
          position: absolute;
          inset: 0;
          border: 1px solid transparent;
          transition: border-color 0.3s ease;
          pointer-events: none;
        }
        .ticket-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        }
        .ticket-card:hover::after {
          border-color: rgba(var(--home-gold-rgb), 0.38);
        }
        .ticket-tear {
          position: absolute;
          left: 50%;
          bottom: -1px;
          transform: translateX(-50%);
          width: 16px;
          height: 6px;
          background: var(--home-bg);
          border-radius: 50% 50% 0 0;
          border-left: 1px solid var(--home-border);
          border-right: 1px solid var(--home-border);
          border-top: 1px solid var(--home-border);
          opacity: 0.6;
        }

        .tab-switcher {
          display: flex;
          align-items: center;
          background: var(--home-card);
          border: 1px solid var(--home-border);
          padding: 4px;
          gap: 4px;
        }
        .tab-switch-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 10px 20px;
          font-weight: 600;
          font-size: 14px;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
          gap: 8px;
          color: var(--home-text-muted);
          background: transparent;
        }
        .tab-switch-btn.active {
          background: var(--home-gold);
          color: var(--home-bg);
        }

        .feature-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          margin-bottom: 40px;
          border-top: 1px solid var(--home-border);
          border-bottom: 1px solid var(--home-border);
          padding: 24px 0;
        }
        .feature-col {
          display: flex;
          gap: 16px;
        }

        .cards-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          margin-bottom: 32px;
        }
        .card-item {
          position: relative;
          background: var(--home-card);
          padding: 24px;
          cursor: pointer;
          overflow: hidden;
          border: 1px solid var(--home-border);
          transition: all 0.2s;
          min-height: 180px;
        }
        .card-item.selected {
          border-width: 2px;
        }
        .card-blur-bg {
          position: absolute;
          right: -30px;
          top: -30px;
          width: 150px;
          height: 150px;
          filter: blur(70px);
          opacity: 0.2;
          z-index: 0;
        }
        .card-icon-bg {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          opacity: 0.1;
          z-index: 1;
          pointer-events: none;
        }
        .card-content {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          height: 100%;
        }
        .card-check {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 3;
        }

        .banner-container {
          background: linear-gradient(130deg, var(--home-pink-deep) 0%, var(--home-bg) 80%);
          border: 1px solid rgba(var(--home-pink-rgb), 0.3);
          padding: 32px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 16px;
        }
        .banner-left {
          display: flex;
          gap: 20px;
          align-items: center;
        }
        .banner-icon-wrap {
          color: #fff;
          background: var(--home-pink);
          width: 60px;
          height: 60px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .banner-btn {
          display: flex;
          align-items: center;
          padding: 12px 24px;
          border: none;
          font-weight: bold;
          font-size: 14px;
          cursor: pointer;
          transition: 0.2s;
          background: var(--home-gold);
          color: var(--home-bg);
        }
        .banner-btn:disabled {
          background: var(--home-border);
          color: var(--home-text-faint);
          cursor: not-allowed;
        }

        .join-wrapper {
          display: flex;
          justify-content: center;
          padding: 40px 0;
        }
        .join-form,
        .step2-container {
          background: var(--home-card);
          border: 1px solid var(--home-border);
          padding: 32px;
          max-width: 100%;
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .code-input {
          padding: 16px;
          border: 1px solid var(--home-border);
          font-size: 24px;
          font-family: var(--home-font-mono);
          color: var(--home-text);
          background: var(--home-bg-soft);
          outline: none;
          width: 100%;
          text-align: center;
          letter-spacing: 6px;
          font-weight: 800;
          text-transform: uppercase;
          transition: border-color 0.15s;
        }
        .code-input:focus {
          border-color: var(--home-gold);
        }

        /* ---- Stile per i select anni personalizzati ---- */
        .year-select-wrapper {
          position: relative;
          width: 100%;
        }
        .year-select-wrapper .year-input {
          appearance: none;
          -webkit-appearance: none;
          -moz-appearance: none;
          padding: 14px 18px;
          padding-right: 44px;
          border: 1px solid var(--home-border);
          background: var(--home-bg-soft);
          color: var(--home-text);
          font-size: 16px;
          font-weight: 600;
          font-family: var(--home-font-mono);
          letter-spacing: 1px;
          width: 100%;
          cursor: pointer;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
          outline: none;
          text-align: center;
        }
        .year-select-wrapper .year-input:hover {
          border-color: var(--home-gold);
          background: var(--home-card-hover);
        }
        .year-select-wrapper .year-input:focus {
          border-color: var(--home-gold);
          box-shadow: 0 0 0 3px rgba(var(--home-gold-rgb), 0.15);
          background: var(--home-card);
        }
        .year-select-wrapper .year-icon {
          position: absolute;
          right: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--home-text-faint);
          pointer-events: none;
          transition: transform 0.25s ease, color 0.2s;
        }
        .year-select-wrapper .year-input:focus + .year-icon,
        .year-select-wrapper .year-input:hover + .year-icon {
          color: var(--home-gold);
          transform: translateY(-50%) rotate(180deg);
        }
        .year-select-wrapper .year-input option {
          background: var(--home-card);
          color: var(--home-text);
          padding: 8px;
          font-family: var(--home-font);
        }

        .year-grid {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          gap: 16px 20px;
          align-items: center;
        }
        .year-grid .year-arrow {
          font-size: 22px;
          color: var(--home-gold);
          padding-top: 16px;
          opacity: 0.7;
          font-weight: 300;
          text-align: center;
        }
        .year-label {
          font-size: 12px;
          color: var(--home-text-muted);
          text-align: center;
          margin-bottom: 4px;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .genre-chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 8px 14px;
          border: 1px solid var(--home-border);
          background: transparent;
          cursor: pointer;
          font-size: 13px;
          font-family: var(--home-font);
          color: var(--home-text-muted);
          transition: all 0.15s;
          font-weight: 500;
        }
        .genre-chip:hover {
          border-color: var(--home-gold);
          color: var(--home-gold);
        }
        .genre-chip.selected {
          border-color: var(--home-gold);
          background: var(--home-gold);
          color: var(--home-bg);
          font-weight: 600;
        }

        .btn-primary {
          width: 100%;
          padding: 16px;
          border: none;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          font-family: var(--home-font);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: opacity 0.15s;
        }
        .btn-primary:disabled {
          background: var(--home-border);
          color: var(--home-text-faint);
          cursor: not-allowed;
        }
        .btn-primary:not(:disabled):hover {
          opacity: 0.9;
        }

        .footer-cine {
          border-top: 1px solid rgba(var(--home-border-rgb), 0.38);
          padding: 36px 20px 24px;
          position: relative;
          margin-top: auto;
        }
        .footer-cine::before {
          content: '';
          position: absolute;
          top: -1px;
          left: 15%;
          right: 15%;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(var(--home-gold-rgb), 0.2), transparent);
        }
        .footer-grid {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1.5fr;
          gap: 40px;
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 20px;
        }
        .footer-col-title {
          font-size: 12px;
          font-weight: 700;
          color: var(--home-text);
          margin-bottom: 12px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          opacity: 0.7;
        }
        .footer-link {
          font-size: 12.5px;
          color: var(--home-text-faint);
          line-height: 2.2;
          cursor: pointer;
          transition: color 0.2s;
        }
        .footer-link:hover {
          color: var(--home-gold);
        }
        .footer-social {
          width: 34px;
          height: 34px;
          background: var(--home-card);
          border: 1px solid rgba(var(--home-border-rgb), 0.38);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: border-color 0.25s, transform 0.2s;
          cursor: pointer;
        }
        .footer-social:hover {
          border-color: rgba(var(--home-gold-rgb), 0.44);
          transform: translateY(-2px);
        }

        @media (max-width: 1024px) {
          .header-actions { margin-top: 0; }
          .feature-col { flex-direction: column; gap: 8px; }
        }
        @media (max-width: 768px) {
          .header-top {
            flex-direction: column;
            align-items: flex-start;
            gap: 16px;
            margin-bottom: 24px;
          }
          .header-actions { width: 100%; }
          .tab-switcher { width: 100%; }
          .tab-switch-btn { flex: 1; }
          .feature-grid { grid-template-columns: 1fr; gap: 16px; padding: 16px 0; border: none; }
          .feature-col { flex-direction: row; gap: 12px; border-right: none !important; border-bottom: 1px solid var(--home-border); padding: 0 0 16px 0 !important; }
          .feature-col:last-child { border-bottom: none; padding-bottom: 0 !important; }
          .cards-grid { grid-template-columns: 1fr; }
          .banner-container { flex-direction: column; align-items: flex-start; gap: 20px; }
          .banner-left { flex-direction: row; }
          .banner-btn { width: 100%; justify-content: center; }
          .join-form, .step2-container { padding: 24px; }
          .year-grid { grid-template-columns: 1fr auto 1fr; gap: 12px; }
          .year-grid .year-arrow { padding-top: 12px; font-size: 18px; }
        }
        @media (max-width: 480px) {
          .main-container { padding: 16px; }
          .banner-left { flex-direction: column; align-items: flex-start; text-align: left; }
          .join-form, .step2-container { padding: 20px; }
          .tab-switch-btn { padding: 8px 12px; font-size: 13px; }
          .footer-grid { grid-template-columns: 1fr; gap: 24px; }
          .year-grid { grid-template-columns: 1fr; gap: 8px; }
          .year-grid .year-arrow { padding-top: 0; transform: rotate(90deg); }
        }
      `}</style>

      <AppShell activeNav="stanze">
        <div className="crea-stanza-page" style={{ ...pageThemeVars, opacity: mounted ? 1 : 0, transition: 'opacity 0.4s ease' }}>
          <div className="main-container">
            {/* HEADER */}
            <div className="header-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
              <div>
                <button
                  onClick={() => router.push('/home')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    color: P.textMuted,
                    fontWeight: 500,
                    marginBottom: '12px',
                    fontSize: '15px',
                  }}
                >
                  <ArrowLeft size={20} style={{ marginRight: '6px' }} />
                  Home
                </button>
                <div className="page-title">Crea una stanza</div>
              </div>
              <div className="header-actions">
                <div className="tab-switcher">
                  <button
                    onClick={switchToJoin}
                    className={`tab-switch-btn ${tab === 'join' ? 'active' : ''}`}
                  >
                    <Door size={18} weight={tab === 'join' ? 'fill' : 'duotone'} />
                    Entra
                  </button>
                  <button
                    onClick={switchToCreate}
                    className={`tab-switch-btn ${tab === 'create' ? 'active' : ''}`}
                  >
                    <Plus size={18} weight={tab === 'create' ? 'fill' : 'duotone'} />
                    Crea
                  </button>

                  <button
                    onClick={() => void router.push('/stanze')}
                    className="tab-switch-btn"
                  >
                    <Star size={18} weight="duotone" />
                    Esplora
                  </button>
                </div>
              </div>
            </div>

            {/* TAB: ENTRA */}
            {tab === 'join' && (
              <div className="join-wrapper" style={{ display: 'grid', gap: '18px' }}>
                <form onSubmit={handleJoin} className="join-form ticket-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Door size={28} color={P.gold} weight="duotone" />
                    <div>
                      <div style={{ fontSize: '20px', fontWeight: 'bold', color: P.text }}>Entra con codice</div>
                      <div style={{ fontSize: '14px', color: P.textMuted }}>Hai già un invito? Inserisci il codice della stanza.</div>
                    </div>
                  </div>

                  <input
                    className="code-input"
                    value={codeInput}
                    onChange={(e) => { setCodeInput(e.target.value.toUpperCase()); setCodeError(''); }}
                    placeholder="MAPLE-73"
                    maxLength={10}
                    autoCapitalize="characters"
                    autoCorrect="off"
                    autoComplete="off"
                    spellCheck={false}
                  />

                  {codeError && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: P.pink }}>
                      <Warning size={16} color={P.pink} weight="fill" />
                      {codeError}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={codeInput.trim().length < 4}
                    style={{
                      background: codeInput.trim().length < 4 ? P.border : P.gold,
                      color: codeInput.trim().length < 4 ? P.textFaint : P.bg,
                    }}
                  >
                    <Door size={18} weight="fill" />
                    Entra nella stanza
                  </button>
                  <div className="ticket-tear" style={{ background: P.bg }} />
                </form>

                <button
                  type="button"
                  onClick={() => router.push('/stanze')}
                  className="ticket-card"
                  style={{
                    padding: '22px',
                    border: `1px solid ${P.border}`,
                    background: P.card,
                    color: P.text,
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: FONT,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: P.pink, fontWeight: 800, marginBottom: '5px' }}>
                      <MapPin size={20} weight="fill" />
                      Stanze per te
                    </div>
                    <div style={{ color: P.textMuted, fontSize: '13px', lineHeight: 1.5 }}>
                      Trova persone e gruppi cinema nella tua zona e nella tua rete sociale.
                    </div>
                  </div>
                  <ArrowRight size={22} color={P.gold} />
                </button>
              </div>
            )}

            {/* TAB: CREA STANZA — STEP 1 */}
            {tab === 'create' && step === 1 && (
              <>
                <div className="feature-grid">
                  <div className="feature-col" style={{ paddingRight: '24px', borderRight: `1px solid ${P.border}` }}>
                    <div style={{ color: P.pink }}>
                      <Users size={32} weight="duotone" />
                    </div>
                    <div>
                      <div style={{ color: P.text, fontWeight: 600, fontSize: '16px' }}>Trova il tuo match</div>
                      <div style={{ color: P.textMuted, fontSize: '14px' }}>Persone con i tuoi stessi gusti</div>
                    </div>
                  </div>
                  <div className="feature-col" style={{ padding: '0 24px', borderRight: `1px solid ${P.border}` }}>
                    <div style={{ color: P.purple }}>
                      <FilmSlate size={32} weight="duotone" />
                    </div>
                    <div>
                      <div style={{ color: P.text, fontWeight: 600, fontSize: '16px' }}>Scopri cosa vedere</div>
                      <div style={{ color: P.textMuted, fontSize: '14px' }}>Consigli su misura per te</div>
                    </div>
                  </div>
                  <div className="feature-col" style={{ paddingLeft: '24px' }}>
                    <div style={{ color: P.gold }}>
                      <Armchair size={32} weight="duotone" />
                    </div>
                    <div>
                      <div style={{ color: P.text, fontWeight: 600, fontSize: '16px' }}>Vivi il cinema</div>
                      <div style={{ color: P.textMuted, fontSize: '14px' }}>Insieme è meglio</div>
                    </div>
                  </div>
                </div>

                <div className="cards-grid">
                  {modeCards.map((card) => {
                    const themeColor = card.color;
                    return (
                      <div
                        key={card.id}
                        onClick={() => setMode(card.id)}
                        className={`card-item ${mode === card.id ? 'selected' : ''}`}
                        style={{ borderColor: mode === card.id ? themeColor : undefined }}
                      >
                        <div className="card-blur-bg" style={{ background: themeColor }} />
                        <div className="card-icon-bg">
                          {card.id === 'trending' && <TrendUp size={120} weight="duotone" color={themeColor} />}
                          {card.id === 'cinema' && <Ticket size={120} weight="duotone" color={themeColor} />}
                          {card.id === 'streaming' && <Television size={120} weight="duotone" color={themeColor} />}
                          {card.id === 'discover' && <Funnel size={120} weight="duotone" color={themeColor} />}
                        </div>
                        <div className="card-content">
                          <div style={{ color: themeColor, marginBottom: '12px' }}>{card.icon}</div>
                          <div style={{ fontSize: '18px', fontWeight: 'bold', color: P.text }}>{card.title}</div>
                          <div style={{ fontSize: '14px', color: P.textMuted, marginTop: '8px', lineHeight: '1.5' }}>{card.desc}</div>
                          <div style={{ marginTop: '16px', fontSize: '13px', fontWeight: '600', color: themeColor }}>
                            {card.badge}
                          </div>
                        </div>
                        {mode === card.id && (
                          <div className="card-check" style={{ background: themeColor }}>
                            <Check size={14} color="#000" weight="bold" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="banner-container">
                  <div className="banner-left">
                    <div className="banner-icon-wrap">
                      <Popcorn size={32} weight="duotone" color="#fff" />
                    </div>
                    <div>
                      <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '20px' }}>Il cinema è meglio insieme</div>
                      <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '14px', marginTop: '4px' }}>
                        Crea una stanza, invita i tuoi amici e iniziate subito a guardare qualcosa di straordinario.
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleCreateAction}
                    disabled={!mode || isCreating}
                    className="banner-btn"
                  >
                    <Plus size={20} style={{ marginRight: '8px' }} color={(!mode || isCreating) ? P.textFaint : P.bg} />
                    Crea una stanza
                  </button>
                </div>
              </>
            )}

            {/* TAB: CREA STANZA — STEP 2: TIPO DI STANZA */}
            {tab === 'create' && step === 2 && (
              <div className="step2-container ticket-card">
                <button
                  onClick={() => setStep(1)}
                  style={{ background: 'none', border: 'none', color: P.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '18px', fontFamily: FONT }}
                >
                  <ArrowLeft size={17} /> Indietro
                </button>

                <div style={{ fontSize: '22px', fontWeight: 'bold', color: P.text, marginBottom: '6px' }}>
                  Con quante persone vuoi scegliere?
                </div>
                <div style={{ color: P.textMuted, fontSize: '14px', marginBottom: '22px' }}>
                  La stessa logica funziona sia per una coppia che per un gruppo.
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '24px' }}>
                  <button
                    type="button"
                    onClick={() => { setRoomKind('private'); setMinMembers(2); setMaxMembers(2); }}
                    style={{ textAlign: 'left', padding: '18px', borderRadius: '14px', cursor: 'pointer', background: roomKind === 'private' ? P.goldGlow : P.card, border: `1px solid ${roomKind === 'private' ? P.gold : P.border}`, color: P.text }}
                  >
                    <Users size={28} color={P.gold} weight="duotone" />
                    <div style={{ fontWeight: 800, marginTop: '10px' }}>In 2</div>
                    <div style={{ fontSize: '13px', color: P.textMuted, marginTop: '5px' }}>La stanza classica: il match richiede 2 like su 2.</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setRoomKind('group'); setMinMembers(3); setMaxMembers(6); }}
                    style={{ textAlign: 'left', padding: '18px', borderRadius: '14px', cursor: 'pointer', background: roomKind === 'group' ? P.pinkGlow : P.card, border: `1px solid ${roomKind === 'group' ? P.pink : P.border}`, color: P.text }}
                  >
                    <Users size={28} color={P.pink} weight="fill" />
                    <div style={{ fontWeight: 800, marginTop: '10px' }}>Gruppo</div>
                    <div style={{ fontSize: '13px', color: P.textMuted, marginTop: '5px' }}>Da 3 a 10 persone. Il match viene calcolato automaticamente in base ai voti del gruppo.</div>
                  </button>
                </div>

                {roomKind === 'group' && (
                  <div style={{ display: 'grid', gap: '16px', marginBottom: '24px' }}>
                    <label style={{ color: P.text, fontWeight: 700 }}>
                      Minimo partecipanti: {minMembers}
                      <input type="range" min={2} max={Math.min(10, maxMembers)} value={minMembers}
                        onChange={(e) => setMinMembers(Number(e.target.value))}
                        style={{ width: '100%', marginTop: '8px' }} />
                    </label>
                    <label style={{ color: P.text, fontWeight: 700 }}>
                      Massimo partecipanti: {maxMembers}
                      <input type="range" min={Math.max(3, minMembers)} max={10} value={maxMembers}
                        onChange={(e) => setMaxMembers(Number(e.target.value))}
                        style={{ width: '100%', marginTop: '8px' }} />
                    </label>
                  </div>
                )}

                <button className="btn-primary" disabled={isCreating} onClick={handleRoomKindContinue}
                  style={{ background: isCreating ? P.border : P.gold, color: isCreating ? P.textFaint : P.bg }}>
                  {isCreating ? '⏳ Creazione...' : (mode === 'discover' ? 'Continua' : 'Crea stanza')}
                </button>
                <div className="ticket-tear" style={{ background: P.bg }} />
              </div>
            )}

            {/* TAB: CREA STANZA — STEP 3: PRIVACY */}
            {tab === 'create' && step === 3 && (
              <div className="step2-container ticket-card">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  style={{ background: 'none', border: 'none', color: P.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '18px', fontFamily: FONT }}
                >
                  <ArrowLeft size={17} /> Indietro
                </button>

                <div style={{ fontSize: '22px', fontWeight: 'bold', color: P.text, marginBottom: '6px' }}>
                  Chi può entrare nella stanza?
                </div>

                <div style={{ color: P.textMuted, fontSize: '14px', lineHeight: 1.6, marginBottom: '22px' }}>
                  Scegli come gestire l’ingresso dei partecipanti.
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '10px', marginBottom: '22px' }}>
                  {[
                    {
                      id: 'public',
                      label: 'Pubblica',
                      desc: 'Chiunque può entrare subito finché c’è posto.',
                    },
                    {
                      id: 'private',
                      label: 'Privata',
                      desc: 'Chi entra deve essere accettato dall’host.',
                    },
                  ].map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setRoomVisibility(option.id as RoomVisibility)}
                      style={{
                        padding: '16px',
                        textAlign: 'left',
                        background: roomVisibility === option.id ? P.goldGlow : P.bg,
                        border: `1px solid ${roomVisibility === option.id ? P.gold : P.border}`,
                        color: P.text,
                        cursor: 'pointer',
                        fontFamily: FONT,
                      }}
                    >
                      <div style={{ fontWeight: 800, fontSize: '15px' }}>{option.label}</div>
                      <div style={{ color: P.textMuted, fontSize: '12px', marginTop: '5px', lineHeight: 1.45 }}>
                        {option.desc}
                      </div>
                    </button>
                  ))}
                </div>

                <button
                  className="btn-primary"
                  onClick={handleVisibilityContinue}
                  disabled={isCreating}
                  style={{
                    background: P.gold,
                    color: P.bg,
                  }}
                >
                  {mode === 'cinema' || mode === 'discover' ? 'Continua' : (isCreating ? 'Creazione...' : 'Crea stanza')}
                </button>

                <div className="ticket-tear" style={{ background: P.bg }} />
              </div>
            )}

            {/* TAB: CREA STANZA — STEP 3: POSIZIONE CINEMA */}
            {tab === 'create' && step === 4 && mode === 'cinema' && (
              <div className="step2-container ticket-card">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  style={{ background: 'none', border: 'none', color: P.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '18px', fontFamily: FONT }}
                >
                  <ArrowLeft size={17} /> Indietro
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <MapPin size={24} color={P.gold} weight="fill" />
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: P.text }}>
                    Dove vuoi andare al cinema?
                  </div>
                </div>

                <div style={{ color: P.textMuted, fontSize: '14px', lineHeight: 1.6, marginBottom: '22px' }}>
                  Useremo la città per trovare persone e gruppi compatibili nella tua zona. Agli altri non mostreremo le tue coordinate precise.
                </div>

                <button
                  type="button"
                  onClick={detectLocation}
                  disabled={locationLoading}
                  style={{
                    width: '100%',
                    padding: '13px 16px',
                    marginBottom: '16px',
                    background: P.goldGlow,
                    color: P.gold,
                    border: `1px solid ${P.gold}`,
                    cursor: locationLoading ? 'wait' : 'pointer',
                    fontFamily: FONT,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  <Crosshair size={18} weight="bold" />
                  {locationLoading ? 'Rilevamento posizione...' : 'Usa la mia posizione'}
                </button>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: P.text, marginBottom: '7px' }}>
                    Città
                  </label>
                  <input
                    value={city}
                    onChange={(e) => {
                      setCity(e.target.value);
                      setLocationError('');
                      // Se l'utente corregge manualmente la città, non fingiamo
                      // che le vecchie coordinate rappresentino necessariamente quel comune.
                      setLatitude(null);
                      setLongitude(null);
                    }}
                    placeholder="Es. Parma"
                    style={{
                      width: '100%',
                      padding: '13px 14px',
                      background: P.bg,
                      border: `1px solid ${P.border}`,
                      color: P.text,
                      fontFamily: FONT,
                      fontSize: '15px',
                    }}
                  />
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: P.text, marginBottom: '7px' }}>
                    Distanza massima
                  </label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {[10, 25, 50].map((km) => (
                      <button
                        key={km}
                        type="button"
                        onClick={() => setRadiusKm(km)}
                        style={{
                          padding: '10px 16px',
                          background: radiusKm === km ? P.gold : P.bg,
                          color: radiusKm === km ? P.bg : P.text,
                          border: `1px solid ${radiusKm === km ? P.gold : P.border}`,
                          cursor: 'pointer',
                          fontFamily: FONT,
                          fontWeight: 700,
                        }}
                      >
                        {km} km
                      </button>
                    ))}
                  </div>
                </div>

                {locationError && (
                  <div style={{ color: P.pink, fontSize: '13px', marginBottom: '14px' }}>
                    {locationError}
                  </div>
                )}

                {city && (
                  <div style={{
                    padding: '12px 14px',
                    background: P.bgSoft,
                    border: `1px solid ${P.border}`,
                    color: P.textMuted,
                    fontSize: '13px',
                    marginBottom: '18px',
                  }}>
                    <strong style={{ color: P.text }}>{city}</strong>
                    {province ? ` · ${province}` : ''} · raggio {radiusKm} km
                  </div>
                )}

                <button
                  className="btn-primary"
                  disabled={isCreating || !city.trim()}
                  onClick={handleCreate}
                  style={{
                    background: isCreating || !city.trim() ? P.border : P.gold,
                    color: isCreating || !city.trim() ? P.textFaint : P.bg,
                  }}
                >
                  {isCreating ? '⏳ Creazione...' : 'Crea stanza cinema'}
                </button>

                <div style={{ color: P.textFaint, fontSize: '10px', marginTop: '12px', textAlign: 'center' }}>
                  Geocodifica: © OpenStreetMap contributors
                </div>
                <div className="ticket-tear" style={{ background: P.bg }} />
              </div>
            )}

            {/* TAB: CREA STANZA — STEP 3: FILTRI */}
            {tab === 'create' && step === 4 && mode === 'discover' && (
              <div className="step2-container ticket-card">
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: P.text, marginBottom: '24px' }}>
                  Filtri avanzati
                </div>

                {/* Generi */}
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: P.text, marginBottom: '12px' }}>
                    Generi
                    <span style={{ fontSize: '14px', color: P.textMuted, fontWeight: '400', marginLeft: '8px' }}>
                      (opzionale — vuoto = tutti)
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {GENRES.map((g) => (
                      <button
                        key={g.id}
                        className={`genre-chip${selectedGenres.includes(g.id) ? ' selected' : ''}`}
                        onClick={() => toggleGenre(g.id)}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                          {genreIconMap[g.id]}
                        </span>
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Anni */}
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: P.text, marginBottom: '16px' }}>
                    Periodo di uscita
                  </div>
                  <div className="year-grid">
                    <div>
                      <div className="year-label">Dal</div>
                      <div className="year-select-wrapper">
                        <select
                          className="year-input"
                          value={yearFromStr}
                          onChange={(e) => {
                            setYearFromStr(e.target.value);
                            setYearError('');
                            const from = parseInt(e.target.value);
                            const to = parseInt(yearToStr);
                            if (from > to) {
                              setYearToStr(e.target.value);
                            }
                          }}
                          onBlur={validateYears}
                        >
                          {yearOptions.map((year) => (
                            <option key={year} value={year}>
                              {year}
                            </option>
                          ))}
                        </select>
                        <CaretDown size={18} className="year-icon" weight="bold" />
                      </div>
                    </div>

                    <div className="year-arrow">→</div>

                    <div>
                      <div className="year-label">Al</div>
                      <div className="year-select-wrapper">
                        <select
                          className="year-input"
                          value={yearToStr}
                          onChange={(e) => {
                            setYearToStr(e.target.value);
                            setYearError('');
                            const from = parseInt(yearFromStr);
                            const to = parseInt(e.target.value);
                            if (to < from) {
                              setYearFromStr(e.target.value);
                            }
                          }}
                          onBlur={validateYears}
                        >
                          {yearOptions.map((year) => (
                            <option key={year} value={year}>
                              {year}
                            </option>
                          ))}
                        </select>
                        <CaretDown size={18} className="year-icon" weight="bold" />
                      </div>
                    </div>
                  </div>
                  {yearError && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '12px', fontSize: '14px', color: P.pink }}>
                      <Warning size={16} color={P.pink} weight="fill" />
                      {yearError}
                    </div>
                  )}
                </div>

                {/* Riepilogo */}
                <div style={{ background: P.bgSoft, border: `1px solid ${P.border}`, padding: '16px', marginBottom: '24px', fontSize: '14px', color: P.textMuted, lineHeight: '1.8' }}>
                  <div style={{ fontWeight: '700', color: P.text, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FilmSlate size={18} color={P.gold} weight="duotone" />
                    Riepilogo stanza
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FilmSlate size={16} color={P.gold} weight="duotone" />
                    {selectedGenres.length === 0 ? 'Tutti i generi' : selectedGenres.map(id => { const g = GENRES.find(g => g.id === id); return `${g?.label}`; }).join(', ')}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={16} color={P.gold} weight="duotone" />
                    Dal {yearFrom} al {yearTo}
                  </div>
                </div>

                <button
                  className="btn-primary"
                  disabled={!!yearError || isCreating}
                  onClick={handleCreate}
                  style={{ background: isCreating ? P.border : P.gold, color: isCreating ? P.textFaint : P.bg }}
                >
                  {isCreating ? (
                    '⏳ Creazione...'
                  ) : (
                    <>
                      <FilmSlate size={20} color={P.bg} weight="fill" />
                      Crea stanza
                    </>
                  )}
                </button>
                <div className="ticket-tear" style={{ background: P.bg }} />
              </div>
            )}

            {/* FOOTER (disattivato) */}
            {false && <div className="footer-cine" style={{ marginTop: 'auto' }}>
              <div className="footer-grid">
                <div>
                  <div style={{ fontSize: '16px', fontWeight: '800', color: P.text, marginBottom: '10px', fontFamily: FONT_DISPLAY, letterSpacing: '-0.01em' }}>
                    CINE<span style={{ color: P.pink }}>DATE</span>
                  </div>
                  <div style={{ fontSize: '12.5px', color: P.textFaint, lineHeight: 1.7, maxWidth: '200px', fontStyle: 'italic' }}>
                    "Il cinema, in compagnia. Trova il film perfetto, insieme."
                  </div>
                </div>
                <div>
                  <div className="footer-col-title">Navigazione</div>
                  <div className="footer-link">Come funziona</div>
                  <div className="footer-link">Recensioni</div>
                  <div className="footer-link" onClick={() => router.push('/cinema')}>Cinema vicino a te</div>
                </div>
                <div>
                  <div className="footer-col-title">Legal</div>
                  <div className="footer-link">Termini di servizio</div>
                  <div className="footer-link">Privacy policy</div>
                  <div className="footer-link">Cookie policy</div>
                </div>
                <div>
                  <div className="footer-col-title">Seguici</div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div className="footer-social"><InstagramLogo size={15} color={P.textMuted} /></div>
                    <div className="footer-social"><TiktokLogo size={15} color={P.textMuted} /></div>
                    <div className="footer-social"><XLogo size={15} color={P.textMuted} /></div>
                  </div>
                  <div style={{ marginTop: '16px', fontSize: '11px', color: P.textFaint, lineHeight: 1.6 }}>
                    <Heart size={12} color={P.pink} weight="fill" style={{ display: 'inline', marginRight: '4px' }} />
                    Fatto con passione per chi ama il cinema
                  </div>
                </div>
              </div>
              <div style={{ fontSize: '11px', color: P.textFaint, textAlign: 'center', marginTop: '28px', letterSpacing: '0.04em', borderTop: `1px solid ${P.border}30`, paddingTop: '18px' }}>
                © 2026 CineDate — Tutti i diritti riservati
              </div>
            </div>}
          </div>
        </div>
      </AppShell>
    </>
  );
}