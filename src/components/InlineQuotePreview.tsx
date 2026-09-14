// Copied from QuoteMGR src/components/InlineQuotePreview.tsx (read-only reference).
import React, { useState } from 'react';
import {
  Building2, Phone, Mail, Shield, FileText, CheckCircle, Camera, AlertCircle, X, DollarSign, ExternalLink
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import type { Company, Contact, LineItem, EstimatePhoto } from '@/data/quoteData';
import { tierLabels } from '@/data/quoteData';
import { calculateCancellationDeadline, getLegalNotice } from '@/lib/legalNotices';

interface InlineQuotePreviewProps {
  open: boolean;
  onClose: () => void;
  contact: Partial<Contact>;
  company: Company;
  lineItems: LineItem[];
  photos: EstimatePhoto[];
  coverPageTitle: string;
  jobDescription: string;
  jobType: 'exterior' | 'interior' | 'both';
  includeAbout: boolean;
  includeWarranty: boolean;
  includeCancel: boolean;
  includeCustomPage: boolean;
  customPageTitle: string;
  customPageBody: string;
  customPageFileUrl: string | null;
  customPageFileType: string | null;
  notes: string;
  // Tier customization
  showGoodTier: boolean;
  showBetterTier: boolean;
  showBestTier: boolean;
  goodTierName: string;
  betterTierName: string;
  bestTierName: string;
  showLineItemPrices: boolean;
  pageOrder: string[];
  showFinancing?: boolean;
  financingOptions?: Array<{
    id: string;
    lender_name: string;
    program_name: string | null;
    apr_low: number | null;
    apr_high: number | null;
    term_months: number | null;
    notes: string | null;
    application_url: string | null;
  }>;
}

const InlineQuotePreview: React.FC<InlineQuotePreviewProps> = ({
  open, onClose, contact, company, lineItems, photos,
  coverPageTitle, jobDescription, jobType, includeAbout, includeWarranty, includeCancel,
  includeCustomPage, customPageTitle, customPageBody, customPageFileUrl, customPageFileType, notes,
  showGoodTier, showBetterTier, showBestTier,
  goodTierName, betterTierName, bestTierName,
  showLineItemPrices, pageOrder,
  showFinancing, financingOptions = [],
}) => {
  const [currentPage, setCurrentPage] = useState('cover');

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(val);

  const goodTotal = lineItems.reduce((sum, item) => sum + item.quantity * item.good_price, 0);
  const betterTotal = lineItems.reduce((sum, item) => sum + item.quantity * item.better_price, 0);
  const bestTotal = lineItems.reduce((sum, item) => sum + item.quantity * item.best_price, 0);

  // Totals above cover every line; internal-only rows (labor) are not listed.
  const groupedItems = lineItems.reduce((acc, item) => {
    if (item.hidden_from_customer) return acc;
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, LineItem[]>);

  // Build full list of possible pages
  const allPossiblePages = [
    { id: 'cover', label: 'Cover Page', included: true },
    { id: 'about', label: 'About Us', included: includeAbout },
    { id: 'custom', label: customPageTitle || 'Custom Page', included: includeCustomPage },
    { id: 'pricing-good', label: `${goodTierName} Option`, included: showGoodTier },
    { id: 'pricing-better', label: `${betterTierName} Option`, included: showBetterTier },
    { id: 'pricing-best', label: `${bestTierName} Option`, included: showBestTier },
    { id: 'photos', label: 'Photo Documentation', included: photos.length > 0 },
    { id: 'financing', label: 'Financing Options', included: !!(showFinancing && financingOptions.length > 0) },
    { id: 'warranty', label: 'Warranty', included: includeWarranty },
    { id: 'cancel', label: 'Right to Cancel', included: includeCancel },
  ];

  // Sort by pageOrder, then filter to only included pages
  const pages = [...allPossiblePages]
    .sort((a, b) => {
      const ai = pageOrder.indexOf(a.id);
      const bi = pageOrder.indexOf(b.id);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    })
    .filter(p => p.included);

  const contactName = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'Contact Name';
  const hasContact = !!(contact.first_name || contact.last_name);
  const legalNotice = getLegalNotice(contact.state, company.state);
  const cancellationDeadline = calculateCancellationDeadline(new Date());

  // Render a single-tier pricing page
  const renderTierPage = (
    tierKey: 'good' | 'better' | 'best',
    tierName: string,
    total: number,
    priceField: 'good_price' | 'better_price' | 'best_price'
  ) => {
    const config = tierLabels[tierKey];
    return (
      <div className="p-6 lg:p-10">
        <div className={`flex items-center gap-3 mb-6`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${config.bg} border ${config.border}`}>
            <Shield className={`w-5 h-5 ${config.color}`} />
          </div>
          <div>
            <h2 className={`text-2xl font-bold ${config.color}`}>{tierName} Option</h2>
            <p className="text-gray-500 text-sm">{config.subtitle}</p>
          </div>
        </div>

        {/* Summary Card */}
        <div className={`rounded-xl border-2 ${config.border} ${config.bg} p-6 mb-8`}>
          <p className="text-sm text-gray-500 mb-1">Job Total</p>
          <p className={`text-4xl font-bold ${config.color}`}>{formatCurrency(total)}</p>
          {lineItems.length > 0 && (
            <p className="text-xs text-gray-400 mt-2">{lineItems.length} line item{lineItems.length !== 1 ? 's' : ''}</p>
          )}
        </div>

        {/* Line Items (if enabled) */}
        {showLineItemPrices && lineItems.length > 0 && (
          <>
            {Object.entries(groupedItems).map(([category, items]) => (
              <div key={category} className="mb-6">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${config.solidBg}`} />
                  {category}
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 font-medium text-gray-500">Item</th>
                        <th className="text-center py-2 font-medium text-gray-500 w-20">Qty</th>
                        <th className={`text-right py-2 font-medium w-28 ${config.color}`}>Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, idx) => (
                        <tr key={item.id || idx} className="border-b border-gray-50">
                          <td className="py-2">
                            <p className="font-medium text-gray-900">{item.item_name}</p>
                            {item.description && <p className="text-xs text-gray-500">{item.description}</p>}
                          </td>
                          <td className="text-center text-gray-600">{item.quantity} {item.unit}</td>
                          <td className={`text-right font-medium ${config.color}`}>
                            {formatCurrency(item.quantity * item[priceField])}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            {/* Total Row */}
            <div className={`border-t-2 ${config.border} pt-4 mt-4 flex items-center justify-between`}>
              <span className="font-bold text-gray-900 text-sm uppercase tracking-wide">Job Total</span>
              <span className={`text-2xl font-bold ${config.color}`}>{formatCurrency(total)}</span>
            </div>
          </>
        )}

        {/* Empty state */}
        {lineItems.length === 0 && (
          <div className="text-center py-10 text-gray-400">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Add line items in Step 3 to see pricing here</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] p-0 overflow-hidden flex flex-col">
        <DialogTitle className="sr-only">Estimate Preview</DialogTitle>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-white shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full">
              Draft Preview
            </span>
            <span className="text-sm text-gray-500">{coverPageTitle}</span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Page Navigation */}
        <div className="bg-white border-b shrink-0">
          <div className="px-4 flex gap-1 overflow-x-auto py-2">
            {pages.map(page => (
              <button
                key={page.id}
                onClick={() => setCurrentPage(page.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${currentPage === page.id ? 'bg-[#1e3a5f] text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}
              >
                {page.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-gray-100 p-4 lg:p-8">
          <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">

            {/* COVER PAGE */}
            {currentPage === 'cover' && (
              <div className="relative">
                <div className="bg-gradient-to-br from-[#1e3a5f] via-[#2d5a8e] to-[#1e3a5f] text-white p-12 lg:p-16 min-h-[500px] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-12">
                      <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                        {company.logo_url ? (
                          <img src={company.logo_url} alt="Logo" className="w-10 h-10 object-contain rounded-lg" />
                        ) : (
                          <Building2 className="w-7 h-7" />
                        )}
                      </div>
                      <div>
                        <h2 className="text-xl font-bold">{company.name}</h2>
                        <p className="text-blue-200 text-sm">{company.license_number ? `License: ${company.license_number}` : ''}</p>
                      </div>
                    </div>
                    <h1 className="text-4xl lg:text-5xl font-bold leading-tight mb-4">{coverPageTitle || 'Home Restoration Proposal'}</h1>
                    <p className="text-xl text-blue-200">{jobDescription || 'Job description will appear here'}</p>
                  </div>
                  <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-white/10 rounded-xl p-5">
                      <p className="text-xs text-blue-300 uppercase tracking-wider mb-2">Prepared For</p>
                      <p className={`text-lg font-semibold ${hasContact ? '' : 'italic opacity-60'}`}>{contactName}</p>
                      {contact.address && <p className="text-blue-200 text-sm">{contact.address}</p>}
                      {(contact.city || contact.state || contact.zip) && (
                        <p className="text-blue-200 text-sm">{[contact.city, contact.state, contact.zip].filter(Boolean).join(', ')}</p>
                      )}
                      {contact.email && <p className="text-blue-200 text-sm mt-1">{contact.email}</p>}
                      {contact.phone && <p className="text-blue-200 text-sm">{contact.phone}</p>}
                      {!hasContact && <p className="text-blue-300 text-sm italic">Fill in contact info to see details here</p>}
                    </div>
                    <div className="bg-white/10 rounded-xl p-5">
                      <p className="text-xs text-blue-300 uppercase tracking-wider mb-2">Estimate Details</p>
                      <p className="text-sm"><span className="text-blue-300">Date:</span> {new Date().toLocaleDateString()}</p>
                      <p className="text-sm"><span className="text-blue-300">Type:</span> <span className="capitalize">{jobType === 'both' ? 'Interior & Exterior' : jobType}</span></p>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-6 py-6">
                  <div className="mb-5">
                    <p className="text-sm font-semibold text-gray-900">Why Clients Choose Us</p>
                    <p className="text-xs text-gray-500 mt-1">Professional standards presented clearly on every proposal.</p>
                  </div>
                  <div className="flex flex-col gap-3 mb-5">
                    {[
                      { label: 'Licensed & Insured', detail: 'Protected crews and accountable project execution.' },
                      { label: 'Free Estimates', detail: 'Clear scope and pricing before work begins.' },
                      { label: 'Quality Materials', detail: 'Professional products selected for durable results.' },
                      { label: 'Expert Team', detail: 'Experienced installers with organized oversight.' },
                    ].map((item, i) => (
                      <div key={i} className="rounded-xl border border-gray-200 bg-white p-4 flex gap-3">
                        <div className="w-2.5 rounded-full bg-[#ff6b35] shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                          <p className="text-xs text-gray-600 mt-1 leading-relaxed">{item.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col sm:flex-row items-center justify-between text-sm text-gray-500 gap-2">
                    <div className="flex items-center gap-4">
                    {company.phone && <span className="flex items-center gap-1"><Phone className="w-4 h-4" />{company.phone}</span>}
                    {company.email && <span className="flex items-center gap-1"><Mail className="w-4 h-4" />{company.email}</span>}
                    </div>
                    <p>{[company.address, company.city, company.state, company.zip].filter(Boolean).join(', ')}</p>
                  </div>
                </div>
              </div>
            )}

            {/* ABOUT PAGE */}
            {currentPage === 'about' && (
              <div className="relative overflow-hidden">
                {company.about_bg_image_url && (
                  <div
                    className="absolute inset-0 bg-center bg-no-repeat"
                    style={{
                      backgroundImage: `url(${company.about_bg_image_url})`,
                      backgroundSize: `${company.about_bg_zoom ?? 100}%`,
                      opacity: company.about_bg_opacity ?? 0.12,
                    }}
                  />
                )}
              <div className="relative z-10 p-8 lg:p-12">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-[#1e3a5f]" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">About {company.name}</h2>
                </div>
                <div className="prose max-w-none text-gray-700 leading-relaxed whitespace-pre-line">
                  {company.about_text || 'Company information has not been set up yet. Go to Company Setup to add your company description.'}
                </div>
                <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Licensed & Insured', icon: Shield },
                    { label: 'Free Estimates', icon: FileText },
                    { label: 'Quality Materials', icon: CheckCircle },
                    { label: 'Expert Team', icon: Building2 },
                  ].map((item, i) => (
                    <div key={i} className="bg-blue-50 rounded-xl p-4 text-center">
                      <item.icon className="w-6 h-6 text-[#1e3a5f] mx-auto mb-2" />
                      <p className="text-sm font-medium text-[#1e3a5f]">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
              </div>
            )}

            {/* CUSTOM PAGE */}
            {currentPage === 'custom' && (
              <div className="p-8 lg:p-12">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                    <FileText className="w-5 h-5 text-amber-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">{customPageTitle || 'Custom Information'}</h2>
                </div>
                {customPageBody && (
                  <div className="prose max-w-none text-gray-700 leading-relaxed whitespace-pre-line mb-6">
                    {customPageBody}
                  </div>
                )}
                {customPageFileUrl && (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                    {customPageFileType?.startsWith('image/') ? (
                      <img src={customPageFileUrl} alt="Custom attachment" className="w-full rounded-lg" />
                    ) : (
                      <a href={customPageFileUrl} target="_blank" rel="noreferrer" className="text-blue-600 text-sm underline">
                        View attached file
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* PRICING - GOOD TIER */}
            {currentPage === 'pricing-good' && renderTierPage('good', goodTierName, goodTotal, 'good_price')}

            {/* PRICING - BETTER TIER */}
            {currentPage === 'pricing-better' && renderTierPage('better', betterTierName, betterTotal, 'better_price')}

            {/* PRICING - BEST TIER */}
            {currentPage === 'pricing-best' && renderTierPage('best', bestTierName, bestTotal, 'best_price')}

            {/* PHOTOS PAGE */}
            {currentPage === 'photos' && (
              <div className="p-6 lg:p-10">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                    <Camera className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Inspection Photos</h2>
                    <p className="text-gray-500 text-sm">Documentation of findings during property inspection</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {photos.map((photo, i) => (
                    <div key={photo.id || i} className="rounded-xl border border-gray-200 overflow-hidden">
                      <div className="bg-gray-50 flex items-center justify-center" style={{ maxHeight: '280px' }}>
                        <img
                          src={photo.photo_url}
                          alt={photo.caption || `Photo ${i + 1}`}
                          className="w-full object-contain max-h-72"
                        />
                      </div>
                      <div className="p-4">
                        {photo.damage_type && (
                          <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs font-medium px-2 py-1 rounded-full mb-2">
                            <AlertCircle className="w-3 h-3" />
                            {photo.damage_type}
                          </span>
                        )}
                        {photo.caption && <h4 className="font-semibold text-gray-900 mb-1">{photo.caption}</h4>}
                        {photo.notes && <p className="text-sm text-gray-600">{photo.notes}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* FINANCING PAGE */}
            {currentPage === 'financing' && (
              <div className="p-8 lg:p-12">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Financing Available</h2>
                    <p className="text-gray-500 text-sm">We work with these trusted lenders to make your project affordable</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {financingOptions.filter(o => (o as any).is_active !== false).map(opt => {
                    const totalBetter = lineItems.reduce((s, i) => s + i.quantity * i.better_price, 0);
                    const monthlyEst = (opt.term_months && opt.apr_low !== null && totalBetter > 0)
                      ? (() => {
                        const r = (opt.apr_low / 100) / 12;
                        const n = opt.term_months;
                        if (r === 0) return totalBetter / n;
                        return totalBetter * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
                      })()
                      : null;

                    return (
                      <div key={opt.id} className="border border-gray-200 rounded-2xl overflow-hidden">
                        <div className="bg-gradient-to-r from-[#1e3a5f] to-[#2d5a8e] px-6 py-4 flex items-center justify-between">
                          <div>
                            <h3 className="text-white font-bold text-lg">{opt.lender_name}</h3>
                            {opt.program_name && <p className="text-blue-200 text-sm">{opt.program_name}</p>}
                          </div>
                          {monthlyEst && (
                            <div className="text-right">
                              <p className="text-white text-2xl font-bold">${Math.ceil(monthlyEst).toLocaleString()}<span className="text-sm font-normal text-blue-200">/mo</span></p>
                              <p className="text-blue-300 text-xs">estimated payment</p>
                            </div>
                          )}
                        </div>
                        <div className="p-5">
                          <div className="flex flex-wrap gap-4 mb-4">
                            {(opt.apr_low !== null || opt.apr_high !== null) && (
                              <div className="bg-gray-50 rounded-xl px-4 py-2 text-center">
                                <p className="text-xs text-gray-500">APR Range</p>
                                <p className="font-bold text-gray-900">
                                  {opt.apr_low !== null && opt.apr_high !== null && opt.apr_low !== opt.apr_high
                                    ? `${opt.apr_low}%–${opt.apr_high}%`
                                    : `${opt.apr_low ?? opt.apr_high}%`}
                                </p>
                              </div>
                            )}
                            {opt.term_months && (
                              <div className="bg-gray-50 rounded-xl px-4 py-2 text-center">
                                <p className="text-xs text-gray-500">Loan Term</p>
                                <p className="font-bold text-gray-900">{opt.term_months} months</p>
                              </div>
                            )}
                            {monthlyEst && (
                              <div className="bg-green-50 rounded-xl px-4 py-2 text-center">
                                <p className="text-xs text-green-600">Est. Monthly</p>
                                <p className="font-bold text-green-700">${Math.ceil(monthlyEst).toLocaleString()}</p>
                              </div>
                            )}
                          </div>
                          {opt.notes && <p className="text-sm text-gray-500 mb-4">{opt.notes}</p>}
                          {opt.application_url ? (
                            <a
                              href={opt.application_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 px-6 py-3 bg-[#ff6b35] hover:bg-[#e55a2b] text-white rounded-xl font-semibold text-sm transition-colors shadow-md shadow-orange-100"
                            >
                              Apply Now with {opt.lender_name} <ExternalLink className="w-4 h-4" />
                            </a>
                          ) : (
                            <p className="text-sm text-gray-400 italic">Contact us to discuss financing options</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs text-gray-400">* Monthly payment estimates are based on the "Better" tier total and lowest available APR. Actual terms depend on creditworthiness and lender approval. Subject to change without notice.</p>
                </div>
              </div>
            )}

            {/* WARRANTY PAGE */}
            {currentPage === 'warranty' && (
              <div className="p-8 lg:p-12">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                    <Shield className="w-5 h-5 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">Warranty Information</h2>
                </div>
                <div className="prose max-w-none text-gray-700 leading-relaxed whitespace-pre-line">
                  {company.warranty_text || 'Warranty information has not been set up yet. Go to Company Setup to add your warranty terms.'}
                </div>
              </div>
            )}

            {/* RIGHT TO CANCEL */}
            {currentPage === 'cancel' && (
              <div className="p-8 lg:p-12">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                    <Shield className="w-5 h-5 text-amber-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">{legalNotice.cancelTitle}</h2>
                </div>
                <div className="prose max-w-none text-gray-700 leading-relaxed">
                  {legalNotice.cancelIntroParagraphs.map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                  <p>{legalNotice.cancelInstructionText}</p>
                  <p>
                    NOT LATER THAN MIDNIGHT OF{' '}
                    <strong>
                      {cancellationDeadline.toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </strong>
                  </p>
                  <p>Please contact {company.name} to request cancellation instructions.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InlineQuotePreview;
