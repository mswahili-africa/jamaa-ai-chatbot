import path from "path";
import type { Options, Result } from "pdf-parse";

// Type for the actual pdf-parse function (not the module)
type PdfParseFunction = (dataBuffer: Buffer, options?: Options) => Promise<Result>;

let pdfParse: PdfParseFunction | null = null;

async function getPdfParser(): Promise<PdfParseFunction> {
  if (!pdfParse) {
    // Import the module and extract the default export
    const pdfModule = await import("pdf-parse");
    pdfParse = pdfModule.default;
  }
  return pdfParse;
}

export async function extractPDFTextFromFile(fileName: string): Promise<string> {
  if (process.env.NEXT_PHASE === "phase-production-build") {
    console.warn("PDF processing disabled during build");
    return "";
  }

  if (!fileName.endsWith(".pdf")) {
    throw new Error("Only PDF files are supported");
  }

  try {
    const [{ readFile }, pdf] = await Promise.all([
      import("fs/promises"),
      getPdfParser()
    ]);

    const filePath = path.join(process.cwd(), "public/documents", fileName);
    const fileBuffer = await readFile(filePath);

    if (fileBuffer.length > 5 * 1024 * 1024) {
      throw new Error("PDF file too large (max 5MB)");
    }

    const data = await pdf(fileBuffer, {
      max: 10,
      pagerender: renderPageOptimized
    });

    return cleanPDFText(data.text);
  } catch (error) {
    console.error(`PDF processing failed for ${fileName}:`, error);
    return "";
  }
}

// Optimized page rendering
async function renderPageOptimized(pageData: any): Promise<string> {
  return pageData.getTextContent({
    normalizeWhitespace: true,
    disableCombineTextItems: false
  }).then((textContent: any) => {
    return textContent.items
      .map((item: any) => item.str.trim())
      .filter(Boolean)
      .join(" ");
  });
}

// Enhanced text cleaning
function cleanPDFText(text: string): string {
  return text
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "") // Remove control chars
    .replace(/(\r\n|\n|\r)+/g, "\n") // Normalize newlines
    .replace(/\s+/g, " ") // Collapse whitespace
    .replace(/(\w+)-\s+(\w+)/g, "$1$2") // Fix hyphenated words
    .substring(0, 50000) // Limit size
    .trim();
}