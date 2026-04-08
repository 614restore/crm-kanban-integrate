import React, { useState, useEffect } from 'react';
import { Download, CheckCircle, Loader, Home, Ruler, TrendingUp, Settings } from 'lucide-react';
import { EstimateItem } from '@/lib/crmData';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { EagleViewIntegration } from '@/lib/integrations/eagleview';

interface EagleViewReport {
  reportId: string;
  address: string;
  reportDate: string;
  measurements: {
    totalSquares: number;
    roofArea: number; // sqft
    pitch: string;
    ridgeLength: number; // linear feet
    eaveLength: number; // linear feet
    rakeLength: number; // linear feet
    valleyLength: number; // linear feet
    hipLength: number; // linear feet
    facets: Array<{
      name: string;
      area: number;
      pitch: string;
    }>;
  };
  imageUrl?: string;
}

interface EagleViewImportProps {
  contactAddress: string;
  companyId: string;
  onImportComplete: (items: EstimateItem[]) => void;
}

export function EagleViewImport({ contactAddress, companyId, onImportComplete }: EagleViewImportProps) {
  const [isSearching, setIsSearching] = useState(false);
  const [report, setReport] = useState<EagleViewReport | null>(null);
  const [searchAddress, setSearchAddress] = useState(contactAddress);
  const [eagleView, setEagleView] = useState<EagleViewIntegration | null>(null);
  const [configStatus, setConfigStatus] = useState<'unknown' | 'ok' | 'missing'>('unknown');

  // Load EagleView credentials from Supabase on mount
  useEffect(() => {
    if (!companyId) { setConfigStatus('missing'); return; }
    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setConfigStatus('missing'); return; }

        const { data, error: dbError } = await supabase
          .from('company_integrations')
          .select('credentials')
          .eq('company_id', companyId)
          .eq('integration_type', 'eagleview')
          .eq('is_active', true)
          .single();

        if (dbError && dbError.code !== 'PGRST116') {
          setConfigStatus('missing');
          return;
        }

        const apiKey = data?.credentials?.apiKey;
        const clientId = data?.credentials?.clientId;
        const env = data?.credentials?.environment || 'production';
        if (!apiKey || !clientId) { setConfigStatus('missing'); return; }

        setEagleView(new EagleViewIntegration(apiKey, clientId, env));
        setConfigStatus('ok');
      } catch {
        setConfigStatus('missing');
      }
    };
    load();
  }, [companyId]);

  const searchEagleView = async () => {
    if (!eagleView) return;
    setIsSearching(true);

    try {
      // Parse address into components for searchProperties
      // Format expected: "123 Main St, City, ST ZIP" or similar
      const parts = searchAddress.split(',').map((s) => s.trim());
      const street = parts[0] || searchAddress;
      const city = parts[1] || '';
      const stateZip = (parts[2] || '').trim().split(' ');
      const state = stateZip[0] || '';
      const zip = stateZip[1] || '';

      const data = await eagleView.searchProperties(street, city, state, zip);

      // Normalize API response into our EagleViewReport shape
      const property = Array.isArray(data) ? data[0] : (data?.properties?.[0] ?? data);

      if (property) {
        const m = property.measurements ?? property.roof_measurements ?? {};
        const normalizedReport: EagleViewReport = {
          reportId: property.report_id ?? property.id ?? 'EV-' + Date.now(),
          address: searchAddress,
          reportDate: property.report_date ?? property.created_at ?? new Date().toISOString(),
          measurements: {
            totalSquares: m.total_squares ?? m.totalSquares ?? 0,
            roofArea: m.roof_area ?? m.roofArea ?? 0,
            pitch: m.pitch ?? m.predominant_pitch ?? '0/12',
            ridgeLength: m.ridge_length ?? m.ridgeLength ?? 0,
            eaveLength: m.eave_length ?? m.eaveLength ?? 0,
            rakeLength: m.rake_length ?? m.rakeLength ?? 0,
            valleyLength: m.valley_length ?? m.valleyLength ?? 0,
            hipLength: m.hip_length ?? m.hipLength ?? 0,
            facets: m.facets ?? [],
          },
          imageUrl: property.image_url ?? property.imageUrl,
        };
        setReport(normalizedReport);
        toast.success('EagleView report found!');
      } else {
        toast.error('No EagleView report found for this address');
      }
    } catch (error) {
      console.error('EagleView search error:', error);
      toast.error('Failed to search EagleView. Check API credentials.');
    } finally {
      setIsSearching(false);
    }
  };

  const generateEstimateItems = (): EstimateItem[] => {
    if (!report) return [];

    const { measurements } = report;
    const squares = measurements.totalSquares;
    const wasteFactor = 1.1; // 10% waste
    
    // Calculate quantities with waste factor
    const shingleSquares = Math.ceil(squares * wasteFactor);
    const underlaymentSqft = Math.ceil(measurements.roofArea * wasteFactor);
    const dripEdge = Math.ceil(measurements.eaveLength + measurements.rakeLength);
    const ridgeCap = Math.ceil(measurements.ridgeLength);
    const valleyFlashing = Math.ceil(measurements.valleyLength);
    const starterShingles = Math.ceil(measurements.eaveLength);

    const items: EstimateItem[] = [
      {
        id: crypto.randomUUID(),
        description: 'Roof Tear-Off & Disposal',
        quantity: squares,
        unit: 'sq',
        unitPrice: 125,
        total: squares * 125,
      },
      {
        id: crypto.randomUUID(),
        description: 'Architectural Asphalt Shingles (30-year)',
        quantity: shingleSquares,
        unit: 'sq',
        unitPrice: 350,
        total: shingleSquares * 350,
      },
      {
        id: crypto.randomUUID(),
        description: 'Synthetic Underlayment',
        quantity: underlaymentSqft,
        unit: 'sqft',
        unitPrice: 0.45,
        total: underlaymentSqft * 0.45,
      },
      {
        id: crypto.randomUUID(),
        description: 'Ice & Water Shield (valleys/eaves)',
        quantity: Math.ceil(underlaymentSqft * 0.15 / 200), // 15% coverage, 200 sqft per roll
        unit: 'roll',
        unitPrice: 85,
        total: Math.ceil(underlaymentSqft * 0.15 / 200) * 85,
      },
      {
        id: crypto.randomUUID(),
        description: 'Drip Edge (aluminum)',
        quantity: dripEdge,
        unit: 'lf',
        unitPrice: 3.5,
        total: dripEdge * 3.5,
      },
      {
        id: crypto.randomUUID(),
        description: 'Ridge Vent',
        quantity: ridgeCap,
        unit: 'lf',
        unitPrice: 12,
        total: ridgeCap * 12,
      },
      {
        id: crypto.randomUUID(),
        description: 'Ridge Cap Shingles',
        quantity: Math.ceil(ridgeCap / 35), // 35 lf per bundle
        unit: 'bundle',
        unitPrice: 65,
        total: Math.ceil(ridgeCap / 35) * 65,
      },
      {
        id: crypto.randomUUID(),
        description: 'Starter Shingles',
        quantity: starterShingles,
        unit: 'lf',
        unitPrice: 2.5,
        total: starterShingles * 2.5,
      },
    ];

    // Add valley flashing if valleys exist
    if (valleyFlashing > 0) {
      items.push({
        id: crypto.randomUUID(),
        description: 'Valley Flashing (metal)',
        quantity: valleyFlashing,
        unit: 'lf',
        unitPrice: 8,
        total: valleyFlashing * 8,
      });
    }

    // Add pipe boots (estimate 1 per 500 sqft)
    const pipeBoots = Math.max(2, Math.ceil(measurements.roofArea / 500));
    items.push({
      id: crypto.randomUUID(),
      description: 'Pipe Boots/Flashings',
      quantity: pipeBoots,
      unit: 'ea',
      unitPrice: 45,
      total: pipeBoots * 45,
    });

    // Add nails
    items.push({
      id: crypto.randomUUID(),
      description: 'Roofing Nails & Fasteners',
      quantity: 1,
      unit: 'lot',
      unitPrice: 250,
      total: 250,
    });

    // Add labor
    items.push({
      id: crypto.randomUUID(),
      description: 'Labor - Installation',
      quantity: squares,
      unit: 'sq',
      unitPrice: 180,
      total: squares * 180,
    });

    // Add cleanup
    items.push({
      id: crypto.randomUUID(),
      description: 'Dumpster & Cleanup',
      quantity: 1,
      unit: 'ea',
      unitPrice: 450,
      total: 450,
    });

    return items;
  };

  const handleImport = () => {
    const items = generateEstimateItems();
    onImportComplete(items);
    toast.success(`Imported ${items.length} line items from EagleView!`);
  };

  // Not configured state
  if (configStatus === 'missing') {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white mb-1">EagleView Integration</h3>
              <p className="text-blue-100 text-sm">Import 3D roof measurements</p>
            </div>
            <Home size={32} className="text-white/80" />
          </div>
        </div>
        <div className="p-6">
          <div className="flex items-start gap-2 bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-500">
            <Settings size={16} className="mt-0.5 shrink-0" />
            <span>Configure EagleView in Settings to enable aerial measurements.</span>
          </div>
        </div>
      </div>
    );
  }

  if (configStatus === 'unknown') {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white mb-1">EagleView Integration</h3>
              <p className="text-blue-100 text-sm">Import 3D roof measurements</p>
            </div>
            <Home size={32} className="text-white/80" />
          </div>
        </div>
        <div className="p-6 flex items-center gap-2 text-gray-400 text-sm">
          <Loader size={16} className="animate-spin" /> Loading EagleView…
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white mb-1">EagleView Integration</h3>
            <p className="text-blue-100 text-sm">Import 3D roof measurements</p>
          </div>
          <Home size={32} className="text-white/80" />
        </div>
      </div>

      {/* Search Section */}
      {!report && (
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Property Address
            </label>
            <input
              type="text"
              value={searchAddress}
              onChange={(e) => setSearchAddress(e.target.value)}
              placeholder="123 Main St, City, State ZIP"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <button
            onClick={searchEagleView}
            disabled={isSearching || !searchAddress || configStatus !== 'ok'}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSearching ? (
              <>
                <Loader size={20} className="animate-spin" />
                Searching EagleView...
              </>
            ) : (
              <>
                <Download size={20} />
                Search EagleView Reports
              </>
            )}
          </button>

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="text-sm font-semibold text-blue-900 mb-2">How it works:</h4>
            <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
              <li>Enter the property address</li>
              <li>We'll search your EagleView account for existing reports</li>
              <li>Review the measurements and roof diagram</li>
              <li>Click "Import" to auto-generate estimate line items</li>
              <li>Adjust quantities and pricing as needed</li>
            </ol>
          </div>
        </div>
      )}

      {/* Report Display */}
      {report && (
        <div className="p-6 space-y-6">
          {/* Report Info */}
          <div className="flex items-start justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start gap-3">
              <CheckCircle size={24} className="text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-green-900 mb-1">Report Found!</h4>
                <p className="text-xs text-green-700">{report.address}</p>
                <p className="text-xs text-green-600 mt-1">Report Date: {new Date(report.reportDate).toLocaleDateString()}</p>
              </div>
            </div>
            <button
              onClick={() => setReport(null)}
              className="text-xs text-green-700 hover:text-green-900 underline"
            >
              Search Different Address
            </button>
          </div>

          {/* Measurements */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <Ruler size={16} className="text-blue-600" />
                <span className="text-xs font-medium text-blue-900">Total Squares</span>
              </div>
              <p className="text-2xl font-bold text-blue-600">{report.measurements.totalSquares}</p>
              <p className="text-xs text-blue-700 mt-1">{report.measurements.roofArea.toLocaleString()} sqft</p>
            </div>

            <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg border border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={16} className="text-purple-600" />
                <span className="text-xs font-medium text-purple-900">Pitch</span>
              </div>
              <p className="text-2xl font-bold text-purple-600">{report.measurements.pitch}</p>
            </div>

            <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <Ruler size={16} className="text-green-600" />
                <span className="text-xs font-medium text-green-900">Ridge</span>
              </div>
              <p className="text-2xl font-bold text-green-600">{report.measurements.ridgeLength}</p>
              <p className="text-xs text-green-700 mt-1">linear feet</p>
            </div>

            <div className="p-4 bg-gradient-to-br from-orange-50 to-red-50 rounded-lg border border-orange-200">
              <div className="flex items-center gap-2 mb-2">
                <Ruler size={16} className="text-orange-600" />
                <span className="text-xs font-medium text-orange-900">Eave</span>
              </div>
              <p className="text-2xl font-bold text-orange-600">{report.measurements.eaveLength}</p>
              <p className="text-xs text-orange-700 mt-1">linear feet</p>
            </div>
          </div>

          {/* Roof Diagram */}
          {report.imageUrl && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <img 
                src={report.imageUrl} 
                alt="Roof Diagram" 
                className="w-full h-auto"
              />
            </div>
          )}

          {/* Facets */}
          {report.measurements.facets.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Roof Facets</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {report.measurements.facets.map((facet, index) => (
                  <div key={index} className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-xs font-medium text-gray-700">{facet.name}</p>
                    <p className="text-sm font-bold text-gray-900">{facet.area} sqft</p>
                    <p className="text-xs text-gray-600">Pitch: {facet.pitch}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Import Button */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              <p className="font-medium">Ready to import measurements</p>
              <p className="text-xs">This will generate {generateEstimateItems().length} line items</p>
            </div>
            <button
              onClick={handleImport}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all font-semibold"
            >
              <CheckCircle size={20} />
              Import to Estimate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
