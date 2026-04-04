import { supabase } from "@/integrations/supabase/client";

function isFullUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

export async function resolveVideoUrl(
  videoUrlOrKey: string | null | undefined
): Promise<string | null> {
  if (!videoUrlOrKey) return null;

  if (isFullUrl(videoUrlOrKey)) {
    return videoUrlOrKey;
  }

  // It's a storage path — create a signed URL from the screening-videos bucket
  const { data, error } = await supabase.storage
    .from("screening-videos")
    .createSignedUrl(videoUrlOrKey, 3600);

  if (error || !data?.signedUrl) {
    throw new Error("Failed to resolve video URL");
  }

  return data.signedUrl;
}
