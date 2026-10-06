
## Local desktop startup - 2026-09-07

The macOS login item `~/Library/LaunchAgents/OS Voice (local).plist` launches `apps/desktop/src-tauri/target/debug/OSVoice --voquill-autostart-hidden`.
This development binary requires the Vite frontend at `http://localhost:1420`; launching it without Vite produced an empty white window.
Starting Vite from `apps/desktop` with `--mode prod --host localhost` and restarting OSVoice restored frontend initialization and the local transcription sidecar.
The Vite process was started separately, so the existing login item still does not start this dependency after a reboot.

## Installed app and latency verification - 2026-09-07

Installed the signed release bundle at `/Applications/OS Voice.app`, retaining identifier `com.osvoice.desktop.local` to reuse the existing database and models.
Built the frontend in `prod` mode and both transcription sidecars in the optimized release profile, requiring native Metal GPU support.
The development server is stopped; the installed frontend loads from `tauri://localhost`.
Replaced the old development login item with `~/Library/LaunchAgents/OS Voice.plist`, labelled `OS Voice`, using `RunAtLoad=true`, `KeepAlive=true`, and a five-second restart throttle.
This intentionally restarts the app even after a normal Quit, matching Roberto's request to keep it running.
To stop that supervision intentionally, run `launchctl bootout "gui/$(id -u)/OS Voice"`; remove or change the plist separately to change the next login behavior.
The login item starts the app hidden; opening `/Applications/OS Voice.app` reveals the dashboard.
Avoid opening the app concurrently with initial LaunchAgent registration; wait until the managed process registers with LaunchServices to avoid duplicate startup.
Database and old login-item backups are in `~/Library/Application Support/OSVoice-maintenance/2026-09-07/`.

Removed the local speech engine's unconditional 30-minute idle shutdown, which otherwise discards the warmed model.
Session cleanup now runs asynchronously after transcription, removing a measured 119 ms delay before text delivery.
Regression tests exercise idle reuse and delayed session cleanup through the real sidecar class with mocked process and HTTP boundaries.
Eight targeted tests, TypeScript compilation, and targeted Prettier and oxlint checks passed.

On this M3 Ultra, the optimized Metal/Turbo sidecar transcribed a fixed five-second sentence correctly in 284-286 ms round-trip across three warm runs.
Cold model initialization was much slower, so the app's startup prewarm and retained model matter more than warm inference micro-optimizations.
After installation and recovery, a microphone-to-TextEdit test inserted `Voice is ready.` correctly using MouseButton4.
The final trace recorded stop at 10:55:49.388 and insertion completion at 10:55:49.947, approximately 559 ms, with zero warnings.
The completed text was also read back from TextEdit.
Automatic process recovery was verified by sending SIGTERM to managed PID 40906; launchd restarted it as PID 41738, with the dashboard, hotkey listener, and GPU prewarm verified afterward.
A physical reboot and sleep/wake cycle were not performed during the active session.

## Metal inference and long dictation latency - 2026-09-07

Enabled Flash Attention only in the Metal GPU build; CPU behavior is unchanged.
Replaced the plugin HTTP request sequence with one native command backed by a reused reqwest client, restricted to loopback sidecar routes with redirects disabled and an end-to-end timeout.
Transport failures now enter the existing sidecar recovery path.
The warm short fixtures improved about 15 percent in raw inference, and native tail upload fell from roughly 116 ms to 4-5 ms.

GPU dictation now processes sections in the background, preferring pauses after 18 seconds, with a 30-second maximum section and three seconds of overlap.
Ordered merging also runs while recording, so stopping normally waits only for the last section.
Audio ingestion continues while previous sections transcribe.
Unmatched overlap or section errors trigger the existing full-recording fallback, preserving the original audio rather than accepting uncertain stitching.
That fallback can take longer than the normal rolling path.

A 66-second audio replay improved finalization from 1291-1314 ms to 396-401 ms.
A 243-second replay improved finalization from 5183-5206 ms to 350-371 ms, with 14 sections finished before stop and normalized words identical to the baseline transcript.
These are accelerated audio replays through the production TypeScript rolling implementation and real Metal/Turbo sidecar at 20 times real time, not physical four-minute microphone-to-editor measurements.
The one-minute transcript matched its reference; the four-minute baseline and optimized transcript retained the same number-formatting differences from the reference.
Fixtures, outputs, scripts, and timing summaries are saved under `~/Library/Application Support/OSVoice-maintenance/2026-09-07/performance/`.

Validation passed 82 targeted TypeScript tests, four native transport tests, five speech-engine tests, TypeScript compilation, targeted lint and formatting, and diff whitespace checks.
After the final background-merge adjustment, the nine directly affected rolling and session integration tests passed again.
Installed and verified the final Developer ID signed bundle in `/Applications/OS Voice.app` and restarted the existing LaunchAgent.
The dashboard accessibility tree showed `Welcome back, Roberto` and `Mouse 4`, and startup logs confirmed permission authorization and Metal/Turbo prewarm.
The installed final build dictated `Voice is ready.` correctly into TextEdit, with stop at 11:19:15.459 and output completion at 11:19:15.849, or 390 ms, with zero transcription warnings.
Earlier successful short tests with the transport and Metal improvements measured 300 and 302 ms versus the 559 ms initial baseline.
The managed app and GPU child remain running without a development server.
A dock activation-policy error was logged when opening the app, although the dashboard surfaced successfully and dictation worked; no visible window failure was reproduced in final verification.

