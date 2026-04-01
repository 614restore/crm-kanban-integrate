/**
 * Standardized Status Definitions
 * 
 * CRITICAL: Use these constants consistently across ALL components
 * to ensure analytics, commissions, and business logic work correctly.
 * 
 * DO NOT hardcode status strings like 'completed' || 'paid' in components.
 */

import { CustomerStatus } from './types/supabase';

/**
 * Statuses that represent a SOLD/WON deal
 * Used for: win rate calculations, commission triggers, revenue reporting
 */
export const SOLD_STATUSES: readonly CustomerStatus[] = [
  'signed',
  'approved',
  'ordering_material',
  'scheduled',
  'in_progress',
  'build_phase',
  'cleanup',
  'punch_list',
  'invoicing',
  'pending_payment',
  'completed',
  'paid',
] as const;

/**
 * Statuses that represent a LOST deal
 * Used for: conversion rate calculations, loss analysis
 */
export const LOST_STATUSES: readonly CustomerStatus[] = [
  'lost',
  'declined',
] as const;

/**
 * Statuses that are COMMISSIONABLE
 * Used for: commission calculations in CommissionPayrollView
 */
export const COMMISSIONABLE_STATUSES: readonly CustomerStatus[] = [
  'signed',
  'approved',
  'in_progress',
  'build_phase',
  'cleanup',
  'invoicing',
  'pending_payment',
  'completed',
  'paid',
] as const;

/**
 * Statuses representing active PROSPECTS (not yet sold or lost)
 * Used for: pipeline value, active lead tracking
 */
export const PROSPECT_STATUSES: readonly CustomerStatus[] = [
  'lead',
  'contacted',
  'appointment_set',
  'inspection_scheduled',
  'inspected',
  'inspection_complete',
  'estimating',
  'estimate_sent',
  'follow_up',
  'retail',
  'claim_filed',
  'adjuster_scheduled',
  'supplement_filed',
] as const;

/**
 * Check if a status represents a sold/won deal
 */
export function isSoldStatus(status: string): boolean {
  return (SOLD_STATUSES as readonly string[]).includes(status);
}

/**
 * Check if a status represents a lost deal
 */
export function isLostStatus(status: string): boolean {
  return (LOST_STATUSES as readonly string[]).includes(status);
}

/**
 * Check if a status is commissionable
 */
export function isCommissionableStatus(status: string): boolean {
  return (COMMISSIONABLE_STATUSES as readonly string[]).includes(status);
}

/**
 * Check if a status represents an active prospect
 */
export function isProspectStatus(status: string): boolean {
  return (PROSPECT_STATUSES as readonly string[]).includes(status);
}

/**
 * Get conversion rate (sold / (sold + lost))
 */
export function getConversionRate(soldCount: number, lostCount: number): number {
  const total = soldCount + lostCount;
  return total > 0 ? (soldCount / total) * 100 : 0;
}

/**
 * Normalize lead source string for consistent matching
 * Handles variations like "Self-Generated", "Self Generated", "self-gen", etc.
 */
export function normalizeLeadSource(source: string | null | undefined): string {
  if (!source) return 'Unknown';
  const normalized = source.toLowerCase().trim();
  
  if (normalized.includes('self') && (normalized.includes('gen') || normalized.includes('generated'))) {
    return 'Self-Generated';
  }
  if (normalized === 'referral' || normalized.includes('referred')) {
    return 'Referral';
  }
  
  // Return original with proper casing for known sources
  return source.charAt(0).toUpperCase() + source.slice(1);
}
