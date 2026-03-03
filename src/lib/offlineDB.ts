import Dexie, { Table } from 'dexie';
import type { Contact, CustomerStatus, Job } from './crmData';

// Offline-optimized contact interface
export interface OfflineContact {
  id: string;
  company_id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  status: CustomerStatus;
  insurance_company?: string;
  policy_number?: string;
  claim_number?: string;
  project_type?: string;
  project_value?: number;
  lead_source?: string;
  tags?: string[];
  notes?: string;
  last_synced: number;
  is_dirty: boolean; // Has local changes not synced
  created_offline?: boolean;
}

// Offline job interface
export interface OfflineJob {
  id: string;
  contact_id: string;
  title: string;
  status: string;
  estimated_value?: number;
  notes?: string;
  last_synced: number;
  is_dirty: boolean;
  created_offline?: boolean;
}

// Offline photo interface
export interface OfflinePhoto {
  id: string;
  temp_id?: string; // For offline-created photos
  job_id?: string;
  contact_id: string;
  user_id: string;
  category: 'before' | 'during' | 'after' | 'damage';
  damage_type?: 'roof' | 'siding' | 'gutter' | 'window' | 'interior';
  room?: string;
  timestamp: number;
  gps_coords?: { lat: number; lng: number; accuracy?: number };
  stage?: CustomerStatus;
  annotations?: Array<{ x: number; y: number; note: string }>;
  local_blob?: Blob; // Store image data offline
  storage_path?: string;
  thumbnail_path?: string;
  file_size?: number;
  mime_type?: string;
  uploaded: boolean;
  upload_progress?: number;
  upload_error?: string;
  created_offline?: boolean;
}

// Sync queue for offline actions
export interface SyncQueueItem {
  id?: string;
  table_name: string;
  record_id: string;
  action: 'create' | 'update' | 'delete';
  data: any;
  created_at: number;
  retry_count: number;
  last_error?: string;
  priority: 'high' | 'medium' | 'low';
}

// Network status tracking
export interface NetworkStatus {
  id: number;
  is_online: boolean;
  last_online: number;
  last_sync: number;
  pending_uploads: number;
}

class OfflineDatabase extends Dexie {
  contacts!: Table<OfflineContact>;
  jobs!: Table<OfflineJob>;
  photos!: Table<OfflinePhoto>;
  sync_queue!: Table<SyncQueueItem>;
  network_status!: Table<NetworkStatus>;

  constructor() {
    super('StormCraftOfflineDB');
    
    this.version(1).stores({
      contacts: 'id, company_id, status, last_synced, is_dirty, created_offline',
      jobs: 'id, contact_id, status, last_synced, is_dirty, created_offline',
      photos: 'id, contact_id, job_id, category, uploaded, created_offline, timestamp',
      sync_queue: '++id, table_name, record_id, created_at, priority',
      network_status: 'id, is_online, last_online, last_sync'
    });
  }

  // Helper method to add items to sync queue
  async addToSyncQueue(
    tableName: string, 
    recordId: string, 
    action: SyncQueueItem['action'], 
    data: any,
    priority: SyncQueueItem['priority'] = 'medium'
  ) {
    await this.sync_queue.add({
      table_name: tableName,
      record_id: recordId,
      action,
      data,
      created_at: Date.now(),
      retry_count: 0,
      priority
    });
  }

  // Helper method to update network status
  async updateNetworkStatus(isOnline: boolean) {
    const now = Date.now();
    await this.network_status.clear();
    await this.network_status.add({
      id: 1,
      is_online: isOnline,
      last_online: isOnline ? now : (await this.getLastOnlineTime()),
      last_sync: isOnline ? now : (await this.getLastSyncTime()),
      pending_uploads: await this.getPendingUploadsCount()
    });
  }

  // Get pending uploads count
  async getPendingUploadsCount(): Promise<number> {
    return await this.photos.where('uploaded').equals(0).count();
  }

  // Get last online time
  async getLastOnlineTime(): Promise<number> {
    const status = await this.network_status.get(1);
    return status?.last_online || Date.now();
  }

  // Get last sync time
  async getLastSyncTime(): Promise<number> {
    const status = await this.network_status.get(1);
    return status?.last_sync || Date.now();
  }

  // Clear all data (useful for logout)
  async clearAllData() {
    await this.contacts.clear();
    await this.jobs.clear();
    await this.photos.clear();
    await this.sync_queue.clear();
    await this.network_status.clear();
  }

  // Get storage size estimate
  async getStorageSize(): Promise<number> {
    let size = 0;
    const photos = await this.photos.toArray();
    
    for (const photo of photos) {
      if (photo.local_blob) {
        size += photo.local_blob.size;
      }
    }
    
    return size;
  }
}

// Create and export database instance
export const offlineDB = new OfflineDatabase();

// Database initialization
export const initializeOfflineDB = async () => {
  try {
    await offlineDB.open();
    console.log('✅ Offline database initialized successfully');
    
    // Initialize network status if not exists
    const status = await offlineDB.network_status.get(1);
    if (!status) {
      await offlineDB.updateNetworkStatus(navigator.onLine);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize offline database:', error);
    return false;
  }
};