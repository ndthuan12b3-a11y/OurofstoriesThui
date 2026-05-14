import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import { MapPin, Search, Compass, X } from 'lucide-react';
import { reverseGeocode } from '../lib/geocoding';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet icon issue
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

interface Location {
  lat: number;
  lng: number;
  address_name: string;
}

interface LocationPickerProps {
  value: Location | null;
  onChange: (location: Location) => void;
}

const MapEvents = ({ onLocationSelect }: { onLocationSelect: (lat: number, lng: number) => void }) => {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

const ChangeView = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, 15, {
      duration: 2.8,
      easeLinearity: 0.25
    });
    // Force recalculate size for visibility in modal
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    return () => clearTimeout(timer);
  }, [center, map]);
  return null;
};

export const LocationPicker: React.FC<LocationPickerProps> = ({ value, onChange }) => {
  const [showMap, setShowMap] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mapCenter, setMapCenter] = useState<[number, number]>(value ? [value.lat, value.lng] : [10.762622, 106.660172]); // Default center (HCMC)

  useEffect(() => {
    if (value) {
      setMapCenter([value.lat, value.lng]);
    }
  }, [value]);

  const handleSelectLocation = async (lat: number, lng: number) => {
    setLoading(true);
    const address = await reverseGeocode(lat, lng);
    onChange({ lat, lng, address_name: address });
    setLoading(false);
  };

  const getCurrentLocation = () => {
    if ("geolocation" in navigator) {
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          setMapCenter([latitude, longitude]);
          const address = await reverseGeocode(latitude, longitude);
          onChange({ lat: latitude, lng: longitude, address_name: address });
          setLoading(false);
        },
        (error) => {
          console.error("Error getting location:", error);
          setLoading(false);
        }
      );
    }
  };

  const handleSearch = async (e?: React.FormEvent | React.KeyboardEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1&accept-language=vi`);
      const data = await response.json();
      if (data && data.length > 0) {
        const { lat, lon, display_name } = data[0];
        const latitude = parseFloat(lat);
        const longitude = parseFloat(lon);
        setMapCenter([latitude, longitude]);
        onChange({ lat: latitude, lng: longitude, address_name: display_name });
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div 
        onClick={() => setShowMap(!showMap)}
        className="flex items-center gap-3 p-4 bg-white/50 border border-white/20 rounded-2xl cursor-pointer hover:bg-white/70 transition-all shadow-sm"
      >
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          <MapPin size={20} />
        </div>
        <div className="flex-grow min-w-0">
          <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">Vị trí kỉ niệm</p>
          <p className="text-[13px] font-bold text-gray-700 truncate">
            {value ? value.address_name : "Chưa chọn vị trí (Nhấn để mở bản đồ)"}
          </p>
        </div>
      </div>

      {showMap && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowMap(false)} />
          
          <div className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col h-[80vh] animate-scaleIn">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-gray-900 tracking-tight">Chọn vị trí</h3>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Ghim kỉ niệm của bạn tại đây</p>
              </div>
              <button 
                onClick={() => setShowMap(false)}
                className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 bg-gray-50 flex gap-2">
              <div className="flex-grow relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSearch(e);
                    }
                  }}
                  placeholder="Tìm kiếm địa điểm..."
                  className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:border-primary outline-none transition-all shadow-sm"
                />
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
              <button 
                onClick={getCurrentLocation}
                className="w-12 h-12 bg-white border border-gray-200 rounded-xl flex items-center justify-center text-primary shadow-sm hover:bg-gray-50 transition-colors"
                title="Vị trí hiện tại"
              >
                <Compass size={20} />
              </button>
            </div>

            <div className="flex-grow relative bg-slate-900">
              <MapContainer 
                center={mapCenter} 
                zoom={13} 
                className="w-full h-full"
                style={{ background: '#0f172a' }}
              >
                <TileLayer
                  attribution='&copy; Google'
                  url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                  maxZoom={20}
                />
                <ChangeView center={mapCenter} />
                <MapEvents onLocationSelect={handleSelectLocation} />
                {value && <Marker position={[value.lat, value.lng]} />}
              </MapContainer>

              {loading && (
                <div className="absolute inset-0 z-[1000] bg-white/50 backdrop-blur-[2px] flex items-center justify-center">
                  <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            <div className="p-6 bg-white border-t border-gray-100">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-primary">
                  <MapPin size={20} />
                </div>
                <div className="min-w-0 flex-grow">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Địa chỉ đã chọn</p>
                  <p className="text-[13px] font-bold text-gray-700 truncate">
                    {value ? value.address_name : "Vui lòng chọn một điểm trên bản đồ"}
                  </p>
                </div>
              </div>
              <button 
                disabled={!value || loading}
                onClick={() => setShowMap(false)}
                className="w-full py-4 bg-primary text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100"
              >
                Xác nhận vị trí
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
