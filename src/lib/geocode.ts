import { supabase } from '@/lib/supabase';

export interface GeocodeResult {
  lat: number;
  lon: number;
  displayName: string;
}

/**
 * Looks up a US address through /api/geocode (server-side Census geocoder, then
 * Nominatim). Returns null when the address can't be found.
 */
export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  const q = query.trim();
  if (!q) return null;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, {
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data?.lat !== 'number' || typeof data?.lon !== 'number') return null;
    return { lat: data.lat, lon: data.lon, displayName: data.displayName ?? q };
  } catch {
    return null;
  }
}
