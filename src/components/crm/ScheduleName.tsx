// A customer's name, colored by how close their next appointment is (see appointmentUrgency).
// Customers with nothing scheduled keep the normal color.
import React from 'react';
import { useContactSchedule } from '@/hooks/useScheduleMap';
import { URGENCY_STYLE, describeTimeUntil } from '@/lib/appointmentUrgency';

type Tag = 'p' | 'span' | 'h1' | 'h3' | 'h4' | 'div';

interface Props {
  contactId?: string | null;
  as?: Tag;
  className?: string;
  /** The color used when no appointment colors the name. */
  fallbackClass?: string;
  children: React.ReactNode;
}

export default function ScheduleName({ contactId, as = 'span', className = '', fallbackClass = 'text-gray-900', children }: Props) {
  const schedule = useContactSchedule(contactId);
  const Tag = as;
  if (!schedule) return <Tag className={`${className} ${fallbackClass}`}>{children}</Tag>;
  const style = URGENCY_STYLE[schedule.urgency];
  const when = schedule.missed
    ? `Missed: ${schedule.appointment.title} was ${describeTimeUntil(schedule.msUntilStart)} and was never completed`
    : `${schedule.appointment.title} ${describeTimeUntil(schedule.msUntilStart)}`;
  return (
    <Tag className={`${className} ${style.text}`} title={when}>
      {children}
    </Tag>
  );
}
