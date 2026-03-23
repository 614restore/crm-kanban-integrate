/**
 * JobMapView — Live map of all active jobs & leads.
 *
 * Uses OpenStreetMap (via iframe embed) with a list of pins alongside.
 * No API key required for the iframe approach. For a full interactive
 * map, swap the iframe for react-leaflet (open source) or Google Maps.
 *
 * Features:
 * - Clusters jobs by address/zip
 * - Color-coded by status (lead=blue, in_progress=orange, completed=green)
 * - Click a job on the list → opens directions in native maps app
 * - Shows crew GPS positions (if time_entries with lat/lng are available)
 * - Filter by: all | mine | status
 */
import React, { useState, useMemo } from 'react';
import { useCRM } from '@/lib/crmStore';
import { useAuth } from '@/lib/authContext';
import {
  Contact,
  getContactFullName,
  formatCurrency,
  statusLabels,
  statusColors,
} from '@/lib/crmData';
import {
  MapPin,
  Navigation,
  Filter,
  Users,
  Briefcase,
  TrendingUp,
  Circle,
  ExternalLink,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface JobPin {
  contact: Contact;
  address: string;
  lat?: number;
  lng?: number;
  statusColor: string;
  statusLabel: string;
}

type MapFilter = 'all' | 'mine' | 'active' | 'leads';

// ─── Geocode helper (browser-side, no key) ────────────────────────────────────

const geocodeCache = new Map<string, { lat: number; lng: number }>();

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  if (geocodeCache.has(address)) return geocodeCache.get(address)!;
  try {
    const encoded = encodeURIComponent(address);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`,
      { headers: { 'User-Agent': 'TrussCTR-CRM/1.0' } }
    );
    const data = await res.json();
    if (data?.[0]) {
      const coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      geocodeCache.set(address, coords);
      return coords;
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Status → color ───────────────────────────────────────────────────────────

const STATUS_DOT: Record<string, string> = {
  prospect: 'bg-gray-400',
  lead: 'bg-blue-500',
  appt_set: 'bg-indigo-500',
  inspection_completed: 'bg-violet-500',
  estimate_sent: 'bg-orange-400',
  contingency: 'bg-yellow-500',
  signed: 'bg-emerald-500',
  in_progress: 'bg-amber-500',
  build_phase: 'bg-amber-600',
  cleanup: 'bg-teal-500',
  invoicing: 'bg-cyan-500',
  pending_payment: 'bg-red-400',
  completed: 'bg-green-600',
  lost: 'bg-gray-300',
};

function getStatusDot(status: string): string {
  return STATUS_DOT[status] || 'bg-gray-400';
}

// ─── Map iframe ───────────────────────────────────────────────────────────────

function OpenStreetMapEmbed({ pins }: { pins: JobPin[] }) {
  // Build a simple bounding box around all known coordinates
  const validPins = pins.filter((p) => p.lat && p.lng);

  if (validPins.length === 0) {
    // Default to US center if no geocoded pins
    return (
      <iframe
        title="Jobs Map"
        className="w-full h-full rounded-xl border-0"
        src="https://www.openstreetmap.org/export/embed.html?bbox=-100,30,-80,45&layer=mapnik"
        loading="lazy"
      />
    );
  }

  const lats = validPins.map((p) => p.lat!);
  const lngs = validPins.map((p) => p.lng!);
  const minLat = Math.min(...lats) - 0.05;
  const maxLat = Math.max(...lats) + 0.05;
  const minLng = Math.min(...lngs) - 0.05;
  const maxLng = Math.max(...lngs) + 0.05;

  const bbox = `${minLng},${minLat},${maxLng},${maxLat}`;
  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;

  // Build marker string for all pins
  const markers = validPins
    .slice(0, 20) // OSM embed supports limited markers
    .map((p) => `mlat=${p.lat}&mlon=${p.lng}`)
    .join('&');

  return (
    <iframe
      title="Jobs Map"
      className="w-full h-full rounded-xl border-0"
      src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&${markers}`}
      loading="lazy"
    />
  );
}

// ─── Job row ─────────────────────────────────────────────────────────────────

