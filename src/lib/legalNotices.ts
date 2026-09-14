// Copied from QuoteMGR src/lib/legalNotices.ts (read-only reference).
// ─────────────────────────────────────────────────────────────────────────────
// Legal notices for home-improvement / home-solicitation contracts.
//
// Sources: FTC Cooling-Off Rule (16 CFR §429), each state's Home Solicitation
// Sales Act or Home Improvement Contract statute, and relevant AG guidance.
//
// IMPORTANT: This text is a best-effort reference. It does not constitute legal
// advice and should be reviewed by qualified legal counsel before relying on it
// in any jurisdiction. Statutes and AG interpretations change — verify currency
// against the controlling source for your state before each use.
// ─────────────────────────────────────────────────────────────────────────────

export type LegalNotice = {
  stateCode: string;
  contractAgreementText: string;
  cancelTitle: string;
  cancelBody: string;
  cancelIntroParagraphs?: string[];
  cancelInstructionText?: string;
  signatureFooterText: string;
};

const STATE_NAME_TO_CODE: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR',
  california: 'CA', colorado: 'CO', connecticut: 'CT', delaware: 'DE',
  'district of columbia': 'DC', florida: 'FL', georgia: 'GA', hawaii: 'HI',
  idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS',
  kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
  massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS',
  missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM',
  'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND',
  ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA',
  'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD',
  tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA',
  washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY',
};

// ─── Federal baseline (FTC Cooling-Off Rule, 16 CFR §429) ────────────────────
const FEDERAL_NOTICE: LegalNotice = {
  stateCode: 'DEFAULT',
  contractAgreementText:
    'By signing below, I acknowledge that I have reviewed and accept the terms ' +
    'of this proposal. I authorize the contractor to perform the described work ' +
    'at the agreed price. I understand that if this agreement was solicited or ' +
    'signed at my residence or a location other than the contractor\'s regular ' +
    'place of business, I may cancel it within three (3) business days under the ' +
    'Federal Trade Commission Cooling-Off Rule (16 CFR Part 429).',
  cancelTitle: 'Notice of Right to Cancel',
  cancelIntroParagraphs: [
    'Your right to cancel: If you agreed to this contract at your residence or at ' +
    'a location other than the contractor\'s regular place of business, the Federal ' +
    'Trade Commission\'s Cooling-Off Rule (16 CFR Part 429) gives you the right to ' +
    'cancel this transaction without penalty or obligation within THREE (3) BUSINESS ' +
    'DAYS from the date of the transaction.',
    'If you cancel, any property traded in, any payments made by you under the contract ' +
    'or sale, and any negotiable instrument executed by you will be returned within ten ' +
    '(10) business days following receipt by the seller of your cancellation notice, and ' +
    'any security interest arising out of the transaction will be cancelled. If you cancel, ' +
    'you must make available to the seller at your residence, in substantially as good ' +
    'condition as when received, any goods delivered to you under this contract or sale; ' +
    'or you may, if you wish, comply with the instructions of the seller regarding the ' +
    'return shipment of the goods at the seller\'s expense and risk.',
  ],
  cancelBody:
    'You may cancel this transaction, without any penalty or obligation, within ' +
    'three (3) business days from the above date. To cancel, mail or deliver a ' +
    'signed and dated copy of this notice or any other written notice to the ' +
    'contractor at the address shown on this document before midnight of the third ' +
    'business day.',
  cancelInstructionText:
    'I hereby cancel this transaction.',
  signatureFooterText:
    'By signing, you agree to the terms and conditions of this proposal and ' +
    'acknowledge your right to cancel under the Federal Trade Commission Cooling-Off Rule.',
};

