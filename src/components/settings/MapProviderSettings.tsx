// Settings → Map Provider. Like the AI assistant's keys: anyone can add their
// own map provider, and an owner or admin adds one for the team. Storm Search
// uses the personal one first, then the team's, then the free map. A radar tile
// address can replace the free NOAA radar.
import React, { useEffect, useState } from 'react';
import { CheckCircle, ExternalLink, Layers, Loader2, Radar, ShieldAlert, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { MAP_SETTINGS_CHANGED_EVENT } from '@/hooks/useMapSettings';
import { checkTileUrl } from '@/lib/mapTileCheck';
import {
  buildTileConfig,
  getMapProvider,
  isValidRadarUrl,
  isValidTileUrl,
  MAP_PROVIDERS,
  MAP_SETTINGS_COLUMNS,
  radarTileUrl,
  type MapProviderId,
  type MapSettingsRow,
} from '@/lib/mapProviders';

type Scope = 'personal' | 'team';

interface FormState {
  provider: MapProviderId;
  style: string;
  apiKey: string;
  customUrl: string;
  customAttribution: string;
  radarUrl: string;
}

const EMPTY_FORM: FormState = {
  provider: 'openstreetmap',
  style: '',
  apiKey: '',
  customUrl: '',
  customAttribution: '',
  radarUrl: '',
};

const toForm = (row: MapSettingsRow | null): FormState =>
  row
    ? {
        provider: (getMapProvider(row.provider)?.id ?? 'openstreetmap') as MapProviderId,
        style: row.style ?? '',
        apiKey: row.api_key ?? '',
        customUrl: row.custom_url ?? '',
        customAttribution: row.custom_attribution ?? '',
        radarUrl: row.radar_url ?? '',
      }
    : EMPTY_FORM;

type TestResult = { status: 'idle' } | { status: 'testing' } | { status: 'ok'; previewUrl: string } | { status: 'failed'; message: string };

function MapSettingsSection({
  scope,
  companyId,
  userId,
  canEdit,
}: {
  scope: Scope;
  companyId: string;
  userId: string | null;
  canEdit: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [saved, setSaved] = useState<MapSettingsRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [mapTest, setMapTest] = useState<TestResult>({ status: 'idle' });
  const [radarTest, setRadarTest] = useState<TestResult>({ status: 'idle' });

  const table = scope === 'team' ? 'company_map_settings' : 'user_map_settings';
  const matchColumn = scope === 'team' ? 'company_id' : 'user_id';
  const matchValue = scope === 'team' ? companyId : userId;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!matchValue) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data, error } = await supabase.from(table).select(MAP_SETTINGS_COLUMNS).eq(matchColumn, matchValue).maybeSingle();
      if (cancelled) return;
      if (error) {
        setNeedsSetup(/map_settings|relation|does not exist/i.test(error.message));
      } else {
        const row = (data as MapSettingsRow | null) ?? null;
        setSaved(row);
        setForm(toForm(row));
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [table, matchColumn, matchValue]);

  const provider = getMapProvider(form.provider) ?? MAP_PROVIDERS[0];
  const update = (patch: Partial<FormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setMapTest({ status: 'idle' });
  };

  const draftRow = {
    provider: form.provider,
    style: form.style || provider.styles[0]?.id || null,
    api_key: form.apiKey.trim() || null,
    custom_url: form.customUrl.trim() || null,
    custom_attribution: form.customAttribution.trim() || null,
  };

  const mapProblem = (): string | null => {
    if (provider.key === 'required' && !form.apiKey.trim()) return `Add your ${provider.name} ${provider.keyLabel?.toLowerCase() ?? 'key'}.`;
    if (provider.id === 'custom' && !isValidTileUrl(form.customUrl)) return 'The tile address must start with https:// and include {z}, {x} and {y}.';
    return null;
  };

  const radarProblem = (): string | null =>
    form.radarUrl.trim() && !isValidRadarUrl(form.radarUrl)
      ? 'The radar address must start with https:// and include {z}, {x}, {y} and a time: {time}, {unix} or {iso}.'
      : null;

  const runMapTest = async () => {
    const problem = mapProblem();
    const config = buildTileConfig(draftRow);
    if (problem || !config) {
      setMapTest({ status: 'failed', message: problem ?? 'These settings are incomplete.' });
      return;
    }
    setMapTest({ status: 'testing' });
    // Checked server-side: a rejected key still returns an "Invalid key" image to the browser.
    const result = await checkTileUrl(config.url, config.subdomains, true);
    setMapTest(result.ok ? { status: 'ok', previewUrl: result.sampleUrl } : { status: 'failed', message: result.message });
  };

  const runRadarTest = async () => {
    const problem = radarProblem();
    if (problem || !form.radarUrl.trim()) {
      setRadarTest({ status: 'failed', message: problem ?? 'Enter a radar tile address first.' });
      return;
    }
    setRadarTest({ status: 'testing' });
    const step = 5 * 60000;
    const time = new Date(Math.floor((Date.now() - 3600e3) / step) * step);
    const result = await checkTileUrl(radarTileUrl(form.radarUrl.trim(), time), 'abc', true);
    setRadarTest(result.ok ? { status: 'ok', previewUrl: result.sampleUrl } : { status: 'failed', message: result.message });
  };

  const save = async () => {
    if (!matchValue) return;
    const problem = form.provider === 'openstreetmap' ? null : mapProblem();
    const radarIssue = radarProblem();
    if (problem || radarIssue) {
      toast.error(problem ?? radarIssue ?? 'Check the settings');
      return;
    }
    setSaving(true);
    const row = {
      [matchColumn]: matchValue,
      ...draftRow,
      style: form.provider === 'openstreetmap' ? null : draftRow.style,
      api_key: provider.key === 'none' ? null : draftRow.api_key,
      custom_url: form.provider === 'custom' ? draftRow.custom_url : null,
      custom_attribution: form.provider === 'custom' ? draftRow.custom_attribution : null,
      radar_url: form.radarUrl.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from(table).upsert(row, { onConflict: matchColumn });
    setSaving(false);
    if (error) {
      toast.error(error.message || 'Could not save map settings');
      return;
    }
    setSaved(row as unknown as MapSettingsRow);
    window.dispatchEvent(new Event(MAP_SETTINGS_CHANGED_EVENT));
    toast.success(scope === 'team' ? 'Team map saved' : 'Your map saved');
  };

  const remove = async () => {
    if (!matchValue) return;
    setSaving(true);
    const { error } = await supabase.from(table).delete().eq(matchColumn, matchValue);
    setSaving(false);
    if (error) {
      toast.error(error.message || 'Could not remove map settings');
      return;
    }
    setSaved(null);
    setForm(EMPTY_FORM);
    setMapTest({ status: 'idle' });
    setRadarTest({ status: 'idle' });
    window.dispatchEvent(new Event(MAP_SETTINGS_CHANGED_EVENT));
    toast.success(scope === 'team' ? 'Team map removed' : 'Your map removed');
  };

  const disabled = !canEdit || needsSetup || saving;
  const savedProvider = getMapProvider(saved?.provider);
  const savedStyle = savedProvider?.styles.find((s) => s.id === saved?.style)?.name;

  const TestLine = ({ result }: { result: TestResult }) =>
    result.status === 'testing' ? (
      <span className="flex items-center gap-1.5 text-xs text-gray-500"><Loader2 size={12} className="animate-spin" /> Testing…</span>
    ) : result.status === 'ok' ? (
      <span className="flex items-center gap-2 text-xs text-green-700">
        <CheckCircle size={13} /> Works
        <img src={result.previewUrl} alt="Map preview" className="h-16 w-16 rounded border border-gray-200 object-cover bg-gray-50" />
      </span>
    ) : result.status === 'failed' ? (
      <span className="flex items-center gap-1.5 text-xs text-red-600"><XCircle size={13} /> {result.message}</span>
    ) : null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <div>
        <h4 className="text-base font-semibold text-gray-900">{scope === 'team' ? 'Team map' : 'Your personal map'}</h4>
        <p className="text-sm text-gray-500 mt-1">
          {scope === 'team'
            ? 'Used by everyone on your team who has not added their own. Owners and admins can change it.'
            : 'Used for you before the team map.'}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 size={14} className="animate-spin" /> Loading…</div>
      ) : needsSetup ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          Map providers need a database update before they can be added.
        </div>
      ) : !canEdit ? (
        <div className="text-sm text-gray-700">
          {saved && savedProvider && saved.provider !== 'openstreetmap'
            ? `${savedProvider.name}${savedStyle ? ` · ${savedStyle}` : ''}`
            : 'The free OpenStreetMap map'}
          {saved?.radar_url ? ' · custom radar' : ''}
          <p className="text-xs text-gray-500 mt-1">Ask an owner or admin to add or change the team map.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">Provider</label>
              <select
                value={form.provider}
                disabled={disabled}
                onChange={(e) => update({ provider: e.target.value as MapProviderId, style: '' })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
              >
                {MAP_PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {provider.description}{' '}
                {provider.signupUrl && (
                  <a href={provider.signupUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-blue-600 hover:underline">
                    Get a key <ExternalLink size={10} />
                  </a>
                )}
              </p>
            </div>
            {provider.styles.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Map style</label>
                <select
                  value={form.style || provider.styles[0].id}
                  disabled={disabled}
                  onChange={(e) => update({ style: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                >
                  {provider.styles.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {provider.id === 'custom' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-900 mb-1">Tile address</label>
                <input
                  type="url"
                  value={form.customUrl}
                  disabled={disabled}
                  onChange={(e) => update({ customUrl: e.target.value })}
                  placeholder="https://tiles.example.com/{z}/{x}/{y}.png?key={key}"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-900 mb-1">Map credit</label>
                <input
                  type="text"
                  value={form.customAttribution}
                  disabled={disabled}
                  onChange={(e) => update({ customAttribution: e.target.value })}
                  placeholder="© Your provider © OpenStreetMap contributors"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
            </div>
          )}

          {provider.key !== 'none' && (
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">{provider.keyLabel ?? 'API key'}</label>
              <input
                type="password"
                autoComplete="off"
                value={form.apiKey}
                disabled={disabled}
                onChange={(e) => update({ apiKey: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono"
              />
            </div>
          )}

          {provider.id !== 'openstreetmap' && (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={runMapTest}
                disabled={disabled || mapTest.status === 'testing'}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-60"
              >
                Test map
              </button>
              <TestLine result={mapTest} />
            </div>
          )}

          <div className="border-t border-gray-100 pt-4">
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-900 mb-1">
              <Radar size={14} className="text-blue-600" /> Radar tile address (optional)
            </label>
            <input
              type="url"
              value={form.radarUrl}
              disabled={disabled}
              onChange={(e) => { setForm((prev) => ({ ...prev, radarUrl: e.target.value })); setRadarTest({ status: 'idle' }); }}
              placeholder="https://radar.example.com/{time}/{z}/{x}/{y}.png?key=YOUR_KEY"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono"
            />
            <p className="text-xs text-gray-500 mt-1">
              Leave empty for the free NOAA radar (continental US, 5-minute frames, no uptime guarantee). For a paid radar service,
              enter its tile address with {'{z}'}, {'{x}'}, {'{y}'} and the time as {'{time}'} (YYYYMMDDHHmm UTC), {'{unix}'} (seconds)
              or {'{iso}'}. Include your key in the address.
            </p>
            {form.radarUrl.trim() && (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={runRadarTest}
                  disabled={disabled || radarTest.status === 'testing'}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-60"
                >
                  Test radar
                </button>
                <TestLine result={radarTest} />
              </div>
            )}
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            {saved && (
              <button
                type="button"
                onClick={remove}
                disabled={disabled}
                className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-60"
              >
                {scope === 'team' ? 'Remove team map' : 'Remove my map'}
              </button>
            )}
            <button
              type="button"
              onClick={save}
              disabled={disabled}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Save
            </button>
          </div>
        </>
      )}
    </div>
  );
}

interface MapProviderSettingsProps {
  companyId: string;
  userId: string | null;
  canManageTeam: boolean;
}

export default function MapProviderSettings({ companyId, userId, canManageTeam }: MapProviderSettingsProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <Layers size={20} className="text-blue-600" /> Map Provider
        </h3>
        <p className="text-sm text-gray-500">
          Storm Search uses the free OpenStreetMap street map and free NOAA radar. Add a map provider with your own key for satellite
          imagery and more detailed maps, or a paid radar service for more in-depth radar. Your personal map is used first, then your
          team's.
        </p>
      </div>

      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
        <ShieldAlert size={16} className="mt-0.5 shrink-0" />
        <span>
          Map keys load map images in the browser, so people on your team can see them. In your provider's dashboard, limit the key to
          your TrussCTR web address (for example trussctr.614restore.com).
        </span>
      </div>

      <MapSettingsSection scope="personal" companyId={companyId} userId={userId} canEdit={!!userId} />
      <MapSettingsSection scope="team" companyId={companyId} userId={userId} canEdit={canManageTeam} />
    </div>
  );
}
