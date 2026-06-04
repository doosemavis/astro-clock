import type { Metadata } from "next";
import { APP_NAME, PROVIDER, CONTACT_EMAIL, EFFECTIVE_DATE } from "../legal-meta";

export const metadata: Metadata = {
  title: `Privacy Policy — ${APP_NAME}`,
  description: `How ${APP_NAME} collects, uses, and protects your information.`,
};

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="meta">Effective {EFFECTIVE_DATE}</p>

      <p>
        This Privacy Policy explains how {PROVIDER} (&quot;we&quot;, &quot;us&quot;) collects, uses, and
        protects your information when you use {APP_NAME} (the &quot;App&quot;, our website, and related
        services). By using {APP_NAME}, you agree to this policy.
      </p>

      <h2>1. Information we collect</h2>
      <ul>
        <li><strong>Account information.</strong> When you create an account or sign in (with email and
          password, Google, or Apple), we receive your email address and, if provided, your display name.
          Signing in with Google or Apple shares a unique identifier and the email tied to that account.</li>
        <li><strong>Birth details you enter.</strong> To generate your astrological chart, the App stores the
          birth date, time, and location you provide. This is used solely to compute and display your chart.</li>
        <li><strong>Subscription and purchase information.</strong> If you purchase {APP_NAME} Pro, our payment
          partners (Google Play, Apple, or Stripe) and our subscription provider (RevenueCat) process the
          transaction and report your subscription status (active, trial, expired) to us. We do not receive or
          store your full payment-card details.</li>
        <li><strong>Technical and diagnostic data.</strong> Like most apps, we may collect limited device and
          log information (for example, app version and error logs) to operate and improve the service.</li>
      </ul>

      <h2>2. How we use your information</h2>
      <ul>
        <li>To provide the core service — authenticate you and compute and display your chart;</li>
        <li>To manage your subscription and unlock Pro features;</li>
        <li>To respond to your support requests;</li>
        <li>To maintain security and prevent abuse;</li>
        <li>To comply with our legal obligations.</li>
      </ul>

      <h2>3. How your information is stored and shared</h2>
      <p>
        We host your account and chart data with Supabase (database and authentication). We rely on the
        following service providers to operate {APP_NAME}, and share only the information they need to perform
        their services:
      </p>
      <ul>
        <li><strong>Supabase</strong> — database and authentication hosting;</li>
        <li><strong>RevenueCat</strong> — subscription and entitlement management;</li>
        <li><strong>Google Play, the Apple App Store, and Stripe</strong> — payment processing;</li>
        <li><strong>Google and Apple</strong> — optional sign-in.</li>
      </ul>
      <p>We do not sell your personal information, and we do not share it for third-party advertising.</p>

      <h2>4. Data retention</h2>
      <p>
        We keep your account and chart data for as long as your account is active. You may request deletion of
        your account and associated data at any time (see &quot;Your choices and rights&quot;).
      </p>

      <h2>5. Your choices and rights</h2>
      <p>
        You can review and update your account details in the App. To request access to, correction of, or
        deletion of your personal data — or to delete your account — contact us at{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Depending on where you live, you may have
        additional rights under laws such as the GDPR or CCPA, which we honor.
      </p>

      <h2>6. Children&apos;s privacy</h2>
      <p>
        {APP_NAME} is not directed to children under 13 (or the minimum age required in your jurisdiction), and
        we do not knowingly collect their personal information.
      </p>

      <h2>7. Security</h2>
      <p>
        We use industry-standard measures to protect your information. No method of transmission or storage is
        completely secure, but we work to safeguard your data.
      </p>

      <h2>8. International users</h2>
      <p>
        Your information may be processed in countries other than your own, including where our service
        providers operate. We rely on appropriate safeguards for such transfers.
      </p>

      <h2>9. Changes to this policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will post the updated version here and revise
        the &quot;Effective&quot; date above.
      </p>

      <h2>10. Contact us</h2>
      <p>
        Questions about this policy? Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </>
  );
}
