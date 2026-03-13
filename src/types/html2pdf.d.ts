// Type declaration shim for html2pdf.js (no official @types package)
declare module 'html2pdf.js' {
  interface Html2PdfOptions {
    filename?: string;
    margin?: number | number[];
    image?: { type?: string; quality?: number };
    html2canvas?: { scale?: number; useCORS?: boolean; [key: string]: unknown };
    jsPDF?: { unit?: string; format?: string; orientation?: string; [key: string]: unknown };
    [key: string]: unknown;
  }

  interface Html2PdfInstance {
    set(options: Html2PdfOptions): Html2PdfInstance;
    from(element: HTMLElement | string): Html2PdfInstance;
    outputPdf(type: 'blob'): Promise<Blob>;
    outputPdf(type: string): Promise<unknown>;
    save(): Promise<void>;
    toPdf(): Html2PdfInstance;
    output(type: string, options?: unknown): Promise<unknown>;
  }

  function html2pdf(): Html2PdfInstance;
  function html2pdf(element: HTMLElement, options?: Html2PdfOptions): Html2PdfInstance;

  export = html2pdf;
}
