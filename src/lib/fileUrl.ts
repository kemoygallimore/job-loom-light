import { supabase } from "@/integrations/supabase/client";

function isFullUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

export async function resolveFileUrl(
  fileUrlOrKey: string | null | undefined
): Promise<string | null> {
  if (!fileUrlOrKey) return null;

  if (isFullUrl(fileUrlOrKey)) {
    return fileUrlOrKey;
  }

  // It's a storage path — create a signed URL from the resumes bucket
  const { data, error } = await supabase.storage
    .from("resumes")
    .createSignedUrl(fileUrlOrKey, 3600);

  if (error || !data?.signedUrl) {
    throw new Error("Failed to resolve file URL");
  }

  return data.signedUrl;
}
