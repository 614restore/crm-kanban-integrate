// Stale Lead Detection and Notification System
import { db, DbContact, DbAppointment } from './database';
import { supabase } from './supabase';

export interface StaleContact {
  contact: DbContact;
  daysSinceCreated: number;
  hasAppointments: boolean;
  assignedTo?: string;
  assignedToName?: string;
}

/**
 * Detects contacts that have been created but have no activity within 24 hours
 * Returns list of stale contacts with details
 */
export async function detectStaleContacts(companyId: string): Promise<StaleContact[]> {
  try {
    // Get all contacts for the company
    const contacts = await db.getContacts(companyId);
    
    // Get all appointments for the company
    const appointments = await db.getAppointments(companyId);
    
    // Get team members to map assigned_to names
    const teamMembers = await db.getTeamMembers(companyId);
    const teamMap = new Map(teamMembers.map(tm => [tm.id, `${tm.first_name} ${tm.last_name}`.trim() || tm.email]));
    
    const now = new Date();
    const staleContacts: StaleContact[] = [];
    
    for (const contact of contacts) {
      // Skip if contact is already in a closed/won/lost status
      if (['won', 'lost', 'closed', 'completed'].includes(contact.status.toLowerCase())) {
        continue;
      }
      
      // Calculate days since created
      const createdAt = new Date(contact.created_at);
      const hoursSinceCreated = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
      const daysSinceCreated = Math.floor(hoursSinceCreated / 24);
      
      // Check if contact is older than 24 hours
      if (hoursSinceCreated < 24) {
        continue; // Too new, skip
      }
      
      // Check if contact has any appointments
      const contactAppointments = appointments.filter(apt => apt.contact_id === contact.id);
      const hasAppointments = contactAppointments.length > 0;
      
      // If no appointments after 24 hours, mark as stale
      if (!hasAppointments) {
        staleContacts.push({
          contact,
          daysSinceCreated,
          hasAppointments: false,
          assignedTo: contact.assigned_to,
          assignedToName: contact.assigned_to ? teamMap.get(contact.assigned_to) : undefined,
        });
      }
    }
    
    return staleContacts;
  } catch (error) {
    console.error('[StaleLeads] Error detecting stale contacts:', error);
    return [];
  }
}

/**
 * Creates notifications for owners about stale contacts
 */
export async function notifyOwnersOfStaleContacts(companyId: string, staleContacts: StaleContact[]): Promise<void> {
  if (staleContacts.length === 0) return;
  
  try {
    // Get all owners/admins for the company
    const teamMembers = await db.getTeamMembers(companyId);
    const owners = teamMembers.filter(tm => tm.role === 'owner' || tm.role === 'admin');
    
    // Group stale contacts by assigned user
    const staleByUser = new Map<string, StaleContact[]>();
    const unassigned: StaleContact[] = [];
    
    for (const stale of staleContacts) {
      if (stale.assignedTo) {
        if (!staleByUser.has(stale.assignedTo)) {
          staleByUser.set(stale.assignedTo, []);
        }
        staleByUser.get(stale.assignedTo)!.push(stale);
      } else {
        unassigned.push(stale);
      }
    }
    
    // Create notifications for each owner
    for (const owner of owners) {
      // Notification for unassigned stale contacts
      if (unassigned.length > 0) {
        await db.createNotification({
          company_id: companyId,
          user_id: owner.id,
          type: 'warning',
          title: `${unassigned.length} Unassigned Stale Lead${unassigned.length > 1 ? 's' : ''}`,
          message: `${unassigned.length} contact${unassigned.length > 1 ? 's have' : ' has'} been created but not assigned to anyone and ${unassigned.length > 1 ? 'have' : 'has'} no scheduled appointments.`,
          related_type: 'stale_leads',
          read: false,
        });
      }
      
      // Notifications for each user's stale contacts
      for (const [userId, userStaleContacts] of staleByUser.entries()) {
        const userName = userStaleContacts[0].assignedToName || 'Team Member';
        await db.createNotification({
          company_id: companyId,
          user_id: owner.id,
          type: 'warning',
          title: `${userStaleContacts.length} Stale Lead${userStaleContacts.length > 1 ? 's' : ''} - ${userName}`,
          message: `${userName} has ${userStaleContacts.length} contact${userStaleContacts.length > 1 ? 's' : ''} with no appointments scheduled after 24+ hours.`,
          related_id: userId,
          related_type: 'stale_leads_user',
          read: false,
        });
      }
    }
    
    console.log(`[StaleLeads] Created notifications for ${owners.length} owner(s) about ${staleContacts.length} stale contact(s)`);
  } catch (error) {
    console.error('[StaleLeads] Error creating notifications:', error);
  }
}

/**
 * Sends a "nudge" notification to the assigned user about a stale contact
 */
export async function nudgeUserAboutStaleContact(
  companyId: string,
  contactId: string,
  assignedToId: string,
  nudgedBy: string,
  nudgedByName: string
): Promise<boolean> {
  try {
    const contact = await db.getContact(contactId, companyId);
    if (!contact) {
      console.error('[StaleLeads] Contact not found:', contactId);
      return false;
    }
    
    const contactName = `${contact.first_name} ${contact.last_name}`.trim();
    
    // Create notification for the assigned user
    await db.createNotification({
      company_id: companyId,
      user_id: assignedToId,
      type: 'info',
      title: `Reminder: Follow up with ${contactName}`,
      message: `${nudgedByName} is checking in: Have you scheduled an appointment with ${contactName} yet?`,
      related_id: contactId,
      related_type: 'contact',
      read: false,
    });
    
    // Log the nudge in communications
    await db.createCommunication({
      company_id: companyId,
      contact_id: contactId,
      type: 'note',
      direction: 'internal',
      subject: 'Follow-up Reminder',
      content: `${nudgedByName} sent a reminder to follow up with this contact.`,
      user_id: nudgedBy,
    });
    
    console.log(`[StaleLeads] Nudge sent to ${assignedToId} about contact ${contactId}`);
    return true;
  } catch (error) {
    console.error('[StaleLeads] Error sending nudge:', error);
    return false;
  }
}

/**
 * Ensures all contacts have an assigned_to value
 * Assigns to owner if not assigned
 */
export async function ensureContactsAreAssigned(companyId: string): Promise<number> {
  try {
    const contacts = await db.getContacts(companyId);
    const teamMembers = await db.getTeamMembers(companyId);
    
    // Find the owner
    const owner = teamMembers.find(tm => tm.role === 'owner');
    if (!owner) {
      console.warn('[StaleLeads] No owner found for company:', companyId);
      return 0;
    }
    
    let assignedCount = 0;
    
    for (const contact of contacts) {
      if (!contact.assigned_to) {
        await db.updateContact(contact.id, {
          assigned_to: owner.id,
        });
        assignedCount++;
      }
    }
    
    if (assignedCount > 0) {
      console.log(`[StaleLeads] Assigned ${assignedCount} unassigned contact(s) to owner`);
    }
    
    return assignedCount;
  } catch (error) {
    console.error('[StaleLeads] Error ensuring contacts are assigned:', error);
    return 0;
  }
}

/**
 * Main function to run stale lead detection
 * Should be called periodically (e.g., every hour)
 */
export async function runStaleLeadDetection(companyId: string): Promise<{
  staleCount: number;
  assignedCount: number;
}> {
  console.log('[StaleLeads] Running stale lead detection for company:', companyId);
  
  // First, ensure all contacts are assigned
  const assignedCount = await ensureContactsAreAssigned(companyId);
  
  // Detect stale contacts
  const staleContacts = await detectStaleContacts(companyId);
  
  // Notify owners if there are stale contacts
  if (staleContacts.length > 0) {
    await notifyOwnersOfStaleContacts(companyId, staleContacts);
  }
  
  console.log(`[StaleLeads] Detection complete: ${staleContacts.length} stale, ${assignedCount} assigned`);
  
  return {
    staleCount: staleContacts.length,
    assignedCount,
  };
}

/**
 * Get stale contacts for display in UI
 */
export async function getStaleContactsForDisplay(companyId: string): Promise<StaleContact[]> {
  return detectStaleContacts(companyId);
}

/**
 * Detects unassigned contacts and notifies admins/owners
 * This runs independently of stale lead detection
 */
export async function detectAndNotifyUnassignedContacts(companyId: string): Promise<{
  unassignedCount: number;
  notified: boolean;
}> {
  try {
    console.log('[UnassignedContacts] Checking for unassigned contacts in company:', companyId);
    
    // Get all contacts
    const contacts = await db.getContacts(companyId);
    
    // Filter for unassigned contacts (no assigned_to or empty string)
    const unassignedContacts = contacts.filter(contact => {
      // Skip closed/won/lost contacts
      if (['won', 'lost', 'closed', 'completed'].includes(contact.status.toLowerCase())) {
        return false;
      }
      // Check if unassigned
      return !contact.assigned_to || contact.assigned_to === '';
    });
    
    if (unassignedContacts.length === 0) {
      console.log('[UnassignedContacts] No unassigned contacts found');
      return { unassignedCount: 0, notified: false };
    }
    
    console.log(`[UnassignedContacts] Found ${unassignedContacts.length} unassigned contact(s)`);
    
    // Get all owners/admins for the company
    const teamMembers = await db.getTeamMembers(companyId);
    const admins = teamMembers.filter(tm => 
      tm.role === 'owner' || 
      tm.role === 'admin' || 
      tm.role === 'manager'
    );
    
    if (admins.length === 0) {
      console.warn('[UnassignedContacts] No admins found to notify');
      return { unassignedCount: unassignedContacts.length, notified: false };
    }
    
    // Create notification for each admin
    for (const admin of admins) {
      await db.createNotification({
        company_id: companyId,
        user_id: admin.id,
        type: 'warning',
        title: `⚠️ ${unassignedContacts.length} Unassigned Contact${unassignedContacts.length > 1 ? 's' : ''}`,
        message: `Don't forget! ${unassignedContacts.length} contact${unassignedContacts.length > 1 ? 's are' : ' is'} not assigned to any salesman. Please assign ${unassignedContacts.length > 1 ? 'them' : 'it'} to ensure proper follow-up.`,
        related_type: 'unassigned_contacts',
        read: false,
      });
    }
    
    console.log(`[UnassignedContacts] Notified ${admins.length} admin(s) about ${unassignedContacts.length} unassigned contact(s)`);
    
    return {
      unassignedCount: unassignedContacts.length,
      notified: true,
    };
  } catch (error) {
    console.error('[UnassignedContacts] Error detecting/notifying unassigned contacts:', error);
    return { unassignedCount: 0, notified: false };
  }
}

/**
 * Get unassigned contacts for display in UI
 */
export async function getUnassignedContacts(companyId: string): Promise<DbContact[]> {
  try {
    const contacts = await db.getContacts(companyId);
    return contacts.filter(contact => {
      // Skip closed/won/lost contacts
      if (['won', 'lost', 'closed', 'completed'].includes(contact.status.toLowerCase())) {
        return false;
      }
      // Check if unassigned
      return !contact.assigned_to || contact.assigned_to === '';
    });
  } catch (error) {
    console.error('[UnassignedContacts] Error getting unassigned contacts:', error);
    return [];
  }
}
