// Minimal ambient shim so TypeScript doesn't error on the dynamic import path.
// html2pdf.js has no @types package; Vite resolves the CJS bundle at runtime.
declare module 'html2pdf.js' {
  interface Html2PdfWorker {
    set(options: Record<string, unknown>): Html2PdfWorker;
    from(element: HTMLElement | string): Html2PdfWorker;
    outputPdf(type: 'blob'): Promise<Blob>;
    outputPdf(type: string): Promise<unknown>;
    save(): Promise<void>;
  }
  function html2pdf(): Html2PdfWorker;
  export = html2pdf;
}
