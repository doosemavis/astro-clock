// Fails an EAS build EARLY if the public env vars the app needs at launch are missing,
// so we can never again ship a binary that hard-crashes on open.
//
// Background: lib/supabase.ts fail-fast throws at module load when these are undefined.
// They are injected from eas.json "env" (or EAS environment variables). If that injection
// ever regresses, this guard aborts the build instead of producing a crashing AAB.
//
// Wired via the "eas-build-pre-install" npm hook in package.json (runs on the EAS builder).

const REQUIRED = ["EXPO_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_ANON_KEY"];

const missing = REQUIRED.filter((name) => !process.env[name]);

if (missing.length > 0) {
  console.error(
    `\n✖ Build aborted: missing required env var(s): ${missing.join(", ")}.\n` +
      `  These must be injected from eas.json "env" (or EAS environment variables).\n` +
      `  Shipping without them crashes the app on launch (see lib/supabase.ts).\n` +
      `  Fix the build config before rebuilding.\n`,
  );
  process.exit(1);
}

console.log(`✓ Build env check passed (${REQUIRED.join(", ")} present).`);
