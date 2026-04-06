// pdfjsCapacitorWorker.ts
// Imported dynamically on Capacitor iOS before any PDF parsing.
//
// pdfjs v4 checks globalThis.pdfjsWorker?.WorkerMessageHandler at Worker
// initialisation time. When it is set, pdfjs skips Web Worker creation
// entirely and runs the whole PDF pipeline on the main thread instead.
// That bypasses every flavour of Worker / dynamic-import that WKWebView
// restricts under the capacitor:// custom URL scheme.
//
// This file is processed by Vite at build time into a normal bundled chunk
// served from capacitor://localhost/assets/... — loading it via a dynamic
// import() is reliable because it is a same-origin, pre-bundled JS file.

import { WorkerMessageHandler } from 'pdfjs-dist/build/pdf.worker.mjs';

// Assign to globalThis so pdfjs v4 detects it via:
//   static get #mainThreadWorkerMessageHandler() {
//     return globalThis.pdfjsWorker?.WorkerMessageHandler ?? null;
//   }
if (!(globalThis as any).pdfjsWorker?.WorkerMessageHandler) {
  (globalThis as any).pdfjsWorker = {
    ...(globalThis as any).pdfjsWorker,
    WorkerMessageHandler,
  };
}
