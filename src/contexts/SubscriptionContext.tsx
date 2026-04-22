/**
 * SubscriptionContext
 *
 * Provides `isExpiredReadOnly` — true when a company's trial has ended or their
 * subscription is canceled / past-due. Components use this to hide write actions
 * while still allowing read + export access.
 */
import React, { createContext, useContext } from 'react';

interface SubscriptionContextType {
  /** When true the user can view / export data but cannot create, edit, or delete. */
  isExpiredReadOnly: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType>({
  isExpiredReadOnly: false,
});

export function useSubscription() {
  return useContext(SubscriptionContext);
}

export const SubscriptionProvider = SubscriptionContext.Provider;
