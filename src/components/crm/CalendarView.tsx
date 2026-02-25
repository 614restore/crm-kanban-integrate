import React, { useState } from 'react';
import { useCRM, useUpcomingAppointments } from '@/lib/crmStore';
import { Appointment, formatDate } from '@/lib/crmData';
import { db } from '@/lib/database';
import { toast } from 'sonner';
import {
  Calendar,
  Clock,
  MapPin,
  User,
  Plus,
  ChevronLeft,
  ChevronRight,
  Filter,
  List,
  Grid,
  CheckCircle,
  XCircle,
  Edit2,
  Trash2,
  Phone,
  Video,
} from 'lucide-react';

type ViewMode = 'list' | 'week';

const appointmentTypeColors: Record<string, string> = {
  inspection: 'bg-blue-100 text-blue-800 border-blue-200',
  estimate: 'bg-purple-100 text-purple-800 border-purple-200',
  follow_up: 'bg-green-100 text-green-800 border-green-200',
  installation: 'bg-orange-100 text-orange-800 border-orange-200',
  final_walkthrough: 'bg-teal-100 text-teal-800 border-teal-200',
};

const appointmentTypeLabels: Record<string, string> = {
  inspection: 'Inspection',
  estimate: 'Estimate',
  follow_up: 'Follow-up',
  installation: 'Installation',
  final_walkthrough: 'Final Walkthrough',
};

