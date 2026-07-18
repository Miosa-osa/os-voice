# Releasing OS Voice Desktop

A maintainer runbook for cutting a release on `Miosa-osa/os-voice`. Host: **GitHub Releases**
(the chosen distribution channel). This doc reflects what `.github/workflows/release.yml` and
`.github/workflows/_release-desktop-impl.yml` actually do today, forked as-is from upstream
Voquill and only partially adapted — see **Known gaps** below before you rely on it end-to-end.

> `docs/desktop-release.md` (existing file) is stale — it describes an older, manual
> `workflow_dispatch` flow pointing at `voquill/voquill` that no longer matches the current
> push-triggered, per-branch-channel workflow. This file supersedes it; reconciling/removing
> the old file is a follow-up, not done here.

## How a release is triggered

`.github/workflows/release.yml` runs on `push` to three branches, each mapped to a channel:

| Branch pushed | Channel | Desktop release env |
|---|---|---|
| `main` | dev | `dev` (plus an `enterprise-dev` flavor built in parallel, desktop only) |
| `prod` | prod | `prod` |
| `enterprise` | enterprise | `enterprise` |

The `detect` job only fires the desktop release if the push touched `apps/desktop/**`,
`apps/windows-installer/**`, or `packages/**` (path filter against `github.event.before`).
When it does, it calls the reusable workflow `_release-desktop-impl.yml` with
`release_env: <channel>` and `secrets: inherit`.

### Version derivation (from `_release-desktop-impl.yml`)

- **dev**: auto-bumps the patch number of the latest `desktop-dev-v*` git tag (or starts at
  `0.0.1` if none exists), tags the pushed commit `desktop-dev-v<version>`.
- **enterprise**: same pattern against `desktop-enterprise-v*` tags — an independent version
  line from dev/prod.
- **enterprise-dev**: same pattern against `desktop-enterprise-dev-v*` tags, built from every
  `main` push alongside the regular dev build.
- **prod**: does **not** bump from the `prod` branch's own history. It promotes the **latest
  `desktop-dev-v*` tag** (or an explicit `x.y.z` passed via the workflow's optional `version`
  input) — same version number, retagged `desktop-v<version>`, and **built from the commit the
  dev tag points at**, not necessarily the tip of `prod` you just pushed. A prod release fails
  outright if no matching dev tag exists yet.

`scripts/ci/set-tauri-release-config.mjs` writes `RELEASE_VERSION` into
`apps/desktop/src-tauri/tauri.conf.json`'s `version` field, and — if `TAURI_UPDATER_PUBLIC_KEY`
is set — writes it into `plugins.updater.pubkey` (replacing the `__UPDATER_PUBLIC_KEY__`
placeholder). This runs once per platform build (macOS/Windows/Linux) before `tauri build`.

## One-time setup

### 1. Generate the updater signing keypair

The `tauri` CLI is a dependency of `apps/desktop`, not the workspace root, so run this from
inside that package:

```bash
cd apps/desktop
pnpm exec tauri signer generate -w ~/.tauri/osvoice_updater.key
```

You'll be prompted for a password to encrypt the private key. This produces:
- a private key file at `~/.tauri/osvoice_updater.key` (PEM, encrypted with your password)
- a public key printed to stdout

### 2. Set the GitHub Actions secrets

In the `Miosa-osa/os-voice` repo → Settings → Secrets and variables → Actions, add these
(exact names, read directly by `_release-desktop-impl.yml`'s `build` job):

| Secret | Value |
|---|---|
| `TAURI_PRIVATE_KEY` | Full contents of `~/.tauri/osvoice_updater.key` (the private key file) |
| `TAURI_PRIVATE_KEY_PASSWORD` | The password you set when generating the key |
| `TAURI_UPDATER_PUBLIC_KEY` | The public key printed by `tauri signer generate` |

(`TAURI_PRIVATE_KEY` / `TAURI_PRIVATE_KEY_PASSWORD` are also mapped internally to
`TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` for `tauri-apps/tauri-action`
— you only need to set the two secrets above, not four.)

**Updater endpoints are already hardcoded per channel** in this repo (no secret needed):

- `apps/desktop/src-tauri/tauri.dev.conf.json` → `https://github.com/Miosa-osa/os-voice/releases/download/desktop-dev/latest.json`
- `apps/desktop/src-tauri/tauri.prod.conf.json` → `https://github.com/Miosa-osa/os-voice/releases/download/desktop-prod/latest.json`
- `apps/desktop/src-tauri/tauri.enterprise.conf.json` → `.../desktop-enterprise/latest.json`
- `apps/desktop/src-tauri/tauri.enterprise-dev.conf.json` → `.../desktop-enterprise-dev/latest.json`

## Cutting a release

1. Push (or fast-forward-merge) to the branch for the channel you want — `main`, `prod`, or
   `enterprise` — touching something under `apps/desktop/**`, `apps/windows-installer/**`, or
   `packages/**`.
2. The workflow computes the version (see above), creates the git tag, and builds macOS,
   Windows, and Linux in parallel in one matrix job.
3. `tauri-apps/tauri-action` (with `includeUpdaterJson: true`) publishes signed installers plus
   a `latest.json` updater manifest to the GitHub Release at the version tag (e.g.
   `desktop-dev-v1.2.3`), `prerelease: true` for everything except `prod`.
4. The `update-channel` job downloads that `latest.json`, validates its version, and re-uploads
   it to the channel's constant release tag (`desktop-dev` / `desktop-prod` /
   `desktop-enterprise` / `desktop-enterprise-dev`) — **this is the URL the installed app's
   updater actually polls**, so this step is what makes a release "live" for auto-update.
