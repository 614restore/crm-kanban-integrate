import React, { useState, useEffect, useRef } from 'react';
import { Cloud, AlertTriangle, Send, Users, MapPin, Clock, CheckCircle, Info } from 'lucide-react';
import { Contact } from '@/lib/crmData';
import { toast } from 'sonner';
import { useAuth } from '@/lib/authContext';
import { supabase } from '@/lib/supabase';

interface WeatherAlert {
  type: string;
  severity: string;
  urgency: string;
  certainty: string;
  headline: string;
  description: string;
  instruction: string | null;
  areaDesc: string;
  onset: string;
  expires: string;
}

interface ZipResult {
  zip: string;
  alerts: WeatherAlert[];
  hasStorm: boolean;
  location?: string;
}

interface StormAlertProps {
  contacts: Contact[];
  onSendAlerts?: (contactIds: string[]) => void;
}

const SEVERITY_STYLES: Record<string, string> = {
  Extreme:  'bg-red-700 text-white',
  Severe:   'bg-red-500 text-white',
  Moderate: 'bg-orange-500 text-white',
  Minor:    'bg-yellow-500 text-black',
};

const URGENCY_LABEL: Record<string, string> = {
  Immediate: '🔴 Immediate',
  Expected:  '🟠 Expected',
  Future:    '🟡 Future',
  Past:      '⚪ Past',
};