// ─── State overrides ─────────────────────────────────────────────────────────
const STATE_OVERRIDES: Record<string, LegalNotice> = {

  AL: {
    stateCode: 'AL',
    contractAgreementText:
      'By signing below, I acknowledge that I have reviewed and accept the terms ' +
      'of this proposal. I authorize the contractor to perform the described work. ' +
      'Under the Alabama Home Solicitation Sales Act (Ala. Code §8-19A-1 et seq.), ' +
      'if this contract was solicited at my residence, I have the right to cancel ' +
      'within three (3) business days from the date of this transaction.',
    cancelTitle: 'Notice of Cancellation',
    cancelIntroParagraphs: [
      'You may cancel this transaction, without any penalty or obligation, within ' +
      'THREE (3) BUSINESS DAYS from the above date. Alabama Home Solicitation Sales ' +
      'Act (Ala. Code §8-19A-1 et seq.).',
    ],
    cancelBody:
      'If you cancel, any property traded in, payments made by you under the contract, ' +
      'and any negotiable instrument executed by you will be returned within ten (10) ' +
      'business days following the seller\'s receipt of your cancellation notice, and any ' +
      'security interest arising out of the transaction will be cancelled.',
    cancelInstructionText: 'I hereby cancel this transaction.',
    signatureFooterText:
      'By signing, you agree to the terms of this proposal and acknowledge your ' +
      'Alabama three-business-day cancellation right.',
  },

  AK: {
    stateCode: 'AK',
    contractAgreementText:
      'By signing below, I acknowledge and accept the terms of this proposal. ' +
      'Alaska law (AS 45.63.010 et seq.) provides a three-business-day right to ' +
      'cancel any home-solicitation contract entered into at my residence.',
    cancelTitle: 'Notice of Cancellation',
    cancelIntroParagraphs: [
      'You may cancel this transaction, without any penalty or obligation, within ' +
      'THREE (3) BUSINESS DAYS from the date of this transaction. ' +
      'Alaska Home Solicitation Sales Act (AS 45.63.010 et seq.).',
    ],
    cancelBody:
      'To cancel, deliver or mail a signed and dated written notice to the contractor ' +
      'address on this document before midnight of the third business day.',
    cancelInstructionText: 'I hereby cancel this transaction.',
    signatureFooterText:
      'By signing, you agree to the terms of this proposal and acknowledge your ' +
      'Alaska three-business-day cancellation right.',
  },

  AZ: {
    stateCode: 'AZ',
    contractAgreementText:
      'By signing below, I acknowledge and accept the terms of this proposal. ' +
      'Under the Arizona Home Solicitation Sales Act (A.R.S. §44-5001 et seq.), ' +
      'if this agreement was entered at my residence, I have the right to cancel ' +
      'within three (3) business days from the date of this transaction.',
    cancelTitle: 'Notice of Cancellation',
    cancelIntroParagraphs: [
      'You may cancel this transaction, without any penalty or obligation, within ' +
      'THREE (3) BUSINESS DAYS from the date of this transaction. ' +
      'Arizona Home Solicitation Sales Act (A.R.S. §44-5001 et seq.).',
      'If you cancel, any payments, trade-ins, or negotiable instruments you provided ' +
      'will be returned within ten (10) days of the contractor\'s receipt of this notice.',
    ],
    cancelBody:
      'To cancel, mail or deliver a signed and dated written notice to the contractor ' +
      'at the address shown on this document before midnight of the third business day.',
    cancelInstructionText: 'I hereby cancel this transaction.',
    signatureFooterText:
      'By signing, you agree to the terms of this proposal and acknowledge your ' +
      'Arizona three-business-day cancellation right.',
  },

  AR: {
    stateCode: 'AR',
    contractAgreementText:
      'By signing below, I acknowledge and accept the terms of this proposal. ' +
      'Under the Arkansas Home Solicitation Sales Act (Ark. Code Ann. §4-89-101 et seq.), ' +
      'if this agreement was solicited at my residence, I have the right to cancel ' +
      'within three (3) business days.',
    cancelTitle: 'Notice of Cancellation',
    cancelIntroParagraphs: [
      'You may cancel this transaction, without penalty or obligation, within ' +
      'THREE (3) BUSINESS DAYS from the date of this transaction. ' +
      'Arkansas Home Solicitation Sales Act (Ark. Code Ann. §4-89-101 et seq.).',
    ],
    cancelBody:
      'To cancel, mail or deliver a signed and dated written notice to the contractor ' +
      'at the address shown on this document before midnight of the third business day.',
    cancelInstructionText: 'I hereby cancel this transaction.',
    signatureFooterText:
      'By signing, you agree to the terms of this proposal and acknowledge your ' +
      'Arkansas three-business-day cancellation right.',
  },

  CA: {
    stateCode: 'CA',
    contractAgreementText:
      'By signing below, I acknowledge that I have reviewed and accept the terms ' +
      'of this home-improvement contract. Under California law (Bus. & Prof. Code ' +
      '§7159 and Civil Code §1689.5 et seq.), I have the right to cancel this ' +
      'contract without penalty or obligation within THREE (3) BUSINESS DAYS from ' +
      'the date I receive a copy of this contract with the required cancellation notice. ' +
      'The contractor holds a California contractor\'s license as required by state law.',
    cancelTitle: 'Notice of Cancellation',
    cancelIntroParagraphs: [
      'You, the buyer, have the right to cancel this contract for the purchase of ' +
      'goods or services used primarily for personal, family, or household purposes, ' +
      'and this right cannot be waived. You may cancel this contract within THREE (3) ' +
      'BUSINESS DAYS from the date of this contract or from the date you receive this ' +
      'Notice of Cancellation Form, whichever is later. California Civil Code §1689.5.',
      'If you cancel, the seller may not keep any portion of your cash down payment.',
    ],
    cancelBody:
      'To cancel this contract, mail or deliver a signed and dated copy of this ' +
      'Notice of Cancellation or any other written notice to the contractor at the ' +
      'address shown on this document before midnight of the third business day after ' +
      'you received a signed and dated copy of the contract that includes this notice.',
    cancelInstructionText:
      'I hereby cancel this contract. (California Civil Code §1689.7)',
    signatureFooterText:
      'By signing, you agree to the terms of this contract and acknowledge your ' +
      'California three-business-day cancellation right under Civil Code §1689.5.',
  },

  CO: {
    stateCode: 'CO',
    contractAgreementText:
      'By signing below, I acknowledge and accept the terms of this proposal. ' +
      'Under Colorado law (C.R.S. §6-1-701 et seq.), if this contract was entered ' +
      'at my residence following an unsolicited contact, I have the right to cancel ' +
      'within three (3) business days from the date of this transaction.',
    cancelTitle: 'Notice of Cancellation',
    cancelIntroParagraphs: [
      'You may cancel this transaction, without any penalty or obligation, within ' +
      'THREE (3) BUSINESS DAYS from the date of this transaction. ' +
      'Colorado Home Solicitation Sales (C.R.S. §6-1-701 et seq.).',
    ],
    cancelBody:
      'To cancel, mail or deliver a signed and dated written notice to the contractor ' +
      'at the address shown on this document before midnight of the third business day.',
    cancelInstructionText: 'I hereby cancel this transaction.',
    signatureFooterText:
      'By signing, you agree to the terms of this proposal and acknowledge your ' +
      'Colorado three-business-day cancellation right.',
  },

  CT: {
    stateCode: 'CT',
    contractAgreementText:
      'By signing below, I acknowledge that I have reviewed and accept the terms ' +
      'of this proposal. Under the Connecticut Home Solicitation Sales Act ' +
      '(Conn. Gen. Stat. §42-134a et seq.), I have the right to cancel this ' +
      'contract without any penalty or obligation within three (3) business days ' +
      'from the date of this transaction.',
    cancelTitle: 'Notice of Cancellation',
    cancelIntroParagraphs: [
      'You, the buyer, may cancel this transaction at any time prior to midnight of ' +
      'the third business day after the date of this transaction. See the attached ' +
      'Notice of Cancellation form for an explanation of this right. ' +
      'Conn. Gen. Stat. §42-134a et seq.',
    ],
    cancelBody:
      'To cancel, mail or deliver a signed and dated written notice to the contractor ' +
      'at the address shown on this document before midnight of the third business day.',
    cancelInstructionText: 'I hereby cancel this transaction.',
    signatureFooterText:
      'By signing, you agree to the terms of this proposal and acknowledge your ' +
      'Connecticut three-business-day cancellation right.',
  },

  DE: {
    stateCode: 'DE',
    contractAgreementText:
      'By signing below, I acknowledge and accept the terms of this proposal. ' +
      'Under Delaware law (6 Del. C. §4401 et seq.), if this contract was entered ' +
      'at my residence, I have the right to cancel within three (3) business days ' +
      'from the date of this transaction.',
    cancelTitle: 'Notice of Cancellation',
    cancelIntroParagraphs: [
      'You may cancel this transaction, without any penalty or obligation, within ' +
      'THREE (3) BUSINESS DAYS from the date of this transaction. ' +
      'Delaware Home Solicitation Sales Act (6 Del. C. §4401 et seq.).',
    ],
    cancelBody:
      'To cancel, mail or deliver a signed and dated written notice to the contractor ' +
      'at the address shown on this document before midnight of the third business day.',
    cancelInstructionText: 'I hereby cancel this transaction.',
    signatureFooterText:
      'By signing, you agree to the terms of this proposal and acknowledge your ' +
      'Delaware three-business-day cancellation right.',
  },

  DC: {
    stateCode: 'DC',
    contractAgreementText:
      'By signing below, I acknowledge and accept the terms of this proposal. ' +
      'Under DC law (D.C. Code §28-3811 et seq.), if this contract was entered at ' +
      'my residence, I have the right to cancel within three (3) business days from ' +
      'the date of this transaction.',
    cancelTitle: 'Notice of Cancellation',
    cancelIntroParagraphs: [
      'You may cancel this transaction, without any penalty or obligation, within ' +
      'THREE (3) BUSINESS DAYS from the date of this transaction. ' +
      'D.C. Door-to-Door Sales Act (D.C. Code §28-3811 et seq.).',
    ],
    cancelBody:
      'To cancel, mail or deliver a signed and dated written notice to the contractor ' +
      'at the address shown on this document before midnight of the third business day.',
    cancelInstructionText: 'I hereby cancel this transaction.',
    signatureFooterText:
      'By signing, you agree to the terms of this proposal and acknowledge your ' +
      'DC three-business-day cancellation right.',
  },

  FL: {
    stateCode: 'FL',
    contractAgreementText:
      'By signing below, I acknowledge that I have reviewed and accept the terms ' +
      'of this home-improvement contract. Under the Florida Home Solicitation Sales ' +
      'Act (Fla. Stat. §501.021 et seq.), if this contract was entered at my ' +
      'residence, I have the right to cancel without penalty within three (3) ' +
      'business days from the date of this transaction.',
    cancelTitle: 'Notice of Cancellation',
    cancelIntroParagraphs: [
      'You, the buyer, may cancel this transaction at any time prior to midnight of ' +
      'the third business day after the date of this transaction. ' +
      'Florida Home Solicitation Sales Act (Fla. Stat. §501.021 et seq.).',
      'If you cancel, any property traded in, any payments made, and any negotiable ' +
      'instrument executed by you will be returned within ten (10) days of the ' +
      'contractor\'s receipt of your cancellation notice.',
    ],
    cancelBody:
      'To cancel, mail or deliver a signed and dated copy of this notice or any ' +
      'other written notice to the contractor at the address shown on this document ' +
      'before midnight of the third business day after you signed this contract.',
    cancelInstructionText: 'I hereby cancel this transaction.',
    signatureFooterText:
      'By signing, you agree to the terms of this proposal and acknowledge your ' +
      'Florida three-business-day cancellation right.',
  },

  GA: {
    stateCode: 'GA',
    contractAgreementText:
      'By signing below, I acknowledge and accept the terms of this proposal. ' +
      'Under the Georgia Home Solicitation Sales Act (O.C.G.A. §10-1-6 et seq.), ' +
      'if this contract was entered at my residence, I have the right to cancel ' +
      'within three (3) business days from the date of this transaction.',
    cancelTitle: 'Notice of Cancellation',
    cancelIntroParagraphs: [
      'You may cancel this transaction, without any penalty or obligation, within ' +
      'THREE (3) BUSINESS DAYS from the date of this transaction. ' +
      'Georgia Home Solicitation Sales Act (O.C.G.A. §10-1-6 et seq.).',
    ],
    cancelBody:
      'To cancel, mail or deliver a signed and dated written notice to the contractor ' +
      'at the address shown on this document before midnight of the third business day.',
    cancelInstructionText: 'I hereby cancel this transaction.',
    signatureFooterText:
      'By signing, you agree to the terms of this proposal and acknowledge your ' +
      'Georgia three-business-day cancellation right.',
  },

  HI: {
    stateCode: 'HI',
    contractAgreementText:
      'By signing below, I acknowledge and accept the terms of this proposal. ' +
      'Under Hawaii law (HRS §481C-1 et seq.), if this contract was entered at ' +
      'my residence, I have the right to cancel within three (3) business days ' +
      'from the date of this transaction.',
    cancelTitle: 'Notice of Cancellation',
    cancelIntroParagraphs: [
      'You may cancel this transaction, without any penalty or obligation, within ' +
      'THREE (3) BUSINESS DAYS from the date of this transaction. ' +
      'Hawaii Home Solicitation Sales Act (HRS §481C-1 et seq.).',
    ],
    cancelBody:
      'To cancel, mail or deliver a signed and dated written notice to the contractor ' +
      'at the address shown on this document before midnight of the third business day.',
    cancelInstructionText: 'I hereby cancel this transaction.',
    signatureFooterText:
      'By signing, you agree to the terms of this proposal and acknowledge your ' +
      'Hawaii three-business-day cancellation right.',
  },

  ID: {
    stateCode: 'ID',
    contractAgreementText:
      'By signing below, I acknowledge and accept the terms of this proposal. ' +
      'Under Idaho law (Idaho Code §48-601 et seq.), if this contract was entered ' +
      'at my residence, I have the right to cancel within three (3) business days ' +
      'from the date of this transaction.',
    cancelTitle: 'Notice of Cancellation',
    cancelIntroParagraphs: [
      'You may cancel this transaction, without any penalty or obligation, within ' +
      'THREE (3) BUSINESS DAYS from the date of this transaction. ' +
      'Idaho Consumer Protection Act (Idaho Code §48-601 et seq.).',
    ],
    cancelBody:
      'To cancel, mail or deliver a signed and dated written notice to the contractor ' +
      'at the address shown on this document before midnight of the third business day.',
    cancelInstructionText: 'I hereby cancel this transaction.',
    signatureFooterText:
      'By signing, you agree to the terms of this proposal and acknowledge your ' +
      'Idaho three-business-day cancellation right.',
  },

  IL: {
    stateCode: 'IL',
    contractAgreementText:
      'By signing below, I acknowledge and accept the terms of this home-improvement ' +
      'contract. Under the Illinois Home Repair and Remodeling Act (815 ILCS 513/1 ' +
      'et seq.) and the Illinois Home Solicitation Sales Act (815 ILCS 730/1 et seq.), ' +
      'if this contract was entered at my residence, I have the right to cancel ' +
      'within three (3) business days from the date of this transaction.',
    cancelTitle: 'Notice of Cancellation',
    cancelIntroParagraphs: [
      'You may cancel this transaction, without any penalty or obligation, within ' +
      'THREE (3) BUSINESS DAYS from the date of this transaction. ' +
      'Illinois Home Solicitation Sales Act (815 ILCS 730/1 et seq.).',
      'If you cancel, any payments or negotiable instruments will be returned within ' +
      'ten (10) business days of the contractor\'s receipt of your cancellation notice.',
    ],
    cancelBody:
      'To cancel, mail or deliver a signed and dated written notice to the contractor ' +
      'at the address shown on this document before midnight of the third business day.',
    cancelInstructionText: 'I hereby cancel this transaction.',
    signatureFooterText:
      'By signing, you agree to the terms of this proposal and acknowledge your ' +
      'Illinois three-business-day cancellation right.',
  },

  IN: {
    stateCode: 'IN',
    contractAgreementText:
      'By signing below, I acknowledge and accept the terms of this proposal. ' +
      'Under the Indiana Home Solicitation Sales Act (Ind. Code §24-4.5-2-501 ' +
      'et seq.), if this contract was entered at my residence, I have the right ' +
      'to cancel within three (3) business days from the date of this transaction.',
    cancelTitle: 'Notice of Cancellation',
    cancelIntroParagraphs: [
      'You may cancel this transaction, without any penalty or obligation, within ' +
      'THREE (3) BUSINESS DAYS from the date of this transaction. ' +
      'Indiana Uniform Consumer Credit Code (Ind. Code §24-4.5-2-501 et seq.).',
    ],
    cancelBody:
      'To cancel, mail or deliver a signed and dated written notice to the contractor ' +
      'at the address shown on this document before midnight of the third business day.',
    cancelInstructionText: 'I hereby cancel this transaction.',
    signatureFooterText:
      'By signing, you agree to the terms of this proposal and acknowledge your ' +
      'Indiana three-business-day cancellation right.',
  },

  IA: {
    stateCode: 'IA',
    contractAgreementText:
      'By signing below, I acknowledge and accept the terms of this proposal. ' +
      'Under Iowa law (Iowa Code §555A.1 et seq.), if this contract was entered at ' +
      'my residence, I have the right to cancel within three (3) business days from ' +
      'the date of this transaction.',
    cancelTitle: 'Notice of Cancellation',
    cancelIntroParagraphs: [
      'You may cancel this transaction, without any penalty or obligation, within ' +
      'THREE (3) BUSINESS DAYS from the date of this transaction. ' +
      'Iowa Home Solicitation Sales Act (Iowa Code §555A.1 et seq.).',
    ],
    cancelBody:
      'To cancel, mail or deliver a signed and dated written notice to the contractor ' +
      'at the address shown on this document before midnight of the third business day.',
    cancelInstructionText: 'I hereby cancel this transaction.',
    signatureFooterText:
      'By signing, you agree to the terms of this proposal and acknowledge your ' +
      'Iowa three-business-day cancellation right.',
  },

  KS: {
    stateCode: 'KS',
    contractAgreementText:
      'By signing below, I acknowledge and accept the terms of this proposal. ' +
      'Under the Kansas Home Solicitation Sales Act (K.S.A. §50-640 et seq.), ' +
      'if this contract was entered at my residence, I have the right to cancel ' +
      'within three (3) business days from the date of this transaction.',
    cancelTitle: 'Notice of Cancellation',
    cancelIntroParagraphs: [
      'You may cancel this transaction, without any penalty or obligation, within ' +
      'THREE (3) BUSINESS DAYS from the date of this transaction. ' +
      'Kansas Home Solicitation Sales Act (K.S.A. §50-640 et seq.).',
    ],
    cancelBody:
      'To cancel, mail or deliver a signed and dated written notice to the contractor ' +
      'at the address shown on this document before midnight of the third business day.',
    cancelInstructionText: 'I hereby cancel this transaction.',
    signatureFooterText:
      'By signing, you agree to the terms of this proposal and acknowledge your ' +
      'Kansas three-business-day cancellation right.',
  },

  KY: {
    stateCode: 'KY',
    contractAgreementText:
      'By signing below, I acknowledge and accept the terms of this proposal. ' +
      'Under Kentucky law (KRS §367.410 et seq.), if this contract was entered at ' +
      'my residence, I have the right to cancel within three (3) business days from ' +
      'the date of this transaction.',
    cancelTitle: 'Notice of Cancellation',
    cancelIntroParagraphs: [
      'You may cancel this transaction, without any penalty or obligation, within ' +
      'THREE (3) BUSINESS DAYS from the date of this transaction. ' +
      'Kentucky Consumer Protection Act (KRS §367.410 et seq.).',
    ],
    cancelBody:
      'To cancel, mail or deliver a signed and dated written notice to the contractor ' +
      'at the address shown on this document before midnight of the third business day.',
    cancelInstructionText: 'I hereby cancel this transaction.',
    signatureFooterText:
      'By signing, you agree to the terms of this proposal and acknowledge your ' +
      'Kentucky three-business-day cancellation right.',
  },

  LA: {
    stateCode: 'LA',
    contractAgreementText:
      'By signing below, I acknowledge and accept the terms of this proposal. ' +
      'Under Louisiana law (La. R.S. §9:3538 et seq.), if this contract was entered ' +
      'at my residence, I have the right to cancel within three (3) business days ' +
      'from the date of this transaction.',
    cancelTitle: 'Notice of Cancellation',
    cancelIntroParagraphs: [
      'You may cancel this transaction, without any penalty or obligation, within ' +
      'THREE (3) BUSINESS DAYS from the date of this transaction. ' +
      'Louisiana Residential Door-to-Door Sales Act (La. R.S. §9:3538 et seq.).',
    ],
    cancelBody:
      'To cancel, mail or deliver a signed and dated written notice to the contractor ' +
      'at the address shown on this document before midnight of the third business day.',
    cancelInstructionText: 'I hereby cancel this transaction.',
    signatureFooterText:
      'By signing, you agree to the terms of this proposal and acknowledge your ' +
      'Louisiana three-business-day cancellation right.',
  },

  ME: {
    stateCode: 'ME',
    contractAgreementText:
      'By signing below, I acknowledge and accept the terms of this home-improvement ' +
      'contract. Under Maine law (9-A M.R.S.A. §3-501 et seq. and 5 M.R.S.A. §213), ' +
      'if this contract was entered at my residence, I have the right to cancel ' +
      'within three (3) business days from the date of this transaction.',
    cancelTitle: 'Notice of Cancellation',
    cancelIntroParagraphs: [
      'You may cancel this transaction, without any penalty or obligation, within ' +
      'THREE (3) BUSINESS DAYS from the date of this transaction. ' +
      'Maine Consumer Credit Code (9-A M.R.S.A. §3-501 et seq.).',
    ],
    cancelBody:
      'To cancel, mail or deliver a signed and dated written notice to the contractor ' +
      'at the address shown on this document before midnight of the third business day.',
    cancelInstructionText: 'I hereby cancel this transaction.',
    signatureFooterText:
      'By signing, you agree to the terms of this proposal and acknowledge your ' +
      'Maine three-business-day cancellation right.',
  },

  MD: {
    stateCode: 'MD',
    contractAgreementText:
      'By signing below, I acknowledge that I have reviewed and accept the terms ' +
      'of this home-improvement contract. Under the Maryland Home Improvement Law ' +
      '(Md. Bus. Reg. Code Ann. §8-101 et seq.) and the Maryland Door-to-Door Sales ' +
      'Act (Md. Com. Law Code Ann. §14-301 et seq.), if this contract was entered at ' +
      'my residence, I have the right to cancel within three (3) business days from ' +
      'the date of this transaction.',
    cancelTitle: 'Notice of Cancellation',
    cancelIntroParagraphs: [
      'You may cancel this transaction, without any penalty or obligation, within ' +
      'THREE (3) BUSINESS DAYS from the date of this transaction. ' +
      'Maryland Door-to-Door Sales Act (Md. Com. Law Code Ann. §14-301 et seq.).',
      'If you cancel, any payment made by you will be returned within ten (10) ' +
      'business days of the contractor\'s receipt of your cancellation notice.',
    ],
    cancelBody:
      'To cancel, mail or deliver a signed and dated written notice to the contractor ' +
      'at the address shown on this document before midnight of the third business day.',
    cancelInstructionText: 'I hereby cancel this transaction.',
    signatureFooterText:
      'By signing, you agree to the terms of this proposal and acknowledge your ' +
      'Maryland three-business-day cancellation right.',
  },

  MA: {
    stateCode: 'MA',
    contractAgreementText:
      'By signing below, I acknowledge that I have reviewed and accept the terms ' +
      'of this home-improvement contract. Under Massachusetts law (M.G.L. c. 93 §48 ' +
      'et seq. and M.G.L. c. 93A), if this contract was entered at my residence, ' +
      'I have the right to cancel within three (3) business days from the date of ' +
      'this transaction. The contractor is registered with the Massachusetts Home ' +
      'Improvement Contractor Program as required by M.G.L. c. 142A.',
    cancelTitle: 'Notice of Cancellation',
    cancelIntroParagraphs: [
      'You may cancel this transaction, without any penalty or obligation, within ' +
      'THREE (3) BUSINESS DAYS from the date of this transaction. ' +
      'Massachusetts Home Solicitation Sales Act (M.G.L. c. 93 §48 et seq.).',
      'Notice: Massachusetts General Laws Chapter 142A requires that all home ' +
      'improvement contractors and subcontractors be registered with the Director ' +
      'of Consumer Affairs and Business Regulation before contracting for home ' +
      'improvement work.',
    ],
    cancelBody:
      'To cancel, mail or deliver a signed and dated written notice to the contractor ' +
      'at the address shown on this document before midnight of the third business day.',
    cancelInstructionText: 'I hereby cancel this transaction.',
    signatureFooterText:
      'By signing, you agree to the terms of this proposal and acknowledge your ' +
      'Massachusetts three-business-day cancellation right under M.G.L. c. 93 §48.',
  },

  MI: {
    stateCode: 'MI',
    contractAgreementText:
      'By signing below, I acknowledge and accept the terms of this home-improvement ' +
      'contract. Under the Michigan Home Solicitation Sales Act (MCL §445.111 et seq.), ' +
      'if this contract was entered at my residence, I have the right to cancel ' +
      'within three (3) business days from the date of this transaction. The ' +
      'contractor is licensed by the Michigan Department of Licensing and Regulatory ' +
      'Affairs as required by MCL §339.2401 et seq.',
    cancelTitle: 'Notice of Cancellation',
    cancelIntroParagraphs: [
      'You may cancel this transaction, without any penalty or obligation, within ' +
      'THREE (3) BUSINESS DAYS from the date of this transaction. ' +
      'Michigan Home Solicitation Sales Act (MCL §445.111 et seq.).',
      'If you cancel, any payments, trade-ins, or negotiable instruments will be ' +
      'returned within ten (10) business days of the seller\'s receipt of your ' +
      'cancellation notice, and any security interest will be cancelled.',
    ],
    cancelBody:
      'To cancel, mail or deliver a signed and dated written notice to the contractor ' +
      'at the address shown on this document before midnight of the third business day.',
    cancelInstructionText: 'I hereby cancel this transaction.',
    signatureFooterText:
      'By signing, you agree to the terms of this proposal and acknowledge your ' +
      'Michigan three-business-day cancellation right.',
  },

  MN: {
    stateCode: 'MN',
    contractAgreementText:
      'By signing below, I acknowledge and accept the terms of this home-improvement ' +
      'contract. Under the Minnesota Home Solicitation Sales Act (Minn. Stat. §325G.06 ' +
      'et seq.) and the Minnesota Home Improvement Contractor Act, if this contract ' +
      'was entered at my residence, I have the right to cancel within three (3) ' +
      'business days from the date of this transaction.',
    cancelTitle: 'Notice of Cancellation',
    cancelIntroParagraphs: [
      'You may cancel this transaction, without any penalty or obligation, within ' +
      'THREE (3) BUSINESS DAYS from the date of this transaction. ' +
      'Minnesota Home Solicitation Sales Act (Minn. Stat. §325G.06 et seq.).',
    ],
    cancelBody:
      'To cancel, mail or deliver a signed and dated written notice to the contractor ' +
      'at the address shown on this document before midnight of the third business day.',
    cancelInstructionText: 'I hereby cancel this transaction.',
    signatureFooterText:
      'By signing, you agree to the terms of this proposal and acknowledge your ' +
      'Minnesota three-business-day cancellation right.',
  },

  MS: {
    stateCode: 'MS',
    contractAgreementText:
      'By signing below, I acknowledge and accept the terms of this proposal. ' +
      'Under Mississippi law, if this contract was entered at my residence, ' +
      'I have the right to cancel within three (3) business days from the date ' +
      'of this transaction under applicable federal and state consumer protection law.',
    cancelTitle: 'Notice of Cancellation',
    cancelIntroParagraphs: [
      'You may cancel this transaction, without any penalty or obligation, within ' +
      'THREE (3) BUSINESS DAYS from the date of this transaction under the FTC ' +
      'Cooling-Off Rule (16 CFR §429) and applicable Mississippi consumer protection law.',
    ],
    cancelBody:
      'To cancel, mail or deliver a signed and dated written notice to the contractor ' +
      'at the address shown on this document before midnight of the third business day.',
    cancelInstructionText: 'I hereby cancel this transaction.',
    signatureFooterText:
      'By signing, you agree to the terms of this proposal and acknowledge your ' +
      'three-business-day cancellation right.',
  },

  MO: {
    stateCode: 'MO',
    contractAgreementText:
      'By signing below, I acknowledge and accept the terms of this proposal. ' +
      'Under Missouri law (Mo. Rev. Stat. §407.700 et seq.), if this contract was ' +
      'entered at my residence, I have the right to cancel within three (3) business ' +
      'days from the date of this transaction.',
    cancelTitle: 'Notice of Cancellation',
    cancelIntroParagraphs: [
      'You may cancel this transaction, without any penalty or obligation, within ' +
      'THREE (3) BUSINESS DAYS from the date of this transaction. ' +
      'Missouri Door-to-Door Sales Act (Mo. Rev. Stat. §407.700 et seq.).',
    ],
    cancelBody:
      'To cancel, mail or deliver a signed and dated written notice to the contractor ' +
      'at the address shown on this document before midnight of the third business day.',
    cancelInstructionText: 'I hereby cancel this transaction.',
    signatureFooterText:
      'By signing, you agree to the terms of this proposal and acknowledge your ' +
      'Missouri three-business-day cancellation right.',
  },

  MT: {
    stateCode: 'MT',
    contractAgreementText:
      'By signing below, I acknowledge and accept the terms of this proposal. ' +
      'Under Montana law (Mont. Code Ann. §30-14-501 et seq.), if this contract was ' +
      'entered at my residence, I have the right to cancel within three (3) business ' +
      'days from the date of this transaction.',
    cancelTitle: 'Notice of Cancellation',
    cancelIntroParagraphs: [
      'You may cancel this transaction, without any penalty or obligation, within ' +
      'THREE (3) BUSINESS DAYS from the date of this transaction. ' +
      'Montana Consumer Protection Act (Mont. Code Ann. §30-14-501 et seq.).',
    ],
    cancelBody:
      'To cancel, mail or deliver a signed and dated written notice to the contractor ' +
      'at the address shown on this document before midnight of the third business day.',
    cancelInstructionText: 'I hereby cancel this transaction.',
    signatureFooterText:
      'By signing, you agree to the terms of this proposal and acknowledge your ' +
      'Montana three-business-day cancellation right.',
  },

  NE: {
    stateCode: 'NE',
    contractAgreementText:
      'By signing below, I acknowledge that I have reviewed and accept the terms ' +
      'of this proposal. Under the Nebraska Home Solicitation Sales Act ' +
      '(Neb. Rev. Stat. §69-1601 et seq.), I have the right to cancel this ' +
      'transaction without penalty or obligation within three (3) business days ' +
      'from the date of this transaction.',
    cancelTitle: "Buyer's Right to Cancel",
    cancelIntroParagraphs: [
      'You may cancel this transaction, without penalty or obligation, within ' +
      'THREE (3) BUSINESS DAYS from the date of the transaction. ' +
      'Nebraska Home Solicitation Sales Act (Neb. Rev. Stat. §69-1601 et seq.).',
    ],
    cancelBody:
      'To cancel, deliver or mail a signed and dated written notice to the contractor ' +
      'before midnight of the third business day.',
    cancelInstructionText: 'I hereby cancel this transaction.',
    signatureFooterText:
      'By signing, you agree to the terms of this proposal and acknowledge your ' +
      'Nebraska three-business-day cancellation right.',
  },

  NV: {
    stateCode: 'NV',
    contractAgreementText:
      'By signing below, I acknowledge and accept the terms of this proposal. ' +
      'Under Nevada law (NRS §598.100 et seq.), if this contract was entered at ' +
      'my residence, I have the right to cancel within three (3) business days ' +
      'from the date of this transaction.',
    cancelTitle: 'Notice of Cancellation',
    cancelIntroParagraphs: [
      'You may cancel this transaction, without any penalty or obligation, within ' +
      'THREE (3) BUSINESS DAYS from the date of this transaction. ' +
      'Nevada Home Solicitation Sales Act (NRS §598.100 et seq.).',
    ],
    cancelBody:
      'To cancel, mail or deliver a signed and dated written notice to the contractor ' +
      'at the address shown on this document before midnight of the third business day.',
    cancelInstructionText: 'I hereby cancel this transaction.',
    signatureFooterText:
      'By signing, you agree to the terms of this proposal and acknowledge your ' +
      'Nevada three-business-day cancellation right.',
  },

  NH: {
    stateCode: 'NH',
    contractAgreementText:
      'By signing below, I acknowledge and accept the terms of this proposal. ' +
      'Under the New Hampshire Home Solicitation Sales Act (RSA §361-B:1 et seq.), ' +
      'if this contract was entered at my residence, I have the right to cancel ' +
      'within three (3) business days from the date of this transaction.',
    cancelTitle: 'Notice of Cancellation',
    cancelIntroParagraphs: [
      'You may cancel this transaction, without any penalty or obligation, within ' +
      'THREE (3) BUSINESS DAYS from the date of this transaction. ' +
      'New Hampshire Home Solicitation Sales Act (RSA §361-B:1 et seq.).',
    ],
    cancelBody:
      'To cancel, mail or deliver a signed and dated written notice to the contractor ' +
      'at the address shown on this document before midnight of the third business day.',
    cancelInstructionText: 'I hereby cancel this transaction.',
    signatureFooterText:
      'By signing, you agree to the terms of this proposal and acknowledge your ' +
      'New Hampshire three-business-day cancellation right.',
  },

  NJ: {
    stateCode: 'NJ',
    contractAgreementText:
      'By signing below, I acknowledge and accept the terms of this home-improvement ' +
      'contract. Under the New Jersey Home Improvement Contractor Act (N.J.S.A. ' +
      '56:8-136 et seq.) and the New Jersey Door-to-Door Retail Installment Sales Act ' +
      '(N.J.S.A. 17:16C-61.1 et seq.), if this contract was entered at my residence, ' +
      'I have the right to cancel within three (3) business days from the date of ' +
      'this transaction. The contractor is registered with the NJ Division of Consumer ' +
      'Affairs as required by law.',
    cancelTitle: 'Notice of Cancellation',
    cancelIntroParagraphs: [
      'You may cancel this transaction, without any penalty or obligation, within ' +
      'THREE (3) BUSINESS DAYS from the date of this transaction. ' +
      'New Jersey Home Improvement Contractor Act (N.J.S.A. 56:8-136 et seq.).',
    ],
    cancelBody:
      'To cancel, mail or deliver a signed and dated written notice to the contractor ' +
      'at the address shown on this document before midnight of the third business day.',
    cancelInstructionText: 'I hereby cancel this transaction.',
    signatureFooterText:
      'By signing, you agree to the terms of this proposal and acknowledge your ' +
      'New Jersey three-business-day cancellation right.',
  },

  NM: {
    stateCode: 'NM',
    contractAgreementText:
      'By signing below, I acknowledge and accept the terms of this proposal. ' +
      'Under New Mexico law (NMSA 1978 §57-12-1 et seq.), if this contract was ' +
      'entered at my residence, I have the right to cancel within three (3) business ' +
      'days from the date of this transaction.',
    cancelTitle: 'Notice of Cancellation',
    cancelIntroParagraphs: [
      'You may cancel this transaction, without any penalty or obligation, within ' +
      'THREE (3) BUSINESS DAYS from the date of this transaction. ' +
      'New Mexico Unfair Practices Act (NMSA 1978 §57-12-1 et seq.).',
    ],
    cancelBody:
      'To cancel, mail or deliver a signed and dated written notice to the contractor ' +
      'at the address shown on this document before midnight of the third business day.',
    cancelInstructionText: 'I hereby cancel this transaction.',
    signatureFooterText:
      'By signing, you agree to the terms of this proposal and acknowledge your ' +
      'New Mexico three-business-day cancellation right.',
  },

  NY: {
    stateCode: 'NY',
    contractAgreementText:
      'By signing below, I acknowledge that I have reviewed and accept the terms ' +
      'of this home-improvement contract. Under New York General Business Law §396-s ' +
      'and the New York Home Improvement Business Law (GBL §770 et seq.), if this ' +
      'contract was entered at my residence, I have the right to cancel within three ' +
      '(3) business days from the date of this transaction. The contractor holds a ' +
      'valid license as required by applicable New York state and local law.',
    cancelTitle: 'Notice of Cancellation',
    cancelIntroParagraphs: [
      'You may cancel this transaction, without any penalty or obligation, within ' +
      'THREE (3) BUSINESS DAYS from the date of this contract. ' +
      'New York General Business Law §396-s and Home Improvement Business Law §770 et seq.',
      'If you cancel, any down payment made will be returned within five (5) business ' +
      'days of the contractor\'s receipt of your cancellation notice.',
    ],
    cancelBody:
      'To cancel, mail or deliver a signed and dated written notice to the contractor ' +
      'at the address shown on this document before midnight of the third business day.',
    cancelInstructionText: 'I hereby cancel this transaction.',
    signatureFooterText:
      'By signing, you agree to the terms of this proposal and acknowledge your ' +
      'New York three-business-day cancellation right.',
  },

  NC: {
    stateCode: 'NC',
    contractAgreementText:
      'By signing below, I acknowledge and accept the terms of this home-improvement ' +
      'contract. Under the North Carolina Home Solicitation Sales Act (G.S. §25A-38 ' +
      'et seq.), if this contract was entered at my residence, I have the right to ' +
      'cancel within three (3) business days from the date of this transaction.',
    cancelTitle: 'Notice of Cancellation',
    cancelIntroParagraphs: [
      'You may cancel this transaction, without any penalty or obligation, within ' +
      'THREE (3) BUSINESS DAYS from the date of this transaction. ' +
      'North Carolina Home Solicitation Sales Act (G.S. §25A-38 et seq.).',
    ],
    cancelBody:
      'To cancel, mail or deliver a signed and dated written notice to the contractor ' +
      'at the address shown on this document before midnight of the third business day.',
    cancelInstructionText: 'I hereby cancel this transaction.',
    signatureFooterText:
      'By signing, you agree to the terms of this proposal and acknowledge your ' +
      'North Carolina three-business-day cancellation right.',
  },

  ND: {
    stateCode: 'ND',
    contractAgreementText:
      'By signing below, I acknowledge and accept the terms of this proposal. ' +
      'Under North Dakota law (N.D.C.C. §51-18-01 et seq.), if this contract was ' +
      'entered at my residence, I have the right to cancel within three (3) business ' +
      'days from the date of this transaction.',
    cancelTitle: 'Notice of Cancellation',
    cancelIntroParagraphs: [
      'You may cancel this transaction, without any penalty or obligation, within ' +
      'THREE (3) BUSINESS DAYS from the date of this transaction. ' +
      'North Dakota Home Solicitation Sales Act (N.D.C.C. §51-18-01 et seq.).',
    ],
    cancelBody:
      'To cancel, mail or deliver a signed and dated written notice to the contractor ' +
      'at the address shown on this document before midnight of the third business day.',
    cancelInstructionText: 'I hereby cancel this transaction.',
    signatureFooterText:
      'By signing, you agree to the terms of this proposal and acknowledge your ' +
      'North Dakota three-business-day cancellation right.',
  },

  OH: {
    stateCode: 'OH',
    contractAgreementText:
      'By signing below, I acknowledge and accept the terms of this home-improvement ' +
      'contract. Under the Ohio Home Solicitation Sales Act (ORC §1345.21 et seq.) ' +
      'and the Ohio Home Construction Service Suppliers Act (ORC §1345.21), if this ' +
      'contract was entered at my residence, I have the right to cancel within three ' +
      '(3) business days from the date of this transaction.',
    cancelTitle: 'Notice of Cancellation',
    cancelIntroParagraphs: [
      'You may cancel this transaction, without any penalty or obligation, within ' +
      'THREE (3) BUSINESS DAYS from the date of this transaction. ' +
      'Ohio Home Solicitation Sales Act (ORC §1345.21 et seq.).',
      'If you cancel, any payments made and any negotiable instruments given by you ' +
      'will be returned within ten (10) business days of the seller\'s receipt of ' +
      'your cancellation notice.',
    ],
    cancelBody:
      'To cancel, mail or deliver a signed and dated written notice to the contractor ' +
      'at the address shown on this document before midnight of the third business day.',
    cancelInstructionText: 'I hereby cancel this transaction.',
    signatureFooterText:
      'By signing, you agree to the terms of this proposal and acknowledge your ' +
      'Ohio three-business-day cancellation right.',
  },

  OK: {
    stateCode: 'OK',
    contractAgreementText:
      'By signing below, I acknowledge and accept the terms of this proposal. ' +
      'Under the Oklahoma Home Solicitation Sales Act (15 O.S. §751 et seq.), if ' +
      'this contract was entered at my residence, I have the right to cancel within ' +
      'three (3) business days from the date of this transaction.',
    cancelTitle: 'Notice of Cancellation',
    cancelIntroParagraphs: [
      'You may cancel this transaction, without any penalty or obligation, within ' +
      'THREE (3) BUSINESS DAYS from the date of this transaction. ' +
      'Oklahoma Home Solicitation Sales Act (15 O.S. §751 et seq.).',
    ],
    cancelBody:
      'To cancel, mail or deliver a signed and dated written notice to the contractor ' +
      'at the address shown on this document before midnight of the third business day.',
    cancelInstructionText: 'I hereby cancel this transaction.',
    signatureFooterText:
      'By signing, you agree to the terms of this proposal and acknowledge your ' +
      'Oklahoma three-business-day cancellation right.',
  },

  OR: {
    stateCode: 'OR',
    contractAgreementText:
      'By signing below, I acknowledge and accept the terms of this home-improvement ' +
      'contract. Under Oregon law (ORS §83.710 et seq.), if this contract was entered ' +
      'at my residence, I have the right to cancel within three (3) business days ' +
      'from the date of this transaction. The contractor is licensed by the Oregon ' +
      'Construction Contractors Board (CCB) as required by ORS §701.005 et seq.',
    cancelTitle: 'Notice of Cancellation',
    cancelIntroParagraphs: [
      'You may cancel this transaction, without any penalty or obligation, within ' +
      'THREE (3) BUSINESS DAYS from the date of this transaction. ' +
      'Oregon Home Solicitation Sales Act (ORS §83.710 et seq.).',
    ],
    cancelBody:
      'To cancel, mail or deliver a signed and dated written notice to the contractor ' +
      'at the address shown on this document before midnight of the third business day.',
    cancelInstructionText: 'I hereby cancel this transaction.',
    signatureFooterText:
      'By signing, you agree to the terms of this proposal and acknowledge your ' +
      'Oregon three-business-day cancellation right.',
  },

  PA: {
    stateCode: 'PA',
    contractAgreementText:
      'By signing below, I acknowledge that I have reviewed and accept the terms ' +
      'of this home-improvement contract. Under the Pennsylvania Home Improvement ' +
      'Consumer Protection Act (HICPA, 73 P.S. §517.1 et seq.) and the Pennsylvania ' +
      'Unfair Trade Practices and Consumer Protection Law, if this contract was ' +
      'entered at my residence, I have the right to cancel within three (3) business ' +
      'days from the date of this transaction. The contractor is registered with the ' +
      'Pennsylvania Attorney General\'s Office under HICPA.',
    cancelTitle: 'Notice of Cancellation',
    cancelIntroParagraphs: [
      'You may cancel this transaction, without any penalty or obligation, within ' +
      'THREE (3) BUSINESS DAYS from the date of this transaction. ' +
      'Pennsylvania Home Improvement Consumer Protection Act (73 P.S. §517.1 et seq.).',
      'If you cancel, any deposit paid will be returned within twenty (20) days of ' +
      'the contractor\'s receipt of your cancellation notice.',
    ],
    cancelBody:
      'To cancel, mail or deliver a signed and dated written notice to the contractor ' +
      'at the address shown on this document before midnight of the third business day.',
    cancelInstructionText: 'I hereby cancel this transaction.',
    signatureFooterText:
      'By signing, you agree to the terms of this proposal and acknowledge your ' +
      'Pennsylvania three-business-day cancellation right under 73 P.S. §517.1 et seq.',
  },

  RI: {
    stateCode: 'RI',
    contractAgreementText:
      'By signing below, I acknowledge and accept the terms of this home-improvement ' +
      'contract. Under Rhode Island law (R.I. Gen. Laws §6-28-1 et seq.), if this ' +
      'contract was entered at my residence, I have the right to cancel within three ' +
      '(3) business days from the date of this transaction. The contractor holds a ' +
      'valid Rhode Island contractor\'s registration.',
    cancelTitle: 'Notice of Cancellation',
    cancelIntroParagraphs: [
      'You may cancel this transaction, without any penalty or obligation, within ' +
      'THREE (3) BUSINESS DAYS from the date of this transaction. ' +
      'Rhode Island Home Solicitation Sales Act (R.I. Gen. Laws §6-28-1 et seq.).',
    ],
    cancelBody:
      'To cancel, mail or deliver a signed and dated written notice to the contractor ' +
      'at the address shown on this document before midnight of the third business day.',
    cancelInstructionText: 'I hereby cancel this transaction.',
    signatureFooterText:
      'By signing, you agree to the terms of this proposal and acknowledge your ' +
      'Rhode Island three-business-day cancellation right.',
  },

  SC: {
    stateCode: 'SC',
    contractAgreementText:
      'By signing below, I acknowledge and accept the terms of this proposal. ' +
      'Under South Carolina law (S.C. Code Ann. §39-10-10 et seq.), if this contract ' +
      'was entered at my residence, I have the right to cancel within three (3) ' +
      'business days from the date of this transaction.',
    cancelTitle: 'Notice of Cancellation',
    cancelIntroParagraphs: [
      'You may cancel this transaction, without any penalty or obligation, within ' +
      'THREE (3) BUSINESS DAYS from the date of this transaction. ' +
      'South Carolina Home Solicitation Sales Act (S.C. Code Ann. §39-10-10 et seq.).',
    ],
    cancelBody:
      'To cancel, mail or deliver a signed and dated written notice to the contractor ' +
      'at the address shown on this document before midnight of the third business day.',
    cancelInstructionText: 'I hereby cancel this transaction.',
    signatureFooterText:
      'By signing, you agree to the terms of this proposal and acknowledge your ' +
      'South Carolina three-business-day cancellation right.',
  },

  SD: {
    stateCode: 'SD',
    contractAgreementText:
      'By signing below, I acknowledge and accept the terms of this proposal. ' +
      'Under South Dakota law (SDCL §37-24-1 et seq.), if this contract was entered ' +
      'at my residence, I have the right to cancel within three (3) business days ' +
      'from the date of this transaction.',
    cancelTitle: 'Notice of Cancellation',
    cancelIntroParagraphs: [
      'You may cancel this transaction, without any penalty or obligation, within ' +
      'THREE (3) BUSINESS DAYS from the date of this transaction. ' +
      'South Dakota Deceptive Trade Practices and Consumer Protection Law (SDCL §37-24-1 et seq.).',
    ],
    cancelBody:
      'To cancel, mail or deliver a signed and dated written notice to the contractor ' +
      'at the address shown on this document before midnight of the third business day.',
    cancelInstructionText: 'I hereby cancel this transaction.',
    signatureFooterText:
      'By signing, you agree to the terms of this proposal and acknowledge your ' +
      'South Dakota three-business-day cancellation right.',
  },

  TN: {
    stateCode: 'TN',
    contractAgreementText:
      'By signing below, I acknowledge and accept the terms of this home-improvement ' +
      'contract. Under the Tennessee Home Solicitation Sales Act (T.C.A. §47-18-701 ' +
      'et seq.), if this contract was entered at my residence, I have the right to ' +
      'cancel within three (3) business days from the date of this transaction.',
    cancelTitle: 'Notice of Cancellation',
    cancelIntroParagraphs: [
      'You may cancel this transaction, without any penalty or obligation, within ' +
      'THREE (3) BUSINESS DAYS from the date of this transaction. ' +
      'Tennessee Home Solicitation Sales Act (T.C.A. §47-18-701 et seq.).',
    ],
    cancelBody:
      'To cancel, mail or deliver a signed and dated written notice to the contractor ' +
      'at the address shown on this document before midnight of the third business day.',
    cancelInstructionText: 'I hereby cancel this transaction.',
    signatureFooterText:
      'By signing, you agree to the terms of this proposal and acknowledge your ' +
      'Tennessee three-business-day cancellation right.',
  },

  TX: {
    stateCode: 'TX',
    contractAgreementText:
      'By signing below, I acknowledge that I have reviewed and accept the terms ' +
      'of this home-improvement contract. Under the Texas Business & Commerce Code ' +
      '(§39.001 et seq.), if this contract was entered at my residence, I have the ' +
      'right to cancel without penalty within three (3) business days from the date ' +
      'of this transaction. The contractor is registered with the Texas Department ' +
      'of Licensing and Regulation as required by applicable law.',
    cancelTitle: 'Notice of Cancellation',
    cancelIntroParagraphs: [
      'You may cancel this transaction, without any penalty or obligation, within ' +
      'THREE (3) BUSINESS DAYS from the date of this transaction. ' +
      'Texas Business & Commerce Code §39.001 et seq.',
      'If you cancel, any payments made by you will be returned within ten (10) ' +
      'business days of the contractor\'s receipt of your cancellation notice.',
    ],
    cancelBody:
      'To cancel, mail or deliver a signed and dated written notice to the contractor ' +
      'at the address shown on this document before midnight of the third business day.',
    cancelInstructionText: 'I hereby cancel this transaction.',
    signatureFooterText:
      'By signing, you agree to the terms of this proposal and acknowledge your ' +
      'Texas three-business-day cancellation right.',
  },

  UT: {
    stateCode: 'UT',
    contractAgreementText:
      'By signing below, I acknowledge and accept the terms of this proposal. ' +
      'Under the Utah Home Solicitation Sales Act (Utah Code Ann. §70C-5-101 et seq.), ' +
      'if this contract was entered at my residence, I have the right to cancel ' +
      'within three (3) business days from the date of this transaction.',
    cancelTitle: 'Notice of Cancellation',
    cancelIntroParagraphs: [
      'You may cancel this transaction, without any penalty or obligation, within ' +
      'THREE (3) BUSINESS DAYS from the date of this transaction. ' +
      'Utah Home Solicitation Sales Act (Utah Code Ann. §70C-5-101 et seq.).',
    ],
    cancelBody:
      'To cancel, mail or deliver a signed and dated written notice to the contractor ' +
      'at the address shown on this document before midnight of the third business day.',
    cancelInstructionText: 'I hereby cancel this transaction.',
    signatureFooterText:
      'By signing, you agree to the terms of this proposal and acknowledge your ' +
      'Utah three-business-day cancellation right.',
  },

  VT: {
    stateCode: 'VT',
    contractAgreementText:
      'By signing below, I acknowledge and accept the terms of this proposal. ' +
      'Under Vermont law (9 V.S.A. §2454 et seq.), if this contract was entered at ' +
      'my residence, I have the right to cancel within three (3) business days from ' +
      'the date of this transaction.',
    cancelTitle: 'Notice of Cancellation',
    cancelIntroParagraphs: [
      'You may cancel this transaction, without any penalty or obligation, within ' +
      'THREE (3) BUSINESS DAYS from the date of this transaction. ' +
      'Vermont Consumer Protection Act (9 V.S.A. §2454 et seq.).',
    ],
    cancelBody:
      'To cancel, mail or deliver a signed and dated written notice to the contractor ' +
      'at the address shown on this document before midnight of the third business day.',
    cancelInstructionText: 'I hereby cancel this transaction.',
    signatureFooterText:
      'By signing, you agree to the terms of this proposal and acknowledge your ' +
      'Vermont three-business-day cancellation right.',
  },

  VA: {
    stateCode: 'VA',
    contractAgreementText:
      'By signing below, I acknowledge that I have reviewed and accept the terms ' +
      'of this home-improvement contract. Under the Virginia Home Solicitation Sales ' +
      'Act (Va. Code Ann. §59.1-21.1 et seq.) and the Virginia Consumer Protection ' +
      'Act, if this contract was entered at my residence, I have the right to cancel ' +
      'within three (3) business days from the date of this transaction. The ' +
      'contractor holds a valid Virginia contractor\'s license.',
    cancelTitle: "Buyer's Right to Cancel",
    cancelIntroParagraphs: [
      'If this transaction is subject to the Virginia Home Solicitation Sales Act, ' +
      'you may cancel this transaction until midnight of the third business day after ' +
      'the date of the transaction by written notice delivered or mailed to the ' +
      'contractor address listed on this document. ' +
      'Virginia Home Solicitation Sales Act (Va. Code Ann. §59.1-21.1 et seq.).',
    ],
    cancelBody:
      'To cancel, mail or deliver a signed and dated written notice to the contractor ' +
      'at the address shown on this document before midnight of the third business day.',
    cancelInstructionText: 'I hereby cancel this transaction.',
    signatureFooterText:
      'By signing, you agree to the terms of this proposal and acknowledge your ' +
      'Virginia cancellation rights.',
  },

  WA: {
    stateCode: 'WA',
    contractAgreementText:
      'By signing below, I acknowledge and accept the terms of this home-improvement ' +
      'contract. Under the Washington Home Solicitation Transaction Act ' +
      '(RCW §63.14.100 et seq.) and the Washington Consumer Protection Act ' +
      '(RCW §19.86), if this contract was entered at my residence, I have the right ' +
      'to cancel within three (3) business days from the date of this transaction. ' +
      'The contractor is registered with the Washington Department of Labor & ' +
      'Industries as required by RCW §18.27.',
    cancelTitle: 'Notice of Cancellation',
    cancelIntroParagraphs: [
      'You may cancel this transaction, without any penalty or obligation, within ' +
      'THREE (3) BUSINESS DAYS from the date of this transaction. ' +
      'Washington Home Solicitation Transaction Act (RCW §63.14.100 et seq.).',
    ],
    cancelBody:
      'To cancel, mail or deliver a signed and dated written notice to the contractor ' +
      'at the address shown on this document before midnight of the third business day.',
    cancelInstructionText: 'I hereby cancel this transaction.',
    signatureFooterText:
      'By signing, you agree to the terms of this proposal and acknowledge your ' +
      'Washington three-business-day cancellation right.',
  },

  WV: {
    stateCode: 'WV',
    contractAgreementText:
      'By signing below, I acknowledge and accept the terms of this proposal. ' +
      'Under the West Virginia Consumer Credit and Protection Act ' +
      '(W. Va. Code §46A-2-102 et seq.), if this contract was entered at my residence, ' +
      'I have the right to cancel within three (3) business days from the date of ' +
      'this transaction.',
    cancelTitle: 'Notice of Cancellation',
    cancelIntroParagraphs: [
      'You may cancel this transaction, without any penalty or obligation, within ' +
      'THREE (3) BUSINESS DAYS from the date of this transaction. ' +
      'West Virginia Consumer Credit and Protection Act (W. Va. Code §46A-2-102 et seq.).',
    ],
    cancelBody:
      'To cancel, mail or deliver a signed and dated written notice to the contractor ' +
      'at the address shown on this document before midnight of the third business day.',
    cancelInstructionText: 'I hereby cancel this transaction.',
    signatureFooterText:
      'By signing, you agree to the terms of this proposal and acknowledge your ' +
      'West Virginia three-business-day cancellation right.',
  },

  WI: {
    stateCode: 'WI',
    contractAgreementText:
      'By signing below, I acknowledge and accept the terms of this home-improvement ' +
      'contract. Under the Wisconsin Home Improvement Trade Practices Act ' +
      '(Wis. Admin. Code §ATCP 110) and Wisconsin Statutes §423.101 et seq., if ' +
      'this contract was entered at my residence, I have the right to cancel within ' +
      'three (3) business days from the date of this transaction.',
    cancelTitle: 'Notice of Cancellation',
    cancelIntroParagraphs: [
      'You may cancel this transaction, without any penalty or obligation, within ' +
      'THREE (3) BUSINESS DAYS from the date of this transaction. ' +
      'Wisconsin Consumer Act (Wis. Stat. §423.101 et seq.).',
    ],
    cancelBody:
      'To cancel, mail or deliver a signed and dated written notice to the contractor ' +
      'at the address shown on this document before midnight of the third business day.',
    cancelInstructionText: 'I hereby cancel this transaction.',
    signatureFooterText:
      'By signing, you agree to the terms of this proposal and acknowledge your ' +
      'Wisconsin three-business-day cancellation right.',
  },

  WY: {
    stateCode: 'WY',
    contractAgreementText:
      'By signing below, I acknowledge and accept the terms of this proposal. ' +
      'Under Wyoming law (Wyo. Stat. §40-12-101 et seq.), if this contract was ' +
      'entered at my residence, I have the right to cancel within three (3) business ' +
      'days from the date of this transaction.',
    cancelTitle: 'Notice of Cancellation',
    cancelIntroParagraphs: [
      'You may cancel this transaction, without any penalty or obligation, within ' +
      'THREE (3) BUSINESS DAYS from the date of this transaction. ' +
      'Wyoming Consumer Protection Act (Wyo. Stat. §40-12-101 et seq.).',
    ],
    cancelBody:
      'To cancel, mail or deliver a signed and dated written notice to the contractor ' +
      'at the address shown on this document before midnight of the third business day.',
    cancelInstructionText: 'I hereby cancel this transaction.',
    signatureFooterText:
      'By signing, you agree to the terms of this proposal and acknowledge your ' +
      'Wyoming three-business-day cancellation right.',
  },
};

