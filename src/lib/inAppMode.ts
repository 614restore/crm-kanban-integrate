import type { ViewType } from './crmStore';
import type { BoardType } from './crmData';

// The TrussCENTER phone app opens web tools it has no native screen for inside
// its own screen, e.g. /?in_app=1&view=invoices, /?in_app=1&view=pipeline&board=billing,
// or a customer's full page: /?in_app=1&view=contact-detail&contact=<customer id>.
// In that mode the web shows just the one tool: the app supplies the header,
// back button and tab bar, so the web's own menus are hidden.

const IN_APP_KEY = 'trusscenter_in_app';

const VIEWS: ViewType[] = [
  'dashboard', 'pipeline', 'contacts', 'communications', 'calendar', 'documents',
  'financial', 'invoices', 'expenses', 'team', 'automations', 'settings', 'suppliers',
  'quotes', 'storm-search', 'work-orders', 'material-orders', 'reports', 'ai-assistant',
  'insurance-tracking', 'supplement-tracking', 'crew-schedule', 'equipment',
  'commission-payroll', 'sales-analytics', 'inspections', 'projects', 'document-templates',
  'contact-detail',
];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BOARDS: BoardType[] = ['sales', 'production', 'billing'];

function readStart() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('in_app') === '1') sessionStorage.setItem(IN_APP_KEY, '1');
    const inApp = sessionStorage.getItem(IN_APP_KEY) === '1';
    const view = params.get('view') as ViewType | null;
    const board = params.get('board') as BoardType | null;
    const contact = params.get('contact');
    const contactId = inApp && contact && UUID.test(contact) ? contact : null;
    const wanted = inApp && view && VIEWS.includes(view) ? view : null;
    return {
      inApp,
      // A customer's page needs the customer; without one, open the customer list.
      view: wanted === 'contact-detail' && !contactId ? 'contacts' as ViewType : wanted,
      board: inApp && board && BOARDS.includes(board) ? board : null,
      contactId,
    };
  } catch {
    return { inApp: false, view: null, board: null, contactId: null };
  }
}

const start = readStart();

/** True when running inside the TrussCENTER app. */
export const IN_APP = start.inApp;

/** True in TrussCTR's own iPhone/Android app (the Capacitor build), not in a browser. */
export const IS_NATIVE_APP: boolean = (() => {
  try {
    return typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
})();

/**
 * App Store rules (3.1.1) don't allow an app to sell its own subscription through a web checkout,
 * or to point people to one. In either app, plans, prices and checkout buttons stay hidden; people
 * sign up and manage billing on the website.
 */
export const HIDE_PURCHASES = IN_APP || IS_NATIVE_APP;
/** The tool the app asked to open, if any. */
export const inAppStartView: ViewType | null = start.view;
/** For the boards: which board (by type) the app asked for. */
export const inAppStartBoard: BoardType | null = start.board;
/** For a customer's page: which customer the app asked for. */
export const inAppStartContactId: string | null = start.contactId;

/** Tells the TrussCENTER app something happened (e.g. the web sign-in ran out). */
export function notifyApp(type: string) {
  try {
    (window as any).ReactNativeWebView?.postMessage(JSON.stringify({ source: 'trussctr-web', type }));
  } catch { /* not inside the app */ }
}
