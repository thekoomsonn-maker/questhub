import type { Metadata } from "next";
import { Prose } from "../prose";

export const metadata: Metadata = { title: "Safety tips" };

export default function SafetyPage() {
  return (
    <Prose title="Trade safely on QuestHub">
      <p>Most people on QuestHub are honest buyers and sellers. These habits protect you from the few who aren&apos;t.</p>
      <h2>Before you pay</h2>
      <ul>
        <li><strong>Never pay a deposit, &ldquo;booking fee&rdquo; or delivery charge</strong> by Mobile Money or bank transfer for an item you haven&apos;t seen. This is the most common scam.</li>
        <li>Inspect the item in person. Switch phones and laptops on, test generators, check car documents and the chassis number.</li>
        <li>For property, visit the house and confirm the person showing it has the right to rent or sell it. Ask to see the landlord or title documents.</li>
        <li>Be wary of prices far below the market, and of sellers who rush you.</li>
      </ul>
      <h2>Meeting up</h2>
      <ul>
        <li>Meet in a busy public place in daylight: a mall, bank, filling station or police station car park.</li>
        <li>Bring a friend, and tell someone where you&apos;re going.</li>
        <li>Pay only once you&apos;re happy, and get a written receipt for valuable items.</li>
      </ul>
      <h2>Protect your account</h2>
      <ul>
        <li>QuestHub staff will never ask for your password, MoMo PIN or a verification code.</li>
        <li>Keep conversations in QuestHub messages so you can report anyone who behaves badly.</li>
        <li>You don&apos;t have to share your phone number. Turn it on or off any time in your profile settings.</li>
      </ul>
      <h2>Spotted something wrong?</h2>
      <p>Use <strong>Report</strong> on any listing, seller or message. Reports are private and reviewed by our moderators. If you&apos;ve been defrauded, also report it to the Ghana Police Service.</p>
      <p>&ldquo;Verified seller&rdquo; means our team has checked the seller&apos;s identity or business registration. It is not a guarantee about any particular item, so the tips above still apply.</p>
    </Prose>
  );
}
