/**
 * QUICK DATA CHECK
 * 
 * Copy and paste this into your browser console (F12) while logged into the app
 */

(async () => {
  console.log('🔍 Quick Data Check...\n');
  
  try {
    // Get session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.error('❌ Not logged in');
      return;
    }
    
    console.log('✅ Logged in as:', session.user.email);
    
    // Get profile
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    
    if (profileErr) {
      console.error('❌ Profile error:', profileErr);
      return;
    }
    
    console.log('✅ Profile found');
    console.log('   Company ID:', profile.company_id);
    
    if (!profile.company_id) {
      console.error('❌ PROBLEM: Your profile has no company_id!');
      console.log('   This is why no data is loading.');
      console.log('   You need to run this SQL in Supabase:');
      console.log(`   UPDATE profiles SET company_id = 'YOUR_COMPANY_UUID' WHERE id = '${session.user.id}';`);
      return;
    }
    
    // Check company
    const { data: company, error: companyErr } = await supabase
      .from('companies')
      .select('*')
      .eq('id', profile.company_id)
      .single();
    
    if (companyErr) {
      console.error('❌ Company error:', companyErr);
      console.log('   Error code:', companyErr.code);
      console.log('   Error message:', companyErr.message);
      
      if (companyErr.code === '42501' || companyErr.message.includes('policy')) {
        console.log('   🔒 RLS POLICY IS BLOCKING ACCESS!');
        console.log('   Run this in Supabase SQL Editor:');
        console.log('   ALTER TABLE companies DISABLE ROW LEVEL SECURITY;');
      }
      return;
    }
    
    console.log('✅ Company found:', company.name);
    
    // Check contacts
    const { data: contacts, error: contactsErr } = await supabase
      .from('contacts')
      .select('id')
      .eq('company_id', profile.company_id);
    
    if (contactsErr) {
      console.error('❌ Contacts error:', contactsErr);
      if (contactsErr.code === '42501' || contactsErr.message.includes('policy')) {
        console.log('   🔒 RLS POLICY IS BLOCKING CONTACTS!');
        console.log('   Run this in Supabase SQL Editor:');
        console.log('   ALTER TABLE contacts DISABLE ROW LEVEL SECURITY;');
      }
    } else {
      console.log('✅ Contacts found:', contacts.length);
    }
    
    // Check estimates
    const { data: estimates, error: estimatesErr } = await supabase
      .from('estimates')
      .select('id')
      .eq('company_id', profile.company_id);
    
    if (estimatesErr) {
      console.error('❌ Estimates error:', estimatesErr);
    } else {
      console.log('✅ Estimates found:', estimates.length);
    }
    
    console.log('\n📊 SUMMARY:');
    console.log('If you see RLS errors above, your data is there but blocked by security policies.');
    console.log('Run the EMERGENCY_FIX.sql file in your Supabase SQL Editor to fix this.');
    
  } catch (err) {
    console.error('❌ Check failed:', err);
  }
})();
