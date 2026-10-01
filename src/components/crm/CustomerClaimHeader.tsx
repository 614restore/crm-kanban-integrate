// The customer and their insurance details, at the top of the Insurance tab so the claim is the
// first thing seen -- not buried under pages of storm history.
import React from 'react';
import { Mail, MapPin, Phone, ShieldCheck } from 'lucide-react';
import { formatCurrency, getContactFullName, type Contact } from '@/lib/crmData';

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="min-w-0">
    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
    <p className="truncate text-sm text-gray-900">{children || <span className="text-gray-300">—</span>}</p>
  </div>
);

export default function CustomerClaimHeader({ contact }: { contact: Contact }) {
  const address = [contact.address, contact.city, [contact.state, contact.zip].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');
  const hasInsurance = !!(contact.insuranceCompany || contact.policyNumber || contact.claimNumber || contact.adjusterName);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
          <ShieldCheck size={18} className="text-blue-600" />
          {getContactFullName(contact)}
        </h3>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
          {contact.phone1 && (
            <a href={`tel:${contact.phone1}`} className="inline-flex items-center gap-1 hover:text-blue-600">
              <Phone size={13} /> {contact.phone1}
            </a>
          )}
          {contact.email && (
            <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-1 hover:text-blue-600">
              <Mail size={13} /> {contact.email}
            </a>
          )}
          {address && (
            <span className="inline-flex items-center gap-1">
              <MapPin size={13} /> {address}
            </span>
          )}
        </div>
      </div>
      {hasInsurance ? (
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
          <Row label="Insurance">{contact.insuranceCompany}</Row>
          <Row label="Policy #">{contact.policyNumber}</Row>
          <Row label="Claim #">{contact.claimNumber}</Row>
          <Row label="Adjuster">{contact.adjusterName}</Row>
          <Row label="Adjuster phone">{contact.adjusterPhone}</Row>
          <Row label="Deductible">{contact.deductible ? formatCurrency(contact.deductible) : ''}</Row>
        </div>
      ) : (
        <p className="text-sm text-gray-500">No insurance details on this customer yet. Add them from the Overview tab, or start a claim below.</p>
      )}
    </div>
  );
}
