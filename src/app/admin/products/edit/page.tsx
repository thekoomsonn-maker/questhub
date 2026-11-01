import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCategoryTree } from "@/lib/data/catalog";
import { productImageUrl } from "@/lib/images";
import { AdminHeader } from "../../ui";
import { ProductForm } from "./product-form";

export default async function EditProduct({ searchParams }: PageProps<"/admin/products/edit">) {
  const id = (await searchParams).id;
  const supabase = await createClient();
  const tree = await getCategoryTree();
  let product = null;
  if (typeof id === "string") {
    if (!z.uuid().safeParse(id).success) notFound();
    const { data } = await supabase.from("store_products").select("*, images:store_product_images(id,storage_path,sort_order)").eq("id", id).maybeSingle();
    if (!data) notFound();
    product = data;
  }
  const categories = tree.flatMap((r) => [{ id: r.id, name: r.name }, ...r.children.map((c) => ({ id: c.id, name: `${r.name} › ${c.name}` }))]);
  return (
    <>
      <AdminHeader title={product ? "Edit product" : "Add product"} />
      <ProductForm
        product={product ? {
          id: product.id, slug: product.slug,
          values: {
            name: product.name, brand: product.brand ?? "", description: product.description, categoryId: product.category_id,
            price: String(product.price), compareAtPrice: product.compare_at_price ? String(product.compare_at_price) : "", stock: String(product.stock),
            sku: product.sku ?? "", warranty: product.warranty ?? "", isActive: product.is_active, isFeatured: product.is_featured,
          },
          images: [...product.images].sort((a, b) => a.sort_order - b.sort_order).map((i) => ({ id: i.id, url: productImageUrl(i.storage_path)! })),
        } : null}
        categories={categories}
      />
    </>
  );
}
