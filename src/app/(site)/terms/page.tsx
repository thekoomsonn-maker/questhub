import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/config/site";
import { Prose } from "../prose";

export const metadata: Metadata = { title: "Terms of use" };

export default function TermsPage() {
  return (
    <Prose title="Terms of use" updated="1 November 2026">
      <p><em>Template for review by a qualified Ghanaian lawyer before launch.</em></p>
      <p>These terms apply when you use {site.name}, an online classifieds service where people and businesses in Ghana list and find items and services. By creating an account you agree to them.</p>
      <h2>What {site.name} does</h2>
      <p>We provide a place to advertise and to contact other users. Buyers and sellers deal with each other directly. We are not a party to sales, don&apos;t hold payments, and don&apos;t guarantee the quality, safety or legality of items listed.</p>
      <h2>Your account</h2>
      <ul>
        <li>You must be at least 18, or have a parent or guardian&apos;s permission.</li>
        <li>Give accurate information and keep your password secure. You&apos;re responsible for activity on your account.</li>
      </ul>
      <h2>Listings</h2>
      <ul>
        <li>List only items and services you are entitled to sell, at their true condition and price.</li>
        <li>Prohibited: weapons and ammunition, illegal drugs and controlled medicines, counterfeit goods, stolen property, wildlife products, adult content, and anything illegal in Ghana. We may update this list.</li>
        <li>Listings are reviewed and may be rejected or removed. Listings expire after 60 days unless renewed.</li>
        <li>You keep ownership of your photos and text but let us display them on {site.name} and in our promotion of it.</li>
      </ul>
      <h2>Conduct</h2>
      <p>Don&apos;t harass, defraud, impersonate others, spam, or try to get around our safety features. We may suspend or close accounts that break these terms.</p>
      <h2>Promotions</h2>
      <p>Paid promotions improve placement for a set period. They don&apos;t guarantee sales. Promotions on listings removed for breaking these terms are not refunded.</p>
      <h2>Liability</h2>
      <p>To the extent the law allows, {site.name} is not liable for losses arising from transactions between users. Nothing here limits rights you have under Ghanaian consumer protection law.</p>
      <h2>Contact</h2>
      <p>Questions: <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>. See also our <Link href="/privacy">privacy policy</Link>.</p>
    </Prose>
  );
}