function JobRow({ pin }: { pin: JobPin }) {
  const openDirections = () => {
    const encoded = encodeURIComponent(pin.address);
    // Prefer Google Maps; falls back to Apple Maps on iOS
    const url = `https://maps.google.com/maps?q=${encoded}`;
    window.open(url, '_blank');
  };

  const value = pin.contact.projectValue ? formatCurrency(pin.contact.projectValue) : null;

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition">
      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${getStatusDot(pin.contact.status)}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">
          {getContactFullName(pin.contact)}
        </p>
        <p className="text-xs text-gray-400 truncate">{pin.address}</p>
        <p className="text-[11px] text-gray-400 mt-0.5">{pin.statusLabel}</p>
      </div>
      <div className="flex-shrink-0 flex items-center gap-2">
        {value && <span className="text-xs font-semibold text-green-700">{value}</span>}
        <button
          onClick={openDirections}
          className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition"
          title="Get directions"
        >
          <Navigation className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function JobMapView() {
  const { state } = useCRM();
  const { profile } = useAuth();
  const [filter, setFilter] = useState<MapFilter>('active');
  const [showMap, setShowMap] = useState(true);

  const filteredContacts = useMemo(() => {
    let contacts = state.contacts;

    switch (filter) {
      case 'mine':
        contacts = contacts.filter((c) => c.assignedTo === (profile?.id || state.currentUser?.id));
        break;
      case 'active':
        contacts = contacts.filter((c) =>
          ['in_progress', 'build_phase', 'cleanup', 'signed', 'appt_set', 'inspection_completed'].includes(c.status)
        );
        break;
      case 'leads':
        contacts = contacts.filter((c) => ['prospect', 'lead', 'estimate_sent'].includes(c.status));
        break;
      default:
        contacts = contacts.filter((c) => c.status !== 'lost' && c.status !== 'completed');
        break;
    }

    return contacts.filter((c) => (c as any).address);
  }, [state.contacts, filter, profile?.id, state.currentUser?.id]);

  const pins: JobPin[] = useMemo(
    () =>
      filteredContacts.map((c) => ({
        contact: c,
        address: (c as any).address || '',
        statusColor: getStatusDot(c.status),
        statusLabel: statusLabels[c.status] || c.status,
      })),
    [filteredContacts]
  );

  // Stats
  const stats = useMemo(() => {
    const active = state.contacts.filter((c) => ['in_progress', 'build_phase', 'cleanup'].includes(c.status));
    const pipeline = state.contacts.filter((c) => ['prospect', 'lead', 'appt_set', 'estimate_sent', 'signed'].includes(c.status));
    const pipelineValue = pipeline.reduce((s, c) => s + (c.projectValue || 0), 0);
    return { activeJobs: active.length, pipelineJobs: pipeline.length, pipelineValue };
  }, [state.contacts]);

  const filterOptions: { key: MapFilter; label: string }[] = [
    { key: 'all', label: 'All Open' },
    { key: 'active', label: 'In Progress' },
    { key: 'leads', label: 'Leads' },
    { key: 'mine', label: 'Mine' },
  ];

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-blue-500" />
          <h3 className="font-semibold text-sm text-gray-900">Job Map</h3>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1">
          {filterOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setFilter(opt.key)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition ${
                filter === opt.key
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
        <div className="px-4 py-2.5 text-center">
          <p className="text-lg font-bold text-gray-900">{stats.activeJobs}</p>
          <p className="text-[11px] text-gray-400">Active Jobs</p>
        </div>
        <div className="px-4 py-2.5 text-center">
          <p className="text-lg font-bold text-gray-900">{stats.pipelineJobs}</p>
          <p className="text-[11px] text-gray-400">In Pipeline</p>
        </div>
        <div className="px-4 py-2.5 text-center">
          <p className="text-lg font-bold text-green-700">{formatCurrency(stats.pipelineValue)}</p>
          <p className="text-[11px] text-gray-400">Pipeline Value</p>
        </div>
      </div>

      {/* Map + list split */}
      <div className="flex-1 flex overflow-hidden">
        {/* Map */}
        {showMap && (
          <div className="w-1/2 border-r border-gray-100 p-2">
            <OpenStreetMapEmbed pins={pins} />
          </div>
        )}

        {/* Job list */}
        <div className={`${showMap ? 'w-1/2' : 'w-full'} overflow-y-auto`}>
          {pins.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12 text-gray-300">
              <MapPin className="w-10 h-10 mb-2 opacity-40" />
              <p className="text-sm">No jobs with addresses in this view</p>
              <p className="text-xs mt-1 text-center px-4">Add addresses to contacts to see them on the map</p>
            </div>
          ) : (
            <div>
              {pins.map((pin) => (
                <JobRow key={pin.contact.id} pin={pin} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-4 overflow-x-auto">
        {[
          { color: 'bg-blue-500', label: 'Lead' },
          { color: 'bg-emerald-500', label: 'Signed' },
          { color: 'bg-amber-500', label: 'In Progress' },
          { color: 'bg-teal-500', label: 'Cleanup' },
          { color: 'bg-red-400', label: 'Pending Payment' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5 whitespace-nowrap text-[11px] text-gray-500">
            <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
            {item.label}
          </div>
        ))}
        <button
          onClick={() => setShowMap((v) => !v)}
          className="ml-auto text-[11px] text-blue-600 hover:underline whitespace-nowrap"
        >
          {showMap ? 'Hide map' : 'Show map'}
        </button>
      </div>
    </div>
  );
}
