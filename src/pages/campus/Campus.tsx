import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Compass,
  MapPin,
  Search,
  Navigation,
  BookOpen,
  Coffee,
  Building2,
  Users,
  Trophy,
  Package,
  ArrowRight,
  Clock,
  AlertCircle,
  CheckCircle2,
  X,
  Footprints,
  GraduationCap,
  School,
  Building,
  RotateCcw,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  Globe,
  Phone,
  Layers,
  WifiOff,
  Hourglass,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { CampusPlace, CampusBuilding, Item } from '@/types';
import { LeafletMap, MapMarker } from '@/components/common/LeafletMap';
import { getWalkingDirections } from '@/services/routing';
import { useGeolocation } from '@/contexts/LocationContext';
import {
  useNearbyInstitutions,
  NearbyInstitution,
  getInstitutionErrorInfo,
} from '@/hooks/useNearbyInstitutions';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';

// Fallback seed campuses if DB is offline/unconfigured
const FALLBACK_CAMPUSES: CampusPlace[] = [
  {
    id: 'b0000000-0000-0000-0000-000000000001',
    name: 'Stanford University',
    slug: 'stanford-university',
    city: 'Stanford',
    state: 'California',
    country: 'United States',
    latitude: 37.4275,
    longitude: -122.1697,
    zoom_level: 16,
    boundary_polygon: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 'b0000000-0000-0000-0000-000000000002',
    name: 'MIT (Massachusetts Institute of Technology)',
    slug: 'mit-cambridge',
    city: 'Cambridge',
    state: 'Massachusetts',
    country: 'United States',
    latitude: 42.3601,
    longitude: -71.0942,
    zoom_level: 16,
    boundary_polygon: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 'b0000000-0000-0000-0000-000000000003',
    name: 'University of Oxford',
    slug: 'oxford-university',
    city: 'Oxford',
    state: 'Oxfordshire',
    country: 'United Kingdom',
    latitude: 51.7548,
    longitude: -1.2544,
    zoom_level: 16,
    boundary_polygon: null,
    created_at: new Date().toISOString(),
  },
];

const FALLBACK_BUILDINGS: Record<string, CampusBuilding[]> = {
  'b0000000-0000-0000-0000-000000000001': [
    {
      id: 'bldg-1',
      campus_id: 'b0000000-0000-0000-0000-000000000001',
      name: 'Green Library',
      code: 'GREEN',
      category: 'library',
      latitude: 37.4276,
      longitude: -122.1668,
      description: 'Main campus research library with study halls and media suites',
      created_at: '',
    },
    {
      id: 'bldg-2',
      campus_id: 'b0000000-0000-0000-0000-000000000001',
      name: 'Tresidder Memorial Union',
      code: 'TMU',
      category: 'student_union',
      latitude: 37.4241,
      longitude: -122.1706,
      description: 'Central student activity hub, dining terrace, and meeting rooms',
      created_at: '',
    },
    {
      id: 'bldg-3',
      campus_id: 'b0000000-0000-0000-0000-000000000001',
      name: 'Gates Computer Science Building',
      code: 'GATES',
      category: 'academic',
      latitude: 37.4300,
      longitude: -122.1732,
      description: 'Computer Science department, robotics labs, and lecture hall',
      created_at: '',
    },
    {
      id: 'bldg-4',
      campus_id: 'b0000000-0000-0000-0000-000000000001',
      name: 'Arrillaga Family Dining Commons',
      code: 'AFDC',
      category: 'dining',
      latitude: 37.4262,
      longitude: -122.1633,
      description: 'Student dining commons and recreation area',
      created_at: '',
    },
    {
      id: 'bldg-5',
      campus_id: 'b0000000-0000-0000-0000-000000000001',
      name: 'Memorial Church & Main Quad',
      code: 'MEMCH',
      category: 'administrative',
      latitude: 37.4275,
      longitude: -122.1701,
      description: 'Historic center of Stanford campus',
      created_at: '',
    },
  ],
};

function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `about ${meters} m away`;
  }
  const km = (meters / 1000).toFixed(1);
  return `about ${km} km away`;
}

