import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { reverseGeocode } from '@/services/geocoding';

export type GeolocationStatus =
  | 'idle'
  | 'prompt'
  | 'requesting'
  | 'granted'
  | 'denied'
  | 'unavailable'
  | 'error';

export interface LocationCoords {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface LocationAddress {
  country?: string;
  state?: string;
  city?: string;
  suburb?: string;
  road?: string;
  displayName?: string;
  generalArea: string;
}

export interface LocationContextType {
  coords: LocationCoords | null;
  status: GeolocationStatus;
  errorMessage: string | null;
  address: LocationAddress | null;
  generalArea: string | null;
  isSecure: boolean;
  isSupported: boolean;
  isPromptOpen: boolean;
  requestLocation: () => Promise<LocationCoords | null>;
  clearLocation: () => void;
  openPrompt: () => void;
  closePrompt: () => void;
  dismissPrompt: () => void;
}

const STORAGE_KEY_LOCATION = 'findit_user_location';
const STORAGE_KEY_DISMISSED = 'findit_location_prompt_dismissed';

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [coords, setCoords] = useState<LocationCoords | null>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY_LOCATION);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed?.latitude === 'number' && typeof parsed?.longitude === 'number') {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to parse saved location from sessionStorage:', e);
    }
    return null;
  });

  const [status, setStatus] = useState<GeolocationStatus>(() => {
    return coords ? 'granted' : 'idle';
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [address, setAddress] = useState<LocationAddress | null>(null);
  const [generalArea, setGeneralArea] = useState<string | null>(null);
  const [isPromptOpen, setIsPromptOpen] = useState(false);

  const permissionStatusRef = useRef<PermissionStatus | null>(null);

  // Check secure context and geolocation support
  const isSecure = typeof window !== 'undefined' ? window.isSecureContext ?? true : true;
  const isSupported = typeof window !== 'undefined' && 'navigator' in window && 'geolocation' in navigator;

  // Derive human-readable general area name from reverse geocoded place
  const formatGeneralArea = (place: any): string => {
    if (!place || !place.address) return 'Nearby Area';
    const addr = place.address;
    const locality = addr.city || addr.town || addr.village || addr.suburb || addr.municipality;
    const region = addr.state || addr.province || addr.county;
    const country = addr.country;

    if (locality && region) {
      return `${locality}, ${region}`;
    }
    if (locality && country) {
      return `${locality}, ${country}`;
    }
    if (region && country) {
      return `${region}, ${country}`;
    }
    return country || 'Nearby Area';
  };

  // Perform reverse geocoding on coordinates
  const fetchAddress = useCallback(async (lat: number, lon: number) => {
    try {
      const place = await reverseGeocode(lat, lon);
      if (place && place.address) {
        const genArea = formatGeneralArea(place);
        const addrData: LocationAddress = {
          country: place.address.country,
          state: place.address.state,
          city: place.address.city || place.address.town || place.address.village || place.address.suburb,
          suburb: place.address.suburb,
          road: place.address.road,
          displayName: place.display_name,
          generalArea: genArea,
        };
        setAddress(addrData);
        setGeneralArea(genArea);
      } else {
        setGeneralArea('Current Location');
      }
    } catch (err) {
      console.warn('Reverse geocoding error:', err);
      setGeneralArea('Current Location');
    }
  }, []);

  // Sync initial stored coordinates with reverse geocoding
  useEffect(() => {
    if (coords) {
      fetchAddress(coords.latitude, coords.longitude);
    }
  }, [coords, fetchAddress]);

  // Monitor Permissions API if available
  useEffect(() => {
    if (!isSupported || !navigator.permissions || !navigator.permissions.query) return;

    try {
      navigator.permissions
        .query({ name: 'geolocation' as PermissionName })
        .then((permStatus) => {
          permissionStatusRef.current = permStatus;

          if (permStatus.state === 'denied') {
            setStatus('denied');
          } else if (permStatus.state === 'prompt' && !coords) {
            setStatus((prev) => (prev === 'idle' ? 'idle' : prev));
          }

          permStatus.onchange = () => {
            if (permStatus.state === 'denied') {
              setStatus('denied');
              setErrorMessage(
                "Location permission was denied in your browser settings. You can re-enable it by clicking the site settings or lock icon in your browser's address bar."
              );
            } else if (permStatus.state === 'granted' && !coords) {
              requestLocation();
            }
          };
        })
        .catch(() => {
          // Some browsers throw on querying geolocation permission
        });
    } catch {
      // Permissions API not fully supported
    }

    return () => {
      if (permissionStatusRef.current) {
        permissionStatusRef.current.onchange = null;
      }
    };
  }, [isSupported, coords]);

  const requestLocation = useCallback(async (): Promise<LocationCoords | null> => {
    if (!isSecure) {
      setStatus('error');
      setErrorMessage(
        'Location access requires a secure connection (HTTPS or localhost). Please access FindIt over HTTPS.'
      );
      return null;
    }

    if (!isSupported) {
      setStatus('unavailable');
      setErrorMessage(
        'Geolocation is not supported by your browser or device. You can enter your location manually.'
      );
      return null;
    }

    setStatus('requesting');
    setErrorMessage(null);

    return new Promise<LocationCoords | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newCoords: LocationCoords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          };

          setCoords(newCoords);
          setStatus('granted');
          setErrorMessage(null);

          try {
            sessionStorage.setItem(STORAGE_KEY_LOCATION, JSON.stringify(newCoords));
          } catch (e) {
            console.warn('Could not save location to sessionStorage:', e);
          }

          fetchAddress(newCoords.latitude, newCoords.longitude);
          setIsPromptOpen(false);
          resolve(newCoords);
        },
        (error) => {
          let friendlyMsg = 'An error occurred while retrieving your location.';
          let nextStatus: GeolocationStatus = 'error';

          switch (error.code) {
            case error.PERMISSION_DENIED:
              nextStatus = 'denied';
              friendlyMsg =
                "Location permission was denied. You can re-enable location access anytime in your browser's site settings or type your location manually.";
              break;
            case error.POSITION_UNAVAILABLE:
              nextStatus = 'unavailable';
              friendlyMsg =
                "Your location information is currently unavailable. Please check your device's location services or enter your city manually.";
              break;
            case error.TIMEOUT:
              nextStatus = 'error';
              friendlyMsg =
                'The request to get your location timed out. Please check your signal and try again, or enter your city manually.';
              break;
            default:
              friendlyMsg = error.message || friendlyMsg;
          }

          setStatus(nextStatus);
          setErrorMessage(friendlyMsg);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        }
      );
    });
  }, [isSecure, isSupported, fetchAddress]);

  const clearLocation = useCallback(() => {
    try {
      sessionStorage.removeItem(STORAGE_KEY_LOCATION);
    } catch (e) {
      console.warn('Failed to clear location from sessionStorage:', e);
    }
    setCoords(null);
    setAddress(null);
    setGeneralArea(null);
    setErrorMessage(null);
    setStatus('idle');
  }, []);

  const openPrompt = useCallback(() => {
    setIsPromptOpen(true);
  }, []);

  const closePrompt = useCallback(() => {
    setIsPromptOpen(false);
  }, []);

  const dismissPrompt = useCallback(() => {
    setIsPromptOpen(false);
    try {
      sessionStorage.setItem(STORAGE_KEY_DISMISSED, 'true');
    } catch (e) {
      console.warn('Failed to write dismiss state to sessionStorage:', e);
    }
  }, []);

  return (
    <LocationContext.Provider
      value={{
        coords,
        status,
        errorMessage,
        address,
        generalArea,
        isSecure,
        isSupported,
        isPromptOpen,
        requestLocation,
        clearLocation,
        openPrompt,
        closePrompt,
        dismissPrompt,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

export const useGeolocation = (): LocationContextType => {
  const context = useContext(LocationContext);
  if (!context) {
    return {
      coords: null,
      status: 'idle',
      errorMessage: null,
      address: null,
      generalArea: null,
      isSecure: true,
      isSupported: false,
      isPromptOpen: false,
      requestLocation: async () => null,
      clearLocation: () => {},
      openPrompt: () => {},
      closePrompt: () => {},
      dismissPrompt: () => {},
    };
  }
  return context;
};
