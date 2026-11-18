import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
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
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { CampusPlace, CampusBuilding, Item } from '@/types';
import { LeafletMap, MapMarker } from '@/components/common/LeafletMap';
import { getWalkingDirections } from '@/services/routing';
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

export const CampusPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const campusSlug = searchParams.get('place') || 'stanford-university';

  const [campuses, setCampuses] = useState<CampusPlace[]>(FALLBACK_CAMPUSES);
  const [selectedCampus, setSelectedCampus] = useState<CampusPlace>(FALLBACK_CAMPUSES[0]);
  const [buildings, setBuildings] = useState<CampusBuilding[]>([]);
  const [buildingSearch, setBuildingSearch] = useState('');
  const [campusItems, setCampusItems] = useState<Item[]>([]);

  // Navigation / Walking directions state
  const [userStartLocation, setUserStartLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [targetDestination, setTargetDestination] = useState<{ lat: number; lng: number; title: string } | null>(null);
  const [walkingRoute, setWalkingRoute] = useState<any | null>(null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);

  // Selected building details
  const [selectedBuilding, setSelectedBuilding] = useState<CampusBuilding | null>(null);

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

  // Update selected campus from slug
  useEffect(() => {
    const found = campuses.find((c) => c.slug === campusSlug) || campuses[0];
    setSelectedCampus(found);

    // Default user start location near center of campus
    setUserStartLocation({
      lat: found.latitude - 0.002,
      lng: found.longitude - 0.002,
    });
  }, [campusSlug, campuses]);

  // Load buildings and campus items
  useEffect(() => {
    if (!selectedCampus) return;

    if (isSupabaseConfigured && supabase) {
      // Fetch buildings
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

      // Fetch items near campus or tagged with campus_place_id
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
    if (!userStartLocation || !targetDestination) {
      setWalkingRoute(null);
      return;
    }

    const compute = async () => {
      setIsCalculatingRoute(true);
      try {
        const route = await getWalkingDirections(
          userStartLocation.lat,
          userStartLocation.lng,
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
  }, [userStartLocation, targetDestination]);

  const handleSelectCampus = (slug: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('place', slug);
    setSearchParams(next);
    setTargetDestination(null);
    setSelectedBuilding(null);
  };

  const handleManualLocationClick = (lat: number, lng: number) => {
    setUserStartLocation({ lat, lng });
  };

  // Compile markers
  const markers: MapMarker[] = [];

  // User starting point marker
  if (userStartLocation) {
    markers.push({
      id: 'my-loc',
      lat: userStartLocation.lat,
      lng: userStartLocation.lng,
      title: 'Your Starting Location (Click anywhere on map to move)',
      type: 'user',
    });
  }

  // Campus building markers
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

  // Items on campus markers
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

  const filteredBuildings = buildings.filter((b) =>
    b.name.toLowerCase().includes(buildingSearch.toLowerCase()) ||
    (b.code && b.code.toLowerCase().includes(buildingSearch.toLowerCase()))
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header & Campus Selector */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center">
              <Compass className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">
              Campus Navigation Mode
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Locate lost belongings on campus and calculate walking routes to buildings and find locations.
          </p>
        </div>

        {/* Campus Dropdown */}
        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Campus:</span>
          <select
            value={selectedCampus.slug}
            onChange={(e) => handleSelectCampus(e.target.value)}
            className="px-3 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-teal-500"
          >
            {campuses.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name} ({c.city})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Grid: Interactive Map + Building / Route Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Map Column */}
        <div className="lg:col-span-8 space-y-3">
          <div className="bg-white dark:bg-slate-800 p-2 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm relative">
            <LeafletMap
              center={[selectedCampus.latitude, selectedCampus.longitude]}
              zoom={selectedCampus.zoom_level || 16}
              markers={markers}
              routeCoordinates={walkingRoute ? walkingRoute.coordinates : undefined}
              onLocationSelect={handleManualLocationClick}
              height="540px"
            />

            {/* Map Legend Overlay */}
            <div className="absolute bottom-5 left-5 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md flex items-center space-x-4 text-[11px] font-semibold">
              <span className="flex items-center">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-600 mr-1.5"></span>
                My Location
              </span>
              <span className="flex items-center">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-600 mr-1.5"></span>
                Buildings
              </span>
              <span className="flex items-center">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-600 mr-1.5"></span>
                Found Items
              </span>
              <span className="flex items-center">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-600 mr-1.5"></span>
                Lost Items
              </span>
            </div>
          </div>

          {/* Fallback routing banner */}
          {walkingRoute?.isFallback && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl text-xs text-blue-800 dark:text-blue-300 flex items-center">
              <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
              <span>
                Walking path calculated via compass bearing and straight-line guidance (OSRM routing service currently busy or offline).
              </span>
            </div>
          )}
        </div>

        {/* Sidebar: Navigation, Building Search, Directions */}
        <div className="lg:col-span-4 space-y-5">
          {/* Active Navigation Card */}
          {targetDestination && (
            <div className="bg-gradient-to-br from-teal-600 to-blue-700 p-5 rounded-2xl text-white shadow-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full">
                  Walking Directions Active
                </span>
                <button
                  onClick={() => setTargetDestination(null)}
                  className="text-white/80 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <h3 className="text-base font-bold line-clamp-1">{targetDestination.title}</h3>
                <p className="text-xs text-teal-100 mt-0.5">
                  Click anywhere on the map to change your start point
                </p>
              </div>

              {walkingRoute && (
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/20 text-xs">
                  <div>
                    <span className="text-teal-200 block text-[10px] uppercase font-bold">Distance</span>
                    <span className="text-lg font-black">{walkingRoute.distanceMeters} m</span>
                  </div>
                  <div>
                    <span className="text-teal-200 block text-[10px] uppercase font-bold">Est. Walking Time</span>
                    <span className="text-lg font-black">
                      {Math.max(1, Math.round(walkingRoute.durationSeconds / 60))} mins
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Building Search & Directory */}
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
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
                <div
                  key={b.id}
                  className="pt-2 first:pt-0 flex items-start justify-between gap-2"
                >
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white hover:text-teal-600">
                      {b.name}
                    </h4>
                    <p className="text-[11px] text-slate-500 capitalize">
                      {b.code ? `${b.code} • ` : ''}{b.category.replace('_', ' ')}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedBuilding(b);
                      setTargetDestination({ lat: b.latitude, lng: b.longitude, title: b.name });
                    }}
                    className="p-1.5 rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 dark:bg-teal-950 dark:text-teal-300 transition flex items-center text-[10px] font-bold"
                    title="Get walking directions"
                  >
                    <Footprints className="w-3 h-3 mr-1" />
                    Walk
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Campus Lost & Found Items Quick List */}
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center">
              <Package className="w-4 h-4 mr-1.5 text-blue-600" />
              Items on this Campus ({campusItems.length})
            </h3>

            {campusItems.length === 0 ? (
              <p className="text-xs text-slate-400">No items currently reported on this campus.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {campusItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/60 flex items-center justify-between hover:border-teal-400 transition"
                  >
                    <div className="min-w-0 pr-2">
                      <span
                        className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          item.type === 'lost' ? 'bg-rose-100 text-rose-800' : 'bg-teal-100 text-teal-800'
                        }`}
                      >
                        {item.type}
                      </span>
                      <h4 className="text-xs font-semibold text-slate-900 dark:text-white truncate mt-1">
                        {item.title}
                      </h4>
                    </div>

                    <div className="flex items-center space-x-1 flex-shrink-0">
                      {item.latitude && item.longitude && (
                        <button
                          onClick={() => {
                            setTargetDestination({
                              lat: item.latitude!,
                              lng: item.longitude!,
                              title: `${item.type.toUpperCase()}: ${item.title}`,
                            });
                          }}
                          className="p-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold"
                          title="Get directions to item location"
                        >
                          <Footprints className="w-3 h-3" />
                        </button>
                      )}
                      <Link
                        to={`/items/${item.id}`}
                        className="p-1 rounded-md text-blue-600 hover:bg-blue-50"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
