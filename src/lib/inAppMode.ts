import type { ViewType } from './crmStore';
import type { BoardType } from './crmData';

// The TrussCENTER phone app opens web tools it has no native screen for inside
// its own screen, e.g. /?in_app=1&view=invoices or /?in_app=1&view=pipeline&board=billing.
// In that mode the web shows just the one tool: the app supplies the header,
// back button and tab bar, so the web's own menus are hidden.

const IN_APP_KEY = 'trusscenter_in_app';

const VIEWS: ViewType[] = [
  'dashboard', 'pipeline', 'contacts', 'communications', 'calendar', 'documents',
  'financial', 'invoices', 'expenses', 'team', 'automations', 'settings', 'suppliers',
  'quotes', 'storm-search', 'work-orders', 'material-orders', 'reports', 'ai-assistant',
  'insurance-tracking', 'supplement-tracking', 'crew-schedule', 'equipment',
  'commission-payroll', 'sales-analytics', 'inspections',
];
const BOARDS: BoardType[] = ['sales', 'production', 'billing'];

function readStart() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('in_app') === '1') sessionStorage.setItem(IN_APP_KEY, '1');
    const inApp = sessionStorage.getItem(IN_APP_KEY) === '1';
    const view = params.get('view') as ViewType | null;
    const board = params.get('board') as BoardType | null;
    return {
      inApp,
      view: inApp && view && VIEWS.includes(view) ? view : null,
      board: inApp && board && BOARDS.includes(board) ? board : null,
    };
  } catch {
    return { inApp: false, view: null, board: null };
  }
}

const start = readStart();

/** True when running inside the TrussCENTER app. */
export const IN_APP = start.inApp;
/** The tool the app asked to open, if any. */
export const inAppStartView: ViewType | null = start.view;
/** For the boards: which board (by type) the app asked for. */
export const inAppStartBoard: BoardType | null = start.board;

/** Tells the TrussCENTER app something happened (e.g. the web sign-in ran out). */
export function notifyApp(type: string) {
  try {
    (window as any).ReactNativeWebView?.postMessage(JSON.stringify({ source: 'trussctr-web', type }));
  } catch { /* not inside the app */ }
}
