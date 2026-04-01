-- Seed Script: 100 Realistic Customers for TrussCTR CRM
-- Company ID: 9797f417-33ca-4259-b814-924b077931dc
-- Run this in Supabase SQL Editor

-- First, get the user IDs for assignment
DO $$
DECLARE
  v_company_id UUID := '9797f417-33ca-4259-b814-924b077931dc';
  v_owner_id UUID;
  v_user_ids UUID[];
  v_lead_sources TEXT[] := ARRAY['Google Ads', 'Referral', 'Facebook', 'Door Knocking', 'Insurance Referral', 'Yelp', 'Website', 'Repeat Customer'];
  v_statuses TEXT[] := ARRAY['new_lead', 'contacted', 'inspection_scheduled', 'estimate_sent', 'estimate_viewed', 'signed', 'in_progress', 'completed'];
  v_first_names TEXT[] := ARRAY['John', 'Sarah', 'Michael', 'Jennifer', 'David', 'Lisa', 'Robert', 'Mary', 'James', 'Patricia', 'William', 'Linda', 'Richard', 'Barbara', 'Joseph', 'Elizabeth', 'Thomas', 'Susan', 'Charles', 'Jessica', 'Christopher', 'Karen', 'Daniel', 'Nancy', 'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra', 'Donald', 'Ashley', 'Steven', 'Kimberly', 'Paul', 'Emily', 'Andrew', 'Donna', 'Joshua', 'Michelle', 'Kenneth', 'Carol', 'Kevin', 'Amanda', 'Brian', 'Dorothy', 'George', 'Melissa', 'Timothy', 'Deborah'];
  v_last_names TEXT[] := ARRAY['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores', 'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts'];
  v_streets TEXT[] := ARRAY['Main St', 'Oak Ave', 'Maple Dr', 'Cedar Ln', 'Pine St', 'Elm Ave', 'Washington Blvd', 'Park Ave', 'Lake Dr', 'Hill Rd', 'Forest Ln', 'River Rd', 'Sunset Blvd', 'Highland Ave', 'Valley Dr'];
  v_cities TEXT[] := ARRAY['Columbus', 'Cleveland', 'Cincinnati', 'Toledo', 'Akron', 'Dayton', 'Dublin', 'Westerville', 'Grove City', 'Hilliard'];
  v_insurance_companies TEXT[] := ARRAY['State Farm', 'Allstate', 'Nationwide', 'Progressive', 'Liberty Mutual', 'Farmers', 'USAA', 'Travelers', 'American Family', 'Erie Insurance'];
  v_project_types TEXT[] := ARRAY['Roof Replacement', 'Roof Repair', 'Storm Damage', 'Hail Damage', 'Wind Damage', 'Leak Repair', 'Gutter Installation', 'Siding Replacement', 'Full Restoration'];
  
  v_contact_id UUID;
  v_random_status TEXT;
  v_random_source TEXT;
  v_random_user UUID;
  v_random_value NUMERIC;
  v_days_ago INT;
  v_contact_date TIMESTAMP;
  i INT;
