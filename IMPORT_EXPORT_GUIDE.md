# Import/Export Guide - TrussCTR Contractor CRM

## 📋 Overview
TrussCTR CRM includes robust import/export functionality to help you migrate data from other CRMs or backup your contacts.

---

## 📤 EXPORT Contacts

### How to Export
1. Go to **Contacts** page
2. (Optional) Select specific contacts to export
3. Click the **Export** button in the toolbar
4. File downloads automatically as `contacts-YYYY-MM-DD.xlsx`

### What Gets Exported
All contact data including:
- ✅ Name (first + last)
- ✅ Email address
- ✅ Phone numbers (primary + secondary)
- ✅ Full address (street, city, state, zip)
- ✅ Contact status (Lead, Prospect, Customer, etc.)
- ✅ Lead source
- ✅ Insurance information (company, policy #, claim #)
- ✅ Project type
- ✅ Tags
- ✅ Assigned team member
- ✅ Custom fields
- ✅ Created/updated timestamps

### Export Options
- **Selected contacts**: Select contacts first, then export (exports only selected)
- **All contacts**: Click export with nothing selected (exports all active contacts)
- **Archived contacts**: Toggle "Archived" view, then export

### File Format
- **Excel (.xlsx)** - Opens in Microsoft Excel, Google Sheets, Numbers
- Can be converted to CSV in Excel: File → Save As → CSV

---

## 📥 IMPORT Contacts

### Quick Start
1. **Download the CSV template** first by clicking the **Template** button
2. Open the template in Excel or Google Sheets
3. Fill in your contact data (see field guide below)
4. Save as CSV (File → Save As → CSV format)
5. Click **Import CSV** button
6. Select your CSV file
7. Wait for success confirmation

### Required Fields
- `first_name` - Contact's first name (REQUIRED)
- `last_name` - Contact's last name (REQUIRED)

### Optional Fields
You can include any/all of these fields:

| Field Name | Description | Example |
|------------|-------------|---------|
| `email` | Email address | `john@example.com` |
| `phone1` | Primary phone | `555-1234` |
| `phone2` | Secondary phone | `555-5678` |
| `address` | Street address | `123 Main St` |
| `city` | City | `Denver` |
| `state` | State (2-letter code) | `CO` |
| `zip` | ZIP code | `80206` |
| `status` | Lead, Prospect, Customer, etc. | `Lead` |
| `lead_source` | How they found you | `Referral` |
| `insurance_company` | Insurance provider | `State Farm` |
| `policy_number` | Insurance policy # | `POL123` |
| `claim_number` | Insurance claim # | `CLM456` |
| `project_type` | Type of work | `Roofing` or `Siding, Windows` |

### CSV Format Example
```csv
first_name,last_name,email,phone1,phone2,address,city,state,zip,status,lead_source,insurance_company,policy_number,claim_number,project_type
John,Doe,john@example.com,555-1234,,123 Main St,Denver,CO,80206,Lead,Referral,,,,"Roofing"
Jane,Smith,jane@example.com,555-9999,555-8888,456 Oak Ave,Boulder,CO,80301,Prospect,Website,State Farm,POL123,CLM456,"Siding, Windows"
```

### Important Notes
- ⚠️ **Headers must match exactly** - Use the template to avoid typos
- ⚠️ **Commas in values** - Wrap in quotes (e.g., `"Siding, Windows"`)
- ✅ **Empty fields are okay** - Just leave them blank
- ✅ **Duplicates** - System will import all rows (no automatic duplicate detection)
- ✅ **All contacts** are assigned to you automatically
- ✅ **Lead source** defaults to "Import" if not specified

### Troubleshooting

**"CSV must include first_name and last_name columns"**
- Make sure your CSV has headers in the first row
- Check that headers are spelled exactly: `first_name` and `last_name` (with underscore)

**"Failed to import contacts. X rows were skipped"**
- Check that rows have both first name AND last name
- Verify CSV is properly formatted (no missing commas)
- Check for special characters that might break parsing

**Some contacts imported but not all**
- Check the success message: "✅ Imported 5 contacts (3 skipped)"
- Skipped rows are missing required fields (first/last name)
- Review your CSV for blank rows or incomplete data

---

## 🔄 Migrating FROM Another CRM

### Step-by-Step Migration

1. **Export from your old CRM**
   - Most CRMs have an "Export" or "Download" option
   - Choose CSV or Excel format
   - Download the file

2. **Download TrussCTR template**
   - Go to Contacts → Click **Template** button
   - This shows you exactly what fields we support

3. **Map your data**
   - Open both files in Excel
   - Copy/paste columns from your old CRM to our template
   - Match column headers to our field names (see table above)

4. **Clean up the data** (optional but recommended)
   - Remove duplicate contacts
   - Standardize phone numbers (format doesn't matter)
   - Verify email addresses
   - Standardize state codes (CO, TX, CA, etc.)

5. **Save as CSV**
   - File → Save As → CSV format
   - Make sure it's saved as `.csv` not `.xlsx`

6. **Import into TrussCTR**
   - Click **Import CSV** button
   - Select your file
   - Wait for confirmation

7. **Verify**
   - Review imported contacts
   - Check a few random contacts to ensure data looks correct
   - If something went wrong, you can delete and re-import

### Common CRM Export Mapping

**From Salesforce:**
- `FirstName` → `first_name`
- `LastName` → `last_name`
- `Email` → `email`
- `Phone` → `phone1`
- `MobilePhone` → `phone2`
- `MailingStreet` → `address`
- `MailingCity` → `city`
- `MailingState` → `state`
- `MailingPostalCode` → `zip`
- `LeadSource` → `lead_source`

**From HubSpot:**
- `First Name` → `first_name`
- `Last Name` → `last_name`
- `Email` → `email`
- `Phone Number` → `phone1`
- `City` → `city`
- `State/Region` → `state`
- `Postal Code` → `zip`
- `Original Source` → `lead_source`

**From Zoho CRM:**
- `First Name` → `first_name`
- `Last Name` → `last_name`
- `Email` → `email`
- `Phone` → `phone1`
- `Mobile` → `phone2`
- `Mailing Street` → `address`
- `Mailing City` → `city`
- `Mailing State` → `state`
- `Mailing Zip` → `zip`

---

## 🚀 Migrating TO Another CRM

### Export Your Data

1. **Export from TrussCTR**
   - Go to Contacts page
   - Select contacts (or leave blank for all)
   - Click **Export** button
   - File downloads as Excel (.xlsx)

2. **Convert to CSV if needed**
   - Open the .xlsx file in Excel
   - File → Save As → CSV
   - Choose location and save

3. **Review export**
   - Open the CSV to verify all data is present
   - Check for special characters that might need escaping

4. **Import into new CRM**
   - Follow your new CRM's import instructions
   - Map TrussCTR columns to their field names
   - Most CRMs have a "Preview" step before finalizing

### TrussCTR Export Fields

Our exports include these columns (Excel format):
- First Name, Last Name
- Email, Phone 1, Phone 2
- Address, City, State, ZIP
- Status, Lead Source
- Insurance Company, Policy Number, Claim Number
- Project Type
- Tags (comma-separated)
- Assigned To (team member name)
- Created Date, Updated Date

---

## 🎯 Best Practices

### Before Importing
- ✅ **Backup first** - Export your current contacts before importing
- ✅ **Use the template** - Avoids formatting errors
- ✅ **Test with 5-10 contacts** - Import a small batch first
- ✅ **Clean your data** - Remove duplicates in Excel before importing

### Data Quality
- ✅ **Standardize formats** - Consistent phone numbers, state codes, etc.
- ✅ **Remove test data** - Don't import fake/test contacts
- ✅ **Verify emails** - Invalid emails won't receive notifications
- ✅ **Check status values** - Use: Lead, Prospect, Customer, Archived

### After Importing
- ✅ **Review the import** - Spot-check several contacts
- ✅ **Assign contacts** - Imported contacts are assigned to you by default
- ✅ **Add tags** - Organize with tags (can't be imported, must add manually)
- ✅ **Update missing data** - Fill in any fields that didn't import

---

## ❓ FAQ

**Q: Can I import leads from multiple sources at once?**
A: Yes! Just include different lead sources in the `lead_source` column (Website, Referral, Trade Show, etc.)

**Q: What happens if I import a contact that already exists?**
A: It will create a duplicate. We recommend checking for duplicates in Excel before importing.

**Q: Can I import more than 1000 contacts at once?**
A: Yes, there's no hard limit. Large imports (5000+) may take a few minutes.

**Q: Can I update existing contacts via import?**
A: Not currently. Import only creates new contacts. For updates, use the UI or export → edit → re-import after deleting originals.

**Q: What if my CSV has different column names?**
A: Rename the headers in Excel to match our field names (use the template as a guide).

**Q: Can I import notes or documents?**
A: Not via CSV. Import creates basic contact records. Add notes/documents manually after import.

**Q: Does import work on mobile?**
A: Currently import/export is web-only. Mobile support coming soon.

---

## 🔗 Related Features

- **Bulk Actions** - Select multiple contacts and perform actions (delete, archive, assign, tag)
- **Duplicate Detection** - Find and merge duplicate contacts (Settings → Data Management)
- **Export Other Data** - Also available for: Projects, Work Orders, Estimates, Invoices, Expenses
- **API Access** - For advanced integrations, see API documentation

---

## 📞 Need Help?

If you're having trouble with import/export:
1. Check this guide for troubleshooting tips
2. Try the CSV template - it has working examples
3. Contact support with your CSV file (remove sensitive data first)

---

**Last Updated:** April 3, 2026  
**Version:** 1.0  
**Feature Status:** ✅ Production Ready
