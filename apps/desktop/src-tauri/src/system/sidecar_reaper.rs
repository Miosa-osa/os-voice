use sysinfo::System;

/// Kill any leftover transcription-engine sidecars (`rust-transcription-gpu` /
/// `rust-transcription-cpu`) that were orphaned by a previous crash or hard
/// kill of the app. Each sidecar holds a loaded model in (V)RAM, so orphans
/// accumulate across unclean exits and exhaust memory. Called once on startup,
/// before this instance spawns its own engine, so any match is a stale orphan.
/// Returns the number of processes killed.
pub fn reap_orphan_transcription_sidecars() -> usize {
    let current = sysinfo::get_current_pid().ok();
    let sys = System::new_all();

    let mut killed = 0usize;
    for (pid, process) in sys.processes() {
        if Some(*pid) == current {
            continue;
        }

        // Match on the executable basename when available (full, untruncated),
        // and fall back to the process name — which Linux truncates to 15 chars
        // ("rust-transcript"), a valid prefix of the real binary names on every
        // platform.
        let is_sidecar = process
            .exe()
            .and_then(|path| path.file_name())
            .map(|name| name.to_string_lossy().starts_with("rust-transcription"))
            .unwrap_or(false)
            || process.name().to_string_lossy().starts_with("rust-transcript");

        if is_sidecar && process.kill() {
            killed += 1;
        }
    }

    killed
}
