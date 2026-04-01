# Kanban Board System - Technical Deep Dive

## Architecture Overview

The TrussCTR Kanban system is a **status-driven** pipeline management system where contact cards are displayed based on their `status` field value matching column `status` mappings.

### Core Principle

```
Contact.status === Column.status → Card appears in Column
```

This means:
- A contact with `status: 'lead'` appears in any column mapped to `'lead'`
- Changing a contact's status moves it to the corresponding column
- Multiple boards can show the same contact if they have columns for that status

---

## Data Model

### Contact Entity

```typescript
interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  status: CustomerStatus;           // ← KEY FIELD
  statusChangedAt?: string;         // ← Timestamp for alerts
  assignedTo: string;               // Team member ID
  projectValue?: number;            // For column totals
  // ... other fields
}
```

### Board Entity

```typescript
interface KanbanBoard {
  id: string;
  name: string;                     // "Retail Pipeline"
  type: BoardType;                  // 'sales' | 'production' | 'billing' | 'custom'
  columns: KanbanColumn[];          // Ordered list of columns
  visibleTo: UserRole[];            // Who can see this board
  createdBy: string;
  isDefault: boolean;               // System boards vs custom
}
```

### Column Entity

```typescript
interface KanbanColumn {
  id: string;
  title: string;                    // "Inspection Scheduled"
  status: CustomerStatus;           // 'appt_set' ← MAPPING KEY
  color: string;                    // '#8b5cf6'
  order: number;                    // Display order
}
```

### Status Enum

```typescript
type CustomerStatus = 
  | 'prospect'              // New lead
  | 'lead'                  // Contacted
  | 'appt_set'              // Appointment scheduled
  | 'inspection_completed'  // Inspection done
  | 'estimate_sent'         // Estimate sent
  | 'contingency'           // Negotiating
  | 'retail'                // Retail customer
  | 'signed'                // Contract signed
  | 'in_progress'           // Scheduled
  | 'build_phase'           // Work in progress
  | 'cleanup'               // Punch list
  | 'invoicing'             // Creating invoice
  | 'pending_payment'       // Awaiting payment
  | 'completed'             // Done
  | 'lost'                  // Lost deal
  | 'claim_filed'           // Insurance: claim filed
  | 'adjuster_scheduled'    // Insurance: adjuster scheduled
  | 'supplement_filed'      // Insurance: supplement filed
  | 'approved';             // Insurance: approved
```

---

## Card Movement Logic

### 1. Drag & Drop Flow

**File**: `src/components/crm/PipelineBoard.tsx`

```typescript
// Step 1: User starts dragging
const handleDragStart = (e: React.DragEvent, contact: Contact) => {
  setDraggedContact(contact);
  e.dataTransfer.effectAllowed = 'move';
};

// Step 2: User drags over column
const handleDragOver = (e: React.DragEvent, columnId: string) => {
  e.preventDefault();
  setDragOverColumn(columnId);  // Visual feedback
};

// Step 3: User drops card
const handleDrop = async (e: React.DragEvent, column: KanbanColumn) => {
  e.preventDefault();
  
  // Only update if status actually changed
  if (draggedContact && draggedContact.status !== column.status) {
    try {
      // Update database
      if (effectiveCompanyId) {
        await db.updateContact(draggedContact.id, { 
          status: column.status,
          status_changed_at: new Date().toISOString()
        });
      }
      
      // Update local state
      dispatch({
        type: 'UPDATE_CONTACT_STATUS',
        payload: { 
          contactId: draggedContact.id, 
          status: column.status 
        },
      });
      
      // Show notification
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          id: `notif-${Date.now()}`,
          type: 'success',
          title: 'Contact Updated',
          message: `${getContactFullName(draggedContact)} moved to ${column.title}`,
          timestamp: new Date().toISOString(),
          read: false,
        },
      });
    } catch (error) {
      console.error('Error updating contact status:', error);
      toast.error('Failed to move contact');
    }
  }
  
  // Reset drag state
  setDraggedContact(null);
  setDragOverColumn(null);
};
```

