import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CONFIRM = process.env.DELETE_SUPABASE_BUCKETS_CONFIRM;
const BUCKETS = (process.env.SUPABASE_STORAGE_BUCKETS || "resumes,screening-videos")
  .split(",")
  .map((bucket) => bucket.trim())
  .filter(Boolean);

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this script.");
}

if (CONFIRM !== "yes") {
  throw new Error("Set DELETE_SUPABASE_BUCKETS_CONFIRM=yes to permanently delete these buckets.");
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function listFiles(bucket, prefix = "") {
  const files = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit: 100,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Error(`Could not list ${bucket}/${prefix}: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id || entry.metadata) {
        files.push(path);
      } else {
        files.push(...await listFiles(bucket, path));
      }
    }

    if (data.length < 100) break;
    offset += data.length;
  }

  return files;
}

async function removeInBatches(bucket, paths) {
  for (let index = 0; index < paths.length; index += 100) {
    const batch = paths.slice(index, index + 100);
    const { error } = await supabase.storage.from(bucket).remove(batch);
    if (error) throw new Error(`Could not remove objects from ${bucket}: ${error.message}`);
    console.log(`Removed ${Math.min(index + batch.length, paths.length)}/${paths.length} objects from ${bucket}`);
  }
}

for (const bucket of BUCKETS) {
  console.log(`Checking bucket: ${bucket}`);
  const { data: bucketInfo, error: bucketError } = await supabase.storage.getBucket(bucket);
  if (bucketError || !bucketInfo) {
    console.log(`Bucket not found or not accessible, skipping: ${bucket}`);
    continue;
  }

  const files = await listFiles(bucket);
  if (files.length > 0) {
    await removeInBatches(bucket, files);
  }

  const { error: deleteError } = await supabase.storage.deleteBucket(bucket);
  if (deleteError) throw new Error(`Could not delete bucket ${bucket}: ${deleteError.message}`);
  console.log(`Deleted bucket: ${bucket}`);
}

console.log("Done.");
