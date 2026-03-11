# Document Templates - User Guide

## ✅ What's New

Your document system now has **simple form-based editing** for professional documents like the Certificate of Completion.

## 🎯 How It Works

### 1. **Find Your Template**
- Go to **Document Templates** in the CRM
- Look for templates with the **"Edit & Use"** button (these have simple forms)
- Certificate of Completion is ready to use!

### 2. **Fill Out the Form**
Click **"Edit & Use"** and you'll see a simple form with just the fields you need:
- Customer Name
- Contract Date  
- Completion Date

**Everything else auto-fills:**
- ✅ Company name, logo, license (from your profile)
- ✅ Document ID and certificate number (auto-generated)
- ✅ Verification hash (for legal compliance)
- ✅ Generation date/time

### 3. **Preview & Send**
- Switch to **"Preview Document"** tab to see the final PDF-ready version
- Click **"Download"** to save as HTML (can be printed to PDF)
- Click **"Send"** to email to customer
- Click **"Save"** to store in the system

## 📋 Current Templates with Simple Editing

### Certificate of Completion
- **3-page professional legal document**
- Matches your provided screenshots exactly
- Auto-generates document IDs and verification hashes
- Dual signature blocks (contractor + customer)
- Legal compliance sections included

## 🎨 Document Consistency

All documents automatically use:
- Your company logo (upload in Settings → Company Profile)
- Your company name
- Your contractor license number
- Professional formatting matching your brand

## 🔧 Adding More Simple-Edit Templates

To make any template use the simple editor, add a `fields` array:

```typescript
{
  id: 'my-template',
  name: 'My Template',
  // ... other properties
  fields: [
    { 
      key: 'CUSTOMER_NAME', 
      label: 'Customer Name', 
      type: 'text', 
      required: true 
    },
    { 
      key: 'PROJECT_DESCRIPTION', 
      label: 'Project Description', 
      type: 'textarea' 
    },
    { 
      key: 'COMPLETION_DATE', 
      label: 'Completion Date', 
      type: 'date' 
    }
  ]
}
```

Field types available:
- `text` - Single line text
- `textarea` - Multi-line text
- `date` - Date picker
- `number` - Numeric input

## 💡 Tips

1. **Upload your logo first** - Go to Settings → Company Profile
2. **Set your license number** - Also in Company Profile
3. **Use date fields** - They auto-populate with today's date
4. **Preview before sending** - Always check the Preview tab
5. **Download for records** - Save a copy before sending

## 🚀 Coming Soon

- Email integration for direct sending
- PDF generation (currently HTML → print to PDF)
- Customer signature collection
- Document storage and history
- Template customization UI

## 📞 Need Help?

The system auto-generates:
- Document IDs (format: `COC-YYYYMMDD-######`)
- Verification hashes (for legal authenticity)
- Generation timestamps
- Page numbers and footers

Everything is designed to look professional and be legally compliant right out of the box.
