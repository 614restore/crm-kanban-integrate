# ContactDetail.tsx — Manual Patch Instructions

These two fixes must be applied directly in `ContactDetail.tsx`.
They are too surgical to replace the full 170KB file safely via API.
Apply them in your editor with the exact search strings below.

---

## Fix 2 — Real Download Button (Documents Tab)

Search for this pattern (the Download icon button next to each document):

```tsx
<button
  onClick={() => handleOpenDocument(doc.url, doc.name)}
  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
  title="Download"
>
  <Download size={14} />
</button>
```

Replace with:

```tsx
<button
  onClick={async () => {
    const url = doc.url;
    if (!url) return;
    try {
      const { getDocumentSignedUrl } = await import('@/lib/storage');
      const signedUrl = await getDocumentSignedUrl(url, 60);
      if (!signedUrl) { toast.error('Could not generate download link'); return; }
      const a = document.createElement('a');
      a.href = signedUrl;
      a.download = doc.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('[ContactDetail] Download error:', err);
      toast.error('Download failed');
    }
  }}
  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
  title="Download"
>
  <Download size={14} />
</button>
```

---

## Fix 3 — Avatar Fallback (Overview / Header)

Search for the assignee avatar img tag:

```tsx
<img
  src={assignee.avatar}
  alt={assignee.name}
  className="w-8 h-8 rounded-full"
/>
```

Replace with:

```tsx
assignee.avatar ? (
  <img
    src={assignee.avatar}
    alt={assignee.name}
    className="w-8 h-8 rounded-full"
    onError={(e) => {
      (e.currentTarget as HTMLImageElement).style.display = 'none';
      (e.currentTarget.nextElementSibling as HTMLElement | null)?.removeAttribute('hidden');
    }}
  />
) : null}
<span
  hidden={!!assignee.avatar}
  className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold"
>
  {assignee.name?.charAt(0)?.toUpperCase() ?? '?'}
</span
```

> Note: This pattern may appear in 2–3 places in ContactDetail.tsx (header area and Overview tab assignee row). Apply to each occurrence.

---

## Fix 4 — Wire handleSurveyComplete in ContactDetail

Search for:
```tsx
const handleSurveyComplete = (surveyData: any) => {
  // Add survey completion note to contact
  const surveyNote = `Customer survey completed - Overall satisfaction: ${surveyData.overallSatisfaction}/5 stars. ${surveyData.wouldRecommend ? 'Would recommend.' : 'Would not recommend.'}`;
  handleAddNote();
  setShowSurveyModal(false);
};
```

Replace with:
```tsx
const handleSurveyComplete = (surveyData: any) => {
  // CustomerSurvey already saved to Supabase and created the comm note.
  // Here we just update local state so the timeline reflects it immediately.
  const surveyNote = `Customer survey completed — Overall satisfaction: ${surveyData.overallSatisfaction}/5 stars. ${
    surveyData.wouldRecommend ? 'Would recommend.' : 'Would not recommend.'
  }${surveyData.feedback ? ` Feedback: "${surveyData.feedback}"` : ''}`;

  const newComm = {
    id: crypto.randomUUID(),
    contactId: contact.id,
    type: 'note' as const,
    direction: 'inbound' as const,
    content: surveyNote,
    timestamp: new Date().toISOString(),
    userId: state.currentUser?.id || 'unknown',
    userName: state.currentUser?.name || 'Unknown User',
  };

  dispatch({
    type: 'UPDATE_CONTACT',
    payload: {
      ...contact,
      communications: [...(contact.communications || []), newComm],
      updatedAt: new Date().toISOString(),
    },
  });

  setShowSurveyModal(false);
};
```

---

## Fix 5 — Pass companyGoogleUrl to CustomerSurvey

Find where `<CustomerSurvey` is rendered in ContactDetail and add the prop:

```tsx
<CustomerSurvey
  contact={contact}
  companyGoogleUrl={state.company?.googleReviewUrl || undefined}
  onSurveyComplete={handleSurveyComplete}
  onClose={() => setShowSurveyModal(false)}
/>
```

(Replace the existing `<CustomerSurvey` render — it currently does not pass `companyGoogleUrl`.)

---

Once all 5 patches are applied, delete this file.
