'use client';

import { useEffect, useRef } from 'react';
import type { TheSpaceCinema } from '@/utils/cinema/thespaceCinemas';
import { C, R } from '@/styles/token';

type Props = {
  cinemas: (TheSpaceCinema & { distanceKm: number })[];
  userLat: number;
  userLng: number;
  selectedId: number | null;
  onSelect: (id: number) => void;
};

export default function CinemaMap({
  cinemas,
  userLat,
  userLng,
  selectedId,
  onSelect,
}: Props) {
  const mapRef = useRef<HTMLDivElement>(null);

  const mapInstance = useRef<any>(null);
  const leafletRef = useRef<any>(null);

  const cinemaLayerRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);

  //
  // Create map ONCE
  //
  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!mapRef.current || mapInstance.current) return;

      const L = await import('leaflet');

      if (cancelled || !mapRef.current) return;

      // Fix icons
      delete (L.Icon.Default.prototype as any)._getIconUrl;

      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:
          'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:
          'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      // React Strict Mode protection
      if ((mapRef.current as any)._leaflet_id) {
        delete (mapRef.current as any)._leaflet_id;
      }

      const map = L.map(mapRef.current).setView([userLat, userLng], 11);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map);

      mapInstance.current = map;
      leafletRef.current = L;

      cinemaLayerRef.current = L.layerGroup().addTo(map);
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

  //
  // Update user marker
  //
  useEffect(() => {
    if (!mapInstance.current || !leafletRef.current) return;

    const L = leafletRef.current;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
    }

    const userIcon = L.divIcon({
      html: `<div style="
          width:16px;
          height:16px;
          background:${C.primary};
          border:3px solid white;
          border-radius:50%;
          box-shadow:0 2px 6px rgba(0,0,0,.4);
      "></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
      className: '',
    });

    userMarkerRef.current = L.marker([userLat, userLng], {
      icon: userIcon,
    })
      .addTo(mapInstance.current)
      .bindPopup('📍 Sei qui');

    mapInstance.current.setView([userLat, userLng], mapInstance.current.getZoom());
  }, [userLat, userLng]);

  //
  // Update cinema markers
  //
  useEffect(() => {
    if (
      !mapInstance.current ||
      !leafletRef.current ||
      !cinemaLayerRef.current
    )
      return;

    const L = leafletRef.current;

    cinemaLayerRef.current.clearLayers();

    cinemas.forEach((cinema) => {
      const isSelected = cinema.id === selectedId;

      const cinemaIcon = L.divIcon({
        html: `
          <div style="
            background:${isSelected ? C.primary : '#1F1A17'};
            color:white;
            border:2px solid white;
            border-radius:${R.sm};
            padding:4px 8px;
            font-size:11px;
            font-weight:700;
            white-space:nowrap;
            box-shadow:0 2px 8px rgba(0,0,0,.3);
            cursor:pointer;
            font-family:Inter,sans-serif;
          ">
            🎬 ${cinema.city}
          </div>
        `,
        iconAnchor: [40, 16],
        className: '',
      });

      L.marker([cinema.lat, cinema.lng], {
        icon: cinemaIcon,
      })
        .bindPopup(`
          <b>${cinema.name}</b><br/>
          ${cinema.address}<br/>
          <small>${cinema.distanceKm} km da te</small>
        `)
        .on('click', () => onSelect(cinema.id))
        .addTo(cinemaLayerRef.current);
    });
  }, [cinemas, selectedId, onSelect]);

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
          borderRadius: R.lg,
          overflow: 'hidden',
        }}
      />
    </>
  );
}