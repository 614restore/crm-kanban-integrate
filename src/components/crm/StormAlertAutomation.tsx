import React, { useState, useEffect } from 'react';
import { Cloud, AlertTriangle, Send, Users, MapPin, Clock, CheckCircle } from 'lucide-react';
import { Contact } from '@/lib/crmData';
import { toast } from 'sonner';

interface WeatherAlert {
  type: string;
  severity: string;
  description: string;
  onset: string;
  expires: string;
}

interface StormAlertProps {
  contacts: Contact[];
  onSendAlerts?: (contactIds: string[]) => void;
}

export function StormAlertAutomation({ contacts, onSendAlerts }: StormAlertProps) {
  const [activeAlerts, setActiveAlerts] = useState<WeatherAlert[]>([]);
  const [affectedZipCodes, setAffectedZipCodes] = useState<string[]>([]);
  const [affectedContacts, setAffectedContacts] = useState<Contact[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [messageTemplate, setMessageTemplate] = useState(
    "Hi {firstName}, we noticed severe weather in your area today. We're offering free roof inspections to check for damage. Reply YES to schedule or call us at {phone}. - {companyName}"
  );

  const checkWeatherAlerts = async () => {
    setIsChecking(true);
    
    try {
      // Get unique zip codes from contacts
      const zipCodes = [...new Set(contacts.map(c => c.zip))];
      
      const alertPromises = zipCodes.map(async (zip) => {
        const response = await fetch('/api/eagleview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'weather', zipCode: zip }),
        });
        
        if (response.ok) {
          const data = await response.json();
          return { zip, alerts: data.alerts || [], hasStorm: data.hasActiveStorm };
        }
        return { zip, alerts: [], hasStorm: false };
      });

      const results = await Promise.all(alertPromises);
      
      // Filter zip codes with active storms
      const stormZips = results.filter(r => r.hasStorm).map(r => r.zip);
      const allAlerts = results.flatMap(r => r.alerts);
      
      setAffectedZipCodes(stormZips);
      setActiveAlerts(allAlerts);
      
      // Filter contacts in affected zip codes
      const affected = contacts.filter(c => 
        stormZips.includes(c.zip) &&
        ['prospect', 'lead', 'estimate_sent', 'contingency'].includes(c.status)
      );
      
      setAffectedContacts(affected);
      
      if (stormZips.length > 0) {
        toast.success(`Found ${stormZips.length} zip codes with active storms!`);
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
    if (affectedContacts.length === 0) {
      toast.error('No contacts to notify');
      return;
    }

    setIsSending(true);

    try {
      // Send SMS to affected contacts
      const response = await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contacts: affectedContacts.map(c => ({
            id: c.id,
            phone: c.phone1,
            firstName: c.firstName,
          })),
          message: messageTemplate,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send alerts');
      }

      const data = await response.json();
      
      toast.success(`Storm alerts sent to ${affectedContacts.length} contacts!`);
      onSendAlerts?.(affectedContacts.map(c => c.id));
      
      // Clear affected contacts after sending
      setAffectedContacts([]);
    } catch (error) {
      console.error('Send alerts error:', error);
      toast.error('Failed to send storm alerts');
    } finally {
      setIsSending(false);
    }
  };

  // Auto-check weather every hour
  useEffect(() => {
    checkWeatherAlerts();
    const interval = setInterval(checkWeatherAlerts, 60 * 60 * 1000); // 1 hour
    return () => clearInterval(interval);
  }, [contacts]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className={`p-6 ${activeAlerts.length > 0 ? 'bg-gradient-to-r from-orange-500 to-red-500' : 'bg-gradient-to-r from-blue-500 to-indigo-600'}`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-white mb-1">Storm Alert Automation</h3>
            <p className="text-white/90 text-sm">Automatic lead outreach during severe weather</p>
          </div>
          <Cloud size={32} className="text-white/80" />
        </div>

        {activeAlerts.length > 0 && (
          <div className="flex items-center gap-2 text-white">
            <AlertTriangle size={20} className="animate-pulse" />
            <span className="font-semibold">{activeAlerts.length} Active Storm Alert(s)</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Check Weather Button */}
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-gray-900">Weather Monitoring</h4>
            <p className="text-xs text-gray-600">Last checked: {new Date().toLocaleTimeString()}</p>
          </div>
          <button
            onClick={checkWeatherAlerts}
            disabled={isChecking}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isChecking ? (
              <>
                <Clock size={16} className="animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <Cloud size={16} />
                Check Weather Now
              </>
            )}
          </button>
        </div>

        {/* Active Alerts */}
        {activeAlerts.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-900">Active Weather Alerts</h4>
            {activeAlerts.map((alert, index) => (
              <div key={index} className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h5 className="text-sm font-semibold text-red-900">{alert.type}</h5>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        alert.severity === 'Severe' ? 'bg-red-600 text-white' :
                        alert.severity === 'Moderate' ? 'bg-orange-500 text-white' :
                        'bg-yellow-500 text-white'
                      }`}>
                        {alert.severity}
                      </span>
                    </div>
                    <p className="text-xs text-red-700 mb-2">{alert.description}</p>
                    <div className="flex items-center gap-4 text-xs text-red-600">
                      <span>Onset: {new Date(alert.onset).toLocaleString()}</span>
                      <span>Expires: {new Date(alert.expires).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Affected Areas */}
        {affectedZipCodes.length > 0 && (
          <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-start gap-3">
              <MapPin size={20} className="text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <h5 className="text-sm font-semibold text-orange-900 mb-2">Affected Zip Codes</h5>
                <div className="flex flex-wrap gap-2">
                  {affectedZipCodes.map(zip => (
                    <span key={zip} className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-medium">
                      {zip}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Affected Contacts */}
        {affectedContacts.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={20} className="text-blue-600" />
                <h4 className="text-sm font-semibold text-gray-900">
                  {affectedContacts.length} Contacts Ready for Outreach
                </h4>
              </div>
            </div>

            {/* Message Template */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                SMS Message Template
              </label>
              <textarea
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                placeholder="Use {firstName}, {phone}, {companyName} as variables"
              />
              <p className="text-xs text-gray-500 mt-1">
                Variables: {'{firstName}'}, {'{phone}'}, {'{companyName}'}
              </p>
            </div>

            {/* Contact List Preview */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                <h5 className="text-xs font-semibold text-gray-700 uppercase">Contacts to Notify</h5>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {affectedContacts.slice(0, 10).map(contact => (
                  <div key={contact.id} className="px-4 py-2 border-b border-gray-100 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {contact.firstName} {contact.lastName}
                        </p>
                        <p className="text-xs text-gray-600">{contact.phone1}</p>
                      </div>
                      <span className="text-xs text-gray-500">{contact.zip}</span>
                    </div>
                  </div>
                ))}
                {affectedContacts.length > 10 && (
                  <div className="px-4 py-2 text-xs text-gray-500 text-center">
                    + {affectedContacts.length - 10} more contacts
                  </div>
                )}
              </div>
            </div>

            {/* Send Button */}
            <button
              onClick={sendStormAlerts}
              disabled={isSending}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 transition-all font-semibold"
            >
              {isSending ? (
                <>
                  <Clock size={20} className="animate-spin" />
                  Sending Alerts...
                </>
              ) : (
                <>
                  <Send size={20} />
                  Send Storm Alerts to {affectedContacts.length} Contacts
                </>
              )}
            </button>
          </div>
        )}

        {/* No Storms */}
        {activeAlerts.length === 0 && !isChecking && (
          <div className="text-center py-8">
            <CheckCircle size={48} className="mx-auto text-green-500 mb-4" />
            <h4 className="text-lg font-semibold text-gray-900 mb-2">No Active Storms</h4>
            <p className="text-sm text-gray-600">
              We're monitoring weather in your service area. You'll be notified when storms are detected.
            </p>
          </div>
        )}

        {/* Info Box */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h5 className="text-sm font-semibold text-blue-900 mb-2">How Storm Alerts Work:</h5>
          <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
            <li>System monitors weather in all zip codes where you have leads</li>
            <li>When severe weather is detected (hail, wind, tornado), affected leads are identified</li>
            <li>Customize your message template with personalization</li>
            <li>Send SMS alerts to all affected contacts with one click</li>
            <li>Track responses and schedule inspections automatically</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
