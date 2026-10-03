// Roofr Integration Component
// Handles PDF upload, measurement parsing, and estimate generation

import React, { useState } from 'react';
import { toast } from 'sonner';
import { FileUp, Loader2, CheckCircle, AlertCircle, FileText, Download, FolderOpen } from 'lucide-react';
import type { RoofrMeasurements, MultiStructureResult, StructureMeasurements } from '@/lib/roofrParser';
import { generateEstimateFromMeasurements, generateEstimateSummary, formatEstimateForCustomer } from '@/lib/roofrEstimateGenerator';
import { Contact } from '@/lib/crmData';
import { getDocumentSignedUrl } from '@/lib/storage';

interface RoofrIntegrationProps {
  contact: Contact;
  onEstimateGenerated?: (lineItems: any[], measurements: RoofrMeasurements, multiStructureResult?: MultiStructureResult, file?: File) => void;
  /** Persists the raw PDF to the customer's documents before parsing. */
  onPdfSelected?: (file: File) => Promise<boolean>;
}

export function RoofrIntegration({ contact, onEstimateGenerated, onPdfSelected }: RoofrIntegrationProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [measurements, setMeasurements] = useState<RoofrMeasurements | null>(null);
  const [multiStructureResult, setMultiStructureResult] = useState<MultiStructureResult | null>(null);
  const [selectedStructure, setSelectedStructure] = useState<number>(0); // 0 = combined, 1+ = individual structures
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [estimateSummary, setEstimateSummary] = useState<any>(null);
  
  // Block PDF upload on mobile browsers but allow it in the native Capacitor app
  // (Capacitor sets window.Capacitor; mobile browsers do not)
  const isNativeApp = typeof window !== 'undefined' && typeof (window as any).Capacitor !== 'undefined';
  const isMobileBrowser = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const isMobile = isMobileBrowser && !isNativeApp;

  // PDFs already attached to this contact (uploaded via Documents tab)
  const contactPdfs = (contact.documents || []).filter(
    doc => doc.name?.toLowerCase().endsWith('.pdf') || doc.url?.toLowerCase().includes('.pdf')
  );

  const processResult = async (result: MultiStructureResult, sourceFile?: File) => {
    setMultiStructureResult(result);
    setMeasurements(result.combinedMeasurements);
    const validation = (await import('@/lib/roofrParser')).validateMeasurements(result.combinedMeasurements);
    setValidationWarnings(validation.warnings);
    if (validation.warnings.length > 0) {
      toast.warning('Measurements extracted with warnings - please review');
    } else if (result.hasMultipleStructures) {
      toast.success(`Found ${result.structures.length} structures! Use selector to view each.`);
    } else {
      toast.success('Measurements extracted successfully!');
    }
    const lineItems = generateEstimateFromMeasurements(result.combinedMeasurements);
    const summary = generateEstimateSummary(result.combinedMeasurements, lineItems);
    setEstimateSummary(summary);
    if (onEstimateGenerated) {
      onEstimateGenerated(lineItems, result.combinedMeasurements, result.hasMultipleStructures ? result : undefined, sourceFile);
    }
    toast.success(`Estimate generated: $${summary.totalCost.toLocaleString()}`);
  };

  const handleDocumentSelect = async (docId: string) => {
    const doc = contactPdfs.find(d => d.id === docId);
    if (!doc) return;

    setIsProcessing(true);
    setMeasurements(null);
    setMultiStructureResult(null);
    setSelectedStructure(0);
    setValidationWarnings([]);
    setEstimateSummary(null);
    toast.info(`Parsing ${doc.name}…`);

    try {
      let url = doc.url;
      // If it's a Supabase storage path, get a signed URL
      if (!url.startsWith('http')) {
        const signed = await getDocumentSignedUrl(url);
        if (!signed) throw new Error('Could not generate download URL for this document');
        url = signed;
      }
      const { parseRoofrPDFFromUrl } = await import('@/lib/roofrParser');
      const result = await parseRoofrPDFFromUrl(url);
      await processResult(result);
    } catch (error) {
      const msg = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      console.error('[RoofrImport] error:', msg);
      toast.error(msg || 'Failed to parse PDF', { duration: 10000 });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // iOS iCloud files often have empty file.type — accept by extension as fallback
    const isPdf = file.type === 'application/pdf' ||
      (file.name?.toLowerCase().endsWith('.pdf') ?? false);
    if (!isPdf) {
      toast.error(`Not a PDF (type: "${file.type}", name: "${file.name}")`);
      return;
    }

    setIsProcessing(true);
    toast.info('Parsing Roofr measurement report...');
    setMeasurements(null);
    setMultiStructureResult(null);
    setSelectedStructure(0);
    setValidationWarnings([]);
    setEstimateSummary(null);

    if (onPdfSelected) {
      toast.info('Saving PDF to customer documents...');
      await onPdfSelected(file);
    }

    try {
      const { parseRoofrPDFWithStructures } = await import('@/lib/roofrParser');
      const result = await parseRoofrPDFWithStructures(file);
      await processResult(result, file);
    } catch (error) {
      const msg = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      console.error('[RoofrImport] error:', msg);
      toast.error(
        onPdfSelected
          ? `PDF saved, but measurements couldn't be read automatically (${msg}). You can still view it in Documents.`
          : msg || 'Failed to parse PDF',
        { duration: 10000 },
      );
    } finally {
      setIsProcessing(false);
      event.target.value = '';
    }
  };

  const handleStructureChange = (structureIndex: number) => {
    if (!multiStructureResult) return;
    
    setSelectedStructure(structureIndex);
    
    // Update measurements based on selection
    if (structureIndex === 0) {
      // Combined view
      setMeasurements(multiStructureResult.combinedMeasurements);
      const estimate = generateEstimateFromMeasurements(multiStructureResult.combinedMeasurements);
      const summary = generateEstimateSummary(multiStructureResult.combinedMeasurements, estimate);
      setEstimateSummary(summary);
    } else {
      // Individual structure
      const structure = multiStructureResult.structures[structureIndex - 1];
      setMeasurements(structure.measurements);
      const estimate = generateEstimateFromMeasurements(structure.measurements);
      const summary = generateEstimateSummary(structure.measurements, estimate);
      setEstimateSummary(summary);
    }
  };

  const downloadEstimate = () => {
    if (!measurements || !estimateSummary) return;

    const lineItems = generateEstimateFromMeasurements(measurements);
    const formatted = formatEstimateForCustomer(lineItems, true);

    const blob = new Blob([formatted], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `estimate-${contact.firstName}-${contact.lastName}-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Estimate downloaded');
  };

  return (
    <div className="space-y-4">
      {/* Choose from customer documents (works on all platforms including iOS) */}
      {contactPdfs.length > 0 && (
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          <div className="flex items-center gap-2 mb-3">
            <FolderOpen className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Use Existing Customer Document</h3>
          </div>
          <div className="space-y-2">
            {contactPdfs.map(doc => (
              <button
                key={doc.id}
                onClick={() => handleDocumentSelect(doc.id)}
                disabled={isProcessing}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:border-blue-400 hover:bg-blue-50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
                <span className="text-sm font-medium text-gray-800 truncate">{doc.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* File upload (desktop/web/native app) */}
      {!isMobile && (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-blue-400 transition-colors">
          <div className="flex flex-col items-center gap-3">
            <FileUp className="w-8 h-8 text-gray-400" />
            <div className="text-center">
              <h3 className="font-semibold text-gray-900">Upload Roofr Measurement Report</h3>
              <p className="text-sm text-gray-500 mt-1">
                Upload a Roofr or EagleView PDF — it's saved to this customer and used to auto-generate an estimate
              </p>
            </div>

            <label className="relative cursor-pointer">
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                disabled={isProcessing}
                className="hidden"
              />
              <div className={`
                px-4 py-2 rounded-lg font-medium transition-colors
                ${isProcessing
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
                }
              `}>
                {isProcessing ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </span>
                ) : (
                  'Select PDF File'
                )}
              </div>
            </label>
          </div>
        </div>
      )}

      {/* Validation Warnings */}
      {validationWarnings.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="font-medium text-yellow-900">Validation Warnings</h4>
              <ul className="mt-2 space-y-1 text-sm text-yellow-800">
                {validationWarnings.map((warning, index) => (
                  <li key={index}>• {warning}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
      
      {/* Structure Selector - shown when multiple structures detected */}
      {multiStructureResult && multiStructureResult.hasMultipleStructures && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <h4 className="font-semibold text-blue-900 mb-2">
                Multiple Structures Detected! 🏘️
              </h4>
              <p className="text-sm text-blue-700 mb-3">
                This PDF contains {multiStructureResult.structures.length} structures. 
                Select which one to view or use "All Combined" for total.
              </p>
              
              {/* Structure Selector Dropdown */}
              <select
                value={selectedStructure}
                onChange={(e) => handleStructureChange(Number(e.target.value))}
                className="w-full px-3 py-2 border border-blue-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={0}>
                  All Combined ({multiStructureResult.combinedMeasurements.totalSquares.toFixed(1)} sq)
                </option>
                {multiStructureResult.structures.map((structure, index) => (
                  <option key={index + 1} value={index + 1}>
                    {structure.structureName} ({structure.measurements.totalSquares.toFixed(1)} sq)
                  </option>
                ))}
              </select>
              
              {selectedStructure > 0 && (
                <p className="text-xs text-blue-600 mt-2">
                  💡 Viewing: {multiStructureResult.structures[selectedStructure - 1].structureName}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Measurements Display */}
      {measurements && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="font-medium text-green-900">Measurements Extracted</h4>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <span className="text-gray-600">Total Squares:</span>
                  <span className="ml-2 font-medium text-gray-900">
                    {measurements.totalSquares.toFixed(1)} SQ
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Square Feet:</span>
                  <span className="ml-2 font-medium text-gray-900">
                    {measurements.totalSqFt.toLocaleString()} sq ft
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Ridge Length:</span>
                  <span className="ml-2 font-medium text-gray-900">
                    {measurements.ridgeLength > 0 ? `${measurements.ridgeLength.toFixed(0)} LF` : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Valley Length:</span>
                  <span className="ml-2 font-medium text-gray-900">
                    {measurements.valleyLength > 0 ? `${measurements.valleyLength.toFixed(0)} LF` : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Hip Length:</span>
                  <span className="ml-2 font-medium text-gray-900">
                    {measurements.hipLength > 0 ? `${measurements.hipLength.toFixed(0)} LF` : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Eave Length:</span>
                  <span className="ml-2 font-medium text-gray-900">
                    {measurements.eaveLength > 0 ? `${measurements.eaveLength.toFixed(0)} LF` : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Rake Length:</span>
                  <span className="ml-2 font-medium text-gray-900">
                    {measurements.rakeLength > 0 ? `${measurements.rakeLength.toFixed(0)} LF` : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Pitch:</span>
                  <span className="ml-2 font-medium text-gray-900">
                    {measurements.predominantPitch}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Facets:</span>
                  <span className="ml-2 font-medium text-gray-900">
                    {measurements.facetCount > 0 ? measurements.facetCount : '—'}
                  </span>
                </div>
                {measurements.address && (
                  <div className="col-span-2">
                    <span className="text-gray-600">Address:</span>
                    <span className="ml-2 font-medium text-gray-900">
                      {measurements.address}
                    </span>
                  </div>
                )}
              </div>
              
              {/* Note about console logs for debugging */}
              <div className="mt-3 pt-3 border-t border-green-200">
                <p className="text-xs text-green-700">
                  💡 <strong>Tip:</strong> Open browser console (F12) to see detailed extraction logs if values are missing.
                </p>
                {!multiStructureResult?.hasMultipleStructures && (
                  <p className="text-xs text-green-700 mt-1">
                    📋 <strong>Multiple structures in PDF?</strong> The system will automatically detect and separate them!
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Estimate Summary */}
      {estimateSummary && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <FileText className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-medium text-blue-900">Estimate Generated</h4>
                <div className="mt-3 space-y-2 text-sm">
                  <div>
                    <span className="text-gray-600">Roof Size:</span>
                    <span className="ml-2 font-medium text-gray-900">
                      {estimateSummary.roofSize}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Complexity:</span>
                    <span className="ml-2 font-medium text-gray-900">
                      {estimateSummary.complexity}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-blue-200">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Materials:</span>
                      <span className="font-medium text-gray-900">
                        ${estimateSummary.materialsCost.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-gray-600">Labor:</span>
                      <span className="font-medium text-gray-900">
                        ${estimateSummary.laborCost.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between mt-2 pt-2 border-t border-blue-300">
                      <span className="font-semibold text-blue-900">Total:</span>
                      <span className="font-semibold text-blue-900 text-lg">
                        ${estimateSummary.totalCost.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={downloadEstimate}
              className="ml-4 p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
              title="Download estimate"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
