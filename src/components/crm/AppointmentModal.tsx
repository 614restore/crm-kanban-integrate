import React, { useState, useEffect } from 'react';
import { useCRM } from '@/lib/crmStore';
import { Appointment, mockTeamMembers } from '@/lib/crmData';
import { db } from '@/lib/database';
import { X, Calendar, Clock, MapPin, AlignLeft } from 'lucide-react';

export default function AppointmentModal() {
    const { state, dispatch } = useCRM();
    const [formData, setFormData] = useState({
        title: '',
        date: new Date().toISOString().split('T')[0],
        time: '09:00',
        duration: 60,
        type: 'inspection',
        contactId: state.contacts[0]?.id || '',
        assignedTo: state.currentUser?.id || mockTeamMembers[0].id,
        location: '',
        notes: ''
    });

    if (!state.showAppointmentModal) return null;

    // Process the pre-fill ID on component show
    useEffect(() => {
        if (state.showAppointmentModal && state.prefillContactId) {
            setFormData(prev => ({
                ...prev,
                contactId: state.prefillContactId!
            }));
        } else if (state.showAppointmentModal && !state.prefillContactId && !formData.contactId && state.contacts.length > 0) {
            setFormData(prev => ({
                ...prev,
                contactId: state.contacts[0].id
            }));
        }
    }, [state.showAppointmentModal, state.prefillContactId, state.contacts]);

    const handleClose = () => {
        dispatch({ type: 'TOGGLE_APPOINTMENT_MODAL' });
        // Reset the form manually to avoid lingering states on complex unmounts
        setFormData({
            title: '',
            date: new Date().toISOString().split('T')[0],
            time: '09:00',
            duration: 60,
            type: 'inspection',
            contactId: state.contacts[0]?.id || '',
            assignedTo: state.currentUser?.id || mockTeamMembers[0].id,
            location: '',
            notes: ''
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const contact = state.contacts.find(c => c.id === formData.contactId);

        // Save to DB
        if (state.companyId) {
            try {
                await db.createAppointment({
                    company_id: state.companyId,
                    contact_id: formData.contactId,
                    title: formData.title,
                    type: formData.type,
                    date: formData.date,
                    time: formData.time,
                    duration: Number(formData.duration),
                    assigned_to: formData.assignedTo,
                    location: formData.location,
                    notes: formData.notes,
                    status: 'scheduled'
                });
            } catch (err) {
                console.error("Error creating appointment in DB", err);
            }
        }

        // Create new appointment
        const newApt: Appointment = {
            id: `apt-${Date.now()}`,
            contactId: formData.contactId,
            contactName: contact ? `${contact.firstName} ${contact.lastName}` : 'Unknown Contact',
            title: formData.title,
            type: formData.type as any,
            date: formData.date,
            time: formData.time,
            duration: Number(formData.duration),
            assignedTo: formData.assignedTo,
            location: formData.location,
            notes: formData.notes,
            status: 'scheduled'
        };

        dispatch({ type: 'ADD_APPOINTMENT', payload: newApt });

        dispatch({
            type: 'ADD_NOTIFICATION',
            payload: {
                id: `notif-${Date.now()}`,
                type: 'success',
                title: 'Appointment Scheduled',
                message: `${formData.title} has been added to the calendar.`,
                timestamp: new Date().toISOString(),
                read: false,
            },
        });

        handleClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-xl">
                <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                    <h2 className="text-xl font-semibold text-gray-900">New Appointment</h2>
                    <button onClick={handleClose} type="button" className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                        <input required type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" placeholder="Initial Inspection" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <input required type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                            <div className="relative">
                                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <input required type="time" value={formData.time} onChange={e => setFormData({ ...formData, time: e.target.value })} className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Duration (mins)</label>
                            <select value={formData.duration} onChange={e => setFormData({ ...formData, duration: Number(e.target.value) })} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none">
                                <option value={15}>15 minutes</option>
                                <option value={30}>30 minutes</option>
                                <option value={45}>45 minutes</option>
                                <option value={60}>1 hour</option>
                                <option value={90}>1.5 hours</option>
                                <option value={120}>2 hours</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                            <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none">
                                <option value="inspection">Inspection</option>
                                <option value="estimate">Estimate</option>
                                <option value="installation">Installation</option>
                                <option value="follow_up">Follow Up</option>
                                <option value="final_walkthrough">Final Walkthrough</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Contact</label>
                        <select required value={formData.contactId} onChange={e => setFormData({ ...formData, contactId: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none">
                            <option value="" disabled>Select a contact</option>
                            {state.contacts.map(c => (
                                <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                        <div className="relative">
                            <MapPin className="absolute left-3 top-3 text-gray-400" size={16} />
                            <input type="text" value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" placeholder="123 Main St..." />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                        <div className="relative">
                            <AlignLeft className="absolute left-3 top-3 text-gray-400" size={16} />
                            <textarea rows={3} value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none" placeholder="Any special instructions..."></textarea>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-gray-200 flex justify-end gap-3">
                        <button type="button" onClick={handleClose} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium">Cancel</button>
                        <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-md shadow-blue-500/30">Save Appointment</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
