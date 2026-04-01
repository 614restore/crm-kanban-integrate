import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

createRoot(document.getElementById("root")!).render(
  <App />
);

// Hide Capacitor splash screen once React has rendered.
// capacitor.config.ts sets launchAutoHide: false so we must call this manually.
// Safe no-op in the browser.
window.addEventListener('load', () => {
  const cap = (window as any).Capacitor;
  if (cap?.Plugins?.SplashScreen) {
    cap.Plugins.SplashScreen.hide();
  }
});
