import { supabase } from './supabase';
import { offlineDB, SyncQueueItem, OfflineContact, OfflineJob, OfflinePhoto } from './offlineDB';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'success';

interface SyncError {
  message: string;
  item: SyncQueueItem;
  timestamp: number;
}

class SyncEngine {
  private isRunning = false;
  private onStatusChange?: (status: SyncStatus) => void;
  private onProgressChange?: (current: number, total: number) => void;
  private onErrorChange?: (errors: SyncError[]) => void;

  setCallbacks(
    onStatusChange?: (status: SyncStatus) => void,
    onProgressChange?: (current: number, total: number) => void,
    onErrorChange?: (errors: SyncError[]) => void
  ) {
    this.onStatusChange = onStatusChange;
    this.onProgressChange = onProgressChange;
    this.onErrorChange = onErrorChange;
  }

  async startSync(): Promise<boolean> {
    if (this.isRunning || !navigator.onLine) {
      return false;
    }

    this.isRunning = true;
    this.onStatusChange?.('syncing');

    try {
      // Get all items from sync queue
      const queueItems = await offlineDB.sync_queue
        .orderBy('created_at')
        .toArray();

      if (queueItems.length === 0) {
        this.onStatusChange?.('success');
        return true;
      }

      console.log(`📤 Starting sync of ${queueItems.length} items`);

      let processedCount = 0;
      const errors: SyncError[] = [];

      // Process queue items in batches to avoid overwhelming the server
      const batchSize = 5;
      for (let i = 0; i < queueItems.length; i += batchSize) {
        const batch = queueItems.slice(i, i + batchSize);
        
        await Promise.allSettled(
          batch.map(async (item) => {
            try {
              await this.syncItem(item);
              await offlineDB.sync_queue.delete(item.id!);
              processedCount++;
            } catch (error) {
              console.error('Sync item failed:', error);
              errors.push({
                message: error instanceof Error ? error.message : 'Unknown error',
                item,
                timestamp: Date.now()
              });

              // Increment retry count
              await offlineDB.sync_queue.update(item.id!, {
                retry_count: item.retry_count + 1,
                last_error: error instanceof Error ? error.message : 'Unknown error'
              });
            }

            this.onProgressChange?.(processedCount, queueItems.length);
          })
        );

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Update network status
      await offlineDB.updateNetworkStatus(true);

      if (errors.length > 0) {
        this.onErrorChange?.(errors);
        this.onStatusChange?.('error');
        return false;
      } else {
        this.onStatusChange?.('success');
        return true;
      }

    } catch (error) {
      console.error('Sync failed:', error);
      this.onStatusChange?.('error');
      return false;
    } finally {
      this.isRunning = false;
    }
  }

  private async syncItem(item: SyncQueueItem): Promise<void> {
    const { table_name, record_id, action, data } = item;

    try {
      switch (action) {
        case 'create':
          await this.handleCreate(table_name, data);
          break;
        case 'update':
          await this.handleUpdate(table_name, record_id, data);
          break;
        case 'delete':
          await this.handleDelete(table_name, record_id);
          break;
      }
    } catch (error) {
      // If it's a 409 conflict, try to resolve it
      if (error instanceof Error && error.message.includes('409')) {
        await this.resolveConflict(table_name, record_id, data);
      } else {
        throw error;
      }
    }
  }

  private async handleCreate(tableName: string, data: any): Promise<void> {
    // Remove temp IDs and offline flags
    const cleanData = { ...data };
    if (cleanData.temp_id) delete cleanData.temp_id;
    if (cleanData.created_offline) delete cleanData.created_offline;
    if (cleanData.is_dirty) delete cleanData.is_dirty;
    if (cleanData.last_synced) delete cleanData.last_synced;

    const { error } = await supabase
      .from(tableName)
      .insert(cleanData);

    if (error) throw error;
  }

  private async handleUpdate(tableName: string, recordId: string, data: any): Promise<void> {
    // Remove offline-specific fields
    const cleanData = { ...data };
    if (cleanData.is_dirty) delete cleanData.is_dirty;
    if (cleanData.last_synced) delete cleanData.last_synced;
    if (cleanData.created_offline) delete cleanData.created_offline;

    const { error } = await supabase
      .from(tableName)
      .update(cleanData)
      .eq('id', recordId);

    if (error) throw error;
  }

  private async handleDelete(tableName: string, recordId: string): Promise<void> {
    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq('id', recordId);

    if (error) throw error;
  }

  private async resolveConflict(tableName: string, recordId: string, localData: any): Promise<void> {
    // Fetch current server version
    const { data: serverData, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('id', recordId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      throw error;
    }

    if (!serverData) {
      // Record doesn't exist on server, create it
      await this.handleCreate(tableName, localData);
      return;
    }

    // Simple conflict resolution: last-write-wins based on updated_at
    const serverTime = new Date(serverData.updated_at).getTime();
    const localTime = localData.updated_at ? new Date(localData.updated_at).getTime() : Date.now();

    if (localTime > serverTime) {
      // Local version is newer, update server
      await this.handleUpdate(tableName, recordId, localData);
    } else {
      // Server version is newer, update local database
      await this.updateLocalRecord(tableName, recordId, serverData);
    }
  }

  private async updateLocalRecord(tableName: string, recordId: string, serverData: any): Promise<void> {
    // Update the local database with server data
    switch (tableName) {
      case 'contacts':
        await offlineDB.contacts.update(recordId, {
          ...serverData,
          last_synced: Date.now(),
          is_dirty: false
        });
        break;
      case 'jobs':
        await offlineDB.jobs.update(recordId, {
          ...serverData,
          last_synced: Date.now(),
          is_dirty: false
        });
        break;
      case 'photos':
        await offlineDB.photos.update(recordId, {
          ...serverData,
          last_synced: Date.now(),
          uploaded: true
        });
        break;
    }
  }

  // Method to sync down updates from server
  async pullUpdatesFromServer(companyId: string): Promise<void> {
    if (!navigator.onLine) return;

    try {
      // Get last sync timestamp
      const lastSync = await offlineDB.getLastSyncTime();
      const lastSyncDate = new Date(lastSync).toISOString();

      // Fetch contacts updated since last sync
      const { data: contacts } = await supabase
        .from('contacts')
        .select('*')
        .eq('company_id', companyId)
        .gt('updated_at', lastSyncDate);

      // Fetch jobs updated since last sync  
      const { data: jobs } = await supabase
        .from('jobs')
        .select('*')
        .eq('company_id', companyId)
        .gt('updated_at', lastSyncDate);

      // Update local database
      if (contacts && contacts.length > 0) {
        for (const contact of contacts) {
          await offlineDB.contacts.put({
            ...contact,
            last_synced: Date.now(),
            is_dirty: false,
            created_offline: false
          });
        }
      }

      if (jobs && jobs.length > 0) {
        for (const job of jobs) { 
          await offlineDB.jobs.put({
            ...job,
            last_synced: Date.now(),
            is_dirty: false,
            created_offline: false
          });
        }
      }

      console.log(`📥 Pulled ${(contacts?.length || 0) + (jobs?.length || 0)} updates from server`);

    } catch (error) {
      console.error('Failed to pull updates from server:', error);
    }
  }
}

// Create singleton sync engine instance
export const syncEngine = new SyncEngine();

// React hook for using sync functionality
export function useOfflineSync() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const [syncErrors, setSyncErrors] = useState<SyncError[]>([]);

  // Set up sync engine callbacks
  useEffect(() => {
    syncEngine.setCallbacks(
      setSyncStatus,
      (current, total) => setSyncProgress({ current, total }),
      setSyncErrors
    );
  }, []);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Automatically start sync when coming back online
      startSync();
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus('idle');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const startSync = useCallback(async () => {
    if (!isOnline || syncStatus === 'syncing') {
      return false;
    }

    const success = await syncEngine.startSync();
    
    if (success) {
      toast.success('Sync completed successfully');
    } else if (syncErrors.length > 0) {
      toast.error(`Sync completed with ${syncErrors.length} errors`);
    }

    return success;
  }, [isOnline, syncStatus, syncErrors.length]);

  // Function to add item to sync queue
  const addToSyncQueue = useCallback(async (
    tableName: string,
    recordId: string,
    action: SyncQueueItem['action'],
    data: any,
    priority: SyncQueueItem['priority'] = 'medium'
  ) => {
    await offlineDB.addToSyncQueue(tableName, recordId, action, data, priority);
    
    // If online, trigger immediate sync
    if (isOnline && syncStatus === 'idle') {
      startSync();
    }
  }, [isOnline, syncStatus, startSync]);

  return {
    syncStatus,
    isOnline,
    syncProgress,
    syncErrors,
    startSync,
    addToSyncQueue
  };
}