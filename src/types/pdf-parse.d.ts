declare module "pdf-parse" {
  interface TextResultPage {
    text: string;
  }

  interface TextResult {
    total: number;
    pages: TextResultPage[];
    text: string;
  }

  interface PDFParseOptions {
    data: Buffer | Uint8Array;
    verbosity?: number;
  }

  class PDFParse {
    constructor(options: PDFParseOptions);
    getText(): Promise<TextResult>;
    destroy(): Promise<void>;
  }

  export { PDFParse };
}
