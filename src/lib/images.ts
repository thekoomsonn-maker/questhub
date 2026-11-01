/** Public URL for an object in a public storage bucket. */
export function storageUrl(bucket: "listing-images" | "avatars", path: string | null | undefined) {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${base}/storage/v1/object/public/${bucket}/${encoded}`;
}

export const listingImageUrl = (path: string | null | undefined) => storageUrl("listing-images", path);
export const avatarUrl = (path: string | null | undefined) => storageUrl("avatars", path);
