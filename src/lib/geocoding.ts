interface NominatimAddress {
  road?: string;
  suburb?: string;
  city?: string;
  state?: string;
  country?: string;
}

interface NominatimResponse {
  address?: NominatimAddress;
  display_name?: string;
  lat?: string;
  lon?: string;
}

const GEO_CACHE_KEY = 'geocoding_cache_v1';
const getCache = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(GEO_CACHE_KEY) || '{}');
  } catch { return {}; }
};

const saveToCache = (key: string, val: string) => {
  try {
    const cache = getCache();
    cache[key] = val;
    const keys = Object.keys(cache);
    if (keys.length > 100) delete cache[keys[0]];
    localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(cache));
  } catch {}
};

export const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = getCache()[cacheKey];
  if (cached) return cached;

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=vi&email=AlanwalkerT2002@gmail.com`;
    const response = await fetch(url);
    
    if (!response.ok) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    
    const data: NominatimResponse = await response.json();
    let result = "";

    if (data && data.address) {
      const addr = data.address as any;
      // Mở rộng các trường tiềm năng chứa số nhà/tên toà nhà
      const house = addr.house_number || addr.building || addr.house_name || addr.office || addr.apartment || addr.flat || addr.street_number;
      const street = addr.road || addr.pedestrian || addr.path || addr.street || addr.lane;
      const area = addr.suburb || addr.neighbourhood || addr.village || addr.city_district || addr.quarter || addr.hamlet;
      
      const components = [];
      if (house) {
        // Thêm "Số " nếu nhà bắt đầu bằng số và chưa có chữ "Số"
        const formattedHouse = /^\d/.test(house) && !house.toLowerCase().includes('số') ? `Số ${house}` : house;
        components.push(formattedHouse);
      }
      if (street) components.push(street);
      if (components.length < 2 && area) components.push(area);
      
      if (components.length > 0) {
        result = components.join(", ");
      } else {
        const fallback = data.display_name ? data.display_name.split(',').slice(0, 2).map((s: string) => s.trim()).join(', ') : "";
        result = fallback || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      }
    } else {
      result = data?.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }

    if (result) saveToCache(cacheKey, result);
    return result;
  } catch (error) {
    console.warn("Geocoding fallback used:", error);
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
};

export const searchGeocode = async (query: string, bias?: { lat: number, lng: number }): Promise<any[]> => {
  try {
    let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=10&accept-language=vi&email=AlanwalkerT2002@gmail.com`;
    if (bias) {
      const b = 1.0; 
      const viewbox = `${bias.lng - b},${bias.lat + b},${bias.lng + b},${bias.lat - b}`;
      url += `&viewbox=${viewbox}`;
    }
    
    const response = await fetch(url);

    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    console.warn("Search geocode failed:", error);
    return [];
  }
};
