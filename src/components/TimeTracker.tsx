import React, { useState, useEffect } from 'react';
import { Play, Pause, Square, Clock, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import * as db from '@/lib/database';

interface TimeEntry {
  id: string;
  work_order_id: string;
  description: string;
  start_time: string;
  end_time?: string;
  duration_minutes?: number;
  is_active: boolean;
  user_id?: string;
}

interface TimeTrackerProps {
  workOrderId: string;
  companyId: string;
  estimatedHours?: number;
  onLaborHoursUpdate?: (actualHours: number) => void;
}

export default function TimeTracker({ 
  workOrderId, 
  companyId, 
  estimatedHours = 0,
  onLaborHoursUpdate 
}: TimeTrackerProps) {
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [description, setDescription] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [actualHours, setActualHours] = useState(0);
  const [loading, setLoading] = useState(false);

  // Load existing time entries
  useEffect(() => {
    loadTimeEntries();
  }, [workOrderId]);

  // Timer effect for active time tracking
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (activeEntry) {
      interval = setInterval(() => {
        const startTime = new Date(activeEntry.start_time).getTime();
        const now = Date.now();
        setElapsedTime(Math.floor((now - startTime) / 1000));
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeEntry]);

  const loadTimeEntries = async () => {
    try {
      const entries = await db.getTimeEntries(workOrderId);
      setTimeEntries(entries);
      
      // Check for active entry
      const active = entries.find(entry => entry.is_active);
      setActiveEntry(active || null);
      
      // Calculate total actual hours from completed entries
      const totalMinutes = entries
        .filter(entry => entry.duration_minutes)
        .reduce((sum, entry) => sum + (entry.duration_minutes || 0), 0);
      
      const hours = totalMinutes / 60;
      setActualHours(hours);
      onLaborHoursUpdate?.(hours);
    } catch (error) {
      console.error('Failed to load time entries:', error);
      toast.error('Failed to load time entries');
    }
  };

  const startTimer = async () => {
    if (activeEntry) {
      toast.error('Timer is already running');
      return;
    }

    setLoading(true);
    try {
      const entry = await db.createTimeEntry({
        work_order_id: workOrderId,
        company_id: companyId,
        description: description.trim() || 'Work session',
        start_time: new Date().toISOString(),
        is_active: true
      });

      setActiveEntry(entry);
      setDescription('');
      setElapsedTime(0);
      toast.success('Timer started');
    } catch (error) {
      console.error('Failed to start timer:', error);
      toast.error('Failed to start timer');
    } finally {
      setLoading(false);
    }
  };

  const pauseTimer = async () => {
    if (!activeEntry) return;

    setLoading(true);
    try {
      await db.updateTimeEntry(activeEntry.id, {
        end_time: new Date().toISOString(),
        is_active: false
      });

      toast.success('Timer paused');
      await loadTimeEntries(); // Reload to get updated data
    } catch (error) {
      console.error('Failed to pause timer:', error);
      toast.error('Failed to pause timer');
    } finally {
      setLoading(false);
    }
  };

  const stopTimer = async () => {
    if (!activeEntry) return;

    setLoading(true);
    try {
      await db.updateTimeEntry(activeEntry.id, {
        end_time: new Date().toISOString(),
        is_active: false
      });

      setActiveEntry(null);
      setElapsedTime(0);
      toast.success('Timer stopped');
      await loadTimeEntries(); // Reload to get updated data
    } catch (error) {
      console.error('Failed to stop timer:', error);
      toast.error('Failed to stop timer');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Labor Time Tracking
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Timer */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-4">
            {activeEntry ? (
              <>
                <div className="text-2xl font-mono font-bold text-blue-600">
                  {formatTime(elapsedTime)}
                </div>
                <div className="text-sm text-gray-600">
                  {activeEntry.description}
                </div>
              </>
            ) : (
              <div className="text-lg text-gray-500">
                Ready to start timing
              </div>
            )}
          </div>
          
          <div className="flex gap-2">
            {!activeEntry ? (
              <Button
                onClick={startTimer}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700"
              >
                <Play className="h-4 w-4 mr-2" />
                Start
              </Button>
            ) : (
              <>
                <Button
                  onClick={pauseTimer}
                  disabled={loading}
                  variant="outline"
                >
                  <Pause className="h-4 w-4 mr-2" />
                  Pause
                </Button>
                <Button
                  onClick={stopTimer}
                  disabled={loading}
                  variant="destructive"
                >
                  <Square className="h-4 w-4 mr-2" />
                  Stop
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Task Description Input */}
        {!activeEntry && (
          <div className="space-y-2">
            <Label htmlFor="description">What are you working on?</Label>
            <Textarea
              id="description"
              placeholder="e.g., Installing flooring, Electrical work, Site cleanup..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
        )}

        {/* Labor Hours Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-blue-50 rounded-lg">
            <div className="text-sm text-blue-600 font-medium">Estimated</div>
            <div className="text-xl font-bold text-blue-800">
              {estimatedHours.toFixed(1)}h
            </div>
          </div>
          <div className="p-3 bg-green-50 rounded-lg">
            <div className="text-sm text-green-600 font-medium">Actual</div>
            <div className="text-xl font-bold text-green-800">
              {actualHours.toFixed(1)}h
            </div>
          </div>
        </div>

        {/* Variance Alert */}
        {actualHours > estimatedHours && estimatedHours > 0 && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="text-sm text-yellow-800">
              ⚠️ Actual hours exceed estimate by {(actualHours - estimatedHours).toFixed(1)}h
            </div>
          </div>
        )}

        {/* Time Entries History */}
        {timeEntries.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Recent Sessions</Label>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {timeEntries
                .filter(entry => entry.duration_minutes)
                .slice(-10) // Show last 10 entries
                .reverse()
                .map(entry => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <span className="truncate max-w-32">
                        {entry.description}
                      </span>
                    </div>
                    <div className="font-mono">
                      {formatDuration(entry.duration_minutes || 0)}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}