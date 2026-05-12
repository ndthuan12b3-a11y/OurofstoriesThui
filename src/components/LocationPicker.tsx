import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import { Icon, LeafletMouseEvent } from 'leaflet';
import { Search, MapPin, X, Navigation } from 'lucide-react';
import { showNotification } from '../lib/notifications';
import { reverseGeocode, searchGeocode } from '../lib/geocoding';

// Fix for default Leaflet icon inclusion
const defaultIcon = new Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

interface Location {
  lat: number;
  lng: number;
  address_name: string;
}

interface LocationPickerProps {
  value: Location | null;
  onChange: (location: Location | null) => void;
}

const ChangeView = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, 15, {
      duration: 1.5
    });
  }, [center, map]);
  return null;
};

export const LocationPicker: React.FC<LocationPickerProps> = ({ value, onChange }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number]>(() => {
    if (value && !isNaN(Number(value.lat)) && !isNaN(Number(value.lng))) {
      return [Number(value.lat), Number(value.lng)];
    }
    return [10.762622, 106.660172]; // Default to Saigon
  });

  const MapEvents = () => {
    useMapEvents({
      click(e: LeafletMouseEvent) {
        const { lat, lng } = e.latlng;
        // Reverse geocode with wrapper
        reverseGeocode(lat, lng)
          .then(address => {
            onChange({ lat, lng, address_name: address });
            setMapCenter([lat, lng]);
          });
      },
    });
    return null;
  };

  useEffect(() => {
    // Automatically detect current location on start if no custom value is provided
    if (!value && !isSearching) {
      handleCurrentLocation();
    }
  }, []);

  const handleSearch = React.useCallback(async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const data = await searchGeocode(searchQuery, { lat: mapCenter[0], lng: mapCenter[1] });
      setSearchResults(data);

      if (data && data.length > 0) {
        const first = data[0];
        const lat = parseFloat(first.lat);
        const lng = parseFloat(first.lon);
        
        if (!isNaN(lat) && !isNaN(lng)) {
          setMapCenter([lat, lng]);
          onChange({ lat, lng, address_name: first.display_name });
        }
      } else {
        showNotification("Không tìm thấy địa điểm này.", true);
      }
    } catch (error) {
      console.error('Search error:', error);
      showNotification("Lỗi khi tìm kiếm địa điểm!", true);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, mapCenter, onChange]);

  const handleCurrentLocation = React.useCallback(() => {
    if (!navigator.geolocation) {
      showNotification("Trình duyệt không hỗ trợ định vị!", true);
      return;
    }

    setIsSearching(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setMapCenter([latitude, longitude]);
        
        reverseGeocode(latitude, longitude)
          .then(address => {
            onChange({ lat: latitude, lng: longitude, address_name: address });
          })
          .finally(() => {
            setIsSearching(false);
          });
      },
      (error) => {
        console.error("Geolocation error:", error);
        let message = "Không thể lấy vị trí hiện tại.";
        if (error.code === error.PERMISSION_DENIED) {
          message = "Vui lòng cho phép truy cập vị trí trong cài đặt trình duyệt.";
        } else if (error.code === error.TIMEOUT) {
          message = "Yêu cầu định vị quá hạn.";
        }
        showNotification(message, true);
        setIsSearching(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [onChange]);

  const selectResult = React.useCallback((result: any) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    if (!isNaN(lat) && !isNaN(lng)) {
      onChange({ lat, lng, address_name: result.display_name });
      setMapCenter([lat, lng]);
      setSearchResults([]);
      setSearchQuery('');
    }
  }, [onChange]);

  return (
    <div className="space-y-3">
      <div className="relative group">
        <div className="flex gap-2">
          <div className="relative flex-grow">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSearch())}
              placeholder="Tìm địa điểm (ví dụ: Đà Lạt)..."
              className="w-full p-3 bg-white/50 border border-white/20 rounded-xl outline-none focus:border-primary/50 text-sm"
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleSearch}
            className="p-3 bg-gray-900 text-white rounded-xl hover:bg-primary transition-colors"
          >
            <Search size={18} />
          </button>
          <button
            type="button"
            onClick={handleCurrentLocation}
            className="p-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors"
            title="Lấy vị trí hiện tại"
          >
            <Navigation size={18} />
          </button>
        </div>

        {searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-50 bg-white border border-gray-100 shadow-xl rounded-xl mt-2 max-h-60 overflow-y-auto">
            {searchResults.map((res, i) => (
              <button
                key={i}
                type="button"
                onClick={() => selectResult(res)}
                className="w-full text-left p-3 hover:bg-gray-50 border-b last:border-0 border-gray-50 text-xs"
              >
                <p className="font-bold text-gray-800 line-clamp-1">{res.display_name}</p>
                <p className="text-gray-400">{res.type} • {res.lat}, {res.lon}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative h-48 sm:h-60 rounded-2xl overflow-hidden border border-white/40 shadow-inner">
        <MapContainer
          center={mapCenter}
          zoom={13}
          preferCanvas={true}
          style={{ height: '100%', width: '100%' }}
        >
          <ChangeView center={mapCenter} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {value && !isNaN(Number(value.lat)) && !isNaN(Number(value.lng)) && (
            <Marker position={[Number(value.lat), Number(value.lng)]} icon={defaultIcon} />
          )}
          <MapEvents />
        </MapContainer>
        
        {!value && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center bg-black/5">
            <div className="bg-white/90 px-3 py-1.5 rounded-full shadow-lg text-[10px] font-black uppercase tracking-widest text-gray-500">
              Click lên bản đồ để chọn
            </div>
          </div>
        )}
      </div>

      {value && (
        <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-xl border border-primary/10">
          <MapPin size={16} className="text-primary shrink-0 mt-0.5" />
          <div className="flex-grow min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-primary leading-none mb-1">Địa điểm đã chọn</p>
            <p className="text-xs font-bold text-gray-700 line-clamp-2">{value.address_name}</p>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="p-1 hover:bg-primary/10 rounded-lg text-gray-400 hover:text-primary transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
};
