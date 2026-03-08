
import React, { useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { AppProvider } from '@/contexts/AppContext';

const CheckoutHandler: React.FC = () => {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('checkout');
    const plan = params.get('plan');

    if (status === 'success') {
      const planName = plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : '';
      // Show success banner
      const banner = document.createElement('div');
      banner.id = 'checkout-success-banner';
      banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#16a34a;color:white;padding:14px 20px;z-index:9999;display:flex;align-items:center;justify-between;font-family:system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.2)';
      banner.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:20px">🎉</span>
          <div>
            <strong style="font-size:15px">Welcome to TrussCTR${planName ? ` ${planName}` : ''}!</strong>
            <p style="font-size:12px;margin:2px 0 0;opacity:0.9">Your subscription is active. You have a 14-day free trial. No charge until the trial ends.</p>
          </div>
        </div>
        <button onclick="document.getElementById('checkout-success-banner').remove()" style="background:rgba(255,255,255,0.25);border:none;color:white;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:13px">Dismiss</button>
      `;
      document.body.prepend(banner);
      setTimeout(() => banner?.remove(), 10000);

      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (status === 'cancelled') {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  return null;
};

const Index: React.FC = () => {
  return (
    <AppProvider>
      <CheckoutHandler />
      <AppLayout />
    </AppProvider>
  );
};

export default Index;
