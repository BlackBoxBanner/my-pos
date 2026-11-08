# My POS

Desktop point-of-sale for a local shop. Built with Tauri 2, React, TypeScript, and SQLite.

## Features

- Cashier-first sell screen: cart-first layout, sticky pay bar, shortcuts (`F9`, `Esc`, `Ctrl+1–5`, `?`)
- Qty-prefix scan (`3*barcode`), denomination buttons, optional sounds / auto-print
- Product catalog with CSV import preview, export, pagination, quick price edit, and **pin to sell screen**
- Stock receive / adjust with searchable product picker and low-stock filter
- Reports (today + day close) and **Settings** (shop name, PIN, backup, app version & updates)
- First-run onboarding; manager PIN for adjust / close / void
- Database backup to `backups/` under the app data directory

## Business day

Sales, reports, receipt numbers, and day close use **Asia/Bangkok** calendar dates.

## Manager PIN

Set once from **รายงาน → ตั้งรหัสผู้จัดการ**. Required for:

- Stock adjust
- Day close
- Void sale
- Changing the PIN

## Data location

SQLite file: `{appDataDir}/pos.db` (platform-specific Tauri app data directory).

Backup copies go to `{appDataDir}/backups/pos-*.db`. Restore by quitting the app and replacing `pos.db` with a backup copy.

## Pin products (sell screen)

On **สินค้า**, use **ปักหมุด** on a row to show that product at the top of the product picker on **ขาย** (up to 24 items). **เลิกปักหมุด** removes it from the pinned section.

## Import products (CSV)

On **สินค้า**, use **ดาวน์โหลดตัวอย่าง CSV** then **นำเข้า CSV**.

Columns: `name`, `barcode`, `price_baht`, `stock_qty`, `low_stock_qty`, `active`
(Thai headers like `ชื่อ` / `ราคา` also work.)

- Matching **barcode** updates name/price/low stock/active (stock unchanged).
- New barcodes (or no barcode) create products; `stock_qty` is applied on create only.

## Develop

Run the **Tauri** app (not a plain browser tab — `invoke` only works inside Tauri):

```bash
npm install
npm run tauri dev
```

## Test (Rust)

```bash
cd src-tauri && cargo test
```

## Build

```bash
npm run tauri build
```

Local bundle output (under `src-tauri/target/release/bundle/`):

| OS | Installers |
| --- | --- |
| macOS | `.dmg`, `.app.tar.gz` |
| Windows | NSIS `*-setup.exe`, WiX `*.msi` |
| Linux | `.deb`, `.AppImage`, `.rpm` |

## Releases (GitHub Actions)

CI builds the same bundles on every **published** GitHub Release, on pushes to tags `v*` (for example `v0.1.0`), or via **Actions → Release → Run workflow** (you must enter the tag).

### Cut a release

1. Bump `version` in `package.json` and `src-tauri/tauri.conf.json` (and `src-tauri/Cargo.toml` if you keep them in sync).
2. Commit, then create and push an annotated tag: `git tag v0.1.0 && git push origin v0.1.0`.
3. On GitHub: **Releases → Draft a new release**, choose that tag, add release notes, and **Publish release** (publishing also triggers the workflow if the tag push already ran — prefer creating the GitHub release first or pushing the tag once to avoid duplicate runs).
4. Wait for the [Release](.github/workflows/release.yml) workflow. Assets appear on the release page when all matrix jobs finish (macOS Apple Silicon, macOS Intel, Linux, Windows).

### Secrets and signing

