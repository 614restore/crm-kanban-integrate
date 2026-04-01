// Roofr Measurement Report Integration
// Roofr provides aerial roof measurement reports that give accurate square footage,
// pitch, facet count, and material quantities for any property address.
// API docs: https://dev.roofr.com/
import { IntegrationTestResult } from './apiTypes';

export interface RoofrReportOrder {
  address: string;
  city: string;
  state: string;
  zip: string;
  /** Optional — attach a TrussCTR contact ID for record-keeping */
  contactId?: string;
  /** 'standard' (basic measurements) or 'premium' (full breakdown + 3D imagery) */
  reportType?: 'standard' | 'premium';
}

export interface RoofrReport {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  address: string;
  reportType: string;
  orderedAt: string;
  completedAt?: string;
  downloadUrl?: string;
  measurements?: {
    totalSquares: number;      // roofing squares (1 sq = 100 sq ft)
    totalSqFt: number;
    ridgeLength: number;       // linear feet
    hipLength: number;
    valleyLength: number;
    eaveLength: number;        // perimeter
    rakeLength: number;
    flashingLength: number;
    predominantPitch: string;  // e.g. "6/12"
    facetCount: number;
  };
}

export class RoofrIntegration {
  private apiKey: string;
  private baseUrl = 'https://api.roofr.com/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private headers(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Verify the API key works by fetching the authenticated account info.
   */
  async testConnection(): Promise<IntegrationTestResult> {
    try {
      const response = await fetch(`${this.baseUrl}/account`, {
        method: 'GET',
        headers: this.headers(),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => response.statusText);
        return {
          success: false,
          message: `Roofr API error (${response.status}): ${text}`,
          timestamp: new Date().toISOString(),
        };
      }

      const data = await response.json();
      return {
        success: true,
        message: 'Connected to Roofr successfully',
        details: {
          companyName: data.company_name ?? data.name,
          availableCredits: data.credits ?? data.report_credits,
          plan: data.plan,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Order a new roof measurement report for a property address.
   * Returns a report object — status will be 'pending' initially.
   * Poll getReport() or check the Roofr dashboard for completion.
   */
  async orderReport(order: RoofrReportOrder): Promise<RoofrReport> {
    const response = await fetch(`${this.baseUrl}/reports`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        address: order.address,
        city: order.city,
        state: order.state,
        zip: order.zip,
        report_type: order.reportType ?? 'standard',
        reference_id: order.contactId,
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      throw new Error(`Roofr order failed (${response.status}): ${text}`);
    }

    return this.normalizeReport(await response.json());
  }

  /**
   * Fetch the current status/data of a previously ordered report.
   */
  async getReport(reportId: string): Promise<RoofrReport> {
    const response = await fetch(`${this.baseUrl}/reports/${reportId}`, {
      method: 'GET',
      headers: this.headers(),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      throw new Error(`Roofr fetch failed (${response.status}): ${text}`);
    }

    return this.normalizeReport(await response.json());
  }

  /**
   * List all reports ordered by this account. Optionally filter by reference_id
   * (contact ID) to retrieve reports for a specific customer.
   */
  async listReports(contactId?: string): Promise<RoofrReport[]> {
    const params = contactId ? `?reference_id=${encodeURIComponent(contactId)}` : '';
    const response = await fetch(`${this.baseUrl}/reports${params}`, {
      method: 'GET',
      headers: this.headers(),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      throw new Error(`Roofr list failed (${response.status}): ${text}`);
    }

    const data = await response.json();
    const items: unknown[] = Array.isArray(data) ? data : (data.reports ?? data.data ?? []);
    return items.map((r) => this.normalizeReport(r));
  }

  // ── Response normaliser ────────────────────────────────────────────────────

  private normalizeReport(raw: any): RoofrReport {
    const meas = raw.measurements ?? raw.report_data ?? null;
    return {
      id: String(raw.id ?? raw.report_id ?? ''),
      status: raw.status ?? 'pending',
      address: [raw.address, raw.city, raw.state, raw.zip].filter(Boolean).join(', '),
      reportType: raw.report_type ?? raw.type ?? 'standard',
      orderedAt: raw.created_at ?? raw.ordered_at ?? new Date().toISOString(),
      completedAt: raw.completed_at ?? raw.finished_at ?? undefined,
      downloadUrl: raw.download_url ?? raw.pdf_url ?? raw.report_url ?? undefined,
      measurements: meas ? {
        totalSquares: meas.total_squares ?? meas.squares ?? 0,
        totalSqFt: meas.total_sq_ft ?? meas.square_footage ?? 0,
        ridgeLength: meas.ridge_length ?? 0,
        hipLength: meas.hip_length ?? 0,
        valleyLength: meas.valley_length ?? 0,
        eaveLength: meas.eave_length ?? meas.perimeter ?? 0,
        rakeLength: meas.rake_length ?? 0,
        flashingLength: meas.flashing_length ?? 0,
        predominantPitch: meas.predominant_pitch ?? meas.pitch ?? '—',
        facetCount: meas.facet_count ?? meas.facets ?? 0,
      } : undefined,
    };
  }
}

export default RoofrIntegration;
