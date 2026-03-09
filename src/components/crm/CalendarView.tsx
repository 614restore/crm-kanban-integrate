import React, { useState, useMemo, useEffect } from 'react';
import { useCRM } from '@/lib/crmStore';
import { Appointment, formatDate } from '@/lib/crmData';
import { db } from '@/lib/database';
import { getMentionTargets, validateMentions } from '@/lib/mentions';
import { toast } from 'sonner';
import AppointmentModal from './AppointmentModal';
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
  AlertTriangle,
} from 'lucide-react';

type ViewMode = 'month' | 'week' | 'list';

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
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [pendingContactId, setPendingContactId] = useState<string | null>(null);

  // Auto-open appointment modal when navigated here from "Add New Contact" → "Save & Open Calendar"
  useEffect(() => {
    if (state.pendingAppointmentContactId) {
      setPendingContactId(state.pendingAppointmentContactId);
      setEditingAppointment(null);
      setShowModal(true);
      dispatch({ type: 'SET_PENDING_APPOINTMENT_CONTACT', payload: null });
    }
  }, [state.pendingAppointmentContactId]);
  const mentionTargets = getMentionTargets(state.teamMembers);

  const allAppointments = [...state.appointments];

  const filteredAppointments = useMemo(() => {
    return allAppointments.filter((apt) => {
      const matchesAssignee = filterAssignee === 'all' || apt.assignedTo === filterAssignee;
      const matchesType = filterType === 'all' || apt.type === filterType;
      return matchesAssignee && matchesType;
    });
  }, [allAppointments, filterAssignee, filterType]);

  const sortedAppointments = useMemo(() => {
    return [...filteredAppointments].sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time}`);
      const dateB = new Date(`${b.date}T${b.time}`);
      return dateA.getTime() - dateB.getTime();
    });
  }, [filteredAppointments]);

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${minutes} ${ampm}`;
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
  };

  const isSameDay = (d1: Date, d2: Date) =>
    d1.getDate() === d2.getDate() && d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();

  const getAppointmentsForDate = (date: Date) => {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return filteredAppointments.filter((apt) => apt.date === dateStr);
  };

  const getMonthDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay();
    const days: { date: Date; inMonth: boolean }[] = [];
    for (let i = startPad - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: d, inMonth: false });
    }
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), inMonth: true });
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), inMonth: false });
    }
    return days;
  };

  const monthDays = getMonthDays();

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

  const weekDates = getWeekDates(selectedDate || currentMonth);

  const appointmentsByDate = sortedAppointments.reduce(
    (acc, apt) => {
      if (!acc[apt.date]) acc[apt.date] = [];
      acc[apt.date].push(apt);
      return acc;
    },
    {} as Record<string, Appointment[]>
  );

  const handlePrevMonth = () => {
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() - 1);
    setCurrentMonth(d);
  };
  const handleNextMonth = () => {
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() + 1);
    setCurrentMonth(d);
  };
  const handlePrevWeek = () => {
    const d = new Date(selectedDate || currentMonth);
    d.setDate(d.getDate() - 7);
    setSelectedDate(d);
  };
  const handleNextWeek = () => {
    const d = new Date(selectedDate || currentMonth);
    d.setDate(d.getDate() + 7);
    setSelectedDate(d);
  };
  const handleToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    setSelectedDate(today);
  };

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
  };
  const handleDayDoubleClick = (date: Date) => {
    setSelectedDate(date);
    setEditingAppointment(null);
    setShowModal(true);
  };

  const handleNewAppointment = () => {
    setEditingAppointment(null);
    setShowModal(true);
  };

  const handleEditAppointment = (apt: Appointment) => {
    setEditingAppointment(apt);
    setShowModal(true);
  };

  const handleCompleteInspection = async (appointment: Appointment) => {
    if (appointment.type !== 'inspection' || appointment.status === 'completed') return;
    const notes = '';
    const updatedAppointment: Appointment = {
      ...appointment,
      status: 'completed',
      notes: appointment.notes ? `${appointment.notes}\n\nCompleted: ${notes}` : `Completed: ${notes}`,
    };
    const updated = await db.updateAppointment(appointment.id, {
      status: 'completed',
      notes: updatedAppointment.notes,
    });
    if (!updated) {
      toast.error('Failed to update appointment');
      return;
    }
    dispatch({ type: 'UPDATE_APPOINTMENT', payload: updatedAppointment });

    // Persist contact status advancement to DB
    if (appointment.contactId) {
      const contact = state.contacts.find((c) => c.id === appointment.contactId);
      if (contact && contact.status === 'appt_set') {
        const now = new Date().toISOString();
        await db.updateContact(appointment.contactId, {
          status: 'inspection_completed',
          status_changed_at: now,
          inspectionCompleted: true,
          inspectionCompletedDate: now,
        }).catch((err) => console.error('Failed to advance contact status:', err));
      }
    }

    toast.success('Inspection marked as complete!');
  };

  const handleDeleteAppointment = (appointment: Appointment) => {
    toast.warning(`Delete "${appointment.title}"? This cannot be undone.`, {
      action: {
        label: 'Delete',
        onClick: async () => {
          const ok = await db.deleteAppointment(appointment.id);
          if (!ok) { toast.error('Failed to delete appointment'); return; }
          dispatch({ type: 'DELETE_APPOINTMENT', payload: appointment.id });
          toast.success('Appointment deleted');
        },
      },
      cancel: { label: 'Cancel' },
      duration: 8000,
    });
  };

  const renderMentions = (value: string) => {
    const known = new Set(mentionTargets.map((t) => t.handle.toLowerCase()));
    return value.split(/(@[a-zA-Z0-9_]+)/g).map((part, index) => {
      if (!part.startsWith('@')) return <React.Fragment key={index}>{part}</React.Fragment>;
      const handle = part.slice(1).toLowerCase();
      if (!known.has(handle)) return <React.Fragment key={index}>{part}</React.Fragment>;
      return (
        <span key={index} className="font-medium text-blue-700">
          {part}
        </span>
      );
    });
  };

  const unassignedCount = allAppointments.filter((a) => !a.assignedTo && a.status === 'scheduled').length;

  const selectedDayAppointments = selectedDate
    ? getAppointmentsForDate(selectedDate).sort((a, b) => a.time.localeCompare(b.time))
    : [];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Calendar</h2>
            <p className="text-gray-500 mt-1">
              {sortedAppointments.length} appointment{sortedAppointments.length !== 1 ? 's' : ''} scheduled
              {unassignedCount > 0 && (
                <span className="ml-2 text-amber-600 font-medium">
                  <AlertTriangle size={14} className="inline mr-1" />
                  {unassignedCount} unassigned
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleToday} className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors font-medium">
              Today
            </button>
            <button onClick={handleNewAppointment} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              <Plus size={18} />
              <span className="font-medium">New Appointment</span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <button onClick={viewMode === 'month' ? handlePrevMonth : handlePrevWeek} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <ChevronLeft size={20} />
              </button>
              <span className="font-medium text-gray-900 min-w-[200px] text-center">
                {viewMode === 'month'
                  ? currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                  : `${weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
              </span>
              <button onClick={viewMode === 'month' ? handleNextMonth : handleNextWeek} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <ChevronRight size={20} />
              </button>
            </div>

            <select value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm">
              <option value="all">All Team Members</option>
              {state.teamMembers.map((tm) => (
                <option key={tm.id} value={tm.id}>{tm.name}</option>
              ))}
            </select>

            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm">
              <option value="all">All Types</option>
              {Object.entries(appointmentTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {(['month', 'week', 'list'] as ViewMode[]).map((mode) => (
              <button key={mode} onClick={() => setViewMode(mode)} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === mode ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:bg-gray-200'}`}>
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-gray-50">
        {viewMode === 'month' ? (
          <div className="flex h-full">
            <div className="flex-1 p-4">
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden h-full flex flex-col">
                <div className="grid grid-cols-7 border-b border-gray-200">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <div key={day} className="p-2 text-center text-sm font-semibold text-gray-500 bg-gray-50">{day}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 flex-1">
                  {monthDays.map(({ date, inMonth }, idx) => {
                    const dayApts = getAppointmentsForDate(date);
                    const isSelected = selectedDate && isSameDay(date, selectedDate);
                    const today = isToday(date);
                    const hasUnassigned = dayApts.some((a) => !a.assignedTo && a.status === 'scheduled');
                    return (
                      <div key={idx} onClick={() => handleDayClick(date)} onDoubleClick={() => handleDayDoubleClick(date)} className={`min-h-[90px] p-1 border-b border-r border-gray-100 cursor-pointer transition-colors ${!inMonth ? 'bg-gray-50/50' : 'bg-white hover:bg-blue-50/30'} ${isSelected ? 'ring-2 ring-blue-500 ring-inset bg-blue-50/50' : ''}`}>
                        <div className="flex items-center justify-between px-1">
                          <span className={`text-sm font-medium ${today ? 'bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center' : inMonth ? 'text-gray-900' : 'text-gray-400'}`}>
                            {date.getDate()}
                          </span>
                          {hasUnassigned && <AlertTriangle size={12} className="text-amber-500" />}
                        </div>
                        <div className="mt-1 space-y-0.5">
                          {dayApts.slice(0, 3).map((apt) => {
                            const colorCls = appointmentTypeColors[apt.type] || 'bg-gray-100 text-gray-700 border-gray-200';
                            return (
                              <div key={apt.id} className={`text-[10px] leading-tight px-1 py-0.5 rounded truncate border ${colorCls} ${!apt.assignedTo ? 'border-dashed border-amber-400' : ''}`} title={`${formatTime(apt.time)} - ${apt.title} (${apt.contactName})`}>
                                {formatTime(apt.time).replace(' ', '')} {apt.title}
                              </div>
                            );
                          })}
                          {dayApts.length > 3 && <span className="text-[10px] text-gray-500 px-1">+{dayApts.length - 3} more</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Day Detail Sidebar */}
            <div className="w-80 border-l border-gray-200 bg-white p-4 overflow-y-auto">
              {selectedDate ? (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-gray-900">{selectedDate.toLocaleDateString('en-US', { weekday: 'long' })}</h3>
                      <p className="text-sm text-gray-500">{selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                    <button onClick={() => { setEditingAppointment(null); setShowModal(true); }} className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors" title="Schedule appointment on this day">
                      <Plus size={16} />
                    </button>
                  </div>
                  {selectedDayAppointments.length === 0 ? (
                    <div className="text-center py-8">
                      <Calendar size={32} className="mx-auto mb-2 text-gray-300" />
                      <p className="text-sm text-gray-500">No appointments</p>
                      <button onClick={() => { setEditingAppointment(null); setShowModal(true); }} className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium">+ Schedule one</button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedDayAppointments.map((apt) => {
                        const assignee = state.teamMembers.find((tm) => tm.id === apt.assignedTo);
                        return (
                          <div key={apt.id} className={`rounded-lg border p-3 ${!apt.assignedTo ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white'}`}>
                            <div className="flex items-start justify-between mb-1">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${appointmentTypeColors[apt.type] || 'bg-gray-100 text-gray-700'}`}>
                                    {appointmentTypeLabels[apt.type]}
                                  </span>
                                  {apt.status === 'completed' && <CheckCircle size={12} className="text-green-500" />}
                                </div>
                                <p className="font-semibold text-gray-900 text-sm truncate">{apt.title}</p>
                              </div>
                            </div>
                            <p className="text-xs text-gray-600 mb-1">{apt.contactName}</p>
                            <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                              <span className="flex items-center gap-1"><Clock size={11} />{formatTime(apt.time)} &middot; {apt.duration}min</span>
                            </div>
                            {apt.location && (
                              <p className="text-xs text-gray-500 flex items-center gap-1 mb-2"><MapPin size={11} /><span className="truncate">{apt.location}</span></p>
                            )}
                            <div className="flex items-center gap-2 mb-2">
                              {assignee ? (
                                <div className="flex items-center gap-1.5">
                                  <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-medium text-blue-700">{assignee.name.charAt(0)}</div>
                                  <span className="text-xs text-gray-600">{assignee.name}</span>
                                </div>
                              ) : (
                                <span className="text-xs text-amber-600 flex items-center gap-1"><AlertTriangle size={11} />Unassigned</span>
                              )}
                            </div>
                            {apt.notes && (
                              <p className="text-xs text-gray-500 bg-gray-50 rounded p-2 mb-2">{renderMentions(apt.notes)}</p>
                            )}
                            <div className="flex items-center gap-1 pt-1 border-t border-gray-100">
                              {apt.type === 'inspection' && apt.status === 'scheduled' && (
                                <button onClick={() => handleCompleteInspection(apt)} className="p-1.5 hover:bg-green-100 rounded transition-colors" title="Mark complete"><CheckCircle size={14} className="text-green-600" /></button>
                              )}
                              <button onClick={() => handleEditAppointment(apt)} className="p-1.5 hover:bg-gray-100 rounded transition-colors" title="Edit"><Edit2 size={14} className="text-gray-500" /></button>
                              <button onClick={() => handleDeleteAppointment(apt)} className="p-1.5 hover:bg-red-100 rounded transition-colors" title="Delete"><Trash2 size={14} className="text-red-500" /></button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <Calendar size={32} className="mx-auto mb-2 text-gray-300" />
                  <p className="text-sm text-gray-500">Click a day to see appointments</p>
                  <p className="text-xs text-gray-400 mt-1">Double-click to schedule</p>
                </div>
              )}
            </div>
          </div>
        ) : viewMode === 'week' ? (
          <div className="p-4">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="grid grid-cols-7 border-b border-gray-200">
                {weekDates.map((date, index) => (
                  <div key={index} className={`p-3 text-center border-r border-gray-200 last:border-r-0 cursor-pointer hover:bg-blue-50 transition-colors ${isToday(date) ? 'bg-blue-50' : ''} ${selectedDate && isSameDay(date, selectedDate) ? 'ring-2 ring-blue-500 ring-inset' : ''}`} onClick={() => handleDayClick(date)} onDoubleClick={() => handleDayDoubleClick(date)}>
                    <p className="text-xs text-gray-500">{date.toLocaleDateString('en-US', { weekday: 'short' })}</p>
                    <p className={`text-xl font-bold mt-0.5 ${isToday(date) ? 'text-blue-600' : 'text-gray-900'}`}>{date.getDate()}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 min-h-[500px]">
                {weekDates.map((date, index) => {
                  const dayApts = getAppointmentsForDate(date).sort((a, b) => a.time.localeCompare(b.time));
                  return (
                    <div key={index} className={`p-2 border-r border-gray-200 last:border-r-0 ${isToday(date) ? 'bg-blue-50/50' : ''}`}>
                      {dayApts.map((apt) => {
                        const colorCls = appointmentTypeColors[apt.type] || 'bg-gray-100 text-gray-700 border-gray-200';
                        return (
                          <div key={apt.id} onClick={() => handleEditAppointment(apt)} className={`p-2 rounded-lg mb-2 text-xs border cursor-pointer hover:shadow-md transition-shadow ${colorCls} ${!apt.assignedTo ? 'border-dashed border-amber-400' : ''}`}>
                            <p className="font-semibold truncate">{apt.title}</p>
                            <p className="opacity-75">{formatTime(apt.time)}</p>
                            <p className="truncate">{apt.contactName}</p>
                            {!apt.assignedTo && <p className="text-amber-600 mt-0.5 flex items-center gap-0.5"><AlertTriangle size={10} />Unassigned</p>}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {Object.entries(appointmentsByDate).map(([date, appointments]) => (
              <div key={date}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`px-3 py-1 rounded-lg text-sm font-medium ${isToday(new Date(date + 'T12:00:00')) ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}>
                    {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                  </div>
                  <span className="text-sm text-gray-500">{appointments.length} appointment{appointments.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="space-y-3">
                  {appointments.map((apt) => {
                    const assignee = state.teamMembers.find((tm) => tm.id === apt.assignedTo);
                    return (
                      <div key={apt.id} className={`bg-white rounded-xl border p-4 hover:shadow-md transition-shadow ${!apt.assignedTo ? 'border-amber-300' : 'border-gray-200'}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-4">
                            <div className="text-center min-w-[60px]">
                              <p className="text-2xl font-bold text-gray-900">{formatTime(apt.time).split(' ')[0]}</p>
                              <p className="text-sm text-gray-500">{formatTime(apt.time).split(' ')[1]}</p>
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-gray-900">{apt.title}</h3>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${appointmentTypeColors[apt.type]}`}>{appointmentTypeLabels[apt.type]}</span>
                                {apt.status === 'completed' && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">Completed</span>}
                                {!apt.assignedTo && apt.status === 'scheduled' && (
                                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1"><AlertTriangle size={10} />Unassigned</span>
                                )}
                              </div>
                              <p className="text-gray-600">{apt.contactName}</p>
                              <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                                {apt.location && <span className="flex items-center gap-1"><MapPin size={14} />{apt.location}</span>}
                                <span className="flex items-center gap-1"><Clock size={14} />{apt.duration} min</span>
                                {assignee && <span className="flex items-center gap-1"><User size={14} />{assignee.name}</span>}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {apt.type === 'inspection' && apt.status === 'scheduled' && (
                              <button onClick={() => handleCompleteInspection(apt)} className="p-2 hover:bg-green-100 rounded-lg transition-colors" title="Mark inspection complete"><CheckCircle size={16} className="text-green-600" /></button>
                            )}
                            <button onClick={() => handleEditAppointment(apt)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><Edit2 size={16} className="text-gray-500" /></button>
                            <button onClick={() => handleDeleteAppointment(apt)} className="p-2 hover:bg-red-100 rounded-lg transition-colors"><Trash2 size={16} className="text-red-500" /></button>
                          </div>
                        </div>
                        {apt.notes && <p className="mt-3 text-sm text-gray-500 bg-gray-50 rounded-lg p-3">{renderMentions(apt.notes)}</p>}
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
        )}
      </div>

      <AppointmentModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingAppointment(null); setPendingContactId(null); }}
        selectedDate={selectedDate || undefined}
        editingAppointment={editingAppointment}
        preselectedContactId={pendingContactId || undefined}
      />
    </div>
  );
}
