// Automatic company setup helper
import { supabase } from './supabase';
import { db } from './database';

/**
 * Creates the signed-up user's company and makes them its owner.
 *
 * On the shared backend people belong to companies through team_members, and
 * `profiles` (which this used to write to) is a read-only view over it. So the
 * company and the owner's membership are created together by
 * create_company_and_owner, the function QuoteMGR's sign-up uses. It is given
 * the new user's id because right after sign-up, with email confirmation on,
 * there is no session yet; without a session it refuses users who already
 * belong to a company.
 */
export async function ensureUserHasCompany(userId: string, userEmail: string, companyName?: string, ownerName?: string): Promise<boolean> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session) {
      // Signed in: only create a company if they have none. If that check
      // fails, stop rather than risk giving them a second company.
      const { data: ids, error } = await supabase.rpc('get_my_company_ids');
      if (error) {
        console.error('Error checking for an existing company:', error);
        return false;
      }
      if (Array.isArray(ids) && ids.length > 0) return true;
    }

    const derivedName = userEmail.split('@')[0] || 'My';
    const { error } = await supabase.rpc('create_company_and_owner', {
      company_name: companyName?.trim() || `${derivedName}'s Company`,
      company_email: userEmail,
      owner_full_name: ownerName?.trim() || derivedName,
      owner_email: userEmail,
      owner_user_id: userId,
    });
    if (error) {
      console.error('Error creating company:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error in ensureUserHasCompany:', error);
    return false;
  }
}

/**
 * Sets up default lead sources for a company
 */
export async function ensureDefaultLeadSources(companyId: string): Promise<boolean> {
  try {
    // Check if company already has lead sources
    const { data: existing, error: checkError } = await supabase
      .from('lead_sources')
      .select('id')
      .eq('company_id', companyId)
      .limit(1);

    if (checkError) {
      console.error('Error checking lead sources:', checkError);
      return false;
    }

    // If lead sources exist, we're done
    if (existing && existing.length > 0) {
      return true;
    }


    // Create default lead sources
    const defaultSources = [
      { name: 'Website' },
      { name: 'Referral' },
      { name: 'Google Ads' },
      { name: 'Social Media' },
      { name: 'Direct Mail' },
    ];

    const { error: insertError } = await supabase
      .from('lead_sources')
      .insert(
        defaultSources.map((source) => ({
          ...source,
          company_id: companyId,
        }))
      );

    if (insertError) {
      console.error('Error creating lead sources:', insertError);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in ensureDefaultLeadSources:', error);
    return false;
  }
}

/**
 * Complete first-time setup for a new user
 */
export async function setupNewUser(userId: string, userEmail: string, companyName?: string, ownerName?: string): Promise<boolean> {

  // Step 1: Ensure user has a company
  const companySetup = await ensureUserHasCompany(userId, userEmail, companyName, ownerName);
  if (!companySetup) {
    console.error('❌ Failed to set up company');
    return false;
  }

  // Step 2: Get the company ID
  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', userId)
    .maybeSingle();

  // No session yet (email confirmation pending): the company exists, but its
  // lead sources can only be written once the owner signs in.
  if (!profile?.company_id) {
    return true;
  }

  // Step 3: Set up default lead sources
  await ensureDefaultLeadSources(profile.company_id);

  return true;
}
