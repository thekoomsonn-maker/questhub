"use client";

import { site } from "@/config/site";
import { createClient } from "@/lib/supabase/client";

export type UploadCheck = { ok: true } | { ok: false; error: string };

/** Client-side checks; the storage bucket enforces the same limits server-side. */
export function checkImage(file: File, maxBytes: number = site.limits.maxImageBytes): UploadCheck {
  if (!(site.limits.imageTypes as readonly string[]).includes(file.type)) {
    return { ok: false, error: `${file.name}: use a JPG, PNG or WebP photo.` };
  }
  if (file.size > maxBytes) {
    return { ok: false, error: `${file.name} is larger than ${Math.round(maxBytes / 1024 / 1024)} MB.` };
  }
  return { ok: true };
}

/** Confirms the file really is an image by decoding it, and reads its size. */
export async function readImageSize(file: File): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return size;
}

/**
 * Re-encodes large photos to WebP at most 1600px on the long side. This strips
 * EXIF metadata (including GPS location) and keeps uploads small on mobile data.
 */
export async function prepareImage(file: File, maxSide = 1600): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not process image"))), "image/webp", 0.85),
  );
}

export async function uploadToBucket(bucket: "listing-images" | "avatars", path: string, blob: Blob) {
  const { error } = await createClient().storage.from(bucket).upload(path, blob, {
    contentType: blob.type || "image/webp",
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw new Error(error.message.includes("exceeded") ? "That photo is too large." : "Upload failed. Check your connection and try again.");
  return path;
}