### 2. Database Update

**File**: `src/lib/database.ts`

```typescript
export async function updateContact(
  contactId: string, 
  updates: Partial<Contact>
): Promise<Contact | null> {
  const { data, error } = await supabase
    .from('contacts')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', contactId)
    .select()
    .single();
    
  if (error) throw error;
  return data;
}
```

### 3. State Management

**File**: `src/lib/crmStore.ts`

```typescript
case 'UPDATE_CONTACT_STATUS': {
  return {
    ...state,
    contacts: state.contacts.map(contact =>
      contact.id === action.payload.contactId
        ? { 
            ...contact, 
            status: action.payload.status,
            statusChangedAt: new Date().toISOString()
          }
        : contact
    ),
  };
}
```

---

## Column Rendering Logic

### Getting Contacts for a Column

```typescript
const getColumnContacts = (column: KanbanColumn): Contact[] => {
  return state.contacts.filter((c) => c.status === column.status);
};
```

**Key Points**:
- Simple equality check: `contact.status === column.status`
- No complex joins or queries
- Real-time filtering based on current state
- Same contact can appear in multiple boards

### Column Value Calculation

```typescript
const columnValue = contacts.reduce((sum, c) => {
  // Use explicit project value if set
  if (c.projectValue && c.projectValue > 0) {
    return sum + c.projectValue;
  }
  
  // Otherwise, use highest estimate
  const bestEstimate = state.estimates
    .filter(e => e.contactId === c.id && e.status !== 'declined')
    .reduce((max, e) => Math.max(max, Number(e.total || 0)), 0);
    
  return sum + bestEstimate;
}, 0);
```

**Logic**:
1. If contact has `projectValue`, use it
2. Otherwise, find highest non-declined estimate
3. Sum all values for column total

---

## Stage Alert System

### Alert Calculation

**File**: `src/components/crm/PipelineBoard.tsx`

```typescript
function getStageAlert(contact: Contact): { label: string; className: string } | null {
  // Get timestamp of last status change
  const since = contact.statusChangedAt || contact.updatedAt || contact.createdAt;
  if (!since) return null;
  
  // Calculate days in current stage
  const days = Math.floor(
    (Date.now() - new Date(since).getTime()) / (1000 * 60 * 60 * 24)
  );
  
  // Return alert based on thresholds
  if (days >= 21) {
    return { 
      label: `${days}d`, 
      className: 'bg-red-100 text-red-700 border border-red-300 animate-pulse' 
    };
  }
  if (days >= 14) {
    return { 
      label: `${days}d`, 
      className: 'bg-orange-100 text-orange-700 border border-orange-300' 
    };
  }
  if (days >= 7) {
    return { 
      label: `${days}d`, 
      className: 'bg-yellow-100 text-yellow-700 border border-yellow-300' 
    };
  }
  
  return null;  // No alert needed
}
```

**Thresholds**:
- **7-13 days**: Yellow warning
- **14-20 days**: Orange alert
- **21+ days**: Red critical (pulsing animation)

### Alert Display

