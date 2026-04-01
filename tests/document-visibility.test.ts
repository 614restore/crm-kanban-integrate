import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildContactDocumentInsights,
  inferDocumentCategoryFromFile,
  isLegalDocument,
  isSignedDocumentName,
} from '../src/lib/documentVisibility';

const mockFile = (name: string, type: string) => ({ name, type } as File);

test('inferDocumentCategoryFromFile categorizes by filename and mime type', () => {
  assert.equal(inferDocumentCategoryFromFile(mockFile('contract.pdf', 'application/pdf')), 'contract');
  assert.equal(inferDocumentCategoryFromFile(mockFile('estimate-final.pdf', 'application/pdf')), 'estimate');
  assert.equal(inferDocumentCategoryFromFile(mockFile('invoice-1001.pdf', 'application/pdf')), 'invoice');
  assert.equal(inferDocumentCategoryFromFile(mockFile('damage.jpg', 'image/jpeg')), 'photo');
  assert.equal(inferDocumentCategoryFromFile(mockFile('insurance-letter.pdf', 'application/pdf')), 'insurance');
  assert.equal(inferDocumentCategoryFromFile(mockFile('misc-notes.txt', 'text/plain')), 'other');
});

test('isLegalDocument detects legal artifacts by type or name', () => {
  assert.equal(isLegalDocument({ type: 'contract', name: 'whatever.pdf' }), true);
  assert.equal(isLegalDocument({ type: 'other', name: '3 day cancel notice.pdf' }), true);
  assert.equal(isLegalDocument({ type: 'other', name: 'work_order_001.pdf' }), true);
  assert.equal(isLegalDocument({ type: 'photo', name: 'damage-image.jpg' }), false);
});

test('isSignedDocumentName detects signed naming hints', () => {
  assert.equal(isSignedDocumentName('Master Contract - Signed.pdf'), true);
  assert.equal(isSignedDocumentName('change order executed copy.pdf'), true);
  assert.equal(isSignedDocumentName('estimate.pdf'), false);
});

test('buildContactDocumentInsights aggregates signed/legal counts', () => {
  const insights = buildContactDocumentInsights({
    documents: [
      { name: 'Master Contract - Signed.pdf', type: 'contract' },
      { name: 'Insurance Photo 1.jpg', type: 'photo' },
      { name: '3 day cancel notice.pdf', type: 'other' },
    ],
    estimates: [
      { status: 'accepted' },
      { status: 'sent' },
      { signatureData: 'data:image/png;base64,abc' },
    ],
    changeOrders: [{ status: 'signed' }, { status: 'draft' }],
  });

  assert.equal(insights.legalDocumentCount, 2);
  assert.equal(insights.signedDocumentNameCount, 1);
  assert.equal(insights.signedEstimateCount, 2);
  assert.equal(insights.signedChangeOrderCount, 1);
  assert.equal(insights.totalSignedArtifacts, 4);
});
