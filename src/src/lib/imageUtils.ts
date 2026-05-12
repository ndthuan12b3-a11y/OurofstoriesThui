import { supabase } from './supabase';

/**
 * Optimizes Supabase storage URLs using transformation parameters.
 * Note: Requires Supabase Pro plan for transformation.
 * Since most users are on the Free plan, we return the original URL to avoid breakage.
 */
export const getOptimizedImageUrl = (url: string, width = 800, quality = 80) => {
  if (!url) return '';
  // Returning original URL as many Supabase projects are on the Free tier 
  // which doesn't support query-param based image transformation.
  return url;
};

/**
 * Helper to get a small thumbnail version of an image
 */
export const getThumbnailUrl = (url: string) => getOptimizedImageUrl(url, 200, 60);
