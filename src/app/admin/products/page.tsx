import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/format";
import { productImageUrl } from "@/lib/images";
import { Badge } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { AdminHeader, Table } from "../ui";

export default async function AdminProducts() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("store_products")
    .select("id,slug,name,brand,price,stock,is_active,is_featured,sku,images:store_product_images(storage_path,sort_order),category:categories(name)")
    .order("created_at", { ascending: false });
  return (
    <>
      <AdminHeader title="Store products" description="Items QuestHub sells directly. Stock is reserved when a customer places an order and returned if it isn't paid in 45 minutes." actions={<ButtonLink href="/admin/products/edit">Add product</ButtonLink>} />
      <Table head={["Product", "Category", "Price", "Stock", "Status"]} empty={!data?.length}>
        {data?.map((p) => {
          const cover = [...p.images].sort((a, b) => a.sort_order - b.sort_order)[0];
          return (
            <tr key={p.id}>
              <td className="px-3 py-3">
                <Link href={`/admin/products/edit?id=${p.id}`} className="flex items-center gap-3 hover:text-brand">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={cover ? productImageUrl(cover.storage_path)! : ""} alt="" className="h-12 w-12 rounded-[6px] bg-white object-contain" />
                  <span><span className="font-medium">{p.brand ? `${p.brand} ` : ""}{p.name}</span>{p.sku ? <span className="block text-xs text-ink-faint">{p.sku}</span> : null}</span>
                </Link>
              </td>
              <td className="px-3 py-3 text-ink-soft">{p.category?.name ?? "—"}</td>
              <td className="px-3 py-3 font-display font-bold tabular">{formatPrice(p.price)}</td>
              <td className="px-3 py-3 tabular"><span className={p.stock === 0 ? "text-danger" : p.stock <= 5 ? "text-[#9a6a00]" : ""}>{p.stock}</span></td>
              <td className="px-3 py-3"><Badge tone={p.is_active ? "success" : "neutral"}>{p.is_active ? "On sale" : "Hidden"}</Badge>{p.is_featured ? <Badge tone="gold" className="ml-1">Featured</Badge> : null}</td>
            </tr>
          );
        })}
      </Table>
    </>
  );
}
