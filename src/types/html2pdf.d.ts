// Type declaration shim for html2pdf.js (no @types package on npm)
declare module 'html2pdf.js' {
  interface Html2PdfOptions {
    filename?: string;
    margin?: number | number[];
    image?: { type?: string; quality?: number };
    html2canvas?: { scale?: number; useCORS?: boolean; [key: string]: unknown };
    jsPDF?: { unit?: string; format?: string; orientation?: string; [key: string]: unknown };
    [key: string]: unknown;
  }

  interface Html2PdfWorker {
    set(options: Html2PdfOptions): Html2PdfWorker;
    from(element: HTMLElement | string): Html2PdfWorker;
    outputPdf(type: 'blob'): Promise<Blob>;
    outputPdf(type: string): Promise<unknown>;
    save(): Promise<void>;
    toPdf(): Html2PdfWorker;
    output(type: string, options?: unknown): Promise<unknown>;
  }

  // The lib exports a function that returns a worker chain
  function html2pdf(): Html2PdfWorker;
  function html2pdf(element: HTMLElement, options?: Html2PdfOptions): Html2PdfWorker;

  export = html2pdf;
}