```typescript
{stageAlert && (
  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${stageAlert.className}`}>
    {stageAlert.label}
  </span>
)}
```

---

## Board Management

### Creating a Board

```typescript
const handleCreateBoard = () => {
  const stamp = Date.now();
  const newBoard: KanbanBoard = {
    id: `board-${stamp}`,
    name: 'New Board',
    type: 'custom',
    visibleTo: ['owner', 'manager', 'admin'],
    createdBy: state.currentUser?.id || 'unknown',
    isDefault: false,
    columns: [
      { 
        id: `col-${stamp}-1`, 
        title: 'Lead', 
        status: 'lead', 
        color: '#3b82f6', 
        order: 0 
      },
      // ... more columns
    ],
  };
  setEditingBoard(newBoard);
  setShowBoardEditor(true);
};
```

### Saving a Board

```typescript
const handleSaveBoard = async () => {
  if (!editingBoard) return;
  
  // Validation
  if (!editingBoard.name.trim()) {
    toast.error('Board name is required');
    return;
  }
  if (editingBoard.columns.length === 0) {
    toast.error('Add at least one column');
    return;
  }
  
  setIsSaving(true);
  
  try {
    const isNewBoard = !state.boards.find((b) => b.id === editingBoard.id);
    
    // Normalize column order
    const normalizedColumns = editingBoard.columns.map((col, index) => ({
      ...col,
      order: index
    }));
    
    let savedBoard: KanbanBoard = { 
      ...editingBoard, 
      columns: normalizedColumns 
    };
    
    if (effectiveCompanyId) {
      if (isNewBoard) {
        // Create new board in database
        const created = await db.createKanbanBoard(
          {
            company_id: effectiveCompanyId,
            name: editingBoard.name,
            type: editingBoard.type,
            visible_to: editingBoard.visibleTo,
            created_by: profile?.id,
            is_default: false
          },
          normalizedColumns.map((col) => ({
            title: col.title,
            status: col.status,
            color: col.color,
            sort_order: col.order
          }))
        );
        
        if (!created) {
          toast.error('Failed to create board');
          return;
        }
        
        // Fetch complete board with columns
        const boardWithColumns = await db.getKanbanBoardWithColumns(
          created.id, 
          effectiveCompanyId
        );
        
        savedBoard = {
          id: created.id,
          name: created.name,
          type: created.type as KanbanBoard['type'],
          visibleTo: (created.visible_to || editingBoard.visibleTo) as KanbanBoard['visibleTo'],
          createdBy: created.created_by || profile?.id || 'unknown',
          isDefault: created.is_default,
          columns: boardWithColumns?.columns.map((col) => ({
            id: col.id,
            title: col.title,
            status: col.status as CustomerStatus,
            color: col.color,
            order: col.sort_order
          })) || normalizedColumns,
        };
      } else {
        // Update existing board
        const updatedBoard = await db.updateKanbanBoard(editingBoard.id, {
          name: editingBoard.name,
          type: editingBoard.type,
          visible_to: editingBoard.visibleTo
        });
        
        if (!updatedBoard) {
          toast.error('Failed to update board');
          return;
        }
        
        // Replace columns
        const replaced = await db.replaceKanbanColumns(
          editingBoard.id,
          normalizedColumns.map((col) => ({
            title: col.title,
            status: col.status,
            color: col.color,
            sort_order: col.order
          }))
        );
        
        if (!replaced) {
          toast.error('Failed to update board columns');
          return;
        }
        
        // Fetch updated board
        const boardWithColumns = await db.getKanbanBoardWithColumns(
          editingBoard.id,
          effectiveCompanyId
        );
        
        savedBoard = {
          id: updatedBoard.id,
          name: updatedBoard.name,
          type: updatedBoard.type as KanbanBoard['type'],
          visibleTo: (updatedBoard.visible_to || editingBoard.visibleTo) as KanbanBoard['visibleTo'],
          createdBy: updatedBoard.created_by || editingBoard.createdBy,
          isDefault: updatedBoard.is_default,
          columns: boardWithColumns?.columns.map((col) => ({
            id: col.id,
            title: col.title,
            status: col.status as CustomerStatus,
            color: col.color,
            order: col.sort_order
          })) || normalizedColumns,
        };
      }
    }
    
    // Update local state
    if (isNewBoard) {
      dispatch({ type: 'ADD_BOARD', payload: savedBoard });
    } else {
      dispatch({ type: 'UPDATE_BOARD', payload: savedBoard });
    }
    
    // Select the saved board
    dispatch({ type: 'SELECT_BOARD', payload: savedBoard.id });
    
    // Close editor
    setShowBoardEditor(false);
    setEditingBoard(null);
    
    toast.success(isNewBoard ? 'Board created' : 'Board updated');
  } catch (error) {
    console.error('Error saving board:', error);
    toast.error('Failed to save board');
  } finally {
    setIsSaving(false);
  }
};
```

---

## Automatic Status Updates

### Appointment Creation

**File**: `src/components/crm/CalendarView.tsx` (or wherever appointments are created)

```typescript
const createAppointment = async (appointmentData) => {
  // Create appointment
  const appointment = await db.createAppointment(appointmentData);
  
  // Update contact status
  await db.updateContact(appointmentData.contactId, {
    status: 'appt_set',
    status_changed_at: new Date().toISOString()
  });
  
  // Card automatically moves to "Appointment Set" column
};
```

### Estimate Sent

```typescript
const sendEstimate = async (estimateId, contactId) => {
  // Send estimate
  await db.updateEstimate(estimateId, {
    status: 'sent',
    sent_at: new Date().toISOString()
  });
  
  // Update contact status
  await db.updateContact(contactId, {
    status: 'estimate_sent',
    status_changed_at: new Date().toISOString()
  });
  
  // Card moves to "Estimate Sent" column
};
```

### Contract Signed

```typescript
const signContract = async (contactId) => {
  // Update contact
  await db.updateContact(contactId, {
    status: 'signed',
    status_changed_at: new Date().toISOString()
  });
  
  // Card moves to "Signed" column
};
```

### Job Scheduled

```typescript
const scheduleJob = async (contactId, scheduledDate) => {
  // Update contact
  await db.updateContact(contactId, {
    status: 'in_progress',
    status_changed_at: new Date().toISOString()
  });
  
  // Card moves to "Scheduled" column
};
```

### Work Started

```typescript
const startWork = async (contactId) => {
  await db.updateContact(contactId, {
    status: 'build_phase',
    status_changed_at: new Date().toISOString()
  });
  
  // Card moves to "In Progress" column
};
```

### Work Completed

```typescript
const completeWork = async (contactId) => {
  await db.updateContact(contactId, {
    status: 'cleanup',
    status_changed_at: new Date().toISOString()
  });
  
  // Card moves to "Punch List" column
};
```

### Invoice Created

```typescript
const createInvoice = async (invoiceData) => {
  // Create invoice
  await db.createInvoice(invoiceData);
  
  // Update contact
  await db.updateContact(invoiceData.contactId, {
    status: 'invoicing',
    status_changed_at: new Date().toISOString()
  });
  
  // Card moves to "Invoicing" column
};
```

### Invoice Sent

```typescript
const sendInvoice = async (invoiceId, contactId) => {
  // Update invoice
  await db.updateInvoice(invoiceId, {
    status: 'sent'
  });
  
  // Update contact
  await db.updateContact(contactId, {
    status: 'pending_payment',
    status_changed_at: new Date().toISOString()
  });
  
  // Card moves to "Pending Payment" column
};
```

### Payment Received

```typescript
const recordPayment = async (invoiceId, contactId) => {
  // Update invoice
  await db.updateInvoice(invoiceId, {
    status: 'paid',
    paid_at: new Date().toISOString()
  });
  
  // Update contact
  await db.updateContact(contactId, {
    status: 'completed',
    status_changed_at: new Date().toISOString()
  });
  
  // Card moves to "Completed" column
};
```

---

## Performance Optimizations

### 1. Efficient Filtering

```typescript
// ✅ Good: Single pass filter
const columnContacts = state.contacts.filter(c => c.status === column.status);

