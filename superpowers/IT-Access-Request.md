# IT Access Request — Accent Pipeline Development Environment

**Requestor:** Sameer Tikoo
**Date:** 2026-05-21
**Machine:** Current corporate laptop (Windows 11 Pro)
**Project:** Accent Pipeline / XTTS voice inference service (Provana AI)
**Urgency:** Blocking — development cannot proceed without these components

---

## Summary

I need two software components installed on my development machine to complete and test the Accent Pipeline voice service. Both installs require local administrator rights and are currently blocked by Group Policy / WSUS restrictions. Silent install attempts via the standard bootstrappers exit immediately without installing.

Total install time once unblocked: **under 15 minutes**.

---

## What I need installed

### 1. VB-Audio Virtual Cable (or VoiceMeeter)

- **Purpose:** Provides a virtual audio loopback device so the service can capture microphone input and route processed audio back to applications (Teams, Zoom, etc.).
- **Vendor:** VB-Audio Software (https://vb-audio.com/Cable/)
- **Installer:** `VBCABLE_Setup_x64.exe` (signed by VB-Audio Software)
- **Why required:** Without a virtual audio device, live microphone capture is impossible. The service falls back to passthrough mode only.
- **Footprint:** ~2 MB, installs one signed kernel-mode audio driver.

### 2. Visual Studio 2022 Build Tools — C++ Workload

- **Purpose:** Compile the native `AccentPipeline.dll` (WASAPI audio capture module) that the Python service loads.
- **Vendor:** Microsoft
- **Installer:** `vs_buildtools.exe` (Visual Studio Installer bootstrapper)
- **Workload required:** `Microsoft.VisualStudio.Workload.VCTools` (C++ build tools, MSVC v143, Windows 10/11 SDK)
- **Footprint:** ~6–8 GB on disk after install.

---

## Exact install commands (for IT to run as admin)

### VB-Audio Virtual Cable

```cmd
:: Download from https://download.vb-audio.com/Download_CABLE/VBCABLE_Driver_Pack43.zip
:: Extract and run as admin:
VBCABLE_Setup_x64.exe -i -h
```

### VS Build Tools — C++ workload (online installer, recommended)

```cmd
vs_buildtools.exe --quiet --wait --norestart --nocache ^
  --installPath "C:\BuildTools" ^
  --add Microsoft.VisualStudio.Workload.VCTools ^
  --includeRecommended ^
  --lang en-US
```

### VS Build Tools — offline layout (if WSUS blocks the online installer)

```cmd
:: Step 1: download full offline layout (~2 GB) on an unrestricted machine
vs_buildtools.exe --layout "D:\vslayout" ^
  --add Microsoft.VisualStudio.Workload.VCTools ^
  --includeRecommended --lang en-US

:: Step 2: copy D:\vslayout to target machine, then run:
D:\vslayout\vs_setup.exe --quiet --wait --norestart ^
  --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended
```

---

## Verification (after install)

IT can confirm success by running these in an admin Command Prompt:

```cmd
:: VB-Audio
powershell -c "Get-PnpDevice -Class AudioEndpoint | Where-Object {$_.FriendlyName -like '*CABLE*'}"

:: VS Build Tools
"C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
```

Both commands should return non-empty results.

---

## Current blocker evidence

- `vs_buildtools.exe` returns immediately after download (~4.3 MB stub only) — no install initiated.
- `vswhere.exe` returns blank, confirming no VS components are present.
- VB-Cable installer fails silently when launched without elevated rights.
- Likely cause: Group Policy / WSUS restriction on Microsoft installer endpoints and driver installation.

---

## Business justification

- Accent Pipeline is a Provana AI delivery — voice/audio service for real-time accent normalization.
- Without these tools, I can only test the XTTS inference engine and IPC layer in passthrough mode. Live microphone capture (the primary user-facing feature) cannot be exercised.
- Both packages are mainstream, signed, and routinely installed on developer workstations.

---

## What I can do without IT access

While waiting, I can validate:
1. XTTS inference pipeline (model load, synthesis correctness)
2. IPC server (named-pipe protocol, client connections)
3. Tray application UI and lifecycle

I cannot validate:
- Live microphone capture (`AccentPipeline.dll`)
- End-to-end audio routing into Teams/Zoom

---

## Requested action

Please grant temporary local admin rights, OR run the install commands above on my behalf, OR whitelist the VS installer and VB-Audio driver in Group Policy.

Thank you.
