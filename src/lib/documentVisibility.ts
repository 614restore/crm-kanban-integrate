export type DocumentCategory = 'contract' | 'estimate' | 'invoice' | 'photo' | 'insurance' | 'other';

const LEGAL_NAME_HINTS = [
  'contract',
  'agreement',
  'estimate',
  'change order',
  'change_order',
  'work order',
  'work_order',
  '3 day cancel',
  '3_day_cancel',
  'cancellation notice',
];

const SIGNED_NAME_HINTS = [
  'signed',
  'executed',
  'countersigned',
  'fully signed',
];

export function inferDocumentCategoryFromFile(file: File): DocumentCategory {
  const fileName = file.name.toLowerCase();
  if (fileName.includes('contract')) return 'contract';
  if (fileName.includes('estimate')) return 'estimate';
  if (fileName.includes('invoice')) return 'invoice';
  if (file.type.startsWith('image/')) return 'photo';
  if (fileName.includes('insurance')) return 'insurance';
  return 'other';
}

export function isLegalDocument(doc: { name?: string; type?: string }): boolean {
  if (doc.type === 'contract' || doc.type === 'estimate') return true;
  const name = (doc.name || '').toLowerCase();
  return LEGAL_NAME_HINTS.some((hint) => name.includes(hint));
}

export function isSignedDocumentName(name: string): boolean {
  const normalized = (name || '').toLowerCase();
  return SIGNED_NAME_HINTS.some((hint) => normalized.includes(hint));
}

export function buildContactDocumentInsights(input: {
  documents: Array<{ name?: string; type?: string }>;
  estimates?: Array<{ status?: string; signedBy?: string; signatureData?: string }>;
  changeOrders?: Array<{ status?: string }>;
}) {
  const legalDocs = input.documents.filter((doc) => isLegalDocument(doc));
  const signedDocsByName = legalDocs.filter((doc) => isSignedDocumentName(doc.name));
  const signedEstimates = (input.estimates || []).filter(
    (e) => e.status === 'accepted' || !!e.signedBy || !!e.signatureData
  ).length;
  const signedChangeOrders = (input.changeOrders || []).filter((co) => co.status === 'signed').length;

  return {
    legalDocumentCount: legalDocs.length,
    signedDocumentNameCount: signedDocsByName.length,
    signedEstimateCount: signedEstimates,
    signedChangeOrderCount: signedChangeOrders,
    totalSignedArtifacts: signedDocsByName.length + signedEstimates + signedChangeOrders,
  };
}