// ❌ Bad: Multiple passes
const allContacts = state.contacts;
const filteredContacts = allContacts.filter(c => c.status === column.status);
const sortedContacts = filteredContacts.sort(...);
```

### 2. Memoization

```typescript
import { useMemo } from 'react';

const columnContacts = useMemo(() => {
  return state.contacts.filter(c => c.status === column.status);
}, [state.contacts, column.status]);
```

### 3. Virtual Scrolling (for large datasets)

```typescript
// If column has 100+ contacts, use virtual scrolling
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={contacts.length}
  itemSize={120}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <ContactCard contact={contacts[index]} />
    </div>
  )}
</FixedSizeList>
```

### 4. Debounced Drag Updates

```typescript
import { debounce } from 'lodash';

const debouncedUpdate = debounce(async (contactId, status) => {
  await db.updateContact(contactId, { status });
}, 300);
```

---

## Database Schema

### Contacts Table

```sql
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id),
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  status VARCHAR(50) NOT NULL,           -- KEY FIELD
  status_changed_at TIMESTAMP,           -- For alerts
  assigned_to UUID REFERENCES profiles(id),
  project_value DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast filtering
CREATE INDEX idx_contacts_status ON contacts(status);
CREATE INDEX idx_contacts_company_status ON contacts(company_id, status);
```

### Kanban Boards Table

```sql
CREATE TABLE kanban_boards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  visible_to JSONB,
  created_by UUID REFERENCES profiles(id),
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Kanban Columns Table