export function StormAlertAutomation({ contacts, onSendAlerts }: StormAlertProps) {
  const { session, profile, user } = useAuth();
  const [activeAlerts, setActiveAlerts]       = useState<WeatherAlert[]>([]);
  const [affectedZipCodes, setAffectedZipCodes] = useState<string[]>([]);
  const [zipLocations, setZipLocations]       = useState<Record<string, string>>({});
  const [affectedContacts, setAffectedContacts] = useState<Contact[]>([]);
  const [isChecking, setIsChecking]           = useState(false);
  const [isSending, setIsSending]             = useState(false);
  const [lastChecked, setLastChecked]         = useState<Date | null>(null);
  const [expandedAlert, setExpandedAlert]     = useState<number | null>(null);
  const [messageTemplate, setMessageTemplate] = useState(
    "Hi {firstName}, we noticed severe weather in your area today. We're offering free roof inspections to check for damage. Reply YES to schedule or call us at {phone}. - {companyName}"
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkWeatherAlerts = async () => {
    setIsChecking(true);

    try {
      // Load user preferences
      let minSeverityLevel = 2; // Default: moderate
      let serviceAreaZips: string[] = [];
      
      if (profile?.company_id && user?.id) {
        const { data: prefs } = await supabase
          .from('notification_preferences')
          .select('*')
          .eq('company_id', profile.company_id)
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (prefs) {
          // Map severity to numeric level
          const severityOrder: Record<string, number> = { 
            minor: 1, 
            moderate: 2, 
            severe: 3, 
            extreme: 4 
          };
          minSeverityLevel = severityOrder[prefs.min_severity] || 2;
          serviceAreaZips = prefs.service_area_zip_codes || [];
        }
      }

      // Get zip codes to check
      let zipCodes = [...new Set(contacts.map(c => c.zip).filter(Boolean))];
      
      // Filter by service area if configured
      if (serviceAreaZips.length > 0) {
        zipCodes = zipCodes.filter(zip => serviceAreaZips.includes(zip));
      }
      
      if (!zipCodes.length) {
        toast.info(serviceAreaZips.length > 0 
          ? 'No contacts in your configured service area' 
          : 'No zip codes found in your contacts'
        );
        setIsChecking(false);
        return;
      }

      const results: ZipResult[] = await Promise.all(
        zipCodes.map(async (zip) => {
          try {
            const response = await fetch('/api/eagleview', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
              },
              body: JSON.stringify({ action: 'weather', zipCode: zip }),
            });
            if (response.ok) {
              const data = await response.json();
              return { zip, alerts: data.alerts || [], hasStorm: data.hasActiveStorm, location: data.location };
            }
            console.warn(`[StormAlert] Weather check failed for zip ${zip}: HTTP ${response.status}`);
          } catch (e) {
            console.warn(`[StormAlert] Weather check error for zip ${zip}:`, e);
          }
          return { zip, alerts: [], hasStorm: false };
        })
      );

      // Filter alerts by severity threshold
      const severityOrder: Record<string, number> = { 
        minor: 1, 
        moderate: 2, 
        severe: 3, 
        extreme: 4 
      };
      
      const filteredResults = results.map(result => ({
        ...result,
        alerts: result.alerts.filter(alert => {
          const alertSeverityLevel = severityOrder[alert.severity?.toLowerCase()] || 1;
          return alertSeverityLevel >= minSeverityLevel;
        }),
        hasStorm: result.alerts.some(alert => {
          const alertSeverityLevel = severityOrder[alert.severity?.toLowerCase()] || 1;
          return alertSeverityLevel >= minSeverityLevel;
        })
      }));

      const stormZips = filteredResults.filter(r => r.hasStorm).map(r => r.zip);
      const allAlerts = filteredResults.flatMap(r => r.alerts);
      const locMap: Record<string, string> = {};
      filteredResults.forEach(r => { if (r.location) locMap[r.zip] = r.location; });

      setAffectedZipCodes(stormZips);
      setActiveAlerts(allAlerts);
      setZipLocations(locMap);
      setLastChecked(new Date());

      const affected = contacts.filter(c =>
        stormZips.includes(c.zip) &&
        ['prospect', 'lead', 'estimate_sent', 'contingency'].includes(c.status)
      );
      setAffectedContacts(affected);

      if (stormZips.length > 0) {
        toast.success(`Found ${allAlerts.length} active alert(s) across ${stormZips.length} zip code(s)`);
      } else {
        toast.info('No active storms detected in your service area');
      }
    } catch (error) {
      console.error('Weather check error:', error);
      toast.error('Failed to check weather alerts');
    } finally {
      setIsChecking(false);
    }
  };

  const sendStormAlerts = async () => {
    if (!affectedContacts.length) {
      toast.error('No contacts to notify');
      return;
    }
    setIsSending(true);
    try {
      const response = await fetch('/api/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          type: 'sms',
          contacts: affectedContacts.map(c => ({
            id: c.id,
            phone: c.phone1,
            firstName: c.firstName,
          })),
          message: messageTemplate,
        }),
      });
      if (!response.ok) throw new Error('Failed to send alerts');
      toast.success(`Storm alerts sent to ${affectedContacts.length} contacts!`);
      onSendAlerts?.(affectedContacts.map(c => c.id));
      setAffectedContacts([]);
    } catch (error) {
      console.error('Send alerts error:', error);
      toast.error('Failed to send storm alerts');
    } finally {
      setIsSending(false);
    }
  };

  // Auto-check on mount and every hour
  useEffect(() => {
    checkWeatherAlerts();
    intervalRef.current = setInterval(checkWeatherAlerts, 60 * 60 * 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const hasStorms = activeAlerts.length > 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className={`p-6 ${hasStorms ? 'bg-gradient-to-r from-orange-500 to-red-500' : 'bg-gradient-to-r from-blue-500 to-indigo-600'}`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-bold text-white mb-0.5">Storm Alert Automation</h3>
            <p className="text-white/80 text-sm">Automatic lead outreach during severe weather</p>
          </div>
          <Cloud size={32} className="text-white/70" />
        </div>

        {hasStorms && (
          <div className="flex items-center gap-2 text-white font-semibold mt-2">
            <AlertTriangle size={18} className="animate-pulse" />
            {activeAlerts.length} Active NOAA Alert{activeAlerts.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">

        {/* Check button + last-checked */}
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-gray-900">NOAA Weather Monitoring</h4>
            <p className="text-xs text-gray-500 mt-0.5">
              {lastChecked
                ? `Last checked: ${lastChecked.toLocaleTimeString()}`
                : 'Checking now…'}
            </p>
          </div>
          <button
            onClick={checkWeatherAlerts}
            disabled={isChecking}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
          >
            {isChecking ? (
              <><Clock size={15} className="animate-spin" />Checking…</>
            ) : (
              <><Cloud size={15} />Check Now</>
            )}
          </button>
        </div>

        {/* Active alerts */}
        {hasStorms && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-900">Active Weather Alerts</h4>
            {activeAlerts.map((alert, i) => (
              <div key={i} className="border border-red-200 rounded-lg overflow-hidden">
                {/* Alert header row */}
                <button
                  className="w-full text-left px-4 py-3 bg-red-50 hover:bg-red-100 transition-colors flex items-start gap-3"
                  onClick={() => setExpandedAlert(expandedAlert === i ? null : i)}
                >
                  <AlertTriangle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-red-900 truncate">{alert.headline || alert.type}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_STYLES[alert.severity] || 'bg-gray-400 text-white'}`}>
                        {alert.severity}
                      </span>
                      {alert.urgency && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                          {URGENCY_LABEL[alert.urgency] || alert.urgency}
                        </span>
                      )}
                      {alert.certainty && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                          {alert.certainty}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">{expandedAlert === i ? '▲' : '▼'}</span>
                </button>

                {/* Expanded details */}
                {expandedAlert === i && (
                  <div className="px-4 py-3 space-y-3 bg-white border-t border-red-100">
                    {alert.areaDesc && (
                      <p className="text-xs text-gray-600">
                        <span className="font-medium">Area: </span>{alert.areaDesc}
                      </p>
                    )}
                    {alert.description && (
                      <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed line-clamp-6">
                        {alert.description.trim()}
                      </p>
                    )}
                    {alert.instruction && (
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-xs font-semibold text-yellow-900 mb-1">What to do:</p>
                        <p className="text-xs text-yellow-800 whitespace-pre-wrap leading-relaxed">
                          {alert.instruction.trim()}
                        </p>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                      <span>Onset: {alert.onset ? new Date(alert.onset).toLocaleString() : '—'}</span>
                      <span>Expires: {alert.expires ? new Date(alert.expires).toLocaleString() : '—'}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* NOAA attribution */}
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <Info size={11} />
              Alerts sourced from <span className="font-medium">NOAA / National Weather Service</span> (api.weather.gov)
            </p>
          </div>
        )}

        {/* Affected zip codes */}
        {affectedZipCodes.length > 0 && (
          <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-start gap-3">
              <MapPin size={18} className="text-orange-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h5 className="text-sm font-semibold text-orange-900 mb-2">Affected Zip Codes</h5>
                <div className="flex flex-wrap gap-2">
                  {affectedZipCodes.map(zip => (
                    <span key={zip} className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-medium">
                      {zip}{zipLocations[zip] ? ` · ${zipLocations[zip]}` : ''}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Outreach section */}
        {affectedContacts.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-blue-600" />
              <h4 className="text-sm font-semibold text-gray-900">
                {affectedContacts.length} Contact{affectedContacts.length !== 1 ? 's' : ''} Ready for Outreach
              </h4>
            </div>

            {/* Message template */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">SMS Message Template</label>
              <textarea
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                placeholder="Use {firstName}, {phone}, {companyName} as variables"
              />
              <p className="text-xs text-gray-400 mt-1">
                Variables: {'{firstName}'} · {'{phone}'} · {'{companyName}'}
              </p>
            </div>

            {/* Contact preview */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                <h5 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Contacts to Notify</h5>
              </div>
              <div className="max-h-48 overflow-y-auto divide-y divide-gray-100">
                {affectedContacts.slice(0, 10).map(contact => (
                  <div key={contact.id} className="px-4 py-2.5 hover:bg-gray-50 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{contact.firstName} {contact.lastName}</p>
                      <p className="text-xs text-gray-500">{contact.phone1}</p>
                    </div>
                    <span className="text-xs text-gray-400">{contact.zip}</span>
                  </div>
                ))}
                {affectedContacts.length > 10 && (
                  <div className="px-4 py-2 text-xs text-gray-400 text-center">
                    +{affectedContacts.length - 10} more contacts
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={sendStormAlerts}
              disabled={isSending}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 transition-all font-semibold"
            >
              {isSending ? (
                <><Clock size={18} className="animate-spin" />Sending Alerts…</>
              ) : (
                <><Send size={18} />Send Storm Alerts to {affectedContacts.length} Contact{affectedContacts.length !== 1 ? 's' : ''}</>
              )}
            </button>
          </div>
        )}

        {/* No storms state */}
        {!hasStorms && !isChecking && (
          <div className="text-center py-8">
            <CheckCircle size={44} className="mx-auto text-green-500 mb-3" />
            <h4 className="text-base font-semibold text-gray-900 mb-1">No Active Storms</h4>
            <p className="text-sm text-gray-500">
              Monitoring {[...new Set(contacts.map(c => c.zip).filter(Boolean))].length} zip code(s) in your service area.
            </p>
          </div>
        )}

        {/* How it works */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h5 className="text-sm font-semibold text-blue-900 mb-2">How Storm Alerts Work</h5>
          <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
            <li>NOAA is queried for each zip code where you have active leads</li>
            <li>Tornado, severe thunderstorm, hail, and wind alerts trigger outreach</li>
            <li>Affected prospects &amp; leads are identified automatically</li>
            <li>Customize your SMS template, then send with one click</li>
            <li>Alerts re-check automatically every hour</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
