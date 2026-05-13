import imageCompression from 'browser-image-compression';

export const compressImage = async (file: File): Promise<File> => {
  const options = {
    maxSizeMB: 0.8, // Max size 800KB
    maxWidthOrHeight: 1920, // Max dimension 1920px
    useWebWorker: true,
    initialQuality: 0.8,
  };

  try {
    const compressedFile = await imageCompression(file, options);
    console.log(`Original size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Compressed size: ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`);
    return compressedFile;
  } catch (error) {
    console.error("Compression failed:", error);
    return file; // Fallback to original
  }
};

/**
 * Optimizes an existing image URL using wsrv.nl proxy.
 * This "compresses" existing images without re-hosting.
 */
export const getOptimizedImageUrl = (url: string, width: number = 800, quality: number = 75): string => {
  if (!url) return '';
  if (url.includes('placehold.co') || url.includes('localhost') || url.includes('127.0.0.1')) return url;
  
  // Use wsrv.nl (images.weserv.nl) for image resizing and compression
  // We trim protocol as wsrv.nl doesn't strictly need it in the 'url' param if we use the proxy format
  const cleanUrl = url.replace('https://', '').replace('http://', '');
  return `https://wsrv.nl/?url=${encodeURIComponent(cleanUrl)}&w=${width}&q=${quality}&output=webp`;
};

export const getThumbnailUrl = (url: string): string => {
  return getOptimizedImageUrl(url, 400, 60);
};
