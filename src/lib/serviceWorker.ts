// Service Worker registration and management for TrussCTR CRM PWA
// Handles SW registration, updates, and offline status

import React from 'react';

// Extend ServiceWorkerRegistration type to include sync
declare global {
  interface ServiceWorkerRegistration {
    sync?: SyncManager;
  }
  
  interface SyncManager {
    register(tag: string): Promise<void>;
    getTags(): Promise<string[]>;
  }
}

export interface SwRegistrationState {
  isRegistered: boolean;
  hasUpdate: boolean;
  isOffline: boolean;
  registration?: ServiceWorkerRegistration;
}

type SwUpdateCallback = (registration: ServiceWorkerRegistration) => void;
type SwStateCallback = (state: SwRegistrationState) => void;

class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private updateCallback: SwUpdateCallback | null = null;
  private stateCallback: SwStateCallback | null = null;
  private isOffline = false;

  constructor() {
    // Monitor online/offline status
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
    this.isOffline = !navigator.onLine;
  }

  /**
   * Register service worker with update detection
   */
  async register(): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) {
      console.warn('⚠️ Service Worker not supported');
      return null;
    }

    // Disable service worker in development
    if (import.meta.env.DEV) {
      console.log('🔧 Service Worker disabled in development mode');
      return null;
    }

    try {
      
      const base = import.meta.env.BASE_URL || '/';
      const registration = await navigator.serviceWorker.register(`${base}sw.js`, {
        scope: base
      });

      this.registration = registration;

      // Listen for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;


        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New worker is installed and ready
            this.notifyUpdate(registration);
          }
        });
      });

      // Handle controller change (after user accepts update)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });

      // Initial state notification
      this.notifyState({
        isRegistered: true,
        hasUpdate: false,
        isOffline: this.isOffline,
        registration
      });

      return registration;

    } catch (error) {
      console.error('❌ Service worker registration failed:', error);
      
      this.notifyState({
        isRegistered: false,
        hasUpdate: false,
        isOffline: this.isOffline
      });

      return null;
    }
  }

  /**
   * Update service worker when new version is available
   */
  async update(): Promise<void> {
    if (!this.registration) {
      console.warn('⚠️ No service worker registration found');
      return;
    }

    try {
      await this.registration.update();
    } catch (error) {
      console.error('❌ Service worker update check failed:', error);
    }
  }

  /**
   * Skip waiting and activate new service worker
   */
  async skipWaiting(): Promise<void> {
    if (!this.registration?.waiting) {
      console.warn('⚠️ No waiting service worker found');
      return;
    }

    try {
      
      // Send skip waiting message to the waiting service worker
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    } catch (error) {
      console.error('❌ Skip waiting failed:', error);
    }
  }

  /**
   * Register background sync for offline actions
   */
  async registerBackgroundSync(tag: string): Promise<boolean> {
    if (!this.registration) {
      console.warn('⚠️ No service worker registration for background sync');
      return false;
    }

    if (!this.registration.sync) {
      console.warn('⚠️ Background sync not supported');
      return false;
    }

    try {
      await this.registration.sync.register(tag);
      return true;
    } catch (error) {
      console.error(`❌ Background sync registration failed for ${tag}:`, error);
      return false;
    }
  }

  /**
   * Set callback for service worker updates
   */
  onUpdateAvailable(callback: SwUpdateCallback): void {
    this.updateCallback = callback;
  }

  /**
   * Set callback for state changes
   */
  onStateChange(callback: SwStateCallback): void {
    this.stateCallback = callback;
  }

  /**
   * Get current registration state
   */
  getState(): SwRegistrationState {
    return {
      isRegistered: !!this.registration,
      hasUpdate: !!(this.registration?.waiting),
      isOffline: this.isOffline,
      registration: this.registration || undefined
    };
  }

  private handleOnline(): void {
    this.isOffline = false;
    this.notifyState(this.getState());

    // Trigger sync when coming back online
    if (this.registration) {
      this.registerBackgroundSync('background-sync-data');
      this.registerBackgroundSync('background-sync-photos');
    }
  }

  private handleOffline(): void {
    this.isOffline = true;
    this.notifyState(this.getState());
  }

  private notifyUpdate(registration: ServiceWorkerRegistration): void {
    if (this.updateCallback) {
      this.updateCallback(registration);
    }

    this.notifyState(this.getState());
  }

  private notifyState(state: SwRegistrationState): void {
    if (this.stateCallback) {
      this.stateCallback(state);
    }
  }
}

// Create singleton instance
export const swManager = new ServiceWorkerManager();

// Helper functions for easier usage
export const registerServiceWorker = () => swManager.register();
export const updateServiceWorker = () => swManager.update();
export const skipWaitingServiceWorker = () => swManager.skipWaiting();
export const registerBackgroundSync = (tag: string) => swManager.registerBackgroundSync(tag);

// React hook for service worker state
export function useServiceWorker() {
  const [state, setState] = React.useState<SwRegistrationState>(swManager.getState());

  React.useEffect(() => {
    // Set up state listener
    swManager.onStateChange(setState);

    // Register service worker on mount (disabled in dev)
    if (!import.meta.env.DEV) {
      registerServiceWorker();
    }

    // Check for updates periodically (every 30 minutes)
    const updateInterval = setInterval(() => {
      updateServiceWorker();
    }, 30 * 60 * 1000);

    return () => {
      clearInterval(updateInterval);
    };
  }, []);

  const handleUpdate = React.useCallback(() => {
    skipWaitingServiceWorker();
  }, []);

  return {
    ...state,
    updateAvailable: state.hasUpdate,
    activateUpdate: handleUpdate
  };
}

export default swManager;
