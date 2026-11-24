import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { useGeolocation } from '@/contexts/LocationContext';
import { Navigation, Loader2, MapPin, X } from 'lucide-react';

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  title: string;
  type?: 'lost' | 'found' | 'building' | 'user' | 'target' | 'university' | 'college' | 'school' | 'other' | 'search-center';
  popupHtml?: string;
  onClick?: () => void;
}

interface LeafletMapProps {
  center?: [number, number];
  zoom?: number;
  markers?: MapMarker[];
  routeCoordinates?: [number, number][];
  circleCenter?: [number, number];
  circleRadiusMeters?: number;
  focusMarkerId?: string | null;
  onLocationSelect?: (lat: number, lng: number) => void;
  onMapMoveEnd?: (center: { lat: number; lng: number }, zoom: number) => void;
  className?: string;
  height?: string;
  readOnly?: boolean;
  showLocateButton?: boolean;
  showUserLocationMarker?: boolean;
}

export const LeafletMap: React.FC<LeafletMapProps> = ({
  center = [37.7749, -122.4194],
  zoom = 13,
  markers = [],
  routeCoordinates,
  circleCenter,
  circleRadiusMeters,
  focusMarkerId,
  onLocationSelect,
  onMapMoveEnd,
  className = '',
  height = '350px',
  readOnly = false,
  showLocateButton = true,
  showUserLocationMarker = true,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const circleLayerRef = useRef<L.Circle | null>(null);
  const markersMapRef = useRef<Map<string, L.Marker>>(new Map());

  const { coords, status, requestLocation, clearLocation } = useGeolocation();
  const [isLocating, setIsLocating] = useState(false);

  const createCustomIcon = (type: MapMarker['type'] = 'lost') => {
    if (type === 'user' || type === 'search-center') {
      const ringColor = type === 'search-center' ? '#0d9488' : '#0284c7';
      return L.divIcon({
        className: 'custom-user-location-marker',
        html: `
          <div style="position: relative; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; width: 28px; height: 28px; background-color: ${ringColor}; border-radius: 50%; opacity: 0.35; transform: scale(1.4); animation: pulse 2s infinite;"></div>
            <div style="width: 16px; height: 16px; background-color: ${ringColor}; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.35);"></div>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14],
      });
    }

    let color = '#2563eb'; // Blue
    if (type === 'lost') color = '#e11d48'; // Rose
    if (type === 'found') color = '#0d9488'; // Teal
    if (type === 'building') color = '#7c3aed'; // Purple
    if (type === 'target') color = '#ea580c'; // Orange
    if (type === 'university') color = '#059669'; // Emerald
    if (type === 'college') color = '#2563eb'; // Blue
    if (type === 'school') color = '#d97706'; // Amber
    if (type === 'other') color = '#0891b2'; // Cyan

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

      if (onMapMoveEnd) {
        map.on('moveend', () => {
          const c = map.getCenter();
          onMapMoveEnd({ lat: c.lat, lng: c.lng }, map.getZoom());
        });
      }

      mapInstanceRef.current = map;
    }

    return () => {
      // Map stays alive until unmount
    };
  }, []);

  // Update map center and zoom
  useEffect(() => {
    if (mapInstanceRef.current && center) {
      mapInstanceRef.current.setView(center, zoom);
    }
  }, [center[0], center[1], zoom]);

  // Update standard markers
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    markersLayerRef.current.clearLayers();
    markersMapRef.current.clear();

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
      markersMapRef.current.set(m.id, marker);
    });

    if (markers.length > 1 && !routeCoordinates && !circleCenter) {
      const group = L.featureGroup(markers.map((m) => L.marker([m.lat, m.lng])));
      mapInstanceRef.current.fitBounds(group.getBounds().pad(0.15));
    }
  }, [markers]);

  // Focus specific marker (e.g. from nearby institution list item click)
  useEffect(() => {
    if (!focusMarkerId || !mapInstanceRef.current) return;
    const marker = markersMapRef.current.get(focusMarkerId);
    if (marker) {
      mapInstanceRef.current.flyTo(marker.getLatLng(), Math.max(mapInstanceRef.current.getZoom(), 16), {
        animate: true,
        duration: 0.8,
      });
      setTimeout(() => {
        marker.openPopup();
      }, 850);
    }
  }, [focusMarkerId]);

  // Update radius circle around centre point
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (circleLayerRef.current) {
      circleLayerRef.current.remove();
      circleLayerRef.current = null;
    }

    if (circleCenter && circleRadiusMeters) {
      circleLayerRef.current = L.circle(circleCenter, {
        radius: circleRadiusMeters,
        color: '#0d9488',
        weight: 2,
        opacity: 0.8,
        fillColor: '#0d9488',
        fillOpacity: 0.08,
        dashArray: '6, 6',
      }).addTo(mapInstanceRef.current);
    }
  }, [circleCenter?.[0], circleCenter?.[1], circleRadiusMeters]);

  // Update user location marker ("You are here")
  useEffect(() => {
    if (!mapInstanceRef.current || !showUserLocationMarker) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    if (coords) {
      const marker = L.marker([coords.latitude, coords.longitude], {
        icon: createCustomIcon('user'),
        zIndexOffset: 1000,
      });

      marker.bindPopup(`
        <div style="font-family: sans-serif; font-size: 12px; text-align: center; padding: 2px;">
          <strong style="color: #0284c7; display: block; margin-bottom: 2px;">You are here</strong>
          <span style="color: #64748b; font-size: 11px;">Approximate Location</span>
        </div>
      `);

      marker.addTo(mapInstanceRef.current);
      userMarkerRef.current = marker;
    }
  }, [coords, showUserLocationMarker]);

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

  // Handle "Locate Me" button click
  const handleLocateMe = async () => {
    setIsLocating(true);
    try {
      let targetCoords = coords;
      if (!targetCoords) {
        targetCoords = await requestLocation();
      }

      if (targetCoords && mapInstanceRef.current) {
        mapInstanceRef.current.flyTo(
          [targetCoords.latitude, targetCoords.longitude],
          15,
          { animate: true, duration: 1.2 }
        );
      }
    } finally {
      setIsLocating(false);
    }
  };

  return (
    <div
      className={`rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm relative z-0 ${className}`}
      style={{ height }}
    >
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

      {/* Floating Map Controls ("Locate Me" & "Clear Location") */}
      {showLocateButton && (
        <div className="absolute bottom-3 right-3 z-[400] flex flex-col items-end space-y-1.5">
          {coords && (
            <button
              type="button"
              onClick={clearLocation}
              title="Clear my location"
              aria-label="Clear my location"
              className="p-2 rounded-xl bg-white/95 dark:bg-slate-800/95 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 shadow-md border border-slate-200 dark:border-slate-700 transition flex items-center space-x-1 text-xs font-semibold backdrop-blur-xs"
            >
              <X className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear Location</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleLocateMe}
            disabled={isLocating || status === 'requesting'}
            title={coords ? 'Center map on my location' : 'Locate me on map'}
            aria-label={coords ? 'Center map on my location' : 'Locate me on map'}
            className={`p-2.5 rounded-xl shadow-lg border transition flex items-center space-x-1.5 text-xs font-bold backdrop-blur-xs ${coords
                ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-500 shadow-blue-500/20'
                : 'bg-white/95 dark:bg-slate-800/95 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
          >
            {isLocating || status === 'requesting' ? (
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            ) : (
              <Navigation className={`w-4 h-4 ${coords ? 'text-white' : 'text-blue-600 dark:text-blue-400'}`} />
            )}
            <span className="hidden sm:inline">
              {coords ? 'My Location' : 'Locate Me'}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
