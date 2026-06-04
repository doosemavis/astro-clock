import type { Metadata } from "next";
import { APP_NAME, PROVIDER, CONTACT_EMAIL, JURISDICTION, EFFECTIVE_DATE } from "../legal-meta";

export const metadata: Metadata = {
  title: `Terms of Service — ${APP_NAME}`,
  description: `The terms that govern your use of ${APP_NAME}.`,
};

export default function TermsPage() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p className="meta">Effective {EFFECTIVE_DATE}</p>

      <p>
        These Terms of Service (&quot;Terms&quot;) govern your use of {APP_NAME} (the &quot;App&quot;, our
        website, and related services), provided by {PROVIDER} (&quot;we&quot;, &quot;us&quot;). By using{" "}
        {APP_NAME}, you agree to these Terms. If you do not agree, do not use the App.
      </p>

      <h2>1. The service</h2>
      <p>
        {APP_NAME} is a living astrological chart that displays the positions of celestial bodies relative to a
        birth chart you create. <strong>{APP_NAME} is provided for personal entertainment and self-reflection
        only. It does not provide professional, medical, legal, financial, or psychological advice, and you
        should not rely on it as such.</strong>
      </p>

      <h2>2. Your account</h2>
      <p>
        To access certain features you must create an account. You are responsible for keeping your credentials
        secure and for all activity under your account. Please provide accurate information and keep it current.
      </p>

      <h2>3. {APP_NAME} Pro subscriptions</h2>
      <p>
        {APP_NAME} offers an optional paid subscription, &quot;{APP_NAME} Pro&quot;, which unlocks additional
        features.
      </p>
      <ul>
        <li><strong>Billing.</strong> Subscriptions are offered as monthly or yearly plans and are billed
          through your platform&apos;s store — Google Play or the Apple App Store on mobile, or Stripe on the
          web.</li>
        <li><strong>Auto-renewal.</strong> Subscriptions renew automatically at the end of each billing period
          at the then-current price, unless you cancel before the renewal date.</li>
        <li><strong>Free trial.</strong> If a free trial is offered, it converts to a paid subscription at the
          end of the trial unless you cancel beforehand. Any unused portion of a free trial is forfeited when
          you purchase a subscription.</li>
        <li><strong>Cancellation.</strong> You can cancel at any time through your store account&apos;s
          subscription settings. Your Pro access continues until the end of the current billing period.</li>
        <li><strong>Refunds.</strong> Purchases are handled by the applicable store; refunds are governed by
          that store&apos;s policy.</li>
        <li><strong>Price changes.</strong> We may change subscription prices; changes apply to future billing
          periods and, where required, with notice and your consent.</li>
      </ul>

      <h2>4. Acceptable use</h2>
      <p>
        You agree not to misuse the App, including by attempting to access it in unauthorized ways, interfering
        with its operation, reverse-engineering it except as permitted by law, or using it to violate any law or
        the rights of others.
      </p>

      <h2>5. Intellectual property</h2>
      <p>
        The App — including its software, design, and content — is owned by {PROVIDER} or its licensors and is
        protected by law. We grant you a limited, personal, non-transferable license to use the App. The chart
        you create from your own birth details is yours.
      </p>

      <h2>6. Disclaimers</h2>
      <p>
        The App is provided &quot;as is&quot; and &quot;as available&quot;, without warranties of any kind,
        express or implied. We do not warrant that astrological calculations or interpretations are accurate,
        complete, or suitable for any purpose, or that the App will be uninterrupted or error-free.
      </p>

      <h2>7. Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, {PROVIDER} will not be liable for any indirect, incidental,
        special, consequential, or punitive damages, or for any loss of data, arising from your use of the App.
        Our total liability for any claim relating to the App will not exceed the amount you paid us in the
        twelve months before the claim.
      </p>

      <h2>8. Termination</h2>
      <p>
        We may suspend or terminate your access if you violate these Terms or if we discontinue the service. You
        may stop using the App and delete your account at any time.
      </p>

      <h2>9. Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. We will post the updated version here and revise the
        &quot;Effective&quot; date. Continued use after changes means you accept the updated Terms.
      </p>

      <h2>10. Governing law</h2>
      <p>
        These Terms are governed by the laws of {JURISDICTION}, without regard to its conflict-of-laws rules.
      </p>

      <h2>11. Contact</h2>
      <p>
        Questions about these Terms? Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </>
  );
}
