// Weather API Integrations
import { IntegrationTestResult } from './apiTypes';

/**
 * OpenWeather API Integration
 */
export class OpenWeatherIntegration {
  private apiKey: string;
  private baseUrl = 'https://api.openweathermap.org';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Test OpenWeather connection
   */
  async testConnection(): Promise<IntegrationTestResult> {
    try {
      const response = await fetch(
        `${this.baseUrl}/data/2.5/weather?q=New%20York&appid=${this.apiKey}&units=metric`,
        { method: 'GET' }
      );

      if (!response.ok) {
        return {
          success: false,
          message: `OpenWeather API error: ${response.statusText}`,
          timestamp: new Date().toISOString(),
        };
      }

      const data = await response.json();

      return {
        success: true,
        message: 'Connected to OpenWeather successfully',
        details: {
          location: `${data.name}, ${data.sys?.country}`,
          temperature: data.main?.temp,
          description: data.weather?.[0]?.description,
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
   * Get current weather by coordinates
   */
  async getCurrentWeather(lat: number, lon: number, units: 'metric' | 'imperial' = 'metric'): Promise<any> {
    try {
      const response = await fetch(
        `${this.baseUrl}/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${this.apiKey}&units=${units}`,
        { method: 'GET' }
      );

      if (!response.ok) {
        throw new Error(`Failed to get weather: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Get weather error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get current weather by city
   */
  async getWeatherByCity(city: string, units: 'metric' | 'imperial' = 'metric'): Promise<any> {
    try {
      const response = await fetch(
        `${this.baseUrl}/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${this.apiKey}&units=${units}`,
        { method: 'GET' }
      );

      if (!response.ok) {
        throw new Error(`Failed to get weather: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Get weather error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get weather forecast
   */
  async getForecast(lat: number, lon: number, units: 'metric' | 'imperial' = 'metric'): Promise<any> {
    try {
      const response = await fetch(
        `${this.baseUrl}/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${this.apiKey}&units=${units}`,
        { method: 'GET' }
      );

      if (!response.ok) {
        throw new Error(`Failed to get forecast: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Get forecast error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get air quality index
   */
  async getAirQuality(lat: number, lon: number): Promise<any> {
    try {
      const response = await fetch(
        `${this.baseUrl}/data/3.0/stations?lat=${lat}&lon=${lon}&appid=${this.apiKey}`,
        { method: 'GET' }
      );

      if (!response.ok) {
        throw new Error(`Failed to get air quality: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Get air quality error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * HailTrace Integration for Hail Damage Tracking
 */
export class HailTraceIntegration {
  private apiKey: string;
  private environment: 'sandbox' | 'production';
  private baseUrl: string;

  constructor(apiKey: string, environment: 'sandbox' | 'production' = 'production') {
    this.apiKey = apiKey;
    this.environment = environment;
    this.baseUrl = environment === 'production' ? 'https://api.hailtrace.com' : 'https://sandbox-api.hailtrace.com';
  }

  /**
   * Test HailTrace connection
   */
  async testConnection(): Promise<IntegrationTestResult> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/account`, {
        method: 'GET',
        headers: this.buildHeaders(),
      });

      if (!response.ok) {
        return {
          success: false,
          message: `HailTrace API error: ${response.statusText}`,
          timestamp: new Date().toISOString(),
        };
      }

      const data = await response.json();

      return {
        success: true,
        message: 'Connected to HailTrace successfully',
        details: {
          accountName: data.name,
          status: data.status,
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
   * Check for hail damage in area
   */
  async checkHailDamage(lat: number, lon: number, radiusMiles: number = 5): Promise<any> {
    try {
      const response = await fetch(
        `${this.baseUrl}/v1/hail-events/check?lat=${lat}&lon=${lon}&radius=${radiusMiles}`,
        {
          method: 'GET',
          headers: this.buildHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to check hail damage: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Check hail damage error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get hail events
   */
  async getHailEvents(
    startDate: string,
    endDate: string,
    severity?: 'minor' | 'moderate' | 'severe'
  ): Promise<any> {
    const params = new URLSearchParams();
    params.append('start_date', startDate);
    params.append('end_date', endDate);
    if (severity) params.append('severity', severity);

    try {
      const response = await fetch(`${this.baseUrl}/v1/hail-events?${params.toString()}`, {
        method: 'GET',
        headers: this.buildHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to get hail events: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Get hail events error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create hail alert
   */
  async createAlert(
    areaName: string,
    lat: number,
    lon: number,
    radiusMiles: number,
    severityThreshold: string
  ): Promise<any> {
    const payload = {
      area_name: areaName,
      latitude: lat,
      longitude: lon,
      radius_miles: radiusMiles,
      severity_threshold: severityThreshold,
    };

    try {
      const response = await fetch(`${this.baseUrl}/v1/alerts`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Failed to create alert: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Create alert error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List active alerts
   */
  async listAlerts(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/alerts`, {
        method: 'GET',
        headers: this.buildHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to list alerts: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`List alerts error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete alert
   */
  async deleteAlert(alertId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/alerts/${alertId}`, {
        method: 'DELETE',
        headers: this.buildHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to delete alert: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Delete alert error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private buildHeaders(): HeadersInit {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }
}

export default {
  OpenWeatherIntegration,
  HailTraceIntegration,
};
