import { redirect } from "next/navigation";

export default function SellerMessagesPage() {
  redirect("/messages?role=selling");
}
