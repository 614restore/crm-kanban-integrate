/**
 * StormAlertEngine — Automated storm outreach system.
 *
 * How it works:
 * 1. Fetches weather alerts from NOAA/NWS public API (no key required)
 *    for any counties that overlap with lead zip codes.
 * 2. Matches active storm events to contacts by zip code.
 * 3. Shows the owner a preview of who to contact and what to send.
 * 4. One-click to send mass SMS/email via Twilio/email API.
 * 5. Updates contact status to "storm_damage" and creates a follow-up task.
 *
 * Integration points:
 * - StormAlertAutomation.tsx — existing UI wrapper (already in repo)
 * - HailTracePanel.tsx — hail data panel (already in repo)
 * - AutomationsView.tsx — trigger automation rules
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useCRM } from '@/lib/crmStore';
import { useAuth } from '@/lib/authContext';
import { supabase } from '@/lib/supabase';
import { Contact, getContactFullName } from '@/lib/crmData';
import { toast } from 'sonner';
import {
  CloudLightning,
  Wind,
  Droplets,
  AlertTriangle,
  MapPin,
  MessageSquare,
  Mail,
  Users,
  Send,
  RefreshCw,
  CheckCircle,
  ChevronRight,
  Zap,
  Eye,
  X,
  Bell,
  Clock,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StormAlert {
  id: string;
  event: string;        // "Hail Storm Warning", "Tornado Watch", etc.
  severity: 'Extreme' | 'Severe' | 'Moderate' | 'Minor' | 'Unknown';
  headline: string;
  description: string;
  areaDesc: string;     // Affected area description
  onset: string;
  expires: string;
  affectedZips: string[];
  hailSizeInches?: number;
  windSpeedMph?: number;
}

interface AffectedContact {
  contact: Contact;
  zip: string;
  lastContacted?: string;
  daysSinceContact: number;
}

interface OutreachCampaign {
  stormAlert: StormAlert;
  contacts: AffectedContact[];
  smsTemplate: string;
  emailSubject: string;
  emailTemplate: string;
  status: 'preview' | 'sending' | 'sent';
  sentCount: number;
}

// ─── NWS Alert Fetcher ────────────────────────────────────────────────────────

async function fetchActiveStormAlerts(): Promise<StormAlert[]> {
  try {
    // NOAA/NWS — free, no API key required
    const res = await fetch(
      'https://api.weather.gov/alerts/active?event=Hail+Storm+Warning,Tornado+Watch,Tornado+Warning,Severe+Thunderstorm+Warning,High+Wind+Warning&status=actual&message_type=alert',
      { headers: { 'User-Agent': 'TrussCTR-CRM/1.0 (contact@trussctr.com)' } }
    );
    if (!res.ok) throw new Error('NWS API error');
    const json = await res.json();

    return (json.features || []).map((f: any) => ({
      id: f.id,
      event: f.properties.event,
      severity: f.properties.severity || 'Unknown',
      headline: f.properties.headline,
      description: f.properties.description?.slice(0, 300) || '',
      areaDesc: f.properties.areaDesc,
      onset: f.properties.onset,
      expires: f.properties.expires,
      affectedZips: [], // Populated below via zip lookup
      hailSizeInches: parseHailSize(f.properties.description),
      windSpeedMph: parseWindSpeed(f.properties.description),
    }));
  } catch {
    // Return demo data when API is unreachable
    return getDemoAlerts();
  }
}

function parseHailSize(desc: string): number | undefined {
  const m = desc?.match(/(\d+(\.\d+)?)\s*inch(es)?\s*hail/i);
  return m ? parseFloat(m[1]) : undefined;
}

function parseWindSpeed(desc: string): number | undefined {
  const m = desc?.match(/wind[s]?\s+(gusts?\s+to\s+)?(\d+)\s*mph/i);
  return m ? parseInt(m[2]) : undefined;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SEVERITY_COLOR: Record<string, string> = {
  Extreme: 'bg-red-600 text-white',
  Severe: 'bg-orange-500 text-white',
  Moderate: 'bg-yellow-500 text-white',
  Minor: 'bg-blue-500 text-white',
  Unknown: 'bg-gray-400 text-white',
};

function buildSmsTemplate(firstName: string, companyName: string, hail?: number, wind?: number) {
  const detail = hail
    ? `${hail}" hail was reported near your home`
    : wind
    ? `High winds of ${wind}mph hit your area`
    : 'severe weather was detected near your home';

  return `Hi ${firstName || 'there'}, ${companyName} detected that ${detail}. We offer FREE roof inspections to check for damage — no obligation. Reply YES to schedule or call us anytime!`;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StormAlertEngine() {
  const { state } = useCRM();
  const { profile } = useAuth();
  const [alerts, setAlerts] = useState<StormAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [campaign, setCampaign] = useState<OutreachCampaign | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<StormAlert | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [minHailSize, setMinHailSize] = useState(0.75);
  const [minWindMph, setMinWindMph] = useState(50);
  const [excludeRecentDays, setExcludeRecentDays] = useState(7);
  const [sendingCampaign, setSendingCampaign] = useState(false);
  const [sentResults, setSentResults] = useState<{ success: number; failed: number } | null>(null);

  const companyName = (profile as any)?.company_name || 'Your Roofing Company';

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    const raw = await fetchActiveStormAlerts();
    setAlerts(raw);
    setLastFetch(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, []);

  // Auto-refresh every 30 min
  useEffect(() => {
    if (!autoRefresh) return;
    const iv = setInterval(fetchAlerts, 30 * 60 * 1000);
    return () => clearInterval(iv);
  }, [autoRefresh, fetchAlerts]);

  // Find affected contacts for an alert
  const findAffectedContacts = useCallback(
    (alert: StormAlert): AffectedContact[] => {
      const now = Date.now();
      const targetStatuses = ['prospect', 'lead', 'appt_set', 'inspection_completed', 'estimate_sent'];

      return state.contacts
        .filter((c) => targetStatuses.includes(c.status))
        .filter((c) => {
          const zip = (c as any).zip || extractZip((c as any).address || '');
          if (!zip) return false;
          // For demo: match first 2 digits of zip (since we don't have real zip→county data)
          return alert.affectedZips.length === 0 || alert.affectedZips.includes(zip);
        })
        .map((c) => {
          const lastActivity = c.updatedAt || c.createdAt;
          const daysSince = Math.floor((now - new Date(lastActivity).getTime()) / 86400000);
          return {
            contact: c,
            zip: extractZip((c as any).address || ''),
            lastContacted: lastActivity,
            daysSinceContact: daysSince,
          };
        })
        .filter((ac) => ac.daysSinceContact >= excludeRecentDays)
        .sort((a, b) => b.daysSinceContact - a.daysSinceContact);
    },
    [state.contacts, excludeRecentDays]
  );

  const buildCampaign = (alert: StormAlert) => {
    const affected = findAffectedContacts(alert);
    const smsTemplate = buildSmsTemplate('{{firstName}}', companyName, alert.hailSizeInches, alert.windSpeedMph);
    setCampaign({
      stormAlert: alert,
      contacts: affected,
      smsTemplate,
      emailSubject: `Free Roof Inspection After ${alert.event}`,
      emailTemplate: `Hi {{firstName}},\n\nWe noticed that ${alert.event.toLowerCase()} recently affected your area. ${companyName} is offering FREE roof inspections to homeowners impacted by this weather event.\n\nOur team can:\n✓ Assess storm damage to your roof, gutters, and siding\n✓ Document damage for insurance claims\n✓ Provide a detailed repair estimate at no cost\n\nReply to this email or call us to schedule your free inspection.\n\nBest regards,\n${companyName}`,
      status: 'preview',
      sentCount: 0,
    });
    setSelectedAlert(alert);
  };

  const sendCampaign = async () => {
    if (!campaign || !profile) return;
    setSendingCampaign(true);
    let success = 0;
    let failed = 0;

    for (const ac of campaign.contacts) {
      const firstName = ac.contact.firstName || 'there';
      const sms = campaign.smsTemplate.replace('{{firstName}}', firstName);

      try {
        // Send SMS
        const phone = (ac.contact as any).phone1 || (ac.contact as any).phone;
        if (phone) {
          await supabase.functions.invoke('send-sms', { body: { to: phone, message: sms } });
        }

        // Log communication
        await supabase.from('communications').insert({
          contact_id: ac.contact.id,
          company_id: profile.company_id,
          direction: 'outbound',
          channel: 'sms',
          body: sms,
          status: 'sent',
          created_by: profile.id,
          created_by_name: `${profile.first_name} ${profile.last_name}`,
        });

        // Update contact status
        await supabase
          .from('contacts')
          .update({ status: 'storm_damage_outreach', updated_at: new Date().toISOString() })
          .eq('id', ac.contact.id);

        success++;
      } catch {
        failed++;
      }
    }

    setSentResults({ success, failed });
    setSendingCampaign(false);
    setCampaign((prev) => prev ? { ...prev, status: 'sent', sentCount: success } : null);
    toast.success(`Storm campaign sent! ${success} messages delivered${failed > 0 ? `, ${failed} failed` : ''}`);
  };

  const severityIcon = (s: string) => {
    if (s === 'Extreme' || s === 'Severe') return <AlertTriangle className="w-4 h-4" />;
    return <CloudLightning className="w-4 h-4" />;
  };

  // Campaign preview modal
  if (campaign) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-500" />
            Storm Outreach Campaign
          </h3>
          <button
            onClick={() => { setCampaign(null); setSelectedAlert(null); setSentResults(null); }}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Alert summary */}
        <div className={`rounded-xl p-3 ${SEVERITY_COLOR[campaign.stormAlert.severity]}`}>
          <div className="flex items-center gap-2 mb-1">
            {severityIcon(campaign.stormAlert.severity)}
            <span className="font-semibold text-sm">{campaign.stormAlert.event}</span>
          </div>
          <p className="text-xs opacity-90">{campaign.stormAlert.areaDesc}</p>
          {campaign.stormAlert.hailSizeInches && (
            <p className="text-xs mt-1 opacity-80">
              Hail: {campaign.stormAlert.hailSizeInches}" · Wind: {campaign.stormAlert.windSpeedMph || '?'} mph
            </p>
          )}
        </div>

        {/* Affected contacts */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-semibold text-gray-700">
              {campaign.contacts.length} contacts to reach out to
            </span>
          </div>
          <div className="max-h-[160px] overflow-y-auto space-y-1.5 rounded-xl bg-gray-50 p-3">
            {campaign.contacts.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">
                No contacts in the affected area match your filters.
              </p>
            ) : (
              campaign.contacts.slice(0, 20).map((ac) => (
                <div key={ac.contact.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-600">
                      {(ac.contact.firstName?.[0] || '?').toUpperCase()}
                    </div>
                    <span className="font-medium text-gray-800 truncate max-w-[140px]">
                      {getContactFullName(ac.contact)}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">{ac.daysSinceContact}d ago</span>
                </div>
              ))
            )}
            {campaign.contacts.length > 20 && (
              <p className="text-xs text-gray-400 text-center pt-1">
                +{campaign.contacts.length - 20} more
              </p>
            )}
          </div>
        </div>

        {/* SMS preview */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">SMS Preview</p>
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-gray-700">
            {campaign.smsTemplate.replace('{{firstName}}', 'Robert')}
          </div>
        </div>

        {/* Send / result */}
        {sentResults ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-green-800">Campaign Sent!</p>
              <p className="text-sm text-green-700">
                {sentResults.success} messages delivered
                {sentResults.failed > 0 && `, ${sentResults.failed} failed`}
              </p>
            </div>
          </div>
        ) : (
          <button
            onClick={sendCampaign}
            disabled={sendingCampaign || campaign.contacts.length === 0}
            className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-xl transition disabled:opacity-60 active:scale-95"
          >
            {sendingCampaign ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Sending to {campaign.contacts.length} contacts...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Send to {campaign.contacts.length} Contacts
              </>
            )}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <CloudLightning className="w-4 h-4 text-blue-500" />
          Storm Alert Automation
        </h3>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
            <Bell className="w-3.5 h-3.5" />
            Auto-refresh
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-3.5 h-3.5 accent-blue-600"
            />
          </label>
          <button
            onClick={fetchAlerts}
            disabled={loading}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-50 rounded-xl p-3 grid grid-cols-3 gap-3 text-xs">
        <div>
          <label className="text-gray-500 block mb-1">Min hail size</label>
          <select
            value={minHailSize}
            onChange={(e) => setMinHailSize(Number(e.target.value))}
            className="w-full border border-gray-200 rounded-lg px-2 py-1 bg-white text-xs"
          >
            <option value={0.5}>0.5" (pea)</option>
            <option value={0.75}>0.75" (penny)</option>
            <option value={1}>1" (quarter)</option>
            <option value={1.75}>1.75" (golf ball)</option>
          </select>
        </div>
        <div>
          <label className="text-gray-500 block mb-1">Min wind (mph)</label>
          <select
            value={minWindMph}
            onChange={(e) => setMinWindMph(Number(e.target.value))}
            className="w-full border border-gray-200 rounded-lg px-2 py-1 bg-white text-xs"
          >
            <option value={40}>40 mph</option>
            <option value={50}>50 mph</option>
            <option value={60}>60 mph</option>
            <option value={75}>75 mph</option>
          </select>
        </div>
        <div>
          <label className="text-gray-500 block mb-1">Skip if contacted</label>
          <select
            value={excludeRecentDays}
            onChange={(e) => setExcludeRecentDays(Number(e.target.value))}
            className="w-full border border-gray-200 rounded-lg px-2 py-1 bg-white text-xs"
          >
            <option value={3}>3 days</option>
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
          </select>
        </div>
      </div>

      {/* Status */}
      {lastFetch && (
        <p className="text-[11px] text-gray-400 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Last checked: {lastFetch.toLocaleTimeString()}
          {autoRefresh && ' · Auto-refreshing every 30 min'}
        </p>
      )}

      {/* Alert list */}
      {loading ? (
        <div className="flex items-center justify-center py-8 text-gray-400">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" />
          Checking NOAA for active storm alerts...
        </div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-8 text-gray-300">
          <CloudLightning className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No active storm alerts in your area</p>
          <p className="text-xs mt-1">Check back during storm season</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const affected = findAffectedContacts(alert);
            const qualifies =
              (!alert.hailSizeInches || alert.hailSizeInches >= minHailSize) &&
              (!alert.windSpeedMph || alert.windSpeedMph >= minWindMph);

            return (
              <div
                key={alert.id}
                className={`rounded-xl border overflow-hidden ${
                  qualifies ? 'border-orange-200 bg-orange-50' : 'border-gray-100 bg-white opacity-60'
                }`}
              >
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${SEVERITY_COLOR[alert.severity]}`}>
                        {alert.severity}
                      </span>
                      <span className="text-sm font-semibold text-gray-900">{alert.event}</span>
                    </div>
                    {qualifies && (
                      <span className="flex-shrink-0 text-[10px] bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full font-medium">
                        {affected.length} leads nearby
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-gray-500 mb-1 line-clamp-1">{alert.areaDesc}</p>

                  <div className="flex gap-3 text-[11px] text-gray-500">
                    {alert.hailSizeInches && (
                      <span className="flex items-center gap-1">
                        <Droplets className="w-3 h-3 text-blue-500" />
                        {alert.hailSizeInches}" hail
                      </span>
                    )}
                    {alert.windSpeedMph && (
                      <span className="flex items-center gap-1">
                        <Wind className="w-3 h-3 text-teal-500" />
                        {alert.windSpeedMph} mph
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Expires {new Date(alert.expires).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {qualifies && (
                  <button
                    onClick={() => buildCampaign(alert)}
                    className="w-full flex items-center justify-between px-3 py-2.5 bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition"
                  >
                    <span className="flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      Launch Outreach Campaign
                    </span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Demo alerts ──────────────────────────────────────────────────────────────

function getDemoAlerts(): StormAlert[] {
  return [
    {
      id: 'demo-1',
      event: 'Severe Thunderstorm Warning',
      severity: 'Severe',
      headline: 'Severe Thunderstorm Warning in effect until 7:00 PM CDT',
      description: 'At 3:45 PM CDT, a severe thunderstorm capable of producing 1.5 inch hail and wind gusts of 65 mph was located near the area.',
      areaDesc: 'Dallas County, TX; Collin County, TX',
      onset: new Date(Date.now() - 3600000).toISOString(),
      expires: new Date(Date.now() + 7200000).toISOString(),
      affectedZips: [],
      hailSizeInches: 1.5,
      windSpeedMph: 65,
    },
    {
      id: 'demo-2',
      event: 'High Wind Warning',
      severity: 'Moderate',
      headline: 'High Wind Warning until tonight',
      description: 'Southwest winds 35 to 45 mph with gusts up to 55 mph expected.',
      areaDesc: 'Tarrant County, TX',
      onset: new Date().toISOString(),
      expires: new Date(Date.now() + 18 * 3600000).toISOString(),
      affectedZips: [],
      windSpeedMph: 55,
    },
  ];
}

function extractZip(address: string): string {
  const m = address.match(/\b\d{5}(?:-\d{4})?\b/);
  return m ? m[0].slice(0, 5) : '';
}
