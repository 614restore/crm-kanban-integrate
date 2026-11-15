import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { installNativeApiFetch } from './lib/apiOrigin'

// In the iPhone app, /api/... requests go to the live site (the app has no server of its own).
installNativeApiFetch()

createRoot(document.getElementById("root")!).render(
  <App />
);

// Hide Capacitor splash screen once React has rendered.
// capacitor.config.ts sets launchAutoHide: false so we must call this manually.
// Safe to call in any environment — no-ops in the browser.
window.addEventListener('load', () => {
  const cap = (window as any).Capacitor;
  if (cap?.Plugins?.SplashScreen) {
    cap.Plugins.SplashScreen.hide();
  }
});
