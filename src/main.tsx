import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

createRoot(document.getElementById("root")!).render(
  <App />
);

// Hide Capacitor splash screen once React has rendered.
// capacitor.config.ts sets launchAutoHide: false so we must call this manually.
<<<<<<< HEAD
// Safe no-op in the browser.
=======
// Safe to call in any environment — no-ops in the browser.
>>>>>>> 0f128f711d5e12e5d6be49ea8b1d4b930247a733
window.addEventListener('load', () => {
  const cap = (window as any).Capacitor;
  if (cap?.Plugins?.SplashScreen) {
    cap.Plugins.SplashScreen.hide();
  }
});