export default function CalendarView() {
  const { state, dispatch } = useCRM();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  // Get all appointments (mock + state)
  const allAppointments = [...state.appointments];

  // Filter appointments
  const filteredAppointments = allAppointments.filter((apt) => {
    const matchesAssignee = filterAssignee === 'all' || apt.assignedTo === filterAssignee;
    const matchesType = filterType === 'all' || apt.type === filterType;
    return matchesAssignee && matchesType;
  });

  // Sort by date and time
  const sortedAppointments = [...filteredAppointments].sort((a, b) => {
    const dateA = new Date(`${a.date}T${a.time}`);
    const dateB = new Date(`${b.date}T${b.time}`);
    return dateA.getTime() - dateB.getTime();
  });

  // Group appointments by date for list view
  const appointmentsByDate = sortedAppointments.reduce((acc, apt) => {
    if (!acc[apt.date]) {
      acc[apt.date] = [];
    }
    acc[apt.date].push(apt);
    return acc;
  }, {} as Record<string, Appointment[]>);

  // Get week dates for week view
  const getWeekDates = (date: Date) => {
    const start = new Date(date);
    start.setDate(start.getDate() - start.getDay());
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      dates.push(d);
    }
    return dates;
  };

  const weekDates = getWeekDates(selectedDate);

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${minutes} ${ampm}`;
  };

  const handlePrevWeek = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 7);
    setSelectedDate(newDate);
  };

  const handleNextWeek = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 7);
    setSelectedDate(newDate);
  };

  const handleToday = () => {
    setSelectedDate(new Date());
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const getAppointmentsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return sortedAppointments.filter((apt) => apt.date === dateStr);
  };

  const handleCreateAppointment = async () => {
    if (state.contacts.length === 0) {
      toast.error('Add a contact first before creating an appointment');
      return;
    }

    const contact = state.contacts[0];
    const defaultDate = selectedDate.toISOString().split('T')[0];
    const title = window.prompt('Appointment title', 'Initial Inspection');
    if (!title?.trim()) return;

    const time = window.prompt('Appointment time (HH:MM)', '09:00') || '09:00';

    const newAppointment: Appointment = {
      id: `apt-${Date.now()}`,
      contactId: contact.id,
      contactName: `${contact.firstName} ${contact.lastName}`,
      title: title.trim(),
      type: 'inspection',
      date: defaultDate,
      time,
      duration: 60,
      assignedTo: state.currentUser?.id || '',
      location: contact.address || '',
      notes: '',
      status: 'scheduled',
    };

    if (state.companyId) {
      const created = await db.createAppointment({
        company_id: state.companyId,
        contact_id: contact.id,
        title: newAppointment.title,
        type: newAppointment.type,
        date: newAppointment.date,
        time: newAppointment.time,
        duration: newAppointment.duration,
        assigned_to: newAppointment.assignedTo || undefined,
        location: newAppointment.location || undefined,
        notes: newAppointment.notes || undefined,
        status: newAppointment.status,
      });

      if (created) {
        newAppointment.id = created.id;
      }
    }

    dispatch({ type: 'ADD_APPOINTMENT', payload: newAppointment });
    toast.success('Appointment created');
  };

  const handleEditAppointment = async (appointment: Appointment) => {
    const title = window.prompt('Edit appointment title', appointment.title);
    if (!title?.trim()) return;

    const updatedAppointment: Appointment = {
      ...appointment,
      title: title.trim(),
    };

    if (state.companyId) {
      const updated = await db.updateAppointment(appointment.id, {
        title: updatedAppointment.title,
      });

      if (!updated) {
        toast.error('Failed to update appointment');
        return;
      }
    }

    dispatch({ type: 'UPDATE_APPOINTMENT', payload: updatedAppointment });
    toast.success('Appointment updated');
  };

  const handleDeleteAppointment = async (appointment: Appointment) => {
    const confirmed = window.confirm(`Delete appointment \"${appointment.title}\"?`);
    if (!confirmed) return;

    if (state.companyId) {
      const ok = await db.deleteAppointment(appointment.id);
      if (!ok) {
        toast.error('Failed to delete appointment');
        return;
      }
    }

    dispatch({ type: 'DELETE_APPOINTMENT', payload: appointment.id });
    toast.success('Appointment deleted');
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Calendar</h2>
            <p className="text-gray-500 mt-1">
              {sortedAppointments.length} appointments scheduled
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleToday}
              className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Today
            </button>
            <button
              onClick={handleCreateAppointment}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={18} />
              <span className="font-medium">New Appointment</span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Date Navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevWeek}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              <span className="font-medium text-gray-900 min-w-[200px] text-center">
                {weekDates[0].toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} -{' '}
                {weekDates[6].toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
              <button
                onClick={handleNextWeek}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronRight size={20} />
              </button>
            </div>

            {/* Filters */}
            <select
              value={filterAssignee}
              onChange={(e) => setFilterAssignee(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            >
              <option value="all">All Team Members</option>
              {state.teamMembers.map((tm) => (
                <option key={tm.id} value={tm.id}>
                  {tm.name}
                </option>
              ))}
            </select>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            >
              <option value="all">All Types</option>
              {Object.entries(appointmentTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'list' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
              }`}
            >
              <List size={18} className={viewMode === 'list' ? 'text-blue-600' : 'text-gray-500'} />
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'week' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
              }`}
            >
              <Grid size={18} className={viewMode === 'week' ? 'text-blue-600' : 'text-gray-500'} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 bg-gray-50">
        {viewMode === 'list' ? (
          // List View
          <div className="space-y-6">
            {Object.entries(appointmentsByDate).map(([date, appointments]) => (
              <div key={date}>
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={`px-3 py-1 rounded-lg text-sm font-medium ${
                      isToday(new Date(date))
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {new Date(date).toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                  <span className="text-sm text-gray-500">
                    {appointments.length} appointment{appointments.length !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="space-y-3">
                  {appointments.map((apt) => {
                    const assignee = state.teamMembers.find((tm) => tm.id === apt.assignedTo);
                    return (
                      <div
                        key={apt.id}
                        className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-4">
                            <div className="text-center min-w-[60px]">
                              <p className="text-2xl font-bold text-gray-900">
                                {formatTime(apt.time).split(' ')[0]}
                              </p>
                              <p className="text-sm text-gray-500">
                                {formatTime(apt.time).split(' ')[1]}
                              </p>
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-gray-900">{apt.title}</h3>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                                    appointmentTypeColors[apt.type]
                                  }`}
                                >
                                  {appointmentTypeLabels[apt.type]}
                                </span>
                              </div>
                              <p className="text-gray-600">{apt.contactName}</p>
                              <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                                <span className="flex items-center gap-1">
                                  <MapPin size={14} />
                                  {apt.location}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock size={14} />
                                  {apt.duration} min
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {assignee && (
                              <img
                                src={assignee.avatar}
                                alt={assignee.name}
                                className="w-10 h-10 rounded-full object-cover"
                                title={assignee.name}
                              />
                            )}
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleEditAppointment(apt)}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                              >
                                <Edit2 size={16} className="text-gray-500" />
                              </button>
                              <button
                                onClick={() => handleDeleteAppointment(apt)}
                                className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                              >
                                <Trash2 size={16} className="text-red-500" />
                              </button>
                            </div>
                          </div>
                        </div>
                        {apt.notes && (
                          <p className="mt-3 text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
                            {apt.notes}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {Object.keys(appointmentsByDate).length === 0 && (
              <div className="text-center py-12">
                <Calendar size={48} className="mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">No appointments</h3>
                <p className="text-gray-500">No appointments match your current filters</p>
              </div>
            )}
          </div>
        ) : (
          // Week View
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Week Header */}
            <div className="grid grid-cols-7 border-b border-gray-200">
              {weekDates.map((date, index) => (
                <div
                  key={index}
                  className={`p-4 text-center border-r border-gray-200 last:border-r-0 ${
                    isToday(date) ? 'bg-blue-50' : ''
                  }`}
                >
                  <p className="text-sm text-gray-500">
                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </p>
                  <p
                    className={`text-2xl font-bold mt-1 ${
                      isToday(date) ? 'text-blue-600' : 'text-gray-900'
                    }`}
                  >
                    {date.getDate()}
                  </p>
                </div>
              ))}
            </div>

            {/* Week Content */}
            <div className="grid grid-cols-7 min-h-[500px]">
              {weekDates.map((date, index) => {
                const dayAppointments = getAppointmentsForDate(date);
                return (
                  <div
                    key={index}
                    className={`p-2 border-r border-gray-200 last:border-r-0 ${
                      isToday(date) ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    {dayAppointments.map((apt) => (
                      <div
                        key={apt.id}
                        className={`p-2 rounded-lg mb-2 text-xs border ${
                          appointmentTypeColors[apt.type]
                        }`}
                      >
                        <p className="font-semibold truncate">{apt.title}</p>
                        <p className="text-gray-600 truncate">{formatTime(apt.time)}</p>
                        <p className="truncate">{apt.contactName}</p>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