export const CampusPage: React.FC = () => {
  const { t, i18n } = useTranslation(['campus', 'common']);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const campusSlug = searchParams.get('place') || 'stanford-university';
  const paramLat = searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : null;
  const paramLng = searchParams.get('lng') ? parseFloat(searchParams.get('lng')!) : null;
  const hasUrlCoords = paramLat !== null && paramLng !== null && !isNaN(paramLat) && !isNaN(paramLng);

  const { coords: geoCoords, status: geoStatus, requestLocation } = useGeolocation();

  // Precedence state: user geolocation > dragged/searched pin > campus preset dropdown
  const [isManualCenter, setIsManualCenter] = useState(hasUrlCoords);

  // Tab mode: 'institutions' | 'buildings'
  const [activeTab, setActiveTab] = useState<'institutions' | 'buildings'>('institutions');

  // Campuses state
  const [campuses, setCampuses] = useState<CampusPlace[]>(FALLBACK_CAMPUSES);
  const [selectedCampus, setSelectedCampus] = useState<CampusPlace>(FALLBACK_CAMPUSES[0]);
  const [buildings, setBuildings] = useState<CampusBuilding[]>([]);
  const [buildingSearch, setBuildingSearch] = useState('');
  const [campusItems, setCampusItems] = useState<Item[]>([]);

  // Search centre state (priority: real user geolocation > dragged/searched pin > preset campus fallback)
  const [searchCenter, setSearchCenter] = useState<{ lat: number; lng: number }>({
    lat: hasUrlCoords ? paramLat! : FALLBACK_CAMPUSES[0].latitude,
    lng: hasUrlCoords ? paramLng! : FALLBACK_CAMPUSES[0].longitude,
  });

  // URL coordinates listener
  useEffect(() => {
    if (hasUrlCoords) {
      setSearchCenter({ lat: paramLat!, lng: paramLng! });
      setIsManualCenter(true);
    }
  }, [paramLat, paramLng, hasUrlCoords]);

  // Manual city/place search autocomplete
  const [placeSearchInput, setPlaceSearchInput] = useState('');
  const [placeSuggestions, setPlaceSuggestions] = useState<any[]>([]);
  const [isSearchingPlace, setIsSearchingPlace] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Map panning & "Search this area" button
  const [mapPannedCenter, setMapPannedCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [showSearchAreaButton, setShowSearchAreaButton] = useState(false);

  // Nearby institutions filters
  const [selectedRadius, setSelectedRadius] = useState<number>(2000); // 2000m default
  const [selectedType, setSelectedType] = useState<string>('all'); // 'all', 'university', 'college', 'school', 'other'
  const [institutionNameQuery, setInstitutionNameQuery] = useState(searchParams.get('q') || '');
  const [focusMarkerId, setFocusMarkerId] = useState<string | null>(null);

  // Mobile drawer state
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Navigation / Walking directions state
  const [targetDestination, setTargetDestination] = useState<{ lat: number; lng: number; title: string } | null>(null);
  const [walkingRoute, setWalkingRoute] = useState<any | null>(null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);

  // Selected building details
  const [selectedBuilding, setSelectedBuilding] = useState<CampusBuilding | null>(null);

  // Fetch institutions using TanStack Query hook
  const typesFilter =
    selectedType === 'all'
      ? undefined
      : selectedType === 'other'
      ? ['kindergarten', 'research_institute', 'other']
      : [selectedType];

  const {
    data: institutionsData,
    isLoading: isLoadingInstitutions,
    isError: isErrorInstitutions,
    error: institutionsError,
    refetch: refetchInstitutions,
  } = useNearbyInstitutions({
    lat: searchCenter.lat,
    lng: searchCenter.lng,
    radius: selectedRadius,
    types: typesFilter,
  });

  // Global callback for leaflet popup button "Walking directions"
  useEffect(() => {
    (window as any)._handleWalkToInstitution = (id: string, lat: number, lng: number, name: string) => {
      setTargetDestination({ lat, lng, title: name });
    };
    return () => {
      delete (window as any)._handleWalkToInstitution;
    };
  }, [searchCenter]);

  // Load campuses
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    supabase
      .from('campus_places')
      .select('*')
      .order('name')
      .then(({ data }) => {
        if (data && data.length > 0) {
          setCampuses(data as CampusPlace[]);
        }
      });
  }, []);

  // Update selected campus from slug & fallback search center
  // Priority rule: Real user geolocation (when granted) > dragged/searched pin > preset campus fallback
  useEffect(() => {
    const found = campuses.find((c) => c.slug === campusSlug) || campuses[0];
    setSelectedCampus(found);

    // Only fallback to preset campus coordinates if user has NOT granted geolocation and NO manual center was selected
    if (!isManualCenter && (!geoCoords || geoStatus !== 'granted')) {
      setSearchCenter({
        lat: found.latitude,
        lng: found.longitude,
      });
    }
  }, [campusSlug, campuses, geoCoords, geoStatus, isManualCenter]);

  // Center on user geolocation when granted (takes top priority over preset campus)
  useEffect(() => {
    if (geoCoords && geoStatus === 'granted' && !isManualCenter) {
      setSearchCenter({
        lat: geoCoords.latitude,
        lng: geoCoords.longitude,
      });
    }
  }, [geoCoords, geoStatus, isManualCenter]);

  // Load buildings and campus items
  useEffect(() => {
    if (!selectedCampus) return;

    if (isSupabaseConfigured && supabase) {
      supabase
        .from('campus_buildings')
        .select('*')
        .eq('campus_id', selectedCampus.id)
        .order('name')
        .then(({ data }) => {
          if (data && data.length > 0) {
            setBuildings(data as CampusBuilding[]);
          } else {
            setBuildings(FALLBACK_BUILDINGS[selectedCampus.id] || []);
          }
        });

      supabase
        .from('items')
        .select('*, category:categories(*)')
        .or(`campus_place_id.eq.${selectedCampus.id},location_city.ilike.%${selectedCampus.city}%`)
        .limit(20)
        .then(({ data }) => {
          if (data) setCampusItems(data as Item[]);
        });
    } else {
      setBuildings(FALLBACK_BUILDINGS[selectedCampus.id] || []);
    }
  }, [selectedCampus]);

  // Calculate Walking Route when destination is picked
  useEffect(() => {
    if (!searchCenter || !targetDestination) {
      setWalkingRoute(null);
      return;
    }

    const compute = async () => {
      setIsCalculatingRoute(true);
      try {
        const route = await getWalkingDirections(
          searchCenter.lat,
          searchCenter.lng,
          targetDestination.lat,
          targetDestination.lng
        );
        setWalkingRoute(route);
      } catch (err) {
        console.error('Walking route error:', err);
      } finally {
        setIsCalculatingRoute(false);
      }
    };

    compute();
  }, [searchCenter, targetDestination]);

  // Debounced Place Autocomplete Search (Nominatim)
  useEffect(() => {
    if (!placeSearchInput || placeSearchInput.trim().length < 3) {
      setPlaceSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingPlace(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            placeSearchInput.trim()
          )}&limit=5&addressdetails=1`,
          { headers: { 'Accept-Language': 'en' } }
        );
        if (res.ok) {
          const data = await res.json();
          setPlaceSuggestions(data);
          setShowSuggestions(true);
        }
      } catch (e) {
        console.error('Place autocomplete error:', e);
      } finally {
        setIsSearchingPlace(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [placeSearchInput]);

  const handleSelectPlaceSuggestion = (place: any) => {
    setIsManualCenter(true);
    const lat = parseFloat(place.lat);
    const lng = parseFloat(place.lon);
    setSearchCenter({ lat, lng });
    setPlaceSearchInput(place.display_name.split(',')[0]);
    setShowSuggestions(false);
    setShowSearchAreaButton(false);
    setTargetDestination(null);
  };

  const handleSelectCampus = (slug: string) => {
    setIsManualCenter(true);
    const next = new URLSearchParams(searchParams);
    next.set('place', slug);
    setSearchParams(next);
    const found = campuses.find((c) => c.slug === slug);
    if (found) {
      setSearchCenter({ lat: found.latitude, lng: found.longitude });
    }
    setTargetDestination(null);
    setSelectedBuilding(null);
    setShowSearchAreaButton(false);
  };

  const handleUseMyLocation = async () => {
    setIsManualCenter(false);
    setPlaceSearchInput('');
    if (geoCoords && geoStatus === 'granted') {
      setSearchCenter({ lat: geoCoords.latitude, lng: geoCoords.longitude });
    } else {
      await requestLocation();
    }
  };

  // Map Movement Handler
  const handleMapMoveEnd = (center: { lat: number; lng: number }) => {
    setMapPannedCenter(center);
    // Calculate distance from current search center
    const dLat = Math.abs(center.lat - searchCenter.lat);
    const dLng = Math.abs(center.lng - searchCenter.lng);
    if (dLat > 0.003 || dLng > 0.003) {
      setShowSearchAreaButton(true);
    } else {
      setShowSearchAreaButton(false);
    }
  };

  const handleSearchThisArea = () => {
    if (mapPannedCenter) {
      setIsManualCenter(true);
      setSearchCenter(mapPannedCenter);
      setShowSearchAreaButton(false);
      setTargetDestination(null);
    }
  };

  // Filter institutions by name search
  const institutions = (institutionsData?.institutions || []).filter((inst) =>
    inst.name.toLowerCase().includes(institutionNameQuery.toLowerCase())
  );

  // Compile all map markers
  const markers: MapMarker[] = [];

  // 1. Search Centre Marker
  markers.push({
    id: 'search-centre',
    lat: searchCenter.lat,
    lng: searchCenter.lng,
    title: 'Search Centre / Starting Location',
    type: 'search-center',
    popupHtml: `
      <div style="font-family: sans-serif; font-size: 12px; text-align: center; padding: 2px;">
        <strong style="color: #0d9488; display: block; margin-bottom: 2px;">Search Centre</strong>
        <span style="color: #64748b; font-size: 11px;">Radius: ${selectedRadius < 1000 ? `${selectedRadius} m` : `${selectedRadius / 1000} km`}</span>
      </div>
    `,
  });

  // 2. Nearby Institutions Markers
  if (activeTab === 'institutions') {
    institutions.forEach((inst) => {
      const typeColor =
        inst.type === 'university'
          ? '#059669'
          : inst.type === 'college'
          ? '#2563eb'
          : inst.type === 'school'
          ? '#d97706'
          : '#0891b2';

      const popupHtml = `
        <div style="font-family: sans-serif; min-width: 210px; max-width: 260px; padding: 2px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
            <span style="display: inline-block; font-size: 10px; font-weight: bold; text-transform: uppercase; color: ${typeColor}; background: #f0fdfa; padding: 2px 6px; border-radius: 6px;">
              ${inst.type}
            </span>
            <span style="font-size: 10px; color: #64748b; font-weight: 600;">
              ${formatDistance(inst.distance)}
            </span>
          </div>

          <h4 style="font-size: 13px; font-weight: bold; margin: 0 0 4px 0; color: #0f172a; line-height: 1.3;">
            ${inst.name}
          </h4>

          ${inst.address ? `<p style="font-size: 11px; color: #64748b; margin: 0 0 6px 0;">${inst.address}</p>` : ''}

          ${
            inst.website
              ? `<a href="${inst.website}" target="_blank" rel="noopener noreferrer" style="font-size: 11px; color: #2563eb; text-decoration: underline; display: block; margin-bottom: 8px;">Visit Website ↗</a>`
              : ''
          }

          <div style="display: flex; flex-direction: column; gap: 5px; margin-top: 8px; padding-top: 6px; border-top: 1px solid #e2e8f0;">
            <button onclick="window._handleWalkToInstitution('${inst.id}', ${inst.lat}, ${inst.lng}, '${inst.name.replace(/'/g, "\\'")}')" style="background: #0d9488; color: white; border: none; padding: 6px 10px; border-radius: 8px; font-size: 11px; font-weight: bold; cursor: pointer; text-align: center;">
              Walking Directions
            </button>
            <a href="/browse?location=${encodeURIComponent(inst.name)}" style="background: #eff6ff; color: #1d4ed8; text-align: center; text-decoration: none; padding: 6px 10px; border-radius: 8px; font-size: 11px; font-weight: bold; border: 1px solid #bfdbfe;">
              View Lost & Found Here
            </a>
          </div>
        </div>
      `;

      markers.push({
        id: inst.id,
        lat: inst.lat,
        lng: inst.lng,
        title: inst.name,
        type: inst.type === 'university' ? 'university' : inst.type === 'college' ? 'college' : inst.type === 'school' ? 'school' : 'other',
        popupHtml,
        onClick: () => {
          setFocusMarkerId(inst.id);
        },
      });
    });
  }

  // 3. Campus building markers (if in buildings mode or on campus)
  if (activeTab === 'buildings') {
    buildings.forEach((b) => {
      markers.push({
        id: b.id,
        lat: b.latitude,
        lng: b.longitude,
        title: `${b.name} (${b.code || b.category})`,
        type: 'building',
        onClick: () => {
          setSelectedBuilding(b);
          setTargetDestination({ lat: b.latitude, lng: b.longitude, title: b.name });
        },
      });
    });
  }

  // 4. Items on campus markers
  campusItems.forEach((i) => {
    if (i.latitude && i.longitude) {
      markers.push({
        id: i.id,
        lat: i.latitude,
        lng: i.longitude,
        title: `${i.type === 'lost' ? 'LOST' : 'FOUND'}: ${i.title}`,
        type: i.type,
        onClick: () => {
          setTargetDestination({ lat: i.latitude!, lng: i.longitude!, title: i.title });
        },
      });
    }
  });

  const filteredBuildings = buildings.filter(
    (b) =>
      b.name.toLowerCase().includes(buildingSearch.toLowerCase()) ||
      (b.code && b.code.toLowerCase().includes(buildingSearch.toLowerCase()))
  );

  const renderInstitutionErrorState = () => {
    const info = getInstitutionErrorInfo(institutionsError);

    const getIcon = () => {
      switch (info.code) {
        case 'SERVICE_UNREACHABLE':
          return <WifiOff className="w-5 h-5 text-amber-600 dark:text-amber-400 mx-auto" />;
        case 'RATE_LIMITED':
          return <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 mx-auto" />;
        case 'TIMEOUT':
          return <Hourglass className="w-5 h-5 text-amber-600 dark:text-amber-400 mx-auto" />;
        case 'OVERPASS_FAILURE':
          return <Globe className="w-5 h-5 text-rose-600 dark:text-rose-400 mx-auto" />;
        default:
          return <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 mx-auto" />;
      }
    };

    const isWarning =
      info.code === 'SERVICE_UNREACHABLE' ||
      info.code === 'RATE_LIMITED' ||
      info.code === 'TIMEOUT';

    const borderBg = isWarning
      ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60'
      : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60';
    const textTitle = isWarning
      ? 'text-amber-900 dark:text-amber-200'
      : 'text-rose-900 dark:text-rose-200';
    const textBody = isWarning
      ? 'text-amber-700 dark:text-amber-300'
      : 'text-rose-700 dark:text-rose-300';
    const textHint = isWarning
      ? 'text-amber-600/90 dark:text-amber-400/80'
      : 'text-rose-600/90 dark:text-rose-400/80';
    const btnColor = isWarning
      ? 'bg-amber-600 hover:bg-amber-700'
      : 'bg-rose-600 hover:bg-rose-700';

    return (
      <div className={`p-4 rounded-2xl border text-center space-y-2.5 ${borderBg}`}>
        {getIcon()}
        <div className="space-y-1">
          <h4 className={`text-xs font-bold ${textTitle}`}>{info.title}</h4>
          <p className={`text-[11px] leading-relaxed ${textBody}`}>{info.message}</p>
          {info.hint && (
            <p className={`text-[10px] leading-normal ${textHint}`}>{info.hint}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => refetchInstitutions()}
          className={`inline-flex items-center space-x-1.5 px-3 py-1.5 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer ${btnColor}`}
        >
          <RotateCcw className="w-3 h-3" />
          <span>Retry</span>
        </button>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Header & Search Controls */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-md shadow-teal-600/20">
              <Compass className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {t('campus:title')}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {t('campus:subtitle')}
              </p>
            </div>
          </div>
        </div>

        {/* Global Controls: Location Autocomplete & Campus Switcher */}
        <div className="w-full md:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Manual Place Search Input */}
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={placeSearchInput}
              onChange={(e) => setPlaceSearchInput(e.target.value)}
              onFocus={() => placeSuggestions.length > 0 && setShowSuggestions(true)}
              placeholder="Search city or area..."
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-teal-500"
            />
            {isSearchingPlace && (
              <span className="absolute right-3 top-2.5 text-xs text-slate-400 animate-pulse">...</span>
            )}

            {showSuggestions && placeSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700/60 overflow-hidden">
                {placeSuggestions.map((place, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectPlaceSuggestion(place)}
                    className="w-full px-4 py-2.5 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center space-x-2"
                  >
                    <MapPin className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    <span className="truncate">{place.display_name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick "Use My Location" Button */}
          <button
            type="button"
            onClick={handleUseMyLocation}
            title="Center on my real GPS location"
            className="inline-flex items-center space-x-1.5 px-3 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-xs focus:ring-2 focus:ring-teal-500 transition cursor-pointer shrink-0"
          >
            <Navigation className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span className="hidden sm:inline">My Location</span>
          </button>

          {/* Preset Campus Quick Selector */}
          <select
            value={selectedCampus.slug}
            onChange={(e) => handleSelectCampus(e.target.value)}
            aria-label="Preset campus selector"
            className="px-3 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-teal-500 cursor-pointer"
          >
            {campuses.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name} ({c.city})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative">
        {/* Map Column */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-3">
          <div className="bg-white dark:bg-slate-800 p-2 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden">
            <LeafletMap
              center={[searchCenter.lat, searchCenter.lng]}
              zoom={selectedRadius > 5000 ? 13 : selectedRadius > 2000 ? 14 : 15}
              markers={markers}
              circleCenter={[searchCenter.lat, searchCenter.lng]}
              circleRadiusMeters={selectedRadius}
              focusMarkerId={focusMarkerId}
              routeCoordinates={walkingRoute ? walkingRoute.coordinates : undefined}
              onMapMoveEnd={handleMapMoveEnd}
              height="580px"
            />

            {/* Floating "Search This Area" Button */}
            {showSearchAreaButton && (
              <div className="absolute top-5 left-1/2 -translate-x-1/2 z-10 animate-in fade-in slide-in-from-top-2 duration-200">
                <button
                  type="button"
                  onClick={handleSearchThisArea}
                  className="px-4 py-2 rounded-full bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-lg shadow-teal-600/30 flex items-center space-x-1.5 transition transform hover:scale-105 cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Search This Area</span>
                </button>
              </div>
            )}

            {/* Map Legend Overlay */}
            <div className="hidden sm:flex absolute bottom-5 left-5 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md items-center space-x-3 text-[11px] font-semibold">
              <span className="flex items-center">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-600 mr-1.5"></span>
                Search Centre
              </span>
              <span className="flex items-center">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 mr-1.5"></span>
                University
              </span>
              <span className="flex items-center">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 mr-1.5"></span>
                College
              </span>
              <span className="flex items-center">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-600 mr-1.5"></span>
                School
              </span>
            </div>

            {/* OpenStreetMap Attribution */}
            <div className="absolute bottom-2 right-2 z-10 text-[10px] text-slate-500 bg-white/80 dark:bg-slate-900/80 px-2 py-0.5 rounded backdrop-blur-xs">
              Data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">OpenStreetMap</a> contributors
            </div>
          </div>

          {/* Active Navigation Card */}
          {targetDestination && (
            <div className="bg-gradient-to-br from-teal-600 to-blue-700 p-5 rounded-2xl text-white shadow-lg space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full flex items-center space-x-1">
                  <Footprints className="w-3 h-3" />
                  <span>Walking Route Active</span>
                </span>
                <button
                  onClick={() => setTargetDestination(null)}
                  className="text-white/80 hover:text-white p-1"
                  aria-label="Cancel walking route"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <h3 className="text-base font-bold line-clamp-1">{targetDestination.title}</h3>
                <p className="text-xs text-teal-100 mt-0.5">
                  Route calculated from your current search centre to destination.
                </p>
              </div>

              {walkingRoute ? (
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/20 text-xs">
                  <div>
                    <span className="text-teal-200 block text-[10px] uppercase font-bold">Total Distance</span>
                    <span className="text-xl font-black">{walkingRoute.distanceMeters} m</span>
                  </div>
                  <div>
                    <span className="text-teal-200 block text-[10px] uppercase font-bold">Est. Walk Time</span>
                    <span className="text-xl font-black">
                      {Math.max(1, Math.round(walkingRoute.durationSeconds / 60))} mins
                    </span>
                  </div>
                </div>
              ) : isCalculatingRoute ? (
                <div className="flex items-center space-x-2 text-xs text-teal-100">
                  <LoadingSpinner size="sm" />
                  <span>Calculating optimal pedestrian route via OSRM...</span>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Desktop Sidebar Panel */}
        <div className="hidden lg:block lg:col-span-5 xl:col-span-4 space-y-4">
          {/* Tab Selector: Nearby Institutions vs Campus Buildings */}
          <div className="p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('institutions')}
              className={`py-2 px-3 rounded-xl transition flex items-center justify-center space-x-1.5 ${
                activeTab === 'institutions'
                  ? 'bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span>{t('campus:tabs.institutions')}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('buildings')}
              className={`py-2 px-3 rounded-xl transition flex items-center justify-center space-x-1.5 ${
                activeTab === 'buildings'
                  ? 'bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>{t('campus:tabs.directory')}</span>
            </button>
          </div>

          {activeTab === 'institutions' ? (
            /* NEARBY INSTITUTIONS PANEL */
            <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
              {/* Type Filter Chips */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Filter by Type
                </label>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Institution type filters">
                  {[
                    { id: 'all', label: t('campus:institutions.filter_all'), icon: GraduationCap },
                    { id: 'university', label: t('campus:institutions.filter_university'), icon: GraduationCap },
                    { id: 'college', label: t('campus:institutions.filter_college'), icon: School },
                    { id: 'school', label: t('campus:institutions.filter_school'), icon: Building },
                    { id: 'other', label: t('campus:institutions.filter_research'), icon: Layers },
                  ].map((tc) => (
                    <button
                      key={tc.id}
                      type="button"
                      onClick={() => setSelectedType(tc.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1 cursor-pointer ${
                        selectedType === tc.id
                          ? 'bg-teal-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      <tc.icon className="w-3 h-3" />
                      <span>{tc.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Radius Selector & Name Search */}
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-7 relative">
                  <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={institutionNameQuery}
                    onChange={(e) => setInstitutionNameQuery(e.target.value)}
                    placeholder="Filter by name..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="col-span-5">
                  <select
                    value={selectedRadius}
                    onChange={(e) => setSelectedRadius(parseInt(e.target.value, 10))}
                    aria-label="Search radius"
                    className="w-full py-1.5 px-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 cursor-pointer"
                  >
                    <option value={500}>Radius: 500 m</option>
                    <option value={1000}>Radius: 1 km</option>
                    <option value={2000}>Radius: 2 km</option>
                    <option value={5000}>Radius: 5 km</option>
                    <option value={10000}>Radius: 10 km</option>
                  </select>
                </div>
              </div>

              {/* Result Status Counter with aria-live */}
              <div
                aria-live="polite"
                className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between"
              >
                <span>
                  {isLoadingInstitutions
                    ? 'Querying OpenStreetMap...'
                    : `Found ${institutions.length} institutions within ${
                        selectedRadius < 1000 ? `${selectedRadius} m` : `${selectedRadius / 1000} km`
                      }${
                        institutionsData?.unnamedCount
                          ? ` (${institutionsData.unnamedCount} unnamed)`
                          : ''
                      }`}
                </span>
                <span className="text-[10px] text-teal-600 dark:text-teal-400 font-bold uppercase">
                  Nearest First
                </span>
              </div>

              {/* Institutions Result List */}
              <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100 dark:divide-slate-700/60">
                {isLoadingInstitutions ? (
                  <div className="py-12 flex justify-center">
                    <LoadingSpinner size="md" message="Scanning area for institutions..." />
                  </div>
                ) : isErrorInstitutions ? (
                  renderInstitutionErrorState()
                ) : institutions.length === 0 ? (
                  <div className="py-6 px-4 text-center space-y-3 text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
                    <School className="w-8 h-8 mx-auto text-slate-400 opacity-60" />
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        No institutions found within {selectedRadius < 1000 ? `${selectedRadius} m` : `${selectedRadius / 1000} km`}.
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Try expanding the search radius or clicking &quot;Use My Location&quot; below.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                      {selectedRadius < 10000 && (
                        <button
                          type="button"
                          onClick={() => setSelectedRadius((r) => Math.min(r * 2, 10000))}
                          className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center space-x-1"
                        >
                          <span>Expand to {selectedRadius < 2500 ? '5 km' : '10 km'}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleUseMyLocation}
                        className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer flex items-center space-x-1"
                      >
                        <Navigation className="w-3 h-3 text-teal-600" />
                        <span>Use My Location</span>
                      </button>
                    </div>

                    {/* Expandable Debug Aid: Why no results? */}
                    <details open className="mt-3 text-left border-t border-slate-200 dark:border-slate-700/60 pt-2.5 text-xs group" data-testid="why-no-results">
                      <summary className="font-semibold text-[11px] text-teal-600 dark:text-teal-400 cursor-pointer hover:underline flex items-center justify-between">
                        <span>Why no results? View query details</span>
                        <ChevronDown className="w-3.5 h-3.5 transition group-open:rotate-180" />
                      </summary>
                      <div className="mt-2 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300 font-mono">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Search Center:</span>
                          <span className="font-bold">{searchCenter.lat.toFixed(5)}, {searchCenter.lng.toFixed(5)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Search Radius:</span>
                          <span className="font-bold">{selectedRadius < 1000 ? `${selectedRadius} m` : `${selectedRadius / 1000} km`}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Category Filter:</span>
                          <span className="font-bold capitalize">{selectedType}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Data Sources:</span>
                          <span className="font-bold">OSM Overpass + Nominatim</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Raw Elements:</span>
                          <span className="font-bold">0 in radius</span>
                        </div>
                      </div>
                    </details>
                  </div>
                ) : (
                  institutions.map((inst) => (
                    <div
                      key={inst.id}
                      className="pt-2.5 first:pt-0 group hover:bg-slate-50 dark:hover:bg-slate-700/30 p-2 rounded-xl transition"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center space-x-1.5 mb-1">
                            <span
                              className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                inst.type === 'university'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                  : inst.type === 'college'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                                  : inst.type === 'school'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                  : 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300'
                              }`}
                            >
                              {inst.type}
                            </span>
                            {inst.source === 'nominatim' && (
                              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
                                Nominatim
                              </span>
                            )}
                            {inst.isUnnamed && (
                              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                                Unnamed
                              </span>
                            )}
                            <span className="text-[11px] font-semibold text-slate-400">
                              {formatDistance(inst.distance)}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => setFocusMarkerId(inst.id)}
                            className="text-xs font-bold text-slate-900 dark:text-white hover:text-teal-600 text-left line-clamp-1 cursor-pointer"
                          >
                            {inst.name}
                          </button>

                          {inst.address && (
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">{inst.address}</p>
                          )}
                        </div>

                        <div className="flex items-center space-x-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => setTargetDestination({ lat: inst.lat, lng: inst.lng, title: inst.name })}
                            title="Get walking directions"
                            aria-label={`Get walking directions to ${inst.name}`}
                            className="p-1.5 rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 dark:bg-teal-950 dark:text-teal-300 transition text-[11px] font-bold flex items-center cursor-pointer"
                          >
                            <Footprints className="w-3.5 h-3.5 mr-1" />
                            <span>Walk</span>
                          </button>

                          <Link
                            to={`/browse?location=${encodeURIComponent(inst.name)}`}
                            title="View lost and found reports here"
                            aria-label={`View lost and found reports at ${inst.name}`}
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            /* CAMPUS DIRECTORY & BUILDINGS PANEL */
            <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center">
                <Building2 className="w-4 h-4 mr-1.5 text-teal-600" />
                Campus Buildings & Landmarks
              </h3>

              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={buildingSearch}
                  onChange={(e) => setBuildingSearch(e.target.value)}
                  placeholder="Search building name or code..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="max-h-72 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100 dark:divide-slate-700/60">
                {filteredBuildings.map((b) => (
                  <div key={b.id} className="pt-2 first:pt-0 flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white hover:text-teal-600">
                        {b.name}
                      </h4>
                      <p className="text-[11px] text-slate-500 capitalize">
                        {b.code ? `${b.code} • ` : ''}
                        {b.category.replace('_', ' ')}
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedBuilding(b);
                        setTargetDestination({ lat: b.latitude, lng: b.longitude, title: b.name });
                      }}
                      className="p-1.5 rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 dark:bg-teal-950 dark:text-teal-300 transition flex items-center text-[10px] font-bold"
                    >
                      <Footprints className="w-3 h-3 mr-1" />
                      Walk
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Drawer (360px viewport support) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-800 rounded-t-3xl shadow-2xl border-t border-slate-200 dark:border-slate-700 overflow-hidden transition-all duration-300">
        <button
          type="button"
          onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
          className="w-full py-3 px-4 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200/60 dark:border-slate-700/60"
        >
          <div className="flex items-center space-x-2">
            <GraduationCap className="w-4 h-4 text-teal-600" />
            <span>Nearby Institutions ({institutions.length})</span>
          </div>
          {mobileDrawerOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>

        {mobileDrawerOpen && (
          <div className="p-4 space-y-3 max-h-[50vh] overflow-y-auto">
            <div className="flex gap-2">
              <select
                value={selectedRadius}
                onChange={(e) => setSelectedRadius(parseInt(e.target.value, 10))}
                className="py-1.5 px-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
              >
                <option value={500}>500 m</option>
                <option value={1000}>1 km</option>
                <option value={2000}>2 km</option>
                <option value={5000}>5 km</option>
                <option value={10000}>10 km</option>
              </select>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="py-1.5 px-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
              >
                <option value="all">All Types</option>
                <option value="university">Universities</option>
                <option value="college">Colleges</option>
                <option value="school">Schools</option>
              </select>
            </div>

            {isErrorInstitutions ? (
              renderInstitutionErrorState()
            ) : (
              <div className="space-y-2 divide-y divide-slate-100 dark:divide-slate-700/60">
                {institutions.slice(0, 8).map((inst) => (
                  <div key={inst.id} className="pt-2 flex items-center justify-between">
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{inst.name}</p>
                      <p className="text-[10px] text-slate-500">{formatDistance(inst.distance)}</p>
                    </div>
                    <button
                      onClick={() => {
                        setTargetDestination({ lat: inst.lat, lng: inst.lng, title: inst.name });
                        setMobileDrawerOpen(false);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-teal-600 text-white text-[10px] font-bold shrink-0"
                    >
                      Walk
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
