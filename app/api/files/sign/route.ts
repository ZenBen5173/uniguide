/**
 * GET /api/files/sign?path=...
 * Returns a short-lived signed URL for a file in the `application-files` bucket.
 * Authorization: file owner (path starts with their uid) OR staff/admin.
 */

import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/guards";
import { getServiceSupabase } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/utils/responses";

export async function GET(req: NextRequest) {
  const user = await requireUser();
  if (!user) return apiError("Not authenticated", 401);

  const path = req.nextUrl.searchParams.get("path");
  if (!path) return apiError("Missing path", 400);

  const folderUserId = path.split("/")[0];
  const isOwner = folderUserId === user.id;
  const isStaff = user.role === "staff" || user.role === "admin";
  if (!isOwner && !isStaff) return apiError("Forbidden", 403);

  const sb = getServiceSupabase();
  const { data, error } = await sb.storage
    .from("application-files")
    .createSignedUrl(path, 60);

  if (error || !data) {
    return apiError(error?.message ?? "Could not sign URL", 500);
  }

  return apiSuccess({ url: data.signedUrl });
}
