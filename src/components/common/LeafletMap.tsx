import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  title: string;
  type?: 'lost' | 'found' | 'building' | 'user' | 'target';
  popupHtml?: string;
  onClick?: () => void;
}

interface LeafletMapProps {
  center?: [number, number];
  zoom?: number;
  markers?: MapMarker[];
  routeCoordinates?: [number, number][];
  onLocationSelect?: (lat: number, lng: number) => void;
  className?: string;
  height?: string;
  readOnly?: boolean;
}

export const LeafletMap: React.FC<LeafletMapProps> = ({
  center = [37.7749, -122.4194],
  zoom = 13,
  markers = [],
  routeCoordinates,
  onLocationSelect,
  className = '',
  height = '350px',
  readOnly = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);

  const createCustomIcon = (type: MapMarker['type'] = 'lost') => {
    let color = '#2563eb'; // Blue
    if (type === 'lost') color = '#e11d48'; // Rose
    if (type === 'found') color = '#0d9488'; // Teal
    if (type === 'building') color = '#7c3aed'; // Purple
    if (type === 'user') color = '#0284c7'; // Sky
    if (type === 'target') color = '#ea580c'; // Orange

    return L.divIcon({
      className: 'custom-leaflet-marker',
      html: `
        <div style="
          width: 30px;
          height: 30px;
          background-color: ${color};
          border: 2px solid white;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.25);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="
            width: 10px;
            height: 10px;
            background-color: white;
            border-radius: 50%;
            transform: rotate(45deg);
          "></div>
        </div>
      `,
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [0, -28],
    });
  };

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center,
        zoom,
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      markersLayerRef.current = L.layerGroup().addTo(map);

      if (!readOnly && onLocationSelect) {
        map.on('click', (e: L.LeafletMouseEvent) => {
          onLocationSelect(e.latlng.lat, e.latlng.lng);
        });
      }

      mapInstanceRef.current = map;
    }

    return () => {
      // Keep map clean if unmounted
    };
  }, []);

  // Update map center and zoom
  useEffect(() => {
    if (mapInstanceRef.current && center) {
      mapInstanceRef.current.setView(center, zoom);
    }
  }, [center[0], center[1], zoom]);

  // Update markers
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    markersLayerRef.current.clearLayers();

    markers.forEach((m) => {
      const marker = L.marker([m.lat, m.lng], {
        icon: createCustomIcon(m.type),
      });

      if (m.popupHtml) {
        marker.bindPopup(m.popupHtml);
      } else if (m.title) {
        marker.bindPopup(`<strong style="font-family: sans-serif; font-size: 13px;">${m.title}</strong>`);
      }

      if (m.onClick) {
        marker.on('click', m.onClick);
      }

      marker.addTo(markersLayerRef.current!);
    });

    if (markers.length > 1 && !routeCoordinates) {
      const group = L.featureGroup(markers.map((m) => L.marker([m.lat, m.lng])));
      mapInstanceRef.current.fitBounds(group.getBounds().pad(0.15));
    }
  }, [markers]);

  // Update route path
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (routeLayerRef.current) {
      routeLayerRef.current.remove();
      routeLayerRef.current = null;
    }

    if (routeCoordinates && routeCoordinates.length > 0) {
      const polyline = L.polyline(routeCoordinates, {
        color: '#2563eb',
        weight: 5,
        opacity: 0.85,
        dashArray: '8, 8',
      }).addTo(mapInstanceRef.current);

      routeLayerRef.current = polyline;
      mapInstanceRef.current.fitBounds(polyline.getBounds().pad(0.2));
    }
  }, [routeCoordinates]);

  return (
    <div
      className={`rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm relative z-0 ${className}`}
      style={{ height }}
    >
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

