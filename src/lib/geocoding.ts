import axios from 'axios';

export interface NominatimAddress {
  road?: string;
  suburb?: string;
  neighbourhood?: string;
  village?: string;
  town?: string;
  city?: string;
  state?: string;
  country?: string;
  amenity?: string;
  shop?: string;
  tourism?: string;
  leisure?: string;
  building?: string;
  house_number?: string;
  office?: string;
  apartment?: string;
  flat?: string;
  street_number?: string;
  unit?: string;
  room?: string;
  pedestrian?: string;
  path?: string;
  street?: string;
  lane?: string;
  city_district?: string;
}

interface NominatimResponse {
  address: NominatimAddress;
  display_name: string;
}

export const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
  if (!lat || !lng) return "";

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=vi&email=AlanwalkerT2002@gmail.com`;
    
    // Add 10s timeout to fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    
    const data = await response.json() as NominatimResponse;
    let result = "";

    if (data && data.address) {
      const addr = data.address;
      
      // Tên địa danh (cafe, nhà hàng, công ty...)
      const placeName = addr.amenity || addr.shop || addr.tourism || addr.leisure || addr.building;
      
      // Số nhà/Số tầng
      const house = addr.house_number || addr.street_number || addr.office || addr.apartment || addr.flat || addr.unit || addr.room;
      
      // Đường phố
      const street = addr.road || addr.pedestrian || addr.path || addr.street || addr.lane;
      
      const parts: string[] = [];
      
      if (house && street) {
        const formattedHouse = /^\d/.test(house) && !house.toLowerCase().includes('số') ? `Số ${house}` : house;
        const formattedStreet = !street.toLowerCase().includes('đường') && !street.toLowerCase().includes('phố') ? `đường ${street}` : street;
        parts.push(`${formattedHouse}, ${formattedStreet}`);
      } else if (street) {
        const formattedStreet = !street.toLowerCase().includes('đường') && !street.toLowerCase().includes('phố') ? `Đường ${street}` : street;
        parts.push(formattedStreet);
      } else if (house) {
        const formattedHouse = /^\d/.test(house) && !house.toLowerCase().includes('số') ? `Số ${house}` : house;
        parts.push(formattedHouse);
      } else {
        // Tên địa danh (cafe, nhà hàng, công ty...) nếu không có số nhà/đường
        const placeName = addr.amenity || addr.shop || addr.tourism || addr.leisure || addr.building;
        if (placeName) parts.push(placeName);
      }
      
      const area = addr.suburb || addr.city_district || addr.village || addr.town;
      
      if (parts.length === 0 && area) {
        parts.push(area);
      }
      
      if (parts.length > 0) {
        result = parts.join(', ');
      } else {
        const fallback = data.display_name ? data.display_name.split(',').slice(0, 1).map((s: string) => s.trim()).join(', ') : "";
        result = fallback || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      }
    }
    
    return result || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch (error) {
    console.error("Geocoding error:", error);
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
};
