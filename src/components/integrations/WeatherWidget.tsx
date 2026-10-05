import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { OpenWeatherIntegration } from '@/lib/integrations/weather';
import { supabase } from '@/lib/supabase';
import { toLocalDateString } from '@/lib/dates';

interface WeatherWidgetProps {
  address: string;
  companyId: string;
}

// ── helpers ──────────────────────────────────────────────────────────────────

/** Extract a "City, State" string suitable for the OWM city query */
function parseCityState(address: string): string {
  // address may be: "123 Main St, Denver, CO 80202" or just "Denver, CO"
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) {
    // "Street, City, State ZIP" → "City, State"
    const city = parts[1];
    const stateZip = parts[2];
    const state = stateZip.split(' ')[0];
    return `${city},${state},US`;
  }
  if (parts.length === 2) {
    // "City, State" already
    return `${parts[0]},${parts[1]},US`;
  }
  return parts[0];
}

/** Map OWM condition id → weather emoji */
function weatherEmoji(id: number, icon: string): string {
  const day = icon.endsWith('d');
  if (id >= 200 && id < 300) return '⛈️';
  if (id >= 300 && id < 400) return '🌦️';
  if (id >= 500 && id < 510) return '🌧️';
  if (id === 511) return '🌨️';
  if (id >= 511 && id < 600) return '🌧️';
  if (id >= 600 && id < 700) return '❄️';
  if (id >= 700 && id < 800) return '🌫️';
  if (id === 800) return day ? '☀️' : '🌙';
  if (id === 801) return day ? '🌤️' : '🌙';
  if (id === 802) return '⛅';
  if (id >= 803) return '☁️';
  return '🌡️';
}

/** Convert OWM 3-hour forecast list → one entry per day (noon slot preferred) */
function groupForecastByDay(list: any[]): { date: string; high: number; low: number; id: number; icon: string; desc: string }[] {
  const byDay: Record<string, any[]> = {};
  for (const item of list) {
    const day = item.dt_txt?.slice(0, 10);
    if (!day) continue;
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(item);
  }

  const today = toLocalDateString();
  return Object.entries(byDay)
    .filter(([day]) => day > today)          // skip today — shown in current block
    .slice(0, 3)
    .map(([day, items]) => {
      const noonSlot = items.find((i) => i.dt_txt?.includes('12:00')) ?? items[Math.floor(items.length / 2)];
      const high = Math.max(...items.map((i) => i.main.temp_max ?? i.main.temp));
      const low = Math.min(...items.map((i) => i.main.temp_min ?? i.main.temp));
      return {
        date: day,
        high: Math.round(high),
        low: Math.round(low),
        id: noonSlot.weather[0].id,
        icon: noonSlot.weather[0].icon,
        desc: noonSlot.weather[0].description,
      };
    });
}

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

// ── data fetchers (used with useQuery) ───────────────────────────────────────

async function fetchCredentials(companyId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('company_integrations')
    .select('credentials')
    .eq('company_id', companyId)
    .eq('integration_type', 'openweather')
    .eq('is_active', true)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return (data?.credentials?.apiKey as string) ?? null;
}

async function fetchWeatherData(apiKey: string, cityQuery: string) {
  const integration = new OpenWeatherIntegration(apiKey);
  const [current, forecastRaw] = await Promise.allSettled([
    integration.getWeatherByCity(cityQuery, 'imperial'),
    // forecast requires coords — derive from geocoding the city string via OWM geo endpoint
    (async () => {
      // get lat/lon from current weather response first, then call forecast
      const cur = await integration.getWeatherByCity(cityQuery, 'imperial');
      return integration.getForecast(cur.coord.lat, cur.coord.lon, 'imperial');
    })(),
  ]);

  return {
    current: current.status === 'fulfilled' ? current.value : null,
    forecast: forecastRaw.status === 'fulfilled' ? forecastRaw.value : null,
  };
}

// ── component ─────────────────────────────────────────────────────────────────

export default function WeatherWidget({ address, companyId }: WeatherWidgetProps) {
  // Step 1: load credentials
  const credQuery = useQuery({
    queryKey: ['openweather-credentials', companyId],
    queryFn: () => fetchCredentials(companyId),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const apiKey = credQuery.data ?? null;
  const cityQuery = parseCityState(address);

  // Step 2: load weather — only runs when we have an API key and an address
  const weatherQuery = useQuery({
    queryKey: ['openweather-data', apiKey, cityQuery],
    queryFn: () => fetchWeatherData(apiKey!, cityQuery),
    enabled: !!apiKey && !!address,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  // If no active integration, render nothing
  if (!credQuery.isLoading && !apiKey) return null;

  // Loading state
  if (credQuery.isLoading || weatherQuery.isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <span className="animate-spin inline-block">🌀</span>
          Loading weather…
        </div>
      </div>
    );
  }

  if (weatherQuery.isError || !weatherQuery.data?.current) {
    // Silent fail — weather is supplementary
    return null;
  }

  const { current, forecast } = weatherQuery.data;
  const condition = current.weather?.[0];
  const emoji = condition ? weatherEmoji(condition.id, condition.icon) : '🌡️';
  const temp = Math.round(current.main?.temp ?? 0);
  const feelsLike = Math.round(current.main?.feels_like ?? 0);
  const humidity = current.main?.humidity ?? 0;
  const windSpeed = Math.round(current.wind?.speed ?? 0);
  const description = condition?.description ?? '';
  const locationName = current.name ?? cityQuery;

  const forecastDays = forecast?.list ? groupForecastByDay(forecast.list) : [];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Current Weather</h3>
        <span className="text-xs text-gray-400">{locationName}</span>
      </div>

      {/* Current conditions */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-3xl leading-none">{emoji}</span>
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-gray-900">{temp}°F</span>
            <span className="text-xs text-gray-400">feels {feelsLike}°</span>
          </div>
          <p className="text-xs text-gray-500 capitalize">{description}</p>
        </div>
        <div className="ml-auto text-right space-y-0.5">
          <p className="text-xs text-gray-500">
            <span className="font-medium text-gray-700">{humidity}%</span> humidity
          </p>
          <p className="text-xs text-gray-500">
            <span className="font-medium text-gray-700">{windSpeed} mph</span> wind
          </p>
        </div>
      </div>

      {/* 3-day forecast */}
      {forecastDays.length > 0 && (
        <div className="border-t border-gray-100 pt-3 grid grid-cols-3 gap-2">
          {forecastDays.map((day) => (
            <div key={day.date} className="text-center">
              <p className="text-xs font-medium text-gray-500">{dayLabel(day.date)}</p>
              <span className="text-lg leading-tight">{weatherEmoji(day.id, day.icon)}</span>
              <p className="text-xs text-gray-900 font-semibold">{day.high}°</p>
              <p className="text-xs text-gray-400">{day.low}°</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
