# Build Windows installers on Azure Pipelines ($0)

Use this when **GitHub Actions is blocked** (billing lock) but you still need **NSIS** (`*-setup.exe`) and **WiX MSI** (`.msi`) for **BlackBoxBanner/my-pos**.

Everything below is done in a **web browser** except downloading files at the end. You do **not** need to install Rust or Node on your own PC.

---

## What Azure will produce

After a successful run, open the run → **Artifacts** → **`windows-installers`**:

| Path inside artifact | Files |
| --- | --- |
| `nsis/` | `My POS_<version>_x64-setup.exe` (name may vary slightly) |
| `msi/` | `My POS_<version>_x64_en-US.msi` (name may vary slightly) |

These builds use [src-tauri/tauri.ci-windows.json](../src-tauri/tauri.ci-windows.json): **NSIS + MSI only**, **`createUpdaterArtifacts: false`** (no `latest.json` unless you add signing variables in Azure).

---

## Before you start

- GitHub repo **BlackBoxBanner/my-pos** must contain **`azure-pipelines.yml` on `main`** (push from your machine or pull latest).
- A **Microsoft account** (Outlook, Xbox, etc.) — same kind you use for Windows login.
- **~30–45 minutes** the first time (account setup + first compile). The build step alone can take **20–40 minutes** on free agents.

---

## Step-by-step checklist

### 1. Create a free Azure account (no paid VM required)

1. Open [https://azure.microsoft.com/free/](https://azure.microsoft.com/free/).
2. Click **Start free** and sign in with your Microsoft account.
3. Complete identity and phone verification.
4. Add a credit/debit card if Microsoft asks — the **free account** tier is used for DevOps billing linkage; you are **not** ordering a Windows VM for this guide.
5. Finish until you see the **Azure Portal** home. You can close the portal tab after this; builds run in **Azure DevOps**, not in VMs you manage.

> **You must do this in the browser** — the agent cannot sign you up.

### 2. Create an Azure DevOps organization and project

1. Open [https://dev.azure.com](https://dev.azure.com).
2. **New organization** → pick a short name (e.g. `blackboxbanner`) → create.
3. **New project** → name e.g. `my-pos` → visibility **Private** → create.

### 3. Connect GitHub

1. In the project, open **Project settings** (bottom left).
2. **Service connections** → **New service connection** → **GitHub**.
3. Choose **OAuth** or **GitHub Apps** (either works) → authorize **BlackBoxBanner/my-pos**.
4. Save the connection (e.g. name `github-my-pos`).

### 4. Create the pipeline from YAML

1. Left menu **Pipelines** → **Pipelines** → **Create Pipeline**.
2. Choose **GitHub** → select **BlackBoxBanner/my-pos**.
3. **Existing Azure Pipelines YAML file** → branch **`main`** → path **`/azure-pipelines.yml`** → continue.
4. Review the YAML → **Run** (or **Save and run**).

If Azure asks to install the **Azure Pipelines** GitHub App on the repo, approve it for **BlackBoxBanner/my-pos** only.

### 5. Enable free Microsoft-hosted parallel jobs

Without this, runs may queue forever on a new org.

1. **Organization settings** (bottom left, org level — not project).
2. **Billing** → link your **Azure subscription** (the free one from step 1).
3. Under **Parallel jobs** → **Microsoft-hosted** → ensure **Free tier** shows **1** parallel job ([licensing doc](https://learn.microsoft.com/en-us/azure/devops/pipelines/licensing/concurrent-jobs)).

> **You must do billing linkage in the browser** — it ties your free Azure subscription to DevOps minutes.

### 6. Run the pipeline

**Automatic runs:**

- Push or merge to **`main`**
- Push a tag matching **`v*`** (e.g. `v0.1.0`)

**Manual run:**

1. **Pipelines** → select **azure-pipelines.yml** (or your pipeline name).
2. **Run pipeline** → branch **`main`** → **Run**.

Wait until the job **Build Windows NSIS + MSI** is green (up to **60 minutes** per run on the free tier).

### 7. Download installers

1. Open the completed run.
2. Top right **Artifacts** (or **Summary** → **Related** → **Published**).
3. Download **`windows-installers`** (ZIP).
4. Unzip → use files in **`nsis/`** and **`msi/`**.

### 8. (Optional) Attach to a GitHub Release manually

If GitHub Actions still cannot upload assets:

1. On GitHub: **Releases** → **Draft a new release** (or edit an existing tag).
2. Upload the `.exe` and `.msi` from step 7.
3. Publish the release.

Users can install from those files even without in-app auto-update (`latest.json` is not built in the default Azure config).

---

## Optional: signed updater artifacts

Only if you already use Tauri updater signing:

1. **Pipelines → Library** → **Variable group** (e.g. `tauri-signing`).
2. Add secrets **`TAURI_SIGNING_PRIVATE_KEY`** and **`TAURI_SIGNING_PRIVATE_KEY_PASSWORD`**.
3. **Pipeline → Edit → Variables** → link the variable group.

The pipeline passes these into `npm run tauri build`. Unsigned builds (no variables) are the default and match `tauri.ci-windows.json`.

---

## Troubleshooting

| Problem | What to try |
| --- | --- |
| Pipeline queued for a long time | Complete **org Billing** + free parallel job (step 5). |
| Build exceeded 60 minutes | Re-run; later you can add caching. First run is often the slowest. |
| Empty artifact | Open the **Build NSIS** step log; fix compile errors on `main`, push, re-run. |
| SmartScreen warning on install | Expected for **unsigned** installers unless you add code signing. |

---

## Quick reference

- Pipeline file: [azure-pipelines.yml](../azure-pipelines.yml)
- CI bundle config: [src-tauri/tauri.ci-windows.json](../src-tauri/tauri.ci-windows.json)
- GitHub-only workflow (when billing works): [.github/workflows/release-windows-only.yml](../.github/workflows/release-windows-only.yml)
