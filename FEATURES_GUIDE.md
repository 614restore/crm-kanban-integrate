# TrussCTR - Complete Features Guide

## Table of Contents
1. [Dashboard & Analytics](#dashboard--analytics)
2. [Contact Management (CRM)](#contact-management-crm)
3. [Pipeline & Kanban Board](#pipeline--kanban-board)
4. [Estimates & Proposals](#estimates--proposals)
5. [Invoicing & Payments](#invoicing--payments)
6. [Work Orders & Job Management](#work-orders--job-management)
7. [Material Orders & Inventory](#material-orders--inventory)
8. [Change Orders](#change-orders)
9. [Projects & Job Tracking](#projects--job-tracking)
10. [Calendar & Scheduling](#calendar--scheduling)
11. [Communication Hub](#communication-hub)
12. [Document Management](#document-management)
13. [Team Management](#team-management)
14. [Reports & Analytics](#reports--analytics)
15. [Automation & Workflows](#automation--workflows)
16. [Settings & Configuration](#settings--configuration)

---

## Dashboard & Analytics

### Overview
The Dashboard provides a real-time snapshot of your business performance with key metrics, recent activities, and actionable insights.

### Features
- **Revenue Metrics**: Total revenue, monthly revenue, outstanding invoices
- **Pipeline Overview**: Active leads, conversion rates, deal values
- **Activity Feed**: Recent customer interactions, status changes, team activities
- **Quick Actions**: Create estimate, add contact, schedule appointment
- **Performance Charts**: Revenue trends, lead sources, conversion funnels
- **Goal Tracking**: Monthly targets, team performance, KPIs

### How to Use
1. Access from sidebar (Home icon)
2. View key metrics at a glance
3. Click any metric to drill down into details
4. Use quick action buttons for common tasks
5. Filter date ranges for historical analysis

---

## Contact Management (CRM)

### Overview
Comprehensive customer relationship management with full contact profiles, insurance tracking, and project history.

### Features
- **Contact Profiles**: Name, phone, email, address, tags
- **Insurance Information**: Company, policy number, claim number, adjuster details, deductible
- **Project Details**: Type, value, deposit tracking, payment status
- **Retail Customers**: Flag for retail vs. insurance jobs
- **Lead Source Tracking**: Track where customers come from
- **Assignment**: Assign contacts to team members
- **Status Management**: Track customer through sales pipeline
- **Communication History**: All calls, emails, SMS in one place
- **Document Attachments**: Store contracts, photos, reports
- **Notes & Activities**: Time-stamped notes and activity log

### How to Use
1. **Add New Contact**:
   - Click "+ New Contact" button
   - Fill in basic info (name, phone, email, address)
   - Add insurance details if applicable
   - Assign to team member
   - Set lead source and status
   - Save

2. **View Contact Details**:
   - Click any contact from list
   - View full profile with tabs: Overview, Insurance, Projects, Communications, Documents
   - Edit any field inline
   - Add notes and activities

3. **Filter & Search**:
   - Use search bar for name, phone, email
   - Filter by status, assigned user, tags
   - Sort by date, value, status

4. **Bulk Actions**:
   - Select multiple contacts
   - Assign to team member
   - Add tags
   - Export to Excel

---

## Pipeline & Kanban Board

### Overview
Visual sales pipeline with drag-and-drop Kanban board to track leads through your sales process.

### Pipeline Stages
1. **New Lead**: Initial contact, not yet qualified
2. **Contacted**: First contact made, gathering information
3. **Estimate Sent**: Proposal/estimate delivered to customer
4. **Signed**: Customer accepted, contract signed
5. **In Progress**: Work is actively being performed
6. **Completed**: Job finished, awaiting final payment
7. **Paid**: Final payment received, job closed

### Features
- **Drag & Drop**: Move contacts between stages
- **Visual Alerts**: Color-coded indicators for stale leads, unassigned contacts, missing data
- **Stage Metrics**: Count and total value per stage
- **Quick Actions**: Call, email, create estimate from card
- **Filters**: By assigned user, date range, project type
- **Board Customization**: Show/hide stages, adjust columns

### Alert System
- 🟡 **Yellow Border**: Lead stale for 7+ days
- 🟠 **Orange Border**: Lead stale for 14+ days
- 🔴 **Red Border**: Lead stale for 21+ days
- 👤 **Unassigned Badge**: No team member assigned
- 📞 **No Contact Badge**: Missing phone/email
- 💰 **Missing Value Badge**: No project value entered

### How to Use
1. **Move Contacts**:
   - Drag contact card to new stage
   - Status updates automatically
   - Activity logged in contact history

2. **Quick Actions on Cards**:
   - Click phone icon to log call
   - Click email icon to send email
   - Click card to view full details
   - Click "+" to create estimate

3. **Filter Pipeline**:
   - Select team member to see only their leads
   - Filter by date range
   - Search by customer name

4. **Monitor Alerts**:
   - Review colored borders for stale leads
   - Check badges for missing information
   - Take action to move deals forward

---

## Estimates & Proposals

### Overview
Professional estimate creation with 15+ pre-built templates, line-item pricing, and email delivery with tracking.

### Features
- **15 Pre-Built Templates**:
  - **Restoration**: Water damage, fire damage, mold remediation, sewage cleanup, basement flood
  - **Roofing**: Asphalt shingles, corrugated metal, standing seam metal
  - **Siding**: Vinyl siding, aluminum siding
  - **Storm**: Emergency storm damage
  - **Commercial**: Large-scale water damage
  - **General**: Customizable template

- **Line Item Pricing**: Description, quantity, unit, unit price, total
- **Tax Calculation**: Optional tax with editable rate
- **Terms & Conditions**: Customizable payment terms
- **Notes**: Internal and customer-facing notes
- **Auto-Population**: Customer info (name, address, phone, email) and company info automatically filled
- **Email Delivery**: Professional HTML email with estimate details
- **View Tracking**: Know when customer opens estimate
- **Digital Signatures**: Request and collect signatures electronically
- **Status Tracking**: Draft, Sent, Viewed, Accepted, Declined
- **Convert to Project**: One-click conversion to active project
- **Convert to Invoice**: Turn accepted estimate into invoice
- **Print/PDF**: Professional PDF generation

### How to Use
1. **Create from Template**:
   - Click "New Estimate"
   - Click "Browse Templates"
   - Select template (e.g., "Asphalt Shingle Roof Replacement")
   - Template loads with all materials and pricing
   - Customize quantities and prices as needed

2. **Create from Scratch**:
   - Click "New Estimate"
   - Select customer
   - Add title and validity date
   - Add line items manually
   - Set tax rate if applicable
   - Add notes and terms
   - Save as draft

3. **Edit Line Items**:
   - Modify description, quantity, unit, price
   - Click "+" to add more items
   - Click trash icon to remove items
   - Totals calculate automatically

4. **Send to Customer**:
   - Click "Send" button
   - Email sent with professional template
   - Status changes to "Sent"
   - Track when customer views

5. **Request Signature**:
   - Click "Request Signature"
   - Customer receives email with sign link
   - They draw signature on mobile/desktop
   - You're notified when signed

6. **Accept & Convert**:
   - Click "Mark Accepted"
   - Automatically creates project
   - Updates contact status to "Signed"
   - Sets project value

---

## Invoicing & Payments

### Overview
Professional invoicing with line items, tax options, payment tracking, and email delivery.

### Features
- **Line Item Invoicing**: Description, quantity, unit price, total
- **Tax Toggle**: Include/exclude tax with editable rate (default 8.25%)
- **Payment Terms**: Net 30, Due on Receipt, custom terms
- **Partial Payments**: Track deposits and progress payments
- **Payment Status**: Unpaid, Partial, Paid, Overdue
- **Email Delivery**: Send invoice via email
- **Payment Methods**: Cash, check, credit card, ACH
- **Late Fees**: Automatic calculation for overdue invoices
- **Recurring Invoices**: Set up automatic billing
- **Invoice Templates**: Professional branded templates
- **Export**: PDF and Excel export

### How to Use
1. **Create Invoice**:
   - Click "+ New Invoice"
   - Select customer
   - Add invoice number (auto-generated)
   - Set due date
   - Add line items
   - Toggle tax on/off
   - Adjust tax rate if needed
   - Add payment terms
   - Save and send

2. **Record Payment**:
   - Open invoice
   - Click "Record Payment"
   - Enter amount, date, method
   - Add reference number
   - Save
   - Status updates automatically

3. **Send Reminders**:
   - Filter by "Overdue"
   - Select invoices
   - Click "Send Reminder"
   - Automated email sent

4. **Track Payments**:
   - View payment history on invoice
   - See outstanding balance
   - Filter by payment status
   - Export for accounting

---

## Work Orders & Job Management

### Overview
Detailed work order management with crew assignments, material tracking, and progress updates.

### Features
- **Work Order Creation**: From estimates or standalone
- **Crew Assignment**: Assign team members to jobs
- **Schedule Management**: Start date, end date, duration
- **Material Tracking**: Link to material orders
- **Progress Updates**: Daily logs, photo uploads
- **Time Tracking**: Labor hours per crew member
- **Status Tracking**: Scheduled, In Progress, On Hold, Completed
- **Customer Notifications**: Automated updates
- **Quality Checklist**: Pre-defined inspection items
- **Completion Sign-Off**: Customer signature on completion

### How to Use
1. **Create Work Order**:
   - From estimate: Click "Convert to Work Order"
   - Or create new from Work Orders page
   - Fill in job details
   - Assign crew members
   - Set schedule
   - Add materials needed
   - Save

2. **Update Progress**:
   - Open work order
   - Click "Add Update"
   - Enter progress notes
   - Upload photos
   - Log hours worked
   - Save

3. **Complete Job**:
   - Mark all checklist items complete
   - Upload final photos
   - Request customer sign-off
   - Change status to "Completed"
   - Generate completion report

---

## Material Orders & Inventory

### Overview
Track material orders, supplier management, and inventory levels.

### Features
- **Material Orders**: Create purchase orders for suppliers
- **Supplier Management**: Contact info, pricing, lead times
- **Inventory Tracking**: Current stock levels
- **Cost Tracking**: Material costs per job
- **Delivery Tracking**: Expected delivery dates
- **Reorder Alerts**: Low stock notifications
- **Vendor Comparison**: Compare pricing across suppliers

### How to Use
1. **Create Material Order**:
   - Click "+ New Material Order"
   - Select supplier
   - Add items with quantities
   - Set delivery date
   - Add to specific job/work order
   - Submit order

2. **Receive Materials**:
   - Open material order
   - Click "Mark Received"
   - Verify quantities
   - Update inventory
   - Attach packing slip

3. **Track Costs**:
   - View material costs per job
   - Compare estimated vs. actual
   - Export for accounting

---

## Change Orders

### Overview
Manage scope changes, additional work, and pricing adjustments with customer approval.

### Features
- **Change Request**: Document scope changes
- **Pricing Adjustments**: Add/subtract from original contract
- **Customer Approval**: Digital signature required
- **Reason Tracking**: Document why change is needed
- **Impact Analysis**: Time and cost impact
- **Approval Workflow**: Request → Review → Approve/Deny
- **Invoice Integration**: Automatically update invoice totals

### How to Use
1. **Create Change Order**:
   - Open project or work order
   - Click "Create Change Order"
   - Describe change
   - Add line items for additional work
   - Calculate new total
   - Save

2. **Request Approval**:
   - Click "Send for Approval"
   - Customer receives email
   - They review and sign
   - You're notified of decision

3. **Implement Approved Changes**:
   - Update work order
   - Adjust schedule if needed
   - Update invoice
   - Notify crew

---

## Projects & Job Tracking

### Overview
Comprehensive project management from estimate to completion.

### Features
- **Project Dashboard**: Overview of all active projects
- **Timeline View**: Gantt chart of project schedules
- **Milestone Tracking**: Key project milestones
- **Budget Tracking**: Estimated vs. actual costs
- **Document Storage**: All project files in one place
- **Team Collaboration**: Comments, mentions, notifications
- **Customer Portal**: Customer can view progress
- **Completion Checklist**: Ensure nothing is missed

### How to Use
1. **Create Project**:
   - Convert from accepted estimate
   - Or create new project
   - Set start and end dates
   - Assign project manager
   - Add team members
   - Set budget

2. **Track Progress**:
   - Update milestones as completed
   - Log expenses
   - Upload photos and documents
   - Add notes and updates

3. **Close Project**:
   - Complete all checklist items
   - Get customer sign-off
   - Generate final invoice
   - Archive project

---

## Calendar & Scheduling

### Overview
Appointment scheduling, crew scheduling, and calendar management.

### Features
- **Appointment Booking**: Schedule customer meetings
- **Crew Scheduling**: Assign crews to jobs
- **Calendar Views**: Day, week, month views
- **Drag & Drop**: Reschedule appointments easily
- **Reminders**: Automated email/SMS reminders
- **Availability Management**: Block out time
- **Recurring Appointments**: Set up repeating schedules
- **Team Calendars**: View team member schedules
- **Integration**: Sync with Google Calendar, Outlook

### How to Use
1. **Schedule Appointment**:
   - Click date/time on calendar
   - Select appointment type
   - Choose customer
   - Assign team member
   - Add notes
   - Save
   - Automated reminder sent

2. **Reschedule**:
   - Drag appointment to new time
   - Confirm change
   - Customer notified automatically

3. **View Team Schedule**:
   - Switch to team view
   - See all team member calendars
   - Identify availability
   - Balance workload

---

## Communication Hub

### Overview
Centralized communication tracking for all customer interactions.

### Features
- **Call Logging**: Log phone calls with notes
- **Email Integration**: Send and track emails
- **SMS Messaging**: Text customers directly
- **Communication History**: All interactions in timeline
- **Templates**: Pre-written email and SMS templates
- **Bulk Messaging**: Send to multiple customers
- **Automated Notifications**: Status updates, reminders
- **Two-Way Sync**: Emails sync with Gmail/Outlook

### How to Use
1. **Log Call**:
   - Open contact
   - Click "Log Call"
   - Select call type (inbound/outbound)
   - Add notes
   - Set follow-up reminder
   - Save

2. **Send Email**:
   - Click "Send Email"
   - Choose template or write custom
   - Add attachments
   - Send
   - Track opens and clicks

3. **Send SMS**:
   - Click "Send SMS"
   - Type message or use template
   - Send
   - View delivery status

4. **View History**:
   - All communications in timeline
   - Filter by type (call, email, SMS)
   - Search by keyword
   - Export communication log

---

## Document Management

### Overview
Centralized document storage with templates, e-signatures, and version control.

### Features
- **Document Templates**: Contracts, agreements, forms
- **Auto-Population**: Customer and company data auto-filled
- **E-Signatures**: Collect signatures electronically
- **Version Control**: Track document revisions
- **Folder Organization**: Organize by customer, project, type
- **File Upload**: Photos, PDFs, Word docs, Excel
- **Sharing**: Share documents with customers
- **Access Control**: Permissions by team member
- **Search**: Full-text search across documents

### Available Templates
- **Restoration Contract**: Water/fire damage restoration agreement
- **Roofing Contract**: Roof replacement/repair contract
- **Siding Contract**: Siding installation agreement
- **General Service Agreement**: Customizable service contract
- **Change Order Form**: Scope change documentation
- **Lien Waiver**: Conditional/unconditional lien waivers
- **Certificate of Completion**: Job completion certificate
- **Warranty Certificate**: Workmanship warranty

### How to Use
1. **Create from Template**:
   - Click "New Document"
   - Select template
   - Choose customer
   - Template auto-fills customer and company info
   - Review and customize
   - Send for signature

2. **Upload Document**:
   - Click "Upload"
   - Select file(s)
   - Choose folder/category
   - Add tags
   - Save

3. **Request Signature**:
   - Open document
   - Click "Request Signature"
   - Customer receives email
   - They sign electronically
   - Signed copy saved automatically

4. **Share with Customer**:
   - Select document
   - Click "Share"
   - Enter customer email
   - Set expiration date
   - Send link

---

## Team Management

### Overview
User management, roles, permissions, and team performance tracking.

### Features
- **User Accounts**: Create accounts for team members
- **Role-Based Permissions**: Admin, Manager, Sales, Crew
- **Activity Tracking**: See what team members are doing
- **Performance Metrics**: Sales, jobs completed, customer satisfaction
- **Commission Tracking**: Calculate sales commissions
- **Time Off Management**: Request and approve time off
- **Team Chat**: Internal messaging
- **Notifications**: Mentions, assignments, updates

### Roles & Permissions
- **Admin**: Full access to all features
- **Manager**: Manage team, view all data, limited settings access
- **Sales**: Manage leads, create estimates, view assigned customers
- **Crew**: View assigned jobs, update work orders, log time
- **Accounting**: View financial data, manage invoices, run reports

### How to Use
1. **Add Team Member**:
   - Go to Settings → Team
   - Click "+ Add Team Member"
   - Enter name, email, phone
   - Assign role
   - Set permissions
   - Send invitation

2. **Assign Leads**:
   - Select contact(s)
   - Click "Assign To"
   - Choose team member
   - They receive notification

3. **Track Performance**:
   - Go to Reports → Team Performance
   - View metrics by team member
   - Filter by date range
   - Export report

---

## Reports & Analytics

### Overview
Comprehensive reporting and business intelligence.

### Available Reports
- **Sales Report**: Revenue by period, product, team member
- **Pipeline Report**: Conversion rates, average deal size, sales cycle
- **Customer Report**: New customers, retention rate, lifetime value
- **Job Report**: Jobs completed, average job value, profitability
- **Financial Report**: P&L, cash flow, accounts receivable aging
- **Team Performance**: Sales by rep, jobs per crew, productivity
- **Lead Source Report**: ROI by marketing channel
- **Inventory Report**: Stock levels, usage, reorder needs

### Features
- **Custom Date Ranges**: Daily, weekly, monthly, quarterly, yearly, custom
- **Filters**: By team member, customer, project type, status
- **Visualizations**: Charts, graphs, tables
- **Export**: PDF, Excel, CSV
- **Scheduled Reports**: Automated email delivery
- **Dashboards**: Create custom dashboards
- **Drill-Down**: Click any metric to see details

### How to Use
1. **Run Report**:
   - Go to Reports
   - Select report type
   - Set date range
   - Apply filters
   - Click "Generate"
   - View results

2. **Export Report**:
   - Click "Export"
   - Choose format (PDF/Excel)
   - Download file

3. **Schedule Report**:
   - Click "Schedule"
   - Set frequency (daily, weekly, monthly)
   - Choose recipients
   - Save
   - Report emails automatically

---

## Automation & Workflows

### Overview
Automate repetitive tasks and create custom workflows.

### Features
- **Trigger-Based Automation**: When X happens, do Y
- **Email Automation**: Welcome emails, follow-ups, reminders
- **Status Updates**: Auto-update status based on actions
- **Task Assignment**: Auto-assign tasks to team members
- **Notifications**: Alert team when conditions are met
- **Lead Routing**: Auto-assign leads based on rules
- **Follow-Up Reminders**: Never miss a follow-up

### Pre-Built Automations
- **New Lead Welcome**: Send welcome email when lead is created
- **Estimate Follow-Up**: Send reminder 3 days after estimate sent
- **Stale Lead Alert**: Notify manager if lead inactive for 7 days
- **Payment Reminder**: Send reminder 3 days before invoice due
- **Job Completion Survey**: Send survey when job marked complete
- **Review Request**: Request Google review after job completion

### How to Use
1. **Create Automation**:
   - Go to Settings → Automations
   - Click "+ New Automation"
   - Choose trigger (e.g., "Estimate Sent")
   - Choose action (e.g., "Send Email")
   - Configure details
   - Activate

2. **Edit Automation**:
   - Click automation name
   - Modify trigger or action
   - Save changes

3. **View Automation Log**:
   - See when automations ran
   - View success/failure status
   - Troubleshoot issues

---

## Settings & Configuration

### Overview
Configure your account, company profile, and system preferences.

### Company Settings
- **Company Profile**: Name, address, phone, email, website
- **Branding**: Logo, colors, tagline
- **License Information**: Contractor license number, tax ID
- **Email Settings**: From name, from email, SMTP configuration
- **Review Links**: Google, Yelp review URLs

### User Preferences
- **Notification Settings**: Email, SMS, in-app notifications
- **Default Views**: Set default filters and views
- **Time Zone**: Set your time zone
- **Date Format**: US or international format
- **Currency**: USD, CAD, etc.

### Integration Settings
- **Email Integration**: Connect Gmail, Outlook
- **Calendar Sync**: Sync with Google Calendar, Outlook
- **Accounting**: QuickBooks, Xero integration
- **Payment Processing**: Stripe, Square integration
- **SMS Provider**: Twilio configuration

### How to Use
1. **Update Company Profile**:
   - Go to Settings → Company
   - Update fields
   - Upload logo
   - Save changes
   - Changes appear on all documents

2. **Configure Integrations**:
   - Go to Settings → Integrations
   - Select integration
   - Click "Connect"
   - Authorize access
   - Configure sync settings

3. **Manage Notifications**:
   - Go to Settings → Notifications
   - Toggle notification types
   - Set frequency
   - Save preferences

---

## Mobile Access

### Overview
TrussCTR is fully responsive and works on mobile devices.

### Mobile Features
- **Responsive Design**: Optimized for phones and tablets
- **Touch-Friendly**: Large buttons, swipe gestures
- **Offline Mode**: View data without internet
- **Photo Upload**: Take photos and upload directly
- **GPS Location**: Auto-tag photos with location
- **Push Notifications**: Real-time alerts on mobile
- **Quick Actions**: Call, text, email from contact card

### How to Use on Mobile
1. **Access on Phone**:
   - Open browser (Chrome, Safari)
   - Go to your TrussCTR URL
   - Login with credentials
   - Add to home screen for app-like experience

2. **Take Photos**:
   - Open work order or project
   - Click "Add Photo"
   - Take photo or select from gallery
   - Photo uploads automatically

3. **Update on the Go**:
   - Log calls while driving
   - Update job status from job site
   - Send estimates from customer meeting
   - Check schedule between appointments

---

## Best Practices

### Lead Management
- ✅ Respond to new leads within 1 hour
- ✅ Follow up within 24 hours if no response
- ✅ Set reminders for every follow-up
- ✅ Move leads through pipeline stages promptly
- ✅ Add detailed notes after every interaction

### Estimate Creation
- ✅ Use templates for consistency
- ✅ Include detailed line items
- ✅ Add photos to estimates when possible
- ✅ Set realistic validity dates (30 days)
- ✅ Follow up 2-3 days after sending

### Job Management
- ✅ Create work orders immediately after signing
- ✅ Assign crew before job starts
- ✅ Update progress daily
- ✅ Upload photos throughout job
- ✅ Get customer sign-off on completion

### Communication
- ✅ Log every customer interaction
- ✅ Use templates for common messages
- ✅ Set follow-up reminders
- ✅ Respond to customer inquiries within 4 hours
- ✅ Send proactive updates on job progress

### Financial Management
- ✅ Send invoices immediately on completion
- ✅ Collect deposits before starting work
- ✅ Track all expenses per job
- ✅ Send payment reminders for overdue invoices
- ✅ Reconcile payments weekly

---

## Keyboard Shortcuts

- `Ctrl/Cmd + K`: Quick search
- `Ctrl/Cmd + N`: New contact
- `Ctrl/Cmd + E`: New estimate
- `Ctrl/Cmd + I`: New invoice
- `Ctrl/Cmd + /`: Show shortcuts
- `Esc`: Close modal
- `Tab`: Navigate form fields
- `Enter`: Submit form

---

## Support & Training

### Getting Help
- **In-App Help**: Click "?" icon for contextual help
- **Knowledge Base**: Searchable help articles
- **Video Tutorials**: Step-by-step video guides
- **Email Support**: support@trussctr.com
- **Live Chat**: Available during business hours
- **Phone Support**: (614) 555-0100

### Training Resources
- **Quick Start Guide**: Get up and running in 15 minutes
- **Video Library**: 50+ tutorial videos
- **Webinars**: Weekly live training sessions
- **Certification Program**: Become a TrussCTR expert
- **Community Forum**: Connect with other users

---

## What's New

### Recent Updates
- ✅ **15 Estimate Templates**: Pre-built templates for roofing, siding, restoration
- ✅ **Tax Toggle**: Include/exclude tax on invoices and estimates
- ✅ **Pipeline Alerts**: Visual indicators for stale leads and missing data
- ✅ **Auto-Population**: Customer and company data auto-fills in documents
- ✅ **Real Company Branding**: Your company info on all documents
- ✅ **Enhanced Email Templates**: Professional HTML email designs

### Coming Soon
- 📱 Native Mobile Apps (iOS & Android)
- 🤖 AI-Powered Lead Scoring
- 📊 Advanced Analytics Dashboard
- 💳 Integrated Payment Processing
- 📧 Email Marketing Campaigns
- 🔗 QuickBooks Integration
- 📱 SMS Two-Way Conversations
- 🗺️ Route Optimization for Crews

---

**Last Updated**: January 2025
**Version**: 2.0
