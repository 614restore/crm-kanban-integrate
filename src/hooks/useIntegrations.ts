// useIntegrations React Hook
import { useCallback, useEffect, useState } from 'react';
import { BaseIntegration, IntegrationTestResult, IntegrationSyncResult } from '@/lib/integrations/apiTypes';
import { integrationManager } from '@/lib/integrations/manager';

export interface UseIntegrationsReturn {
  integrations: BaseIntegration[];
  integrationsByCategory: Record<string, BaseIntegration[]>;
  loading: boolean;
  error: string | null;
  getIntegration: (id: string) => BaseIntegration | undefined;
  configureIntegration: (id: string, credentials: Record<string, any>, settings: Record<string, any>) => Promise<void>;
  toggleIntegration: (id: string, enabled: boolean) => Promise<void>;
  testIntegration: (id: string, credentials?: Record<string, any>) => Promise<IntegrationTestResult>;
  syncIntegration: (id: string) => Promise<IntegrationSyncResult>;
  setupAutoSync: (id: string, intervalMinutes?: number) => void;
  getHealth: () => Record<string, any>;
  exportStatus: () => Record<string, any>;
  resetAll: () => Promise<void>;
  refresh: () => void;
}

/**
 * React hook for managing CRM integrations
 */
export function useIntegrations(): UseIntegrationsReturn {
  const [integrations, setIntegrations] = useState<BaseIntegration[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize integrations on mount
  useEffect(() => {
    refresh();
  }, []);

  /**
   * Refresh integrations list
   */
  const refresh = useCallback(() => {
    try {
      const allIntegrations = integrationManager.getAllIntegrations();
      setIntegrations(allIntegrations);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load integrations');
    }
  }, []);

  /**
   * Get integrations by category
   */
  const integrationsByCategory = useCallback((): Record<string, BaseIntegration[]> => {
    return integrationManager.getIntegrationsByCategory();
  }, []);

  /**
   * Get single integration
   */
  const getIntegration = useCallback((id: string): BaseIntegration | undefined => {
    return integrationManager.getIntegration(id);
  }, []);

  /**
   * Configure integration
   */
  const configureIntegration = useCallback(
    async (id: string, credentials: Record<string, any>, settings: Record<string, any>) => {
      setLoading(true);
      setError(null);
      try {
        await integrationManager.configureIntegration(id, credentials, settings);
        refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to configure integration';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [refresh]
  );

  /**
   * Toggle integration
   */
  const toggleIntegration = useCallback(
    async (id: string, enabled: boolean) => {
      setLoading(true);
      setError(null);
      try {
        await integrationManager.toggleIntegration(id, enabled);
        refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to toggle integration';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [refresh]
  );

  /**
   * Test integration
   */
  const testIntegration = useCallback(
    async (id: string, credentials?: Record<string, any>): Promise<IntegrationTestResult> => {
      setLoading(true);
      setError(null);
      try {
        const result = await integrationManager.testIntegration(id, credentials);
        if (!result.success) {
          setError(result.message);
        }
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to test integration';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Sync integration
   */
  const syncIntegration = useCallback(
    async (id: string): Promise<IntegrationSyncResult> => {
      setLoading(true);
      setError(null);
      try {
        const result = await integrationManager.syncIntegration(id);
        if (!result.success) {
          setError(result.errors.join(', '));
        }
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to sync integration';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Setup auto-sync
   */
  const setupAutoSync = useCallback((id: string, intervalMinutes: number = 60) => {
    integrationManager.setupAutoSync(id, intervalMinutes);
  }, []);

  /**
   * Get integration health
   */
  const getHealth = useCallback(() => {
    return integrationManager.getIntegrationHealth();
  }, []);

  /**
   * Export status
   */
  const exportStatus = useCallback(() => {
    return integrationManager.exportStatus();
  }, []);

  /**
   * Reset all integrations
   */
  const resetAll = useCallback(async () => {
    setLoading(true);
    try {
      await integrationManager.resetAllIntegrations();
      refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reset integrations';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  return {
    integrations,
    integrationsByCategory: integrationsByCategory(),
    loading,
    error,
    getIntegration,
    configureIntegration,
    toggleIntegration,
    testIntegration,
    syncIntegration,
    setupAutoSync,
    getHealth,
    exportStatus,
    resetAll,
    refresh,
  };
}

export default useIntegrations;
