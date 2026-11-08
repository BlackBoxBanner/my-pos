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