5. Verify: check the version-tagged GitHub Release has all platform installers, then check the
   channel tag also shows a freshly-updated `latest.json`.

Failed builds auto-retry (`retry-failed-builds` job re-runs failed jobs, up to 3 workflow run
attempts) — useful for CI flakiness, not for missing secrets (see below).

## Known gaps / discrepancies in this repo

This workflow was forked from upstream Voquill's and has **not been fully adapted** for
`Miosa-osa/os-voice`. Read this before assuming "Linux/Windows ship freely, only macOS is
deferred":

- **macOS signing is currently mandatory in the workflow as written**, not optional. The macOS
  leg of the `build` job has hard `exit 1` assertions for a `Developer ID Application` and
  `Developer ID Installer` identity, and calls `xcrun notarytool submit --wait`. Without the
  Apple secrets (below), that leg fails.
- **Windows signing is also currently mandatory**, not deferrable: NSIS and portable installers
  are signed via Azure Trusted Signing (`azure/login` + `azure/trusted-signing-action`), needing
  `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` secrets and
  `AZURE_CODE_SIGNING_NAME` / `AZURE_CERT_PROFILE_NAME` repo variables. Without these, the
  Windows leg fails too.
- **A failure in the macOS or Windows leg fails the whole `build` job** (GitHub Actions' default
  `needs:` semantics), which **skips `update-channel` entirely** — even though the Linux leg
  (`fail-fast: false`) still completes and its `.deb`/`.rpm`/AppImage get uploaded to the
  version-tagged GitHub Release by `tauri-action`. Net effect **today**: a release push can
  publish working Linux installers to the version tag, but the channel's `latest.json` never
  gets updated, so **the auto-updater does not see the new version**, until Apple + Azure
  secrets are configured (or the workflow's job dependencies are changed so Linux publish /
  `update-channel` doesn't require the mac/Windows legs — not done here, out of scope for docs).
- **`publish-apt` / `publish-rpm` / `publish-brew` push into upstream Voquill's own repos**
  (`github.com/voquill/apt`, `voquill/rpm`, `voquill/homebrew-voquill`) using
  `PACKAGE_REPO_TOKEN`. As configured, these will either fail for lack of write access, or (if
  the token happens to have access) publish into the wrong org's package repos. Don't rely on
  APT/RPM/Homebrew distribution for this fork until these are repointed to `Miosa-osa`-owned
  repos — this is a code change, out of scope here.

## Deferred: macOS notarization (later)

Treat full macOS signing/notarization as a follow-up, not a blocker for shipping Linux/Windows
— **once the "Known gaps" job-dependency issue above is also fixed**, since right now a failed
macOS leg blocks channel promotion for every platform in the same run. Secrets needed when you
pick this up (all consumed by `_release-desktop-impl.yml`'s `build` job):

| Secret | Purpose |
|---|---|
| `APPLE_CERTIFICATE` | Base64-encoded `Developer ID Application` `.p12` |
| `APPLE_CERTIFICATE_PASSWORD` | Password protecting that `.p12` |
| `APPLE_SIGNING_IDENTITY` | Full identity string, e.g. `Developer ID Application: Example Corp (TEAMID)` |
| `APPLE_INSTALLER_SIGNING_IDENTITY` | `Developer ID Installer` identity string (signs the `.pkg`) |
| `KEYCHAIN_PASSWORD` | Password for the throwaway CI keychain that imports the cert |
| `APPLE_API_KEY_BASE64` | Base64-encoded App Store Connect API key (`.p8`), for notarization |
| `APPLE_API_KEY_ID` | App Store Connect API key ID |
| `APPLE_API_ISSUER` | App Store Connect issuer UUID |
| `APPLE_TEAM_ID` | Apple Developer Team ID |

Windows Azure Trusted Signing secrets (`AZURE_CLIENT_ID`, `AZURE_TENANT_ID`,
`AZURE_SUBSCRIPTION_ID`, plus the `AZURE_CODE_SIGNING_NAME` / `AZURE_CERT_PROFILE_NAME` repo
variables) are a separate, similarly currently-mandatory dependency for the Windows leg — see
**Known gaps** above.
