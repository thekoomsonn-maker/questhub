"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { storageUrl } from "@/lib/images";
import { cn } from "@/lib/utils";

export function ImageGallery({
  images,
  title,
  bucket = "listing-images",
}: {
  images: { id: string; storage_path: string }[];
  title: string;
  bucket?: "listing-images" | "product-images";
}) {
  const [index, setIndex] = useState(0);
  const url = (p: string) => storageUrl(bucket, p)!;
  if (images.length === 0) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-[var(--radius-card)] border border-line bg-surface text-ink-faint">
        <ImageOff size={40} aria-hidden />
        <span className="sr-only">No photos</span>
      </div>
    );
  }
  const go = (d: number) => setIndex((i) => (i + d + images.length) % images.length);

  return (
    <div
      className="flex flex-col gap-2"
      role="region"
      aria-roledescription="carousel"
      aria-label={`Photos of ${title}`}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(1);
        if (e.key === "ArrowLeft") go(-1);
      }}
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-card)] border border-line bg-ink">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url(images[index].storage_path)}
          alt={`${title}, photo ${index + 1} of ${images.length}`}
          className="h-full w-full object-contain"
        />
        {images.length > 1 ? (
          <>
            <button onClick={() => go(-1)} aria-label="Previous photo" className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-surface/90 text-ink hover:bg-surface">
              <ChevronLeft size={20} />
            </button>
            <button onClick={() => go(1)} aria-label="Next photo" className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-surface/90 text-ink hover:bg-surface">
              <ChevronRight size={20} />
            </button>
            <span className="absolute bottom-2 right-2 rounded-full bg-ink/70 px-2 py-0.5 text-xs text-white tabular">
              {index + 1} / {images.length}
            </span>
          </>
        ) : null}
      </div>
      {images.length > 1 ? (
        <ul className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <li key={img.id} className="shrink-0">
              <button
                onClick={() => setIndex(i)}
                aria-label={`Show photo ${i + 1}`}
                aria-current={i === index}
                className={cn("h-16 w-20 overflow-hidden rounded-[8px] border-2", i === index ? "border-brand" : "border-transparent opacity-70 hover:opacity-100")}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url(img.storage_path)} alt="" loading="lazy" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