// ─────────────────────────────────────────────────────────────────────────────

const getObservedFederalHolidayKeys = (year: number) => {
  const nthWeekdayOfMonth = (month: number, weekday: number, nth: number) => {
    const date = new Date(Date.UTC(year, month, 1));
    let count = 0;
    while (date.getUTCDay() !== weekday) {
      date.setUTCDate(date.getUTCDate() + 1);
    }
    while (count < nth - 1) {
      date.setUTCDate(date.getUTCDate() + 7);
      count += 1;
    }
    return date;
  };

  const lastWeekdayOfMonth = (month: number, weekday: number) => {
    const date = new Date(Date.UTC(year, month + 1, 0));
    while (date.getUTCDay() !== weekday) {
      date.setUTCDate(date.getUTCDate() - 1);
    }
    return date;
  };

  const observe = (month: number, day: number) => {
    const date = new Date(Date.UTC(year, month, day));
    if (date.getUTCDay() === 0) date.setUTCDate(date.getUTCDate() + 1);
    if (date.getUTCDay() === 6) date.setUTCDate(date.getUTCDate() - 1);
    return date;
  };

  const dates = [
    observe(0, 1),
    nthWeekdayOfMonth(0, 1, 3),
    nthWeekdayOfMonth(1, 1, 3),
    lastWeekdayOfMonth(4, 1),
    observe(5, 19),
    observe(6, 4),
    nthWeekdayOfMonth(8, 1, 1),
    nthWeekdayOfMonth(9, 1, 2),
    observe(10, 11),
    nthWeekdayOfMonth(10, 4, 4),
    observe(11, 25),
  ];

  return new Set(
    dates.map(
      (date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`,
    ),
  );
};

const toDateKey = (date: Date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;

const isBusinessDay = (date: Date) => {
  if (date.getUTCDay() === 0) return false; // Sunday only — FTC 16 CFR §429.1: business day = any day except Sunday or federal holiday; Saturday counts
  return !getObservedFederalHolidayKeys(date.getUTCFullYear()).has(toDateKey(date));
};

export const normalizeStateCode = (state?: string | null) => {
  const trimmed = state?.trim();
  if (!trimmed) return null;
  if (trimmed.length === 2) return trimmed.toUpperCase();
  return STATE_NAME_TO_CODE[trimmed.toLowerCase()] || null;
};

export const getLegalNotice = (customerState?: string | null, companyState?: string | null): LegalNotice => {
  const stateCode = normalizeStateCode(customerState) || normalizeStateCode(companyState);
  return (stateCode && STATE_OVERRIDES[stateCode]) || FEDERAL_NOTICE;
};

export const calculateCancellationDeadline = (transactionDate: string | Date) => {
  const start = typeof transactionDate === 'string' ? new Date(transactionDate) : new Date(transactionDate);
  const cursor = new Date(start);
  let businessDays = 0;

  while (businessDays < 3) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (isBusinessDay(cursor)) {
      businessDays += 1;
    }
  }

  return cursor;
};