- **`GITHUB_TOKEN`**: Provided automatically. The workflow needs **Settings → Actions → General → Workflow permissions → Read and write permissions** so assets can be uploaded to releases.
- **In-app updater (required for auto-update in Settings → อัปเดต)**:
  1. Generate a minisign keypair: `npm run tauri signer generate -w ~/.tauri/my-pos.key`
  2. Put the **public** key (contents of `~/.tauri/my-pos.key.pub`) in `src-tauri/tauri.conf.json` → `plugins.updater.pubkey`. Keep the private key secret.
  3. Add GitHub Actions secrets: `TAURI_SIGNING_PRIVATE_KEY` (file contents or path per [Tauri signer docs](https://v2.tauri.app/reference/cli/#signer)) and optionally `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
  4. Ensure `plugins.updater.endpoints` points at your repo: `https://github.com/<owner>/<repo>/releases/latest/download/latest.json`
  5. On publish, the [Release](.github/workflows/release.yml) workflow uploads signed bundles and `latest.json` when the signing secret is set (`uploadUpdaterJson: true`).
- **Code signing (optional)**: Not configured in this repo. Unsigned macOS builds may show Gatekeeper warnings; Windows SmartScreen may warn until the app is signed. To sign in CI, add repository secrets such as `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `KEYCHAIN_PASSWORD`, and Windows signing vars per [Tauri’s GitHub pipeline docs](https://v2.tauri.app/distribute/pipelines/github/).

### App version & updates (in the app)

Open **ตั้งค่า** → **อัปเดต** to see the current version (`เวอร์ชัน`) and **ตรวจสอบอัปเดต** / **ดาวน์โหลดและติดตั้ง**. Dev builds (`npm run tauri dev`) can check the UI; downloading updates only works in signed release builds with `latest.json` on GitHub.

### Release troubleshooting

| Symptom | Cause | What to do |
| --- | --- | --- |
| Workflow ends in **startup_failure** (~1s), **no jobs**, or annotation: *account is locked due to a billing issue* | GitHub Actions billing on the account is unpaid or over limit | Open [Billing settings](https://github.com/settings/billing) (or org billing if the repo is under an org). Pay outstanding balance or raise spending limit, then **Actions → Release → Run workflow** with tag `v0.1.0-beta.2` (or your release tag). |
| Same, message about **workflow file issue** on very early runs | Invalid workflow expression (e.g. `inputs.tag` instead of `github.event.inputs.tag`) | Fixed on `main` since `0c66b12`; pull latest `main` and re-run. |
| Workflow is green but release has **no assets** | Jobs failed on one matrix leg, or upload permissions | Check each matrix job log; set **Settings → Actions → General → Workflow permissions → Read and write**. |
| Builds fail at **signing** / `latest.json` | `createUpdaterArtifacts` is on but `TAURI_SIGNING_PRIVATE_KEY` is missing | Add signing secrets (see above) or temporarily set `bundle.createUpdaterArtifacts` to `false` for unsigned installer-only releases. |

**Private repo note:** `BlackBoxBanner/my-pos` is private, so Actions minutes count against your plan (macOS/Windows runners use more minutes). After billing is healthy, re-run without creating a new tag:

```bash
gh workflow run release.yml -f tag=v0.1.0-beta.2
```

**Manual fallback (no CI):** On a machine with Rust + Node, run `npm ci && npm run tauri build`, then upload files from `src-tauri/target/release/bundle/` to the GitHub release page.

**Public repo (optional):** Public repositories get a larger free Actions allowance on standard Linux runners (policy varies; macOS/Windows still bill). Do not change visibility unless you accept the repo being public.

## Windows installers without cost ($0)

You need a **Windows** runner to produce NSIS (`*-setup.exe`) and WiX (`*.msi`). A Mac cannot cross-build those bundles reliably. These paths stay at **$0** if you stay within free tiers (no paid CI SKUs).

### Option A — GitHub Actions (best if billing works)

| Repo visibility | Cost | Windows job |
| --- | --- | --- |
| **Public** | **$0** — standard `windows-latest` minutes are free on public repos | [.github/workflows/release-windows-only.yml](.github/workflows/release-windows-only.yml) |
| **Private** | **$0** within included compute (~2,000 min/month on GitHub Free; Windows minutes use a **multiplier**, so budget accordingly) | Same workflow, or full [Release](.github/workflows/release.yml) matrix |

**Account billing lock** (*account is locked due to a billing issue*, jobs show **startup_failure** ~1s):

1. Open **Settings → Billing and licensing** ([billing settings](https://github.com/settings/billing)).
2. Typical fixes at **$0 spend**:
   - **Failed card hold** (often from Copilot trial/sign-up even on GitHub Free): remove the bad payment method or update it so the hold clears; or **downgrade to GitHub Free** per [Unlocking a locked account](https://docs.github.com/en/billing/how-tos/troubleshooting/locked-account).
   - **No valid payment method** on a **private** repo after you used all included compute: add a card with **spending limit $0** / budgets capped so Actions cannot charge; or make the repo **public** so public-repo Actions stay free without metered private compute.
3. If billing shows no balance but Actions stay locked, contact GitHub Support (linked from the same doc).

**After Actions work again:**

1. **Settings → Actions → General → Workflow permissions → Read and write permissions**.
2. Push a tag `v*` or run **Actions → Release (Windows only) → Run workflow** (optional tag; uncheck *upload to release* to only get workflow artifacts).
3. Installers use [src-tauri/tauri.ci-windows.json](src-tauri/tauri.ci-windows.json): **NSIS + MSI only**, `createUpdaterArtifacts: false` unless `TAURI_SIGNING_PRIVATE_KEY` is set.

```bash
gh workflow run "Release (Windows only)" -f tag=v0.1.0 -f upload_to_release=true
```

Download from the **Release** assets (if uploaded) or the workflow **Artifacts** tab.

### Option B — Azure Pipelines (when GitHub Actions stay blocked)

**Step-by-step (non-technical):** [docs/AZURE_WINDOWS_BUILD.md](docs/AZURE_WINDOWS_BUILD.md)

**Cost:** **$0** for a **private** GitHub repo: 1 Microsoft-hosted parallel job, **60 minutes per run**, **1,800 minutes/month**. You must link a **free Azure subscription** to the DevOps org (no charge for this tier; you are not buying Azure VMs).

1. Create a free [Azure account](https://azure.microsoft.com/free/) if needed.
2. [dev.azure.com](https://dev.azure.com) → **New organization** → **New project** (private).
3. **Project settings → Service connections → New → GitHub** → authorize **BlackBoxBanner/my-pos** (or your fork).
4. **Pipelines → New pipeline → GitHub** → select the repo → **Existing Azure Pipelines YAML file** → `azure-pipelines.yml` on `main`.
5. **Organization settings → Billing** → link the Azure subscription → enable **Free tier** parallel jobs for Microsoft-hosted agents ([parallel jobs doc](https://learn.microsoft.com/en-us/azure/devops/pipelines/licensing/concurrent-jobs)).
6. Push a tag matching `v*` or run the pipeline manually.

**Download:** open the pipeline run → **Artifacts** → `windows-installers` → `nsis/` and `msi/` folders. Upload `.exe` / `.msi` to a GitHub Release manually if you still cannot use Actions.

Optional **variable group** (Pipelines → Library): `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — only if you want signed updater artifacts in Azure (otherwise the CI config keeps them off).

### What we did not recommend

- **AppVeyor / others for private repos:** OSS free tiers usually require a **public** GitHub repo.
- **Sketchy “free Windows RDP” VMs:** unreliable; use Azure or fixed GitHub billing instead.
- **Self-hosted runner on a home PC:** viable at $0 if you have Windows hardware; register a [self-hosted runner](https://docs.github.com/en/actions/hosting-your-own-runners) and run `npm run tauri build` there (no files added for that path).

### Limitations (all $0 paths)

- Installers are **unsigned** unless you add signing secrets; Windows SmartScreen may warn.
- Without `TAURI_SIGNING_PRIVATE_KEY`, in-app auto-update files (`latest.json`, `.sig`) are **not** produced in these CI jobs (`createUpdaterArtifacts: false`).
- Azure free tier: single job **≤ 60 minutes**; first Tauri Windows build can be slow — enable pipeline caching later if you hit the limit.
- Full macOS/Linux matrix still needs GitHub Actions minutes or separate machines; this section is **Windows-only**.