## Other-computer PR review - 2026-09-07

Reviewed open PRs 16, 17, and 18 via fetched review refs without applying their changes to the working app.
PR 16 head is exactly the local committed HEAD, 3c0fa0e; the current Mac speed changes are additional uncommitted work.
PR 17 is a Linux GNOME/Wayland compatibility change; its description reports an X11-to-Wayland session change after an update, not a Mac regression.
PR 18 head b711f35643d1d2bf9ee694c350f4c64345b42bed combines Linux fixes, shared dictation changes, and appearance features across 51 files.
Its committed_tail function panics on UTF-8 boundaries before its boundary check; compiling the exact extracted function and passing 60 Chinese characters reproduced the panic.
Its 700 ms early-stop guard conflicts with ActivationController's 500 ms hold threshold; a 600 ms hold/release reproduces an inactive controller with recording still active.
Its shared appearance settings call a no-op macOS notify_theme function, so those controls cannot change the native Mac pill.
Its new Rust streaming segmentation overlaps the local TypeScript rolling implementation and should not be integrated blindly.
The current PR 18 integration CI failure is missing GROQ_API_KEY; macOS lint fails on chunks_exact_to_as_chunks warnings, including both new and existing code.
Recommendation: retain useful binary IPC, GPU recovery, and raw-transcript preservation as focused changes after validation, keep Linux compatibility isolated, and revise PR 18 before integration.

## Feature integration and native Mac verification - 2026-09-07

Integrated the useful PR 17/18 work on branch `integrate/mac-features`, preserving the verified Mac performance snapshot in commit 50c39f9.
The candidate uses a separate worktree and was first built under `com.osvoice.desktop.candidate` with a copied settings database.
Its separate identity correctly required separate macOS microphone/accessibility permissions, so final microphone testing used the original signed application identity and existing grants after taking app/database backups.
The final signed app is installed at `/Applications/OS Voice.app` and supervised by the existing login LaunchAgent.
Backups are under `~/Library/Application Support/OSVoice-maintenance/2026-09-07/features/`.

Retained the TypeScript rolling transcription implementation, Metal Flash Attention, native sidecar transport, and warm model retention.
Excluded PR 18's duplicate Rust segmentation and its invalid 700 ms stop guard.
Integrated binary audio transfer and 16 kHz recording with an anti-aliasing FIR filter before downsampling.
The cloud WebSocket path now sends the Float32Array view, excluding the sample-rate header and respecting subarray bounds.
GPU recovery uses a temporary cooldown without overwriting the selected device or model; post-processing failure preserves the complete raw transcript.
Linux GNOME/Wayland compatibility changes remain in the Linux backend.
Linux desktop runtime and Windows runtime were not available for validation on this Mac.

Added native Mac support for all eleven waveform styles, gradients, background/border settings, glow, size and placement, idle appearance, timers, loading styles, and completion effects.
Theme decoding and waveform rendering are shared between Mac and GTK through `rust_pill_style`.
Nullable optional colors and malformed Unicode color inputs are covered by native tests.
Appearance controls edit a live Zustand draft and persist once on Save; Cancel restores the saved appearance and controls are disabled while saving.
Completion effects are triggered by successful output, not loading cleanup, and remain visible under active-only visibility.
The native renderer has an opt-in `render-preview` example for visual inspection without screen-capture permission.

Independent standards and feature reviews identified and verified fixes for GPU preference downgrades, stale appearance snapshots, binary header leakage, black gradient edges, and completion visibility/trigger semantics.
Validation passed 403 desktop unit tests, 41 desktop Rust tests, the native theme IPC test, and two shared theme tests.
Desktop TypeScript, Prettier, oxlint, desktop Clippy, shared-style Clippy, and native Mac Clippy passed.
The signed release build and signature verification passed.

Native accessibility checks confirmed the dashboard, Mouse 4 shortcut, appearance tabs, and presets.
Choosing Neon and cancelling left the saved appearance unchanged.
Saving Ocean persisted its expected pulse waveform and #5EEAD4 accent; Reset restored the default appearance afterward.
The microphone test inserted `Voice is ready.` into TextEdit with 16 kHz capture, stopping at 11:45:04.287 and completing output at 11:45:04.619, or 332 ms.
A 603 ms hold/release stopped and completed cleanup, verifying the rejected stop workaround is absent.
A roughly 25-second microphone recording processed its first section before release, then conservatively fell back to full-audio transcription when overlap text could not be reconciled.
That native long test completed output in 1029 ms after release, preserving the captured recording rather than accepting uncertain stitching.
The final production rolling code and real Metal sidecar completed 66-second accelerated replays in 417-420 ms and 243-second replays in 352-360 ms after stop, matching the previously verified normalized transcripts.
A physical reboot, sleep/wake cycle, and microphone-device switch were not performed.
