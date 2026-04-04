// Roofr Integration Component
// Handles PDF upload, measurement parsing, and estimate generation

import React, { useState } from 'react';
import { toast } from 'sonner';
import { FileUp, Loader2, CheckCircle, AlertCircle, FileText, Download } from 'lucide-react';
import type { RoofrMeasurements } from '@/lib/roofrParser';
import { generateEstimateFromMeasurements, generateEstimateSummary, formatEstimateForCustomer } from '@/lib/roofrEstimateGenerator';
import { Contact } from '@/lib/crmData';

interface RoofrIntegrationProps {
  contact: Contact;
  onEstimateGenerated?: (lineItems: any[], measurements: RoofrMeasurements) => void;
}

export function RoofrIntegration({ contact, onEstimateGenerated }: RoofrIntegrationProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [measurements, setMeasurements] = useState<RoofrMeasurements | null>(null);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [estimateSummary, setEstimateSummary] = useState<any>(null);
  
  // Detect mobile devices - PDF.js doesn't work reliably on iOS
  const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file');
      return;
    }

    setIsProcessing(true);
    toast.info('Parsing Roofr measurement report...');

    try {
      // Step 1: Parse PDF — lazy-load pdfjs-dist so it doesn't block app startup
      const { parseRoofrPDF, validateMeasurements } = await import('@/lib/roofrParser');
      const parsedMeasurements = await parseRoofrPDF(file);
      setMeasurements(parsedMeasurements);

      // Step 2: Validate measurements
      const validation = validateMeasurements(parsedMeasurements);
      setValidationWarnings(validation.warnings);

      if (validation.warnings.length > 0) {
        toast.warning('Measurements extracted with warnings - please review');
      } else {
        toast.success('Measurements extracted successfully!');
      }

      // Step 3: Generate estimate
      const lineItems = generateEstimateFromMeasurements(parsedMeasurements);
      const summary = generateEstimateSummary(parsedMeasurements, lineItems);
      setEstimateSummary(summary);

      // Step 4: Notify parent component
      if (onEstimateGenerated) {
        onEstimateGenerated(lineItems, parsedMeasurements);
      }

      toast.success(`Estimate generated: $${summary.totalCost.toLocaleString()}`);
    } catch (error) {
      console.error('Failed to process Roofr PDF:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to parse PDF');
    } finally {
      setIsProcessing(false);
      // Reset file input
      event.target.value = '';
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
      {/* Mobile Notice or Upload Section */}
      {isMobile ? (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 bg-gray-50">
          <div className="flex flex-col items-center gap-3 text-center">
            <FileUp className="w-8 h-8 text-gray-400" />
            <div>
              <h3 className="font-semibold text-gray-900">PDF Upload Available on Desktop</h3>
              <p className="text-sm text-gray-500 mt-1">
                Upload Roofr PDFs from your computer or use the "Order New Report" option below
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-blue-400 transition-colors">
          <div className="flex flex-col items-center gap-3">
            <FileUp className="w-8 h-8 text-gray-400" />
            <div className="text-center">
              <h3 className="font-semibold text-gray-900">Upload Roofr Measurement Report</h3>
              <p className="text-sm text-gray-500 mt-1">
                Upload a PDF to auto-generate an estimate
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
                    {measurements.ridgeLength.toFixed(0)} LF
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Valley Length:</span>
                  <span className="ml-2 font-medium text-gray-900">
                    {measurements.valleyLength.toFixed(0)} LF
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Eave Length:</span>
                  <span className="ml-2 font-medium text-gray-900">
                    {measurements.eaveLength.toFixed(0)} LF
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
                    {measurements.facetCount}
                  </span>
                </div>
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
