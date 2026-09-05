'use client';

import { useEffect, useRef } from 'react';
import type { TheSpaceCinema } from '@/utils/cinema/theSpaceCinemasFIX';
import { getChainMeta } from '@/utils/cinema/cinemaChain';
import { useTheme } from '@/context/ThemeContext';

// ─── PALETTE ─────────────────────────────────────────────────────────────

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
};

type Cinema = TheSpaceCinema & {
  distanceKm: number;
};

type Props = {
  cinemas: Cinema[];
  userLat: number;
  userLng: number;
  selectedId: number | null;
  onSelect: (id: number) => void;
};

// ─── LOGHI ONLINE ─────────────────────────────────────────────────────────
//
// UCI: file SVG pubblico su Wikimedia Commons
// The Space: immagine direttamente dal sito ufficiale
//

const chainLogos = {
  UCI:
    'https://upload.wikimedia.org/wikipedia/commons/d/d5/UCI_Logo.svg?utm_source=it.wikipedia.org&utm_campaign=index&utm_content=original',

  'The Space':
    'https://upload.wikimedia.org/wikipedia/it/1/15/THESPACE_CINEMA_Logo.svg?utm_source=it.wikipedia.org&utm_campaign=index&utm_content=original',

  Other: '',
};

// ─── LOGO FALLBACK ────────────────────────────────────────────────────────

const fallbackLogo =
  'data:image/svg+xml;charset=UTF-8,' +
  encodeURIComponent(`
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="40"
      height="40"
      viewBox="0 0 40 40"
    >
      <circle
        cx="20"
        cy="20"
        r="18"
        fill="#555"
      />
      <text
        x="20"
        y="25"
        text-anchor="middle"
        font-size="18"
        fill="white"
        font-family="Arial"
      >🎬</text>
    </svg>
  `);

// ─── TROVA LOGO ───────────────────────────────────────────────────────────

function getLogoForCinema(
  name: string,
  label?: string
): string {
  const value =
    `${label ?? ''} ${name}`.toLowerCase();

  if (value.includes('uci')) {
    return chainLogos.UCI;
  }

  if (value.includes('the space')) {
    return chainLogos['The Space'];
  }

  return fallbackLogo;
}

export default function CinemaMap({
  cinemas,
  userLat,
  userLng,
  selectedId,
  onSelect,
}: Props) {
  const mapRef = useRef<HTMLDivElement>(null);

  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const P = isDark ? D : L;

  const mapInstance = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const cinemaLayerRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);

  // ─── MAPPA ────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!mapRef.current || mapInstance.current) {
        return;
      }

      const L = await import('leaflet');

      if (cancelled || !mapRef.current) {
        return;
      }

      delete (L.Icon.Default.prototype as any)._getIconUrl;

      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',

        iconUrl:
          'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',

        shadowUrl:
          'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      if ((mapRef.current as any)._leaflet_id) {
        delete (mapRef.current as any)._leaflet_id;
      }

      const map = L.map(mapRef.current)
        .setView(
          [userLat, userLng],
          11
        );

      L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          attribution:
            '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
          maxZoom: 18,
        }
      ).addTo(map);

      mapInstance.current = map;
      leafletRef.current = L;

      cinemaLayerRef.current =
        L.layerGroup().addTo(map);
    }

    init();

    return () => {
      cancelled = true;

      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }

      leafletRef.current = null;
      cinemaLayerRef.current = null;
      userMarkerRef.current = null;
    };
  }, []);

  // ─── USER MARKER ──────────────────────────────────────────────────────

  useEffect(() => {
    if (
      !mapInstance.current ||
      !leafletRef.current
    ) {
      return;
    }

    const L = leafletRef.current;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
    }

    const userIcon = L.divIcon({
      html: `
        <div style="
          width:16px;
          height:16px;
          background:${P.pink};
          border:3px solid white;
          border-radius:50%;
          box-shadow:0 2px 6px rgba(0,0,0,.4);
        "></div>
      `,

      iconSize: [16, 16],
      iconAnchor: [8, 8],
      className: '',
    });

    userMarkerRef.current = L.marker(
      [userLat, userLng],
      {
        icon: userIcon,
      }
    )
      .addTo(mapInstance.current)
      .bindPopup('📍 Sei qui');

    mapInstance.current.setView(
      [userLat, userLng],
      mapInstance.current.getZoom()
    );
  }, [
    userLat,
    userLng,
    P.pink,
  ]);

  // ─── CINEMA MARKERS ───────────────────────────────────────────────────

  useEffect(() => {
    if (
      !mapInstance.current ||
      !leafletRef.current ||
      !cinemaLayerRef.current
    ) {
      return;
    }

    const L = leafletRef.current;

    cinemaLayerRef.current.clearLayers();

    cinemas.forEach((cinema) => {
      const isSelected =
        cinema.id === selectedId;

      const meta =
        getChainMeta(cinema.name);

      const logoSrc =
        getLogoForCinema(
          cinema.name,
          meta.label
        );

      const cinemaIcon =
        L.divIcon({
          html: `
            <div
              style="
                background:${
                  isSelected
                    ? meta.mapColorSelected
                    : meta.mapColor
                };

                border:2px solid white;

                border-radius:50%;

                width:40px;
                height:40px;

                display:flex;
                align-items:center;
                justify-content:center;

                box-shadow:
                  0 2px 8px rgba(0,0,0,.4);

                cursor:pointer;

                overflow:hidden;
              "
            >

              <img
                src="${logoSrc}"
                alt="${meta.label}"
                style="
                  width:28px;
                  height:28px;

                  object-fit:contain;

                  display:block;

                  background:transparent;
                "

                onerror="
                  this.onerror=null;
                  this.src='${fallbackLogo}';
                "
              />

            </div>
          `,

          iconSize: [40, 40],
          iconAnchor: [20, 20],
          className: '',
        });

      L.marker(
        [cinema.lat, cinema.lng],
        {
          icon: cinemaIcon,
        }
      )
        .bindPopup(`
          <div
            style="
              min-width:180px;
              font-family:Inter,sans-serif;
              color:${P.text};
            "
          >

            <div
              style="
                font-size:11px;
                font-weight:700;
                color:${
                  isSelected
                    ? meta.mapColorSelected
                    : meta.mapColor
                };
                margin-bottom:4px;
              "
            >
              ${meta.emoji}
              ${meta.label}
            </div>

            <b>
              ${cinema.name}
            </b>

            <br/>

            ${cinema.address}

            <br/>

            <small
              style="
                color:${P.textMuted};
              "
            >
              ${cinema.distanceKm} km da te
            </small>

          </div>
        `)
        .on('click', () =>
          onSelect(cinema.id)
        )
        .addTo(
          cinemaLayerRef.current
        );
    });
  }, [
    cinemas,
    selectedId,
    onSelect,
    P.text,
    P.textMuted,
  ]);

  return (
    <>
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      />

      <div
        ref={mapRef}
        style={{
          width: '100%',
          height: '300px',
          borderRadius: 0,
          overflow: 'hidden',
          border:
            `1px solid ${P.border}`,
          boxShadow:
            '0 2px 8px rgba(0,0,0,0.1)',
        }}
      />
    </>
  );
}