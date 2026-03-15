/**
 * TrussCTR Diagnostic Script
 * 
 * Run this in your browser console (F12) after logging in to diagnose data loading issues.
 * 
 * Usage:
 * 1. Open browser console (F12)
 * 2. Copy and paste this entire script
 * 3. Press Enter
 * 4. Review the output
 */

(async function runDiagnostics() {
  console.log('🔍 TrussCTR Diagnostics Starting...\n');
  
  const results = {
    auth: null,
    profile: null,
    company: null,
    contacts: null,
    errors: []
  };

  // Check if supabase is available
  if (typeof supabase === 'undefined') {
    console.error('❌ Supabase client not found. Make sure you\'re logged in.');
    return;
  }

  try {
    // 1. Check Authentication
    console.log('1️⃣ Checking Authentication...');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('❌ Session Error:', sessionError);
      results.errors.push({ step: 'auth', error: sessionError });
    } else if (!session) {
      console.error('❌ No active session found. Please log in.');
      return;
    } else {
      console.log('✅ Authenticated as:', session.user.email);
      console.log('   User ID:', session.user.id);
      results.auth = { email: session.user.email, userId: session.user.id };
    }

    // 2. Check Profile
    console.log('\n2️⃣ Checking Profile...');
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    
    if (profileError) {
      console.error('❌ Profile Error:', profileError);
      results.errors.push({ step: 'profile', error: profileError });
    } else if (!profile) {
      console.error('❌ No profile found for user');
    } else {
      console.log('✅ Profile loaded');
      console.log('   Name:', profile.first_name, profile.last_name);
      console.log('   Role:', profile.role);
      console.log('   Company ID:', profile.company_id);
      results.profile = profile;
      
      if (!profile.company_id) {
        console.error('⚠️  WARNING: Profile has no company_id! This will prevent data from loading.');
        results.errors.push({ step: 'profile', error: 'Missing company_id' });
      }
    }

    // 3. Check Company Data
    if (profile?.company_id) {
      console.log('\n3️⃣ Checking Company Data...');
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('*')
        .eq('id', profile.company_id)
        .single();
      
      if (companyError) {
        console.error('❌ Company Error:', companyError);
        console.log('   This might be an RLS (Row Level Security) issue.');
        results.errors.push({ step: 'company', error: companyError });
        
        // Try RPC fallback
        console.log('   Trying RPC fallback...');
        const { data: rpcCompany, error: rpcError } = await supabase.rpc('get_my_company');
        if (rpcError) {
          console.error('   ❌ RPC also failed:', rpcError);
        } else if (rpcCompany && rpcCompany.length > 0) {
          console.log('   ✅ RPC succeeded! Company:', rpcCompany[0].name);
          results.company = rpcCompany[0];
        }
      } else if (!company) {
        console.error('❌ No company found for ID:', profile.company_id);
      } else {
        console.log('✅ Company loaded');
        console.log('   Name:', company.name);
        console.log('   Logo:', company.logo_url || '(none)');
        console.log('   Subscription:', company.subscription_status);
        results.company = company;
      }

      // 4. Check Contacts
      console.log('\n4️⃣ Checking Contacts...');
      const { data: contacts, error: contactsError } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, email, status')
        .eq('company_id', profile.company_id)
        .limit(5);
      
      if (contactsError) {
        console.error('❌ Contacts Error:', contactsError);
        results.errors.push({ step: 'contacts', error: contactsError });
      } else {
        console.log(`✅ Found ${contacts?.length || 0} contacts (showing first 5)`);
        if (contacts && contacts.length > 0) {
          contacts.forEach((c, i) => {
            console.log(`   ${i + 1}. ${c.first_name} ${c.last_name} (${c.status})`);
          });
        }
        results.contacts = { count: contacts?.length || 0, sample: contacts };
      }

      // 5. Check Team Members
      console.log('\n5️⃣ Checking Team Members...');
      const { data: team, error: teamError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, role')
        .eq('company_id', profile.company_id);
      
      if (teamError) {
        console.error('❌ Team Error:', teamError);
      } else {
        console.log(`✅ Found ${team?.length || 0} team members`);
      }
    }

    // 6. Check LocalStorage Cache
    console.log('\n6️⃣ Checking LocalStorage Cache...');
    const cacheKeys = Object.keys(localStorage).filter(k => 
      k.includes('company_cache') || k.includes('demo_') || k.includes('sb-')
    );
    console.log(`   Found ${cacheKeys.length} cache entries`);
    if (cacheKeys.length > 0) {
      console.log('   Cache keys:', cacheKeys);
    }

    // Summary
    console.log('\n📊 DIAGNOSTIC SUMMARY');
    console.log('═══════════════════════════════════════');
    console.log('Auth:', results.auth ? '✅ OK' : '❌ FAILED');
    console.log('Profile:', results.profile ? '✅ OK' : '❌ FAILED');
    console.log('Company:', results.company ? '✅ OK' : '❌ FAILED');
    console.log('Contacts:', results.contacts ? `✅ ${results.contacts.count} found` : '❌ FAILED');
    console.log('Errors:', results.errors.length);
    
    if (results.errors.length > 0) {
      console.log('\n⚠️  ERRORS FOUND:');
      results.errors.forEach((err, i) => {
        console.log(`${i + 1}. [${err.step}]`, err.error);
      });
    }

    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    if (!results.profile?.company_id) {
      console.log('❗ Your profile is missing a company_id. Contact support or run:');
      console.log('   UPDATE profiles SET company_id = \'your-company-uuid\' WHERE id = \'' + session.user.id + '\';');
    }
    if (results.errors.some(e => e.step === 'company' && e.error.code === '42501')) {
      console.log('❗ RLS policy is blocking company access. Run in Supabase SQL Editor:');
      console.log('   ALTER TABLE companies DISABLE ROW LEVEL SECURITY;');
    }
    if (results.errors.some(e => e.step === 'contacts')) {
      console.log('❗ Cannot load contacts. Check RLS policies on contacts table.');
    }
    if (results.errors.length === 0 && results.company && results.contacts) {
      console.log('✅ All checks passed! If data still not showing, try:');
      console.log('   1. Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)');
      console.log('   2. Clear cache: localStorage.clear(); location.reload();');
    }

    console.log('\n✅ Diagnostics Complete!');
    console.log('📋 Full results stored in window.diagnosticResults');
    window.diagnosticResults = results;

  } catch (error) {
    console.error('❌ Diagnostic script failed:', error);
  }
})();
