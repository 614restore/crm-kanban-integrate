/**
 * MobileKanban — Touch-optimized pipeline board for phones/tablets.
 *
 * HTML5 drag-and-drop does NOT work on mobile browsers. This component
 * uses React pointer events (onPointerDown / onPointerMove / onPointerUp)
 * which work equally well with touch and mouse.
 *
 * UX model:
 * - Long-press (300 ms) a card to "pick it up"
 * - Drag it left/right; column targets highlight as you pass over them
 * - Release to drop; status updates instantly + syncs to DB
 * - Tap a card (no drag) to open the contact detail
 */
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useCRM, useCurrentBoard } from '@/lib/crmStore';
import { useAuth } from '@/lib/authContext';
import { db } from '@/lib/database';
import { toast } from 'sonner';
import {
  Contact,
  KanbanColumn,
  CustomerStatus,
  getContactFullName,
  formatCurrency,
  statusLabels,
} from '@/lib/crmData';
import { MapPin, DollarSign, Clock, Phone, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function getStaleAlert(contact: Contact) {
  const since = contact.statusChangedAt || contact.updatedAt || contact.createdAt;
  if (!since) return null;
  const days = Math.floor((Date.now() - new Date(since).getTime()) / 86400000);
  if (days >= 21) return { label: `${days}d`, color: 'bg-red-500' };
  if (days >= 14) return { label: `${days}d`, color: 'bg-orange-500' };
  if (days >= 7) return { label: `${days}d`, color: 'bg-yellow-500' };
  return null;
}

// ─────────────────────────────────────────────────────────────────
// Contact Card
// ─────────────────────────────────────────────────────────────────

interface ContactCardProps {
  contact: Contact;
  onSelect: (id: string) => void;
  isDragging: boolean;
  onPointerDown: (e: React.PointerEvent, contact: Contact) => void;
}

const ContactCard = React.memo(
  ({ contact, onSelect, isDragging, onPointerDown }: ContactCardProps) => {
    const stale = getStaleAlert(contact);
    const value =
      contact.projectValue && contact.projectValue > 0
        ? formatCurrency(contact.projectValue)
        : null;

    return (
      <div
        onPointerDown={(e) => onPointerDown(e, contact)}
        onClick={() => !isDragging && onSelect(contact.id)}
        className={`
          bg-white rounded-xl shadow-sm border border-gray-100 p-3 mb-2 select-none
          active:shadow-md transition-shadow touch-none
          ${isDragging ? 'opacity-50 scale-95' : ''}
        `}
        style={{ WebkitUserSelect: 'none', userSelect: 'none' }}
      >
        <div className="flex items-start justify-between gap-1 mb-1.5">
          <p className="text-sm font-semibold text-gray-900 leading-tight line-clamp-1">
            {getContactFullName(contact)}
          </p>
          {stale && (
            <span
              className={`flex-shrink-0 text-[10px] text-white font-bold px-1.5 py-0.5 rounded-full ${stale.color}`}
            >
              {stale.label}
            </span>
          )}
        </div>

        {contact.address && (
          <div className="flex items-center gap-1 text-[11px] text-gray-400 mb-1">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{contact.address}</span>
          </div>
        )}

        {value && (
          <div className="flex items-center gap-1 text-[11px] text-green-700 font-medium">
            <DollarSign className="w-3 h-3 flex-shrink-0" />
            {value}
          </div>
        )}
      </div>
    );
  }
);

// ─────────────────────────────────────────────────────────────────
// Column
// ─────────────────────────────────────────────────────────────────

interface ColumnProps {
  column: KanbanColumn;
  contacts: Contact[];
  isDropTarget: boolean;
  onSelect: (id: string) => void;
  draggingContact: Contact | null;
  onPointerDown: (e: React.PointerEvent, contact: Contact) => void;
}

function Column({
  column,
  contacts,
  isDropTarget,
  onSelect,
  draggingContact,
  onPointerDown,
}: ColumnProps) {
  const value = contacts.reduce((s, c) => s + (c.projectValue || 0), 0);

  return (
    <div
      className={`
        flex-shrink-0 w-[280px] rounded-2xl flex flex-col max-h-full
        transition-colors
        ${isDropTarget ? 'ring-2 ring-blue-400 bg-blue-50' : 'bg-gray-50'}
      `}
      data-column-status={column.status}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ background: column.color }}
        />
        <span className="text-sm font-semibold text-gray-700 truncate">{column.title}</span>
        <span className="ml-auto text-xs font-bold text-gray-400 bg-white rounded-full px-2 py-0.5 border border-gray-100">
          {contacts.length}
        </span>
      </div>
      {value > 0 && (
        <div className="px-3 pb-2 text-[11px] text-gray-400 font-medium">
          {formatCurrency(value)}
        </div>
      )}

      {/* Cards */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-0 min-h-[80px]">
        {contacts.map((c) => (
          <ContactCard
            key={c.id}
            contact={c}
            onSelect={onSelect}
            isDragging={draggingContact?.id === c.id}
            onPointerDown={onPointerDown}
          />
        ))}
        {contacts.length === 0 && (
          <div
            className={`flex items-center justify-center h-20 rounded-xl border-2 border-dashed text-xs text-gray-300 ${
              isDropTarget ? 'border-blue-300 text-blue-400' : 'border-gray-200'
            }`}
          >
            {isDropTarget ? 'Drop here' : 'Empty'}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────

export default function MobileKanban() {
  const { state, dispatch } = useCRM();
  const { profile } = useAuth();
  const currentBoard = useCurrentBoard();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Drag state
  const [draggingContact, setDraggingContact] = useState<Contact | null>(null);
  const [dropTargetColumn, setDropTargetColumn] = useState<string | null>(null);
  const [ghostPos, setGhostPos] = useState({ x: 0, y: 0 });
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraggingRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });

  const effectiveCompanyId =
    state.viewingCompanyId || profile?.company_id || null;

  if (!currentBoard) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
        No board selected
      </div>
    );
  }

  const columns = [...currentBoard.columns].sort((a, b) => a.order - b.order);

  const getColumnContacts = useCallback(
    (col: KanbanColumn): Contact[] =>
      state.contacts.filter((c) => {
        if (effectiveCompanyId && c.companyId !== effectiveCompanyId) return false;
        return c.status === col.status;
      }),
    [state.contacts, effectiveCompanyId]
  );

  // ── Pointer event handlers ───────────────────────────────────────

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, contact: Contact) => {
      startPosRef.current = { x: e.clientX, y: e.clientY };
      setGhostPos({ x: e.clientX, y: e.clientY });

      // Long-press to initiate drag
      longPressTimer.current = setTimeout(() => {
        isDraggingRef.current = true;
        setDraggingContact(contact);
        navigator.vibrate?.(30); // haptic feedback on supported devices
      }, 280);
    },
    []
  );

  const getColumnAtPoint = useCallback((x: number, y: number): string | null => {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    const col = el.closest('[data-column-status]');
    return col?.getAttribute('data-column-status') || null;
  }, []);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;
      setGhostPos({ x: e.clientX, y: e.clientY });
      const colStatus = getColumnAtPoint(e.clientX, e.clientY);
      setDropTargetColumn(colStatus);
    };

    const handlePointerUp = async (e: PointerEvent) => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);

      if (!isDraggingRef.current || !draggingContact) {
        isDraggingRef.current = false;
        setDraggingContact(null);
        setDropTargetColumn(null);
        return;
      }

      const colStatus = getColumnAtPoint(e.clientX, e.clientY) as CustomerStatus | null;

      if (colStatus && colStatus !== draggingContact.status) {
        // Optimistic update
        dispatch({
          type: 'UPDATE_CONTACT_STATUS',
          payload: { contactId: draggingContact.id, status: colStatus },
        });

        // Persist
        try {
          if (effectiveCompanyId) {
            await db.updateContact(draggingContact.id, {
              status: colStatus,
              status_changed_at: new Date().toISOString(),
            });
          }
          toast.success(
            `${getContactFullName(draggingContact)} → ${statusLabels[colStatus] || colStatus}`
          );
        } catch {
          // Rollback
          dispatch({
            type: 'UPDATE_CONTACT_STATUS',
            payload: { contactId: draggingContact.id, status: draggingContact.status },
          });
          toast.error('Failed to move contact');
        }
      }

      isDraggingRef.current = false;
      setDraggingContact(null);
      setDropTargetColumn(null);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [draggingContact, dispatch, effectiveCompanyId, getColumnAtPoint]);

  // Cancel drag on pointer cancel
  useEffect(() => {
    const cancel = () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      isDraggingRef.current = false;
      setDraggingContact(null);
      setDropTargetColumn(null);
    };
    window.addEventListener('pointercancel', cancel);
    return () => window.removeEventListener('pointercancel', cancel);
  }, []);

  const handleSelectContact = (id: string) => {
    dispatch({ type: 'SELECT_CONTACT', payload: id });
  };

  // Scroll column into view buttons
  const scrollLeft = () => scrollRef.current?.scrollBy({ left: -300, behavior: 'smooth' });
  const scrollRight = () => scrollRef.current?.scrollBy({ left: 300, behavior: 'smooth' });

  return (
    <div className="relative flex flex-col h-full">
      {/* Board name + nav arrows */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700 truncate">{currentBoard.name}</h2>
        <div className="flex gap-1">
          <button
            onClick={scrollLeft}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={scrollRight}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Columns scroller */}
      <div
        ref={scrollRef}
        className="flex-1 flex gap-3 overflow-x-auto overflow-y-hidden p-3 snap-x snap-mandatory"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {columns.map((col) => (
          <div key={col.id} className="snap-start h-full">
            <Column
              column={col}
              contacts={getColumnContacts(col)}
              isDropTarget={dropTargetColumn === col.status}
              onSelect={handleSelectContact}
              draggingContact={draggingContact}
              onPointerDown={handlePointerDown}
            />
          </div>
        ))}
      </div>

      {/* Drag ghost */}
      {draggingContact && (
        <div
          className="fixed pointer-events-none z-50 w-[260px] bg-white rounded-xl shadow-2xl border-2 border-blue-400 p-3 opacity-90"
          style={{
            left: ghostPos.x - 130,
            top: ghostPos.y - 30,
            transform: 'rotate(2deg) scale(1.05)',
          }}
        >
          <p className="text-sm font-bold text-gray-900">{getContactFullName(draggingContact)}</p>
          {draggingContact.address && (
            <p className="text-xs text-gray-400 mt-1 truncate">{draggingContact.address}</p>
          )}
        </div>
      )}

      {/* Drag instructions overlay — shown on first drag */}
      {draggingContact && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-black/70 text-white text-xs px-4 py-2 rounded-full pointer-events-none">
          Drag to a column to move
        </div>
      )}
    </div>
  );
}
