/**
 * POST /api/admin/procedures/parse-pdf
 *
 * Accepts a PDF file (multipart form-data, field name "file") and returns
 * the extracted text. Used by the admin SOP upload modal to support PDF
 * input directly instead of forcing manual paste.
 */

import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { apiError, apiSuccess } from "@/lib/utils/responses";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const user = await requireRole("admin");
  if (!user) return apiError("Admin only", 403);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return apiError("Expected multipart form-data", 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) return apiError("Missing 'file' field", 400);
  if (file.type !== "application/pdf") return apiError("Only application/pdf accepted", 400);
  if (file.size > 10 * 1024 * 1024) return apiError("PDF too large (max 10 MB)", 400);

  const buffer = Buffer.from(await file.arrayBuffer());

  // pdf-parse imports a test fixture at top-level which throws when bundled.
  // Use the lib path directly to avoid that.
  const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default as (
    data: Buffer
  ) => Promise<{ text: string; numpages: number }>;

  let result;
  try {
    result = await pdfParse(buffer);
  } catch (err) {
    return apiError(
      `PDF parse failed: ${err instanceof Error ? err.message : "unknown"}`,
      422
    );
  }

  const cleaned = result.text
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (cleaned.length < 50) {
    return apiError(
      "Extracted text is too short — the PDF may be image-only or scanned. Please paste text manually.",
      422
    );
  }

  return apiSuccess({
    text: cleaned,
    pages: result.numpages,
    filename: file.name,
    bytes: file.size,
  });
}
