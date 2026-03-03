import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  MapPin, 
  Users, 
  Phone, 
  Mail,
  Edit3,
  Trash2,
  Copy,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  User,
  Building2,
  Car,
  Wrench,
  Eye,
  Filter,
  Search,
  MoreHorizontal,
  Video,
  FileText,
  DollarSign
} from 'lucide-react';

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  type: 'inspection' | 'estimate' | 'meeting' | 'installation' | 'follow-up' | 'call' | 'site-visit';
  status: 'scheduled' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled' | 'no-show';
  contactId?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  projectId?: string;
  projectName?: string;
  location?: {
    address: string;
    city: string;
    state: string;
    zip: string;
    notes?: string;
  };
  assignedTo: string[];
  estimatedDuration: number; // minutes
  priority: 'low' | 'medium' | 'high' | 'urgent';
  reminders: {
    email: boolean;
    sms: boolean;
    time: number; // minutes before event
  }[];
  notes?: string;
  attachments?: string[];
  createdAt: string;
  updatedAt: string;
  isRecurring?: boolean;
  recurringPattern?: {
    type: 'daily' | 'weekly' | 'monthly';
    interval: number;
    endDate?: string;
  };
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  color: string;
  availability: {
    [key: string]: {
      start: string;
      end: string;
      available: boolean;
    };
  };
}

const CalendarScheduler: React.FC = () => {
  const [currentView, setCurrentView] = useState<'month' | 'week' | 'day' | 'agenda'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedTeamMembers, setSelectedTeamMembers] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    loadCalendarData();
  }, []);

  const loadCalendarData = () => {
    // Load events and team members from localStorage
    const savedEvents = localStorage.getItem('calendarEvents');
    const savedTeamMembers = localStorage.getItem('teamMembers');

    if (savedEvents) {
      setEvents(JSON.parse(savedEvents));
    } else {
      // Initialize with sample events
      const sampleEvents: CalendarEvent[] = [
        {
          id: '1',
          title: 'Roof Inspection - Johnson Property',
          description: 'Initial roof assessment for storm damage claim',
          startTime: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
          endTime: new Date(Date.now() + 86400000 + 3600000).toISOString(), // Tomorrow + 1 hour
          type: 'inspection',
          status: 'scheduled',
          contactName: 'Sarah Johnson',
          contactPhone: '(555) 123-4567',
          contactEmail: 'sarah.johnson@email.com',
          location: {
            address: '123 Main Street',
            city: 'Springfield',
            state: 'IL',
            zip: '62701'
          },
          assignedTo: ['team1'],
          estimatedDuration: 60,
          priority: 'high',
          reminders: [
            { email: true, sms: true, time: 60 },
            { email: true, sms: false, time: 24 * 60 }
          ],
          notes: 'Customer reported missing shingles after recent storm. Check gutters and downspouts as well.',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: '2',
          title: 'Project Estimate - Downtown Office',
          description: 'Commercial roofing estimate for 5-story office building',
          startTime: new Date(Date.now() + 2 * 86400000).toISOString(), // Day after tomorrow
          endTime: new Date(Date.now() + 2 * 86400000 + 7200000).toISOString(), // +2 hours
          type: 'estimate',
          status: 'confirmed',
          contactName: 'Mike Wilson',
          contactPhone: '(555) 987-6543',
          contactEmail: 'mike.wilson@downtown-llc.com',
          location: {
            address: '456 Business Plaza',
            city: 'Springfield',
            state: 'IL',
            zip: '62702'
          },
          assignedTo: ['team1', 'team2'],
          estimatedDuration: 120,
          priority: 'medium',
          reminders: [
            { email: true, sms: true, time: 120 }
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      setEvents(sampleEvents);
      localStorage.setItem('calendarEvents', JSON.stringify(sampleEvents));
    }

    if (savedTeamMembers) {
      setTeamMembers(JSON.parse(savedTeamMembers));
    } else {
      // Initialize with sample team members
      const sampleTeam: TeamMember[] = [
        {
          id: 'team1',
          name: 'John Smith',
          role: 'Lead Inspector',
          email: 'john.smith@trussctr.com',
          phone: '(555) 111-2222',
          color: '#3B82F6',
          availability: {
            monday: { start: '08:00', end: '17:00', available: true },
            tuesday: { start: '08:00', end: '17:00', available: true },
            wednesday: { start: '08:00', end: '17:00', available: true },
            thursday: { start: '08:00', end: '17:00', available: true },
            friday: { start: '08:00', end: '17:00', available: true },
            saturday: { start: '09:00', end: '15:00', available: false },
            sunday: { start: '09:00', end: '15:00', available: false }
          }
        },
        {
          id: 'team2',
          name: 'Emily Davis',
          role: 'Sales Representative',
          email: 'emily.davis@trussctr.com',
          phone: '(555) 333-4444',
          color: '#10B981',
          availability: {
            monday: { start: '09:00', end: '18:00', available: true },
            tuesday: { start: '09:00', end: '18:00', available: true },
            wednesday: { start: '09:00', end: '18:00', available: true },
            thursday: { start: '09:00', end: '18:00', available: true },
            friday: { start: '09:00', end: '17:00', available: true },
            saturday: { start: '10:00', end: '14:00', available: true },
            sunday: { start: '10:00', end: '14:00', available: false }
          }
        },
        {
          id: 'team3',
          name: 'Mike Rodriguez',
          role: 'Project Manager',
          email: 'mike.rodriguez@trussctr.com',
          phone: '(555) 555-6666',
          color: '#F59E0B',
          availability: {
            monday: { start: '07:00', end: '16:00', available: true },
            tuesday: { start: '07:00', end: '16:00', available: true },
            wednesday: { start: '07:00', end: '16:00', available: true },
            thursday: { start: '07:00', end: '16:00', available: true },
            friday: { start: '07:00', end: '16:00', available: true },
            saturday: { start: '08:00', end: '12:00', available: true },
            sunday: { start: '08:00', end: '12:00', available: false }
          }
        }
      ];
      setTeamMembers(sampleTeam);
      localStorage.setItem('teamMembers', JSON.stringify(sampleTeam));
    }
  };

  const saveEvents = (updatedEvents: CalendarEvent[]) => {
    setEvents(updatedEvents);
    localStorage.setItem('calendarEvents', JSON.stringify(updatedEvents));
  };

  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case 'inspection': return Eye;
      case 'estimate': return DollarSign;
      case 'meeting': return Users;
      case 'installation': return Wrench;
      case 'follow-up': return Phone;
      case 'call': return Phone;
      case 'site-visit': return MapPin;
      default: return CalendarIcon;
    }
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'inspection': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'estimate': return 'bg-green-100 text-green-800 border-green-200';
      case 'meeting': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'installation': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'follow-up': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'call': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'site-visit': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scheduled': return Clock;
      case 'confirmed': return CheckCircle;
      case 'in-progress': return Car;
      case 'completed': return CheckCircle;
      case 'cancelled': return AlertCircle;
      case 'no-show': return AlertCircle;
      default: return Clock;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'text-blue-600';
      case 'confirmed': return 'text-green-600';
      case 'in-progress': return 'text-orange-600';
      case 'completed': return 'text-green-700';
      case 'cancelled': return 'text-red-600';
      case 'no-show': return 'text-red-700';
      default: return 'text-gray-600';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'border-l-4 border-red-500';
      case 'high': return 'border-l-4 border-orange-500';
      case 'medium': return 'border-l-4 border-yellow-500';
      case 'low': return 'border-l-4 border-green-500';
      default: return 'border-l-4 border-gray-500';
    }
  };

  const filteredEvents = events.filter(event => {
    const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         event.contactName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         event.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filterType === 'all' || event.type === filterType;
    const matchesStatus = filterStatus === 'all' || event.status === filterStatus;
    const matchesTeam = selectedTeamMembers.length === 0 || 
                       selectedTeamMembers.some(memberId => event.assignedTo.includes(memberId));
    
    return matchesSearch && matchesType && matchesStatus && matchesTeam;
  });

  const createEvent = (eventData: Partial<CalendarEvent>) => {
    const newEvent: CalendarEvent = {
      id: crypto.randomUUID(),
      title: eventData.title || '',
      description: eventData.description,
      startTime: eventData.startTime || new Date().toISOString(),
      endTime: eventData.endTime || new Date(Date.now() + 3600000).toISOString(),
      type: eventData.type || 'meeting',
      status: 'scheduled',
      contactName: eventData.contactName,
      contactPhone: eventData.contactPhone,
      contactEmail: eventData.contactEmail,
      projectName: eventData.projectName,
      location: eventData.location,
      assignedTo: eventData.assignedTo || [],
      estimatedDuration: eventData.estimatedDuration || 60,
      priority: eventData.priority || 'medium',
      reminders: eventData.reminders || [{ email: true, sms: false, time: 60 }],
      notes: eventData.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...eventData
    };

    const updatedEvents = [...events, newEvent];
    saveEvents(updatedEvents);
    return newEvent;
  };

  const updateEvent = (eventId: string, updates: Partial<CalendarEvent>) => {
    const updatedEvents = events.map(event =>
      event.id === eventId
        ? { ...event, ...updates, updatedAt: new Date().toISOString() }
        : event
    );
    saveEvents(updatedEvents);
  };

  const deleteEvent = (eventId: string) => {
    const updatedEvents = events.filter(event => event.id !== eventId);
    saveEvents(updatedEvents);
  };

  const duplicateEvent = (event: CalendarEvent) => {
    const duplicated = {
      ...event,
      id: crypto.randomUUID(),
      title: `${event.title} (Copy)`,
      startTime: new Date(new Date(event.startTime).getTime() + 86400000).toISOString(),
      endTime: new Date(new Date(event.endTime).getTime() + 86400000).toISOString(),
      status: 'scheduled' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const updatedEvents = [...events, duplicated];
    saveEvents(updatedEvents);
  };

  // View navigation functions
  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    
    switch (currentView) {
      case 'month':
        newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
        break;
      case 'week':
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
        break;
      case 'day':
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
        break;
    }
    
    setCurrentDate(newDate);
  };

  const getDateRangeText = () => {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long'
    };
    
    switch (currentView) {
      case 'month':
        return currentDate.toLocaleDateString('en-US', options);
      case 'week':
        const startOfWeek = new Date(currentDate);
        startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        return `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      case 'day':
        return currentDate.toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
      case 'agenda':
        return 'Upcoming Events';
    }
  };

  const eventTypes = [
    { id: 'all', label: 'All Types' },
    { id: 'inspection', label: 'Inspections' },
    { id: 'estimate', label: 'Estimates' },
    { id: 'meeting', label: 'Meetings' },
    { id: 'installation', label: 'Installations' },
    { id: 'follow-up', label: 'Follow-ups' },
    { id: 'call', label: 'Calls' },
    { id: 'site-visit', label: 'Site Visits' }
  ];

  const eventStatuses = [
    { id: 'all', label: 'All Statuses' },
    { id: 'scheduled', label: 'Scheduled' },
    { id: 'confirmed', label: 'Confirmed' },
    { id: 'in-progress', label: 'In Progress' },
    { id: 'completed', label: 'Completed' },
    { id: 'cancelled', label: 'Cancelled' },
    { id: 'no-show', label: 'No Show' }
  ];

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-6 h-6 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Calendar & Scheduling</h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowEventModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              New Event
            </button>
          </div>
        </div>

        {/* Calendar Navigation */}
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigateDate('prev')}
                className="p-2 hover:bg-gray-100 rounded-md"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h2 className="text-lg font-medium text-gray-900 min-w-0">
                {getDateRangeText()}
              </h2>
              <button
                onClick={() => navigateDate('next')}
                className="p-2 hover:bg-gray-100 rounded-md"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Today
            </button>
          </div>

          <div className="flex items-center gap-2">
            {['month', 'week', 'day', 'agenda'].map((view) => (
              <button
                key={view}
                onClick={() => setCurrentView(view as any)}
                className={`px-3 py-1 text-sm rounded-md capitalize ${
                  currentView === view
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {view}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search events, contacts, or projects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {eventTypes.map((type) => (
              <option key={type.id} value={type.id}>{type.label}</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {eventStatuses.map((status) => (
              <option key={status.id} value={status.id}>{status.label}</option>
            ))}
          </select>

          {/* Team Member Filter */}
          <div className="relative">
            <button className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">
              <Users className="w-4 h-4" />
              Team Members
              {selectedTeamMembers.length > 0 && (
                <span className="bg-blue-100 text-blue-800 text-xs rounded-full px-2 py-1">
                  {selectedTeamMembers.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {currentView === 'agenda' ? (
          <AgendaView
            events={filteredEvents}
            teamMembers={teamMembers}
            onEditEvent={setSelectedEvent}
            onDeleteEvent={deleteEvent}
            onDuplicateEvent={duplicateEvent}
            onUpdateStatus={updateEvent}
          />
        ) : (
          <CalendarGridView
            view={currentView}
            currentDate={currentDate}
            events={filteredEvents}
            teamMembers={teamMembers}
            onEditEvent={setSelectedEvent}
          />
        )}
      </div>

      {/* Event Modal */}
      {showEventModal && (
        <EventModal
          event={selectedEvent}
          teamMembers={teamMembers}
          onSave={(eventData) => {
            if (selectedEvent) {
              updateEvent(selectedEvent.id, eventData);
            } else {
              createEvent(eventData);
            }
            setShowEventModal(false);
            setSelectedEvent(null);
          }}
          onClose={() => {
            setShowEventModal(false);
            setSelectedEvent(null);
          }}
        />
      )}
    </div>
  );
};

// Agenda View Component
const AgendaView: React.FC<{
  events: CalendarEvent[];
  teamMembers: TeamMember[];
  onEditEvent: (event: CalendarEvent) => void;
  onDeleteEvent: (eventId: string) => void;
  onDuplicateEvent: (event: CalendarEvent) => void;
  onUpdateStatus: (eventId: string, updates: Partial<CalendarEvent>) => void;
}> = ({ events, teamMembers, onEditEvent, onDeleteEvent, onDuplicateEvent, onUpdateStatus }) => {
  const sortedEvents = [...events].sort((a, b) => 
    new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  const getTeamMemberName = (id: string) => {
    const member = teamMembers.find(m => m.id === id);
    return member ? member.name : 'Unknown';
  };

  if (sortedEvents.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <CalendarIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">No Events Found</h3>
          <p className="text-gray-500">Try adjusting your search or filter criteria.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-4">
        {sortedEvents.map((event) => {
          const EventTypeIcon = getEventTypeIcon(event.type);
          const StatusIcon = getStatusIcon(event.status);

          return (
            <div
              key={event.id}
              className={`bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow ${getPriorityColor(event.priority)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`p-2 rounded-md ${getEventTypeColor(event.type)}`}>
                      <EventTypeIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">{event.title}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <StatusIcon className={`w-4 h-4 ${getStatusColor(event.status)}`} />
                        <span className="capitalize">{event.status}</span>
                        {event.priority !== 'medium' && (
                          <>
                            <span>•</span>
                            <span className={`capitalize font-medium ${
                              event.priority === 'urgent' ? 'text-red-600' :
                              event.priority === 'high' ? 'text-orange-600' :
                              'text-green-600'
                            }`}>
                              {event.priority} priority
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {event.description && (
                    <p className="text-gray-700 mb-3">{event.description}</p>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Clock className="w-4 h-4" />
                      <span>
                        {new Date(event.startTime).toLocaleDateString()} {' '}
                        {new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {' - '}
                        {new Date(event.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {event.contactName && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <User className="w-4 h-4" />
                        <span>{event.contactName}</span>
                      </div>
                    )}

                    {event.location && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <MapPin className="w-4 h-4" />
                        <span>{event.location.address}, {event.location.city}</span>
                      </div>
                    )}

                    {event.assignedTo.length > 0 && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Users className="w-4 h-4" />
                        <span>
                          {event.assignedTo.length === 1
                            ? getTeamMemberName(event.assignedTo[0])
                            : `${event.assignedTo.length} team members`
                          }
                        </span>
                      </div>
                    )}
                  </div>

                  {event.notes && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-md">
                      <p className="text-sm text-gray-700">{event.notes}</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 ml-4">
                  <button
                    onClick={() => onEditEvent(event)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDuplicateEvent(event)}
                    className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-md"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <div className="relative">
                    <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-md">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick Status Update */}
              {event.status === 'scheduled' && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex gap-2">
                    <button
                      onClick={() => onUpdateStatus(event.id, { status: 'confirmed' })}
                      className="px-3 py-1 text-xs bg-green-100 text-green-800 rounded-md hover:bg-green-200"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => onUpdateStatus(event.id, { status: 'in-progress' })}
                      className="px-3 py-1 text-xs bg-orange-100 text-orange-800 rounded-md hover:bg-orange-200"
                    >
                      Start
                    </button>
                    <button
                      onClick={() => onUpdateStatus(event.id, { status: 'cancelled' })}
                      className="px-3 py-1 text-xs bg-red-100 text-red-800 rounded-md hover:bg-red-200"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Calendar Grid View (placeholder for month/week/day views)
const CalendarGridView: React.FC<any> = ({ view, currentDate, events, onEditEvent }) => (
  <div className="p-6 flex items-center justify-center h-full">
    <div className="text-center">
      <CalendarIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-600 mb-2">
        {view.charAt(0).toUpperCase() + view.slice(1)} View
      </h3>
      <p className="text-gray-500">
        {view.charAt(0).toUpperCase() + view.slice(1)} calendar view is coming soon.
      </p>
    </div>
  </div>
);

// Event Modal (placeholder)
const EventModal: React.FC<any> = ({ onClose }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
      <h2 className="text-lg font-medium mb-4">Event Modal</h2>
      <p className="text-gray-600 mb-4">Event creation/editing interface will be here.</p>
      <button
        onClick={onClose}
        className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
      >
        Close
      </button>
    </div>
  </div>
);

export default CalendarScheduler;