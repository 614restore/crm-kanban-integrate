// Automatic company setup helper
import { supabase } from './supabase';
import { db } from './database';

/**
 * Sets up a default company for the user if they don't have one
 * This runs automatically on first login
 */
export async function ensureUserHasCompany(userId: string, userEmail: string): Promise<boolean> {
  try {
    // Check if user already has a company
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Error checking profile:', profileError);
      return false;
    }

    // If user already has a company, we're done
    if (profile?.company_id) {
      return true;
    }


    // Create a new company
    const companyName = userEmail.split('@')[0] || 'My Company';
    const { data: newCompany, error: companyError } = await supabase
      .from('companies')
      .insert({
        name: `${companyName}'s Company`,
        email: userEmail,
        phone: '',
        address: '',
        city: '',
        state: '',
        zip: '',
        website: '',
      })
      .select()
      .single();

    if (companyError || !newCompany) {
      console.error('Error creating company:', companyError);
      return false;
    }


    // Link the company to the user profile with retry logic
    let updateAttempts = 0;
    let updateSuccess = false;
    
    while (updateAttempts < 3 && !updateSuccess) {
      updateAttempts++;
      
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ company_id: newCompany.id, role: 'owner' })
        .eq('id', userId);

      if (!updateError) {
        updateSuccess = true;
      } else {
        console.error(`Error linking company to profile (attempt ${updateAttempts}):`, updateError);
        if (updateAttempts < 3) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }

    if (!updateSuccess) {
      console.error('❌ Failed to link company to profile after all attempts');
      return false;
    }

    // Verify the update
    const { data: verifyProfile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', userId)
      .single();

    if (verifyProfile?.company_id === newCompany.id) {
      return true;
    } else {
      console.error('❌ Company update verification failed');
      return false;
    }
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
      { name: 'Website', is_custom: false },
      { name: 'Referral', is_custom: false },
      { name: 'Google Ads', is_custom: false },
      { name: 'Social Media', is_custom: false },
      { name: 'Direct Mail', is_custom: false },
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
export async function setupNewUser(userId: string, userEmail: string): Promise<boolean> {

  // Step 1: Ensure user has a company
  const companySetup = await ensureUserHasCompany(userId, userEmail);
  if (!companySetup) {
    console.error('❌ Failed to set up company');
    return false;
  }

  // Step 2: Get the company ID
  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', userId)
    .single();

  if (!profile?.company_id) {
    console.error('❌ Could not get company ID');
    return false;
  }

  // Step 3: Set up default lead sources
  await ensureDefaultLeadSources(profile.company_id);

  return true;
}
