"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

type Status = "loading" | "signed-out" | "signed-in";

export default function DeleteAccountActions() {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<User | null>(null);

  // Delete-data (keep account) state
  const [dataConfirmed, setDataConfirmed] = useState(false);
  const [deletingData, setDeletingData] = useState(false);
  const [dataDeleted, setDataDeleted] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  // Delete-account state
  const [accountConfirmed, setAccountConfirmed] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [accountDeleted, setAccountDeleted] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser(data.user);
        setStatus("signed-in");
      } else {
        setStatus("signed-out");
      }
    });
  }, []);

  function handleDownload() {
    window.location.href = "/api/account/export";
  }

  async function handleDeleteData() {
    if (!dataConfirmed || deletingData) return;
    setDeletingData(true);
    setDataError(null);
    try {
      const res = await fetch("/api/account/delete-data", { method: "POST" });
      if (!res.ok) {
        const text = await res.text();
        setDataError(text || "Failed to delete data. Please try again or contact support.");
        setDeletingData(false);
        return;
      }
      setDataDeleted(true);
      setDeletingData(false);
    } catch {
      setDataError("Network error. Please try again.");
      setDeletingData(false);
    }
  }

  async function handleDeleteAccount() {
    if (!accountConfirmed || deletingAccount) return;
    setDeletingAccount(true);
    setAccountError(null);
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      if (!res.ok) {
        const text = await res.text();
        setAccountError(text || "Deletion failed. Please try again or contact support.");
        setDeletingAccount(false);
        return;
      }
      setAccountDeleted(true);
      setTimeout(() => {
        window.location.href = "/";
      }, 2500);
    } catch {
      setAccountError("Network error. Please try again.");
      setDeletingAccount(false);
    }
  }

  const sectionStyle: React.CSSProperties = {
    marginTop: 36,
    padding: "24px 28px",
    border: "1px solid #2a2d52",
    borderRadius: 10,
  };

  const subsectionStyle: React.CSSProperties = {
    marginTop: 28,
    paddingTop: 28,
    borderTop: "1px solid #2a2d52",
  };

  const labelStyle: React.CSSProperties = {
    color: "#cdcfe8",
    fontSize: 15,
  };

  const descStyle: React.CSSProperties = {
    color: "#9a9cc0",
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 1.55,
  };

  const btnBase: React.CSSProperties = {
    display: "inline-block",
    padding: "10px 20px",
    borderRadius: 7,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    border: "1px solid",
    transition: "opacity 0.15s",
    background: "transparent",
  };

  if (status === "loading") {
    return (
      <div style={sectionStyle}>
        <p style={{ color: "#9a9cc0", margin: 0 }}>Loading…</p>
      </div>
    );
  }

  if (status === "signed-out") {
    return (
      <div style={sectionStyle}>
        <p style={labelStyle}>
          You are not currently signed in.{" "}
          <a href="/login?next=/delete-account" style={{ color: "#c7b3ff" }}>
            → Sign in
          </a>{" "}
          to download your data or manage your account.
        </p>
      </div>
    );
  }

  if (accountDeleted) {
    return (
      <div style={sectionStyle}>
        <p style={{ color: "#cdcfe8", margin: 0 }}>
          Your account has been permanently deleted. Redirecting…
        </p>
      </div>
    );
  }

  return (
    <div style={sectionStyle}>
      <p style={{ ...labelStyle, marginTop: 0 }}>
        Signed in as <strong style={{ color: "#e9eaf6" }}>{user?.email}</strong>
      </p>

      {/* ── Download ── */}
      <div>
        <p style={{ ...labelStyle, fontWeight: 600, marginBottom: 6, color: "#e9eaf6" }}>
          Download my data
        </p>
        <p style={descStyle}>
          Export your account info, profile, birth charts, and subscription record as a JSON file.
        </p>
        <button
          onClick={handleDownload}
          style={{
            ...btnBase,
            borderColor: "#4a4d7a",
            color: "#c7b3ff",
          }}
        >
          Download my data
        </button>
      </div>

      {/* ── Delete data (keep account) ── */}
      <div style={subsectionStyle}>
        <p style={{ ...labelStyle, fontWeight: 600, marginBottom: 6, color: "#e9eaf6" }}>
          Delete my data <span style={{ fontWeight: 400, color: "#9a9cc0" }}>(keep account)</span>
        </p>
        <p style={descStyle}>
          Removes your saved profile and all birth charts from our servers. Your account and
          subscription remain active — you can re-enter your details at any time.
        </p>

        {dataDeleted ? (
          <p style={{ color: "#7dcf8e", fontSize: 14, margin: 0 }}>
            Your saved data has been deleted.
          </p>
        ) : (
          <>
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                cursor: "pointer",
                marginBottom: 14,
              }}
            >
              <input
                type="checkbox"
                checked={dataConfirmed}
                onChange={(e) => setDataConfirmed(e.target.checked)}
                style={{ marginTop: 3, accentColor: "#ff6b6b", flexShrink: 0 }}
              />
              <span style={labelStyle}>
                I understand this deletes my saved profile and birth charts.
              </span>
            </label>

            {dataError && (
              <p style={{ color: "#ff6b6b", fontSize: 14, marginBottom: 12 }}>{dataError}</p>
            )}

            <button
              onClick={handleDeleteData}
              disabled={!dataConfirmed || deletingData}
              style={{
                ...btnBase,
                borderColor: dataConfirmed && !deletingData ? "#ff6b6b" : "#4a4d7a",
                color: dataConfirmed && !deletingData ? "#ff6b6b" : "#5a5d8a",
                opacity: deletingData ? 0.6 : 1,
                cursor: !dataConfirmed || deletingData ? "not-allowed" : "pointer",
              }}
            >
              {deletingData ? "Deleting…" : "Delete my saved data"}
            </button>
          </>
        )}
      </div>

      {/* ── Delete account ── */}
      <div style={subsectionStyle}>
        <p style={{ ...labelStyle, fontWeight: 600, marginBottom: 6, color: "#e9eaf6" }}>
          Delete my account
        </p>
        <p style={descStyle}>
          Permanently removes your account and ALL associated data — sign-in identities
          (email&nbsp;/&nbsp;Google&nbsp;/&nbsp;Apple), profile, birth charts, and subscription
          records. You will be signed out immediately and will not be able to sign in again. This
          action is irreversible.
        </p>

        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            cursor: "pointer",
            marginBottom: 14,
          }}
        >
          <input
            type="checkbox"
            checked={accountConfirmed}
            onChange={(e) => setAccountConfirmed(e.target.checked)}
            style={{ marginTop: 3, accentColor: "#ff6b6b", flexShrink: 0 }}
          />
          <span style={labelStyle}>
            I understand this permanently deletes my account and all data.
          </span>
        </label>

        {accountError && (
          <p style={{ color: "#ff6b6b", fontSize: 14, marginBottom: 12 }}>{accountError}</p>
        )}

        <button
          onClick={handleDeleteAccount}
          disabled={!accountConfirmed || deletingAccount}
          style={{
            ...btnBase,
            background: accountConfirmed && !deletingAccount ? "#c0392b" : "#3a1a1a",
            borderColor: accountConfirmed && !deletingAccount ? "#c0392b" : "#4a1a1a",
            color: "#fff",
            opacity: deletingAccount ? 0.6 : 1,
            cursor: !accountConfirmed || deletingAccount ? "not-allowed" : "pointer",
          }}
        >
          {deletingAccount ? "Deleting…" : "Delete my account permanently"}
        </button>
      </div>
    </div>
  );
}
