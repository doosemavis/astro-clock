import type { Metadata } from "next";
import { APP_NAME, PROVIDER, CONTACT_EMAIL } from "../legal-meta";
import DeleteAccountActions from "./DeleteAccountActions";

export const metadata: Metadata = {
  title: `Delete Account — ${APP_NAME}`,
  description: `Delete your ${APP_NAME} account or personal data.`,
};

export default function DeleteAccountPage() {
  return (
    <>
      <h1>Delete your {APP_NAME} account or data</h1>
      <p className="meta">{APP_NAME}, provided by {PROVIDER}.</p>

      <p>
        This page is {APP_NAME}&apos;s official account-deletion and data-management page, as required
        by Google Play&apos;s data-deletion policy. It is public to view. The download and delete actions
        below require you to be signed in.
      </p>

      <h2>Download your data</h2>
      <p>
        You can export a copy of all the data we hold about you — your account details, profile,
        saved birth charts, and subscription record — as a JSON file.
      </p>
      <ol>
        <li>Sign in using the link below (or the app).</li>
        <li>Click <strong>Download my data</strong>. A JSON file will download immediately.</li>
      </ol>

      <h2>Delete your data (keep account)</h2>
      <p>
        This option removes your saved profile and all birth charts from our servers but{" "}
        <strong>keeps your account active and your subscription intact</strong>. You will remain
        signed in and can re-enter your details at any time. Use this if you want to clear your
        stored chart data without losing access to {APP_NAME} Pro.
      </p>
      <ol>
        <li>Sign in using the link below.</li>
        <li>Check the confirmation box under <strong>Delete my data</strong>.</li>
        <li>Click <strong>Delete my saved data</strong>. Your profile and birth charts are removed immediately.</li>
      </ol>

      <h2>Delete your account</h2>
      <p>
        This option <strong>permanently removes your entire account and all associated data</strong>,
        including:
      </p>
      <ul>
        <li>All sign-in identities (email&nbsp;/&nbsp;password, Google, Apple).</li>
        <li>Your profile information.</li>
        <li>All saved birth charts.</li>
        <li>Your subscription record in our database.</li>
      </ul>
      <p>
        You will be signed out immediately and will <strong>not</strong> be able to sign in again with
        the same credentials. This action is irreversible.
      </p>
      <ol>
        <li>Sign in using the link below.</li>
        <li>Check the confirmation box under <strong>Delete my account</strong>.</li>
        <li>Click <strong>Delete my account permanently</strong>. Deletion is immediate and cannot be undone.</li>
      </ol>

      <h2>What is kept and for how long</h2>
      <ul>
        <li>
          <strong>Purchase and transaction records.</strong> Google Play and our payments processor
          (RevenueCat) may retain records of purchases for legal, tax, and accounting purposes per
          their own retention policies. {PROVIDER} does not control this data.
        </li>
        <li>
          <strong>Aggregated, anonymized analytics.</strong> Statistical data that cannot identify
          you individually may be retained to understand aggregate usage patterns.
        </li>
        <li>
          <strong>Locally cached data on your device.</strong> Any data the app has cached locally
          is removed when you uninstall the app.
        </li>
      </ul>

      <h2>Request deletion without app access</h2>
      <p>
        If you no longer have access to your account or the app, email{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> to request manual deletion of your
        data or account.
      </p>

      <DeleteAccountActions />
    </>
  );
}