```sql
CREATE TABLE kanban_columns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  board_id UUID REFERENCES kanban_boards(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL,           -- Maps to contacts.status
  color VARCHAR(7) NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast board loading
CREATE INDEX idx_kanban_columns_board ON kanban_columns(board_id, sort_order);
```

---

## Testing

### Unit Tests

```typescript
describe('getColumnContacts', () => {
  it('filters contacts by status', () => {
    const contacts = [
      { id: '1', status: 'lead' },
      { id: '2', status: 'signed' },
      { id: '3', status: 'lead' },
    ];
    
    const column = { status: 'lead' };
    const result = getColumnContacts(column, contacts);
    
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('1');
    expect(result[1].id).toBe('3');
  });
});

describe('getStageAlert', () => {
  it('returns red alert for 21+ days', () => {
    const contact = {
      statusChangedAt: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000).toISOString()
    };
    
    const alert = getStageAlert(contact);
    
    expect(alert).not.toBeNull();
    expect(alert.className).toContain('bg-red-100');
    expect(alert.className).toContain('animate-pulse');
  });
  
  it('returns null for recent contacts', () => {
    const contact = {
      statusChangedAt: new Date().toISOString()
    };
    
    const alert = getStageAlert(contact);
    
    expect(alert).toBeNull();
  });
});
```

### Integration Tests

```typescript
describe('Card Movement', () => {
  it('updates status when card is dropped', async () => {
    const contact = { id: '1', status: 'lead' };
    const column = { status: 'signed' };
    
    await handleDrop(contact, column);
    
    const updated = await db.getContact('1');
    expect(updated.status).toBe('signed');
    expect(updated.statusChangedAt).toBeDefined();
  });
});
```

---

## Common Issues & Solutions

### Issue: Card appears in multiple columns

**Cause**: Multiple columns mapped to same status

**Solution**: Ensure each status is mapped to only one column per board

### Issue: Card doesn't move after drag

**Cause**: Database update failed or permissions issue

**Solution**: Check error logs, verify user permissions, ensure database connection

### Issue: Stage alerts not showing

**Cause**: `statusChangedAt` field not populated

**Solution**: Ensure all status updates include `status_changed_at` timestamp

### Issue: Column totals incorrect

**Cause**: Missing `projectValue` or estimates

**Solution**: Ensure contacts have either `projectValue` or associated estimates

---

## Future Enhancements

### 1. Swimlanes

Group cards by assignee or priority:

```typescript
<Board>
  <Swimlane assignee="tm1">
    <Column status="lead">...</Column>
    <Column status="signed">...</Column>
  </Swimlane>
  <Swimlane assignee="tm2">
    <Column status="lead">...</Column>
    <Column status="signed">...</Column>
  </Swimlane>
</Board>
```

### 2. Card Templates

Pre-defined card layouts for different project types

### 3. Automation Rules

Visual automation builder:
- When card enters column X
- Then do action Y

### 4. Analytics Dashboard

- Conversion rates by column
- Average time in each stage
- Bottleneck detection

### 5. Mobile Drag & Drop

Touch-optimized drag and drop for mobile devices

---

## Conclusion

The TrussCTR Kanban system is built on a simple but powerful principle: **status-driven card placement**. By understanding this core concept, you can:

- Predict where cards will appear
- Create custom workflows
- Automate status updates
- Build integrations
- Troubleshoot issues

The system is designed to be flexible, performant, and easy to extend.

---

**Last Updated**: March 2026
**Version**: 1.0
