import React, { useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Icon, divIcon } from 'leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Calendar, BookOpen, X, Maximize2, Minimize2, Navigation as NavIcon } from 'lucide-react';
import { AppConfig, Database } from '../types';
import { getOptimizedImageUrl } from '../lib/imageUtils';

type Event = Database['public']['Tables']['events']['Row'];

// Regular marker icon
const defaultIcon = new Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

// Custom marker with image
const createCustomIcon = (imageUrl: string) => {
  return divIcon({
    className: 'custom-marker',
    html: `
      <div class="relative w-10 h-10 group">
        <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-4 bg-white rotate-45 border-r border-b border-gray-100"></div>
        <div class="w-full h-full rounded-2xl border-4 border-white shadow-lg overflow-hidden group-hover:scale-110 transition-transform bg-rose-50">
          <img src="${imageUrl}" class="w-full h-full object-cover" />
        </div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 40]
  });
};

interface StoryMapProps {
  events: Event[];
  config: AppConfig;
}

const ZoomControl = () => {
  const map = useMap();
  return (
    <div className="absolute bottom-10 right-6 z-[1000] flex flex-col gap-2">
      <button 
        onClick={() => map.zoomIn()}
        className="w-10 h-10 bg-white shadow-xl rounded-2xl flex items-center justify-center text-gray-800 hover:bg-gray-50 active:scale-95 transition-all"
      >
        <Plus size={20} />
      </button>
      <button 
        onClick={() => map.zoomOut()}
        className="w-10 h-10 bg-white shadow-xl rounded-2xl flex items-center justify-center text-gray-800 hover:bg-gray-50 active:scale-95 transition-all"
      >
        <Minus size={20} />
      </button>
    </div>
  );
};

export const StoryMap: React.FC<StoryMapProps> = ({ events, config }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Event | null>(null);

  // Filter items that have location
  const mapItems = useMemo(() => {
    return events.filter(e => e.location && typeof e.location.lat === 'number');
  }, [events]);

  return (
    <div className={`relative transition-all duration-500 overflow-hidden ${isFullscreen ? 'fixed inset-0 z-[100] h-screen w-screen' : 'h-[600px] rounded-[3rem] shadow-2xl border border-white/50 bg-white/40 backdrop-blur-xl'}`}>
      
      {/* HUD Controls */}
      <div className="absolute top-6 left-6 right-6 z-[1000] flex items-center justify-between pointer-events-none">
        <div className="bg-white/70 backdrop-blur-md px-5 py-3 rounded-3xl border border-white/50 shadow-lg pointer-events-auto flex items-center gap-3">
          <div className="w-10 h-10 bg-rose-400/10 rounded-2xl flex items-center justify-center text-rose-400">
            <NavIcon size={20} />
          </div>
          <div>
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Story Map</h3>
            <p className="text-xs font-bold text-gray-800 leading-none">{mapItems.length} kỷ niệm trên bản đồ</p>
          </div>
        </div>

        <div className="flex gap-2 pointer-events-auto">
          <button 
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-4 bg-white/70 backdrop-blur-md text-gray-800 rounded-3xl border border-white/50 shadow-lg hover:scale-110 active:scale-95 transition-all"
          >
            {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>
          {isFullscreen && (
            <button 
              onClick={() => setIsFullscreen(false)}
              className="p-4 bg-rose-400/10 backdrop-blur-md text-rose-500 rounded-3xl border border-rose-100 shadow-lg hover:scale-110 active:scale-95 transition-all"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      <MapContainer
        center={[10.762622, 106.660172]}
        zoom={6}
        style={{ height: '100%', width: '100%', zIndex: 0 }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MarkerClusterGroup
          chunkedLoading
          maxClusterRadius={50}
        >
          {mapItems.map((item) => (
            <Marker 
              key={item.id} 
              position={[item.location!.lat, item.location!.lng]}
              icon={createCustomIcon(getOptimizedImageUrl(item.photo_url, 100))}
              eventHandlers={{
                click: () => setSelectedItem(item)
              }}
            >
              <Popup className="custom-popup">
                <div className="w-48 overflow-hidden rounded-2xl">
                  <img 
                    src={getOptimizedImageUrl(item.photo_url, 400)} 
                    alt={item.title}
                    className="w-full h-32 object-cover"
                  />
                  <div className="p-3">
                    <p className="text-[8px] font-black text-rose-400 uppercase tracking-widest leading-none mb-1">
                      {new Date(item.date).toLocaleDateString('vi-VN')}
                    </p>
                    <h4 className="text-xs font-black text-gray-800 line-clamp-1 mb-1 uppercase tracking-tight">{item.title}</h4>
                    <p className="text-[10px] text-gray-500 line-clamp-2 leading-tight">{(item.location as any)?.address_name || item.description}</p>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      </MapContainer>

      {/* Legend / Info */}
      {!isFullscreen && (
        <div className="absolute bottom-6 left-6 z-[1000] max-w-[200px]">
          <p className="text-[8px] font-bold text-gray-400 bg-white/50 backdrop-blur-sm px-3 py-1.5 rounded-full inline-block">
            Sử dụng OpenStreetMap & Leaflet
          </p>
        </div>
      )}
    </div>
  );
};

// Internal Plus/Minus icons for ZoomControl
const Plus = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const Minus = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