BEGIN
  -- Get owner user ID
  SELECT id INTO v_owner_id FROM profiles WHERE company_id = v_company_id AND email = 'jeffrey@614restore.com' LIMIT 1;
  
  -- Get all team member IDs for assignment
  SELECT ARRAY_AGG(id) INTO v_user_ids FROM profiles WHERE company_id = v_company_id;
  
  -- If no team members found, use owner only
  IF v_user_ids IS NULL OR array_length(v_user_ids, 1) = 0 THEN
    v_user_ids := ARRAY[v_owner_id];
  END IF;

  -- Generate 100 contacts
  FOR i IN 1..100 LOOP
    -- Random data selection
    v_random_status := v_statuses[1 + floor(random() * array_length(v_statuses, 1))];
    v_random_source := v_lead_sources[1 + floor(random() * array_length(v_lead_sources, 1))];
    v_random_user := v_user_ids[1 + floor(random() * array_length(v_user_ids, 1))];
    v_random_value := (5000 + random() * 45000)::NUMERIC(10,2);
    v_days_ago := floor(random() * 90)::INT;
    v_contact_date := NOW() - (v_days_ago || ' days')::INTERVAL;
    
    -- Insert contact
    INSERT INTO contacts (
      company_id,
      first_name,
      last_name,
      email,
      phone1,
      address,
      city,
      state,
      zip,
      status,
      status_changed_at,
      lead_source,
      assigned_to,
      insurance_company,
      policy_number,
      claim_number,
      adjuster_name,
      adjuster_phone,
      adjuster_email,
      deductible,
      project_type,
      project_value,
      deposit_amount,
      deposit_paid,
      is_retail,
      notes,
      created_at,
      updated_at
    ) VALUES (
      v_company_id,
      v_first_names[1 + floor(random() * array_length(v_first_names, 1))],
      v_last_names[1 + floor(random() * array_length(v_last_names, 1))],
      'customer' || i || '@example.com',
      '614-' || lpad(floor(random() * 1000)::TEXT, 3, '0') || '-' || lpad(floor(random() * 10000)::TEXT, 4, '0'),
      (1000 + floor(random() * 9000))::TEXT || ' ' || v_streets[1 + floor(random() * array_length(v_streets, 1))],
      v_cities[1 + floor(random() * array_length(v_cities, 1))],
      'OH',
      (43000 + floor(random() * 300))::TEXT,
      v_random_status,
      v_contact_date,
      v_random_source,
      (SELECT email FROM profiles WHERE id = v_random_user),
      CASE WHEN random() > 0.3 THEN v_insurance_companies[1 + floor(random() * array_length(v_insurance_companies, 1))] ELSE NULL END,
      CASE WHEN random() > 0.3 THEN 'POL-' || lpad(floor(random() * 1000000)::TEXT, 6, '0') ELSE NULL END,
      CASE WHEN random() > 0.3 THEN 'CLM-' || lpad(floor(random() * 1000000)::TEXT, 6, '0') ELSE NULL END,
      CASE WHEN random() > 0.5 THEN v_first_names[1 + floor(random() * 20)] || ' ' || v_last_names[1 + floor(random() * 20)] ELSE NULL END,
      CASE WHEN random() > 0.5 THEN '614-' || lpad(floor(random() * 1000)::TEXT, 3, '0') || '-' || lpad(floor(random() * 10000)::TEXT, 4, '0') ELSE NULL END,
      CASE WHEN random() > 0.5 THEN 'adjuster' || floor(random() * 100)::TEXT || '@insurance.com' ELSE NULL END,
      CASE WHEN random() > 0.4 THEN (500 + random() * 2000)::NUMERIC(10,2) ELSE NULL END,
      v_project_types[1 + floor(random() * array_length(v_project_types, 1))],
      v_random_value,
      CASE WHEN v_random_status IN ('signed', 'in_progress', 'completed') THEN (v_random_value * 0.3)::NUMERIC(10,2) ELSE NULL END,
      CASE WHEN v_random_status IN ('in_progress', 'completed') THEN TRUE ELSE FALSE END,
      CASE WHEN random() > 0.7 THEN TRUE ELSE FALSE END,
      CASE 
        WHEN v_random_status = 'new_lead' THEN 'New lead - needs initial contact'
        WHEN v_random_status = 'contacted' THEN 'Spoke with customer, scheduling inspection'
        WHEN v_random_status = 'inspection_scheduled' THEN 'Inspection scheduled for next week'
        WHEN v_random_status = 'estimate_sent' THEN 'Estimate sent, awaiting response'
        WHEN v_random_status = 'estimate_viewed' THEN 'Customer viewed estimate - follow up needed'
        WHEN v_random_status = 'signed' THEN 'Contract signed, scheduling work'
        WHEN v_random_status = 'in_progress' THEN 'Work in progress'
        WHEN v_random_status = 'completed' THEN 'Project completed successfully'
        ELSE 'Standard roofing project'
      END,
      v_contact_date,
      v_contact_date
    ) RETURNING id INTO v_contact_id;
    
    -- Add appointments for some contacts
    IF v_random_status IN ('inspection_scheduled', 'estimate_sent', 'estimate_viewed', 'signed', 'in_progress') AND random() > 0.3 THEN
      INSERT INTO appointments (
        company_id,
        contact_id,
        title,
        type,
        start_time,
        end_time,
        assigned_to,
        location,
        status,
        notes,
        created_at
      ) VALUES (
        v_company_id,
        v_contact_id,
        'Roof Inspection',
        'inspection',
        v_contact_date + ((1 + floor(random() * 14)) || ' days')::INTERVAL + '09:00:00'::TIME,
        v_contact_date + ((1 + floor(random() * 14)) || ' days')::INTERVAL + '10:30:00'::TIME,
        (SELECT email FROM profiles WHERE id = v_random_user),
        (SELECT address || ', ' || city || ', ' || state FROM contacts WHERE id = v_contact_id),
        CASE WHEN v_random_status IN ('estimate_sent', 'estimate_viewed', 'signed', 'in_progress', 'completed') THEN 'completed' ELSE 'scheduled' END,
        'Initial roof inspection and damage assessment',
        v_contact_date
      );
    END IF;
    
    -- Add communications for contacted leads
    IF v_random_status != 'new_lead' AND random() > 0.4 THEN
      INSERT INTO communications (
        company_id,
        contact_id,
        type,
        direction,
        subject,
        content,
        user_id,
        created_at
      ) VALUES (
        v_company_id,
        v_contact_id,
        CASE floor(random() * 3)
          WHEN 0 THEN 'call'
          WHEN 1 THEN 'email'
          ELSE 'sms'
        END,
        'outbound',
        'Initial Contact',
        'Reached out to discuss roofing project. Customer interested in estimate.',
        v_random_user::TEXT,
        v_contact_date + '2 hours'::INTERVAL
      );
    END IF;
    
    -- Add invoices for signed/completed projects
    IF v_random_status IN ('signed', 'in_progress', 'completed') AND random() > 0.5 THEN
      INSERT INTO invoices (
        company_id,
        contact_id,
        invoice_number,
        amount,
        tax_amount,
        status,
        due_date,
        paid_at,
        created_at
      ) VALUES (
        v_company_id,
        v_contact_id,
        'INV-' || TO_CHAR(v_contact_date, 'YYYYMMDD') || '-' || lpad(i::TEXT, 4, '0'),
        v_random_value,
        (v_random_value * 0.07)::NUMERIC(10,2),
        CASE 
          WHEN v_random_status = 'completed' AND random() > 0.3 THEN 'paid'
          WHEN v_random_status = 'in_progress' THEN 'sent'
          ELSE 'draft'
        END,
        v_contact_date + '30 days'::INTERVAL,
        CASE WHEN v_random_status = 'completed' AND random() > 0.3 THEN v_contact_date + '25 days'::INTERVAL ELSE NULL END,
        v_contact_date + '1 day'::INTERVAL
      );
    END IF;
    
  END LOOP;
  
  RAISE NOTICE '✅ Successfully created 100 customers with appointments, communications, and invoices!';
  
END $$;
