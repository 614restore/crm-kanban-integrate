# TrussCTR Kanban Board - Complete User Manual

## Table of Contents
1. [Overview](#overview)
2. [Board Types](#board-types)
3. [How Cards Move Between Columns](#how-cards-move-between-columns)
4. [Automatic Triggers](#automatic-triggers)
5. [Manual Operations](#manual-operations)
6. [Stage Alerts & Warnings](#stage-alerts--warnings)
7. [Board Management](#board-management)
8. [Best Practices](#best-practices)

---

## Overview

The TrussCTR Kanban Board is a visual pipeline management system that tracks contacts (leads/customers) through your sales and production process. Each contact appears as a **card** on the board, and cards move through **columns** that represent different stages of your workflow.

### Key Concepts

- **Card** = A contact/customer in your system
- **Column** = A stage in your workflow (e.g., "Lead", "Appointment Set", "Signed")
- **Board** = A complete workflow with multiple columns
- **Status** = The underlying data field that determines which column a card appears in

---

## Board Types

TrussCTR includes 4 default boards:

### 1. Retail Pipeline (Cash Jobs)
**Purpose**: Track non-insurance, cash-paying customers

**Columns** (11 stages):
1. **New Lead** → Status: `prospect`
2. **Contacted / Qualifying** → Status: `lead`
3. **Inspection Scheduled** → Status: `appt_set`
4. **Estimate Sent** → Status: `estimate_sent`
5. **Follow-up / Negotiation** → Status: `contingency`
6. **Sold / Ready for Production** → Status: `signed`
7. **Scheduled** → Status: `in_progress`
8. **In Progress** → Status: `build_phase`
9. **Punch List** → Status: `cleanup`
10. **Completed** → Status: `completed`
11. **Lost** → Status: `lost`

### 2. Insurance Pipeline (Claims)
**Purpose**: Track insurance claim jobs with adjuster involvement

**Columns** (13 stages):
1. **New Lead (Damage Report)** → Status: `prospect`
2. **Inspection Scheduled** → Status: `appt_set`
3. **Inspection & Authorization** → Status: `claim_filed`
4. **Adjuster Scheduled** → Status: `adjuster_scheduled`
5. **Initial Estimate Review** → Status: `inspection_completed`
6. **Supplement Filed** → Status: `supplement_filed`
7. **Approved / Final Scope** → Status: `approved`
8. **Sold / Ready for Production** → Status: `signed`
9. **Scheduled** → Status: `in_progress`
10. **In Progress** → Status: `build_phase`
11. **Punch List** → Status: `cleanup`
12. **Completed** → Status: `completed`
13. **Lost** → Status: `lost`

### 3. Production Board
**Purpose**: Simplified view for production team (jobs only)

**Columns** (5 stages):
1. **Sold / New** → Status: `signed`
2. **Scheduled** → Status: `in_progress`
3. **In Progress** → Status: `build_phase`
4. **Punch List** → Status: `cleanup`
5. **Completed** → Status: `completed`

### 4. Billing Board
**Purpose**: Track jobs through invoicing and payment

**Columns** (7 stages):
1. **Incoming Job** → Status: `cleanup`
2. **Scheduled Job** → Status: `in_progress`
3. **In Progress** → Status: `build_phase`
4. **Complete** → Status: `completed`
5. **Invoicing** → Status: `invoicing`
6. **Pending Payment** → Status: `pending_payment`
7. **Paid & Closed** → Status: `completed`

---

## How Cards Move Between Columns

### The Core Mechanism

**CRITICAL CONCEPT**: Cards move between columns when their **status field** changes. Each column is mapped to a specific status value.

```
Contact Status Field → Determines Column Position
```

### Example Flow (Retail Pipeline)

```
Contact created with status = "prospect"
  ↓
Card appears in "New Lead" column
  ↓
Status changed to "lead"
  ↓
Card moves to "Contacted / Qualifying" column
  ↓
Status changed to "appt_set"
  ↓
Card moves to "Inspection Scheduled" column
```

### What Triggers Status Changes?

There are **3 ways** a contact's status changes (and thus moves columns):

#### 1. **Manual Drag & Drop** (Most Common)
- User drags a card from one column to another
- System updates the contact's status field
- System records `status_changed_at` timestamp
- Card appears in new column

**Code Location**: `PipelineBoard.tsx` → `handleDrop()` function

```typescript
// When you drop a card on a new column:
await db.updateContact(contactId, { 
  status: newColumnStatus,
  status_changed_at: new Date().toISOString() 
});
```

#### 2. **Automated Status Updates** (Via Automations)
- Certain actions trigger automatic status changes
- Examples:
  - Appointment scheduled → Status changes to `appt_set`
  - Estimate sent → Status changes to `estimate_sent`
  - Contract signed → Status changes to `signed`
  - Invoice created → Status changes to `invoicing`
  - Payment received → Status changes to `completed`

**Note**: These automations are configured in the Automations section

#### 3. **Direct Status Update** (Via Contact Detail Page)
- User opens contact detail page
- Changes status dropdown manually
- Card moves to corresponding column

---

## Automatic Triggers

### What Automatically Moves Cards?

| Action | Status Change | Column Movement |
|--------|---------------|-----------------|
| **Create appointment** | → `appt_set` | → "Inspection Scheduled" |
| **Send estimate** | → `estimate_sent` | → "Estimate Sent" |
| **Sign contract** | → `signed` | → "Sold / Ready for Production" |
| **Schedule job** | → `in_progress` | → "Scheduled" |
| **Start work** | → `build_phase` | → "In Progress" |
| **Complete work** | → `cleanup` | → "Punch List" |
| **Create invoice** | → `invoicing` | → "Invoicing" |
| **Mark invoice sent** | → `pending_payment` | → "Pending Payment" |
| **Receive payment** | → `completed` | → "Completed" |
| **Mark as lost** | → `lost` | → "Lost" |

### Insurance-Specific Triggers

| Action | Status Change | Column Movement |
|--------|---------------|-----------------|
| **File claim** | → `claim_filed` | → "Inspection & Authorization" |
| **Schedule adjuster** | → `adjuster_scheduled` | → "Adjuster Scheduled" |
| **Complete inspection** | → `inspection_completed` | → "Initial Estimate Review" |
| **File supplement** | → `supplement_filed` | → "Supplement Filed" |
| **Claim approved** | → `approved` | → "Approved / Final Scope" |

---

## Manual Operations

### How to Move a Card

**Method 1: Drag & Drop** (Recommended)
1. Click and hold on a card
2. Drag it to the desired column
3. Release to drop
4. Card updates instantly
5. Status field updates in database
6. Notification appears confirming move

**Method 2: Contact Detail Page**
1. Click on a card to open contact details
2. Find the "Status" dropdown
3. Select new status
4. Click "Save"
5. Card moves to corresponding column

**Method 3: Quick Edit**
1. Right-click on a card (if enabled)
2. Select "Change Status"
3. Choose new status
4. Card moves immediately

### What Happens When You Move a Card?

1. **Database Update**: Contact record updated with new status
2. **Timestamp**: `status_changed_at` field set to current time
3. **Notification**: Success notification appears
4. **Visual Update**: Card animates to new column
5. **Column Counts**: Column headers update with new counts
6. **Column Values**: Dollar amounts recalculate

---

## Stage Alerts & Warnings

### Time-Based Alerts

Cards display colored badges when they've been in a stage too long:

| Time in Stage | Badge Color | Meaning |
|---------------|-------------|---------|
| **7-13 days** | 🟡 Yellow | Attention needed |
| **14-20 days** | 🟠 Orange | Urgent attention |
| **21+ days** | 🔴 Red (pulsing) | Critical - immediate action |

### Alert Calculation

```typescript
// Days in current stage
const daysSinceStatusChange = 
  (Today - status_changed_at) / (24 hours)

// Alert thresholds
if (days >= 21) → Red alert (pulsing)
if (days >= 14) → Orange alert
if (days >= 7)  → Yellow alert
```

### Where Alerts Appear

1. **On Card**: Small badge in top-right corner showing days
2. **Owner Priority Board**: Dedicated panel showing all stale leads
3. **Dashboard**: "Needs Attention" widget
4. **Notifications**: Daily digest of stale leads (if enabled)

### "Needs Attention" Panel

Click the **"Needs Attention"** button at top of Pipeline Board to see:
- All contacts stuck in stages for 7+ days
- Sorted by urgency (oldest first)
- Quick actions: Nudge user, View contact, Move to next stage

---

## Board Management

### Creating Custom Boards

**Who Can Create**: Owners, Admins, Managers

**Steps**:
1. Click board selector dropdown
2. Click "Create New Board"
3. Enter board name
4. Add columns:
   - Column title (e.g., "Qualified Lead")
   - Status mapping (e.g., `lead`)
   - Color (visual indicator)
5. Reorder columns with up/down arrows
6. Click "Save Board"

### Editing Boards

**Who Can Edit**: Owners, Admins, Managers

**What You Can Edit**:
- Board name
- Column titles
- Column colors
- Column order
- Status mappings
- Add/remove columns

**What You CANNOT Edit**:
- Default boards (Retail, Insurance, Production, Billing)
- Status values (these are system-defined)

### Deleting Boards

**Restrictions**:
- Cannot delete if it's the only board
- Cannot delete default boards
- Requires confirmation

**What Happens**:
- Board removed from system
- Contacts remain unchanged (they don't disappear)
- Users viewing that board are redirected to default board

### Board Visibility

Each board has visibility settings:
- **Owner**: All boards
- **Admin**: All boards
- **Manager**: Sales, Production, Custom boards
- **Sales**: Sales boards only
- **Production**: Production board only
- **Billing**: Billing board only

---

## Best Practices

### 1. Choose the Right Board

- **Insurance jobs** → Use "Insurance Pipeline"
- **Cash jobs** → Use "Retail Pipeline"
- **Production team** → Use "Production Board"
- **Billing team** → Use "Billing Board"

### 2. Move Cards Promptly

- Update status as soon as action is taken
- Don't let cards sit in wrong column
- Use drag-and-drop for speed

### 3. Monitor Stage Alerts

- Check "Needs Attention" panel daily
- Follow up on yellow/orange alerts before they turn red
- Use nudge feature to remind team members

### 4. Use Consistent Status Updates

- Always update status when:
  - Appointment scheduled
  - Estimate sent
  - Contract signed
  - Work started
  - Work completed
  - Invoice sent
  - Payment received

### 5. Leverage Multiple Board Views

- **Morning**: Check "All Boards" view for overview
- **During day**: Focus on your specific board
- **End of day**: Review "Needs Attention" panel

### 6. Custom Boards for Special Workflows

Create custom boards for:
- Storm damage campaigns
- Referral programs
- Commercial projects
- Warranty work

### 7. Column Value Tracking

Each column shows total dollar value:
- Based on `projectValue` field
- If no project value, uses highest estimate
- Helps track pipeline value by stage

### 8. Team Collaboration

- Assign contacts to team members
- Team member avatar appears on card
- Filter by assignee to see your pipeline

---

## Technical Details

### Status Field Values

All possible status values in the system:

```typescript
'prospect'              // New lead, not yet contacted
'lead'                  // Contacted, qualifying
'appt_set'              // Appointment scheduled
'inspection_completed'  // Inspection done
'estimate_sent'         // Estimate sent to customer
'contingency'           // Negotiating, follow-up needed
'retail'                // Retail customer (cash)
'signed'                // Contract signed
'in_progress'           // Job scheduled
'build_phase'           // Work in progress
'cleanup'               // Punch list, final touches
'invoicing'             // Creating invoice
'pending_payment'       // Invoice sent, awaiting payment
'completed'             // Job complete, paid
'lost'                  // Lost to competitor or declined
'claim_filed'           // Insurance claim filed
'adjuster_scheduled'    // Adjuster appointment set
'supplement_filed'      // Supplement submitted
'approved'              // Insurance approved
```

### Database Schema

**Contacts Table**:
```sql
contacts (
  id UUID PRIMARY KEY,
  status VARCHAR,           -- Current status
  status_changed_at TIMESTAMP,  -- When status last changed
  ...
)
```

**Kanban Boards Table**:
```sql
kanban_boards (
  id UUID PRIMARY KEY,
  name VARCHAR,
  type VARCHAR,
  visible_to JSONB,
  is_default BOOLEAN
)
```

**Kanban Columns Table**:
```sql
kanban_columns (
  id UUID PRIMARY KEY,
  board_id UUID REFERENCES kanban_boards,
  title VARCHAR,
  status VARCHAR,           -- Maps to contact.status
  color VARCHAR,
  sort_order INTEGER
)
```

### Code Flow

**When a card is dragged and dropped**:

```typescript
// 1. User drags card
handleDragStart(contact)

// 2. User drops on column
handleDrop(column)

// 3. Update database
await db.updateContact(contact.id, {
  status: column.status,
  status_changed_at: new Date().toISOString()
})

// 4. Update local state
dispatch({
  type: 'UPDATE_CONTACT_STATUS',
  payload: { contactId, status }
})

// 5. Show notification
dispatch({
  type: 'ADD_NOTIFICATION',
  payload: {
    title: 'Contact Updated',
    message: `${name} moved to ${column.title}`
  }
})
```

---

## Troubleshooting

### Card Not Moving

**Problem**: Dragged card but it didn't move

**Solutions**:
1. Check if you have edit permissions
2. Ensure database connection is active
3. Refresh the page
4. Check browser console for errors

### Card in Wrong Column

**Problem**: Card appears in unexpected column

**Solutions**:
1. Check contact's current status field
2. Verify column status mapping
3. Manually update status via contact detail page
4. Check for automation conflicts

### Missing Cards

**Problem**: Cards disappeared from board

**Solutions**:
1. Check if status changed to value not on current board
2. Switch to "All Boards" view
3. Use search to find contact
4. Check if contact was deleted

### Stage Alerts Not Showing

**Problem**: No alerts despite old contacts

**Solutions**:
1. Verify `status_changed_at` field is populated
2. Check if feature toggle is enabled
3. Refresh the page
4. Check date/time settings

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + K` | Open quick search |
| `Ctrl/Cmd + N` | Add new contact |
| `Esc` | Close modal/panel |
| `Arrow Keys` | Navigate between cards |
| `Enter` | Open selected card |

---

## FAQ

**Q: Can I have a contact on multiple boards?**
A: Yes! The same contact appears on all boards where their status matches a column. For example, a contact with status `signed` appears on Retail, Insurance, Production, and Billing boards.

**Q: What happens if I delete a column?**
A: Contacts in that column remain in the system with their current status. They'll appear in other boards that have a column for that status.

**Q: Can I change the status values?**
A: No, status values are system-defined. However, you can create custom boards with different column titles that map to existing statuses.

**Q: How do I track conversion rates?**
A: Use the Dashboard analytics. It calculates conversion rates based on status changes over time.

**Q: Can I export board data?**
A: Yes, go to Contacts → Export → Select board filter → Download CSV.

**Q: What's the difference between "Retail" status and "Retail Pipeline" board?**
A: "Retail" is a status value. "Retail Pipeline" is a board designed for cash jobs. A contact can have any status and still be on the Retail Pipeline board.

---

## Support

For additional help:
- Email: 614restorellc@gmail.com
- Documentation: See README.md
- Video Tutorials: Coming soon

---

**Last Updated**: March 2026
**Version**: 1.0
