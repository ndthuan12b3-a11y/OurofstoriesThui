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

export const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const response = await fetch(url, {
      headers: {
        'Accept-Language': 'vi,en-US;q=0.9,en;q=0.8',
        'User-Agent': 'ThuiHouseApp/1.0'
      }
    });
    
    if (!response.ok) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    
    const data: NominatimResponse = await response.json();
    
    if (data) {
      if (data.address) {
        return data.address.road || 
               data.address.suburb || 
               data.address.city || 
               data.address.state || 
               (data.display_name ? data.display_name.split(',')[0] : `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      }
      return data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch (error) {
    console.warn("Geocoding fallback used:", error);
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
};

export const searchGeocode = async (query: string, bias?: { lat: number, lng: number }): Promise<any[]> => {
  try {
    let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=10`;
    if (bias) {
      const b = 1.0; 
      const viewbox = `${bias.lng - b},${bias.lat + b},${bias.lng + b},${bias.lat - b}`;
      url += `&viewbox=${viewbox}`;
    }
    
    const response = await fetch(url, {
      headers: {
        'Accept-Language': 'vi,en-US;q=0.9,en;q=0.8',
        'User-Agent': 'ThuiHouseApp/1.0'
      }
    });

    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    console.error("Search geocode failed:", error);
    return [];
  }
};
