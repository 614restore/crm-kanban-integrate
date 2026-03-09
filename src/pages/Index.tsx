
import React, { useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { AppProvider } from '@/contexts/AppContext';

const CheckoutHandler: React.FC = () => {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('checkout');
    const plan = params.get('plan');

    if (status === 'success') {
      // Allowlist plan names to prevent XSS via ?plan= URL param
      const ALLOWED_PLANS = ['starter', 'pro', 'business', 'enterprise'];
      const planRaw = (plan || '').toLowerCase().trim();
      const planName = ALLOWED_PLANS.includes(planRaw)
        ? planRaw.charAt(0).toUpperCase() + planRaw.slice(1)
        : '';

      // Build banner with safe DOM methods — no innerHTML to avoid XSS
      const banner = document.createElement('div');
      banner.id = 'checkout-success-banner';
      banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#16a34a;color:white;padding:14px 20px;z-index:9999;display:flex;align-items:center;justify-content:space-between;font-family:system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.2)';

      const left = document.createElement('div');
      left.style.cssText = 'display:flex;align-items:center;gap:10px';

      const emoji = document.createElement('span');
      emoji.style.fontSize = '20px';
      emoji.textContent = '🎉';

      const textWrap = document.createElement('div');
      const heading = document.createElement('strong');
      heading.style.fontSize = '15px';
      heading.textContent = `Welcome to TrussCTR${planName ? ` ${planName}` : ''}!`;
      const sub = document.createElement('p');
      sub.style.cssText = 'font-size:12px;margin:2px 0 0;opacity:0.9';
      sub.textContent = 'Your subscription is active. You have a 14-day free trial. No charge until the trial ends.';
      textWrap.appendChild(heading);
      textWrap.appendChild(sub);

      left.appendChild(emoji);
      left.appendChild(textWrap);

      const dismiss = document.createElement('button');
      dismiss.style.cssText = 'background:rgba(255,255,255,0.25);border:none;color:white;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:13px';
      dismiss.textContent = 'Dismiss';
      dismiss.addEventListener('click', () => banner.remove());

      banner.appendChild(left);
      banner.appendChild(dismiss);

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
