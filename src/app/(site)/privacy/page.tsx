import type { Metadata } from "next";
import { site } from "@/config/site";
import { Prose } from "../prose";

export const metadata: Metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <Prose title="Privacy policy" updated="1 November 2026">
      <p><em>Template for review before launch, including registration with Ghana&apos;s Data Protection Commission under the Data Protection Act, 2012 (Act 843).</em></p>
      <h2>What we collect</h2>
      <ul>
        <li><strong>Account details:</strong> name, email, password (stored hashed by our authentication provider), and optional photo, area and bio.</li>
        <li><strong>Contact details:</strong> phone and WhatsApp numbers if you add them. They are hidden unless you choose to show them to signed-in users.</li>
        <li><strong>Listings and messages</strong> you create, and reports you send.</li>
        <li><strong>Usage:</strong> listing views and contacts (counted without identifying you to sellers), and security logs.</li>
      </ul>
      <p>Photos are re-processed when uploaded, which removes embedded location data.</p>
      <h2>How we use it</h2>
      <ul>
        <li>To run the marketplace: show listings, deliver messages and notifications.</li>
        <li>To keep people safe: moderation, fraud prevention and handling reports. Moderators can read a message only when it has been reported.</li>
        <li>We do not sell your personal data.</li>
      </ul>
      <h2>Who we share it with</h2>
      <p>Service providers that host our database, files and email under contract, and authorities where the law requires it.</p>
      <h2>Your choices</h2>
      <ul>
        <li>Edit your profile and contact visibility at any time.</li>
        <li>Request deletion of your account from your account page. We delete your data within 30 days, except records we must keep to investigate fraud or meet legal duties.</li>
        <li>Ask for a copy of your data: <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>.</li>
      </ul>
    </Prose>
  );
}
