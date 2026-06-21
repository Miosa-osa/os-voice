<div align="center">

<img src="apps/desktop/src/assets/app-logo.svg" alt="OS Voice" width="110" />

# OS Voice

### Your voice is your new keyboard.

**Local-first, AI-powered voice-to-text that types into any app — private by design.**

A product of **[OSA](https://osa.dev)** · by **[Miosa.ai](https://miosa.ai)**

</div>

---

## What it is

**OS Voice** is a cross-platform desktop dictation app. Tap a hotkey, speak, and your words are transcribed locally and typed into whatever app you're using — then optionally cleaned up by a local AI into structured, polished text. Everything can run **100% offline**: no account, no cloud, no telemetry.

## Highlights

- 🎙️ **Press-to-talk or hands-free** — tap `Ctrl+Space` to lock the mic and dictate a whole paragraph; tap again to stop.
- ⚡ **Local Whisper transcription** — runs on CPU or GPU (Vulkan). On a modern GPU, the Turbo model transcribes faster than real time.
- 🧠 **Local AI cleanup** — pipe the raw transcript through a local LLM (via [Ollama](https://ollama.com)) to remove filler, fix punctuation, handle spoken commands ("period", "quote … unquote"), and split into topic-based paragraphs.
- ✍️ **Writing styles** — switch tone (Polished / Structured / Email / Verbatim) on the fly.
- 📖 **Personal dictionary** — teach it your names, jargon, and replacement rules so they're always spelled right.
- 🌍 **100+ languages**, transcript history, all stored locally in SQLite.
- 🔒 **Private by design** — local models mean your audio and text never leave your machine.

## Tech

Tauri 2 (Rust + TypeScript/React) · `whisper.cpp` (CPU + Vulkan GPU) via a sidecar engine · Ollama for AI post-processing · SQLite · Turborepo monorepo.

## Build & run (Linux)

Requires Node 18+, Rust, and the system deps in `apps/desktop/scripts/setup-linux.sh` (plus `glslc` for the GPU build).

```bash
pnpm install
cd apps/desktop
pnpm run prepare:sidecars        # builds the Whisper engine + native pill
pnpm exec tauri build --bundles deb
```

See `CLAUDE.md` and `apps/desktop/scripts/setup-linux.sh` for full platform details.

## Credits & license

OS Voice is a rebrand and continuation of the excellent open-source **[Voquill](https://github.com/voquill/voquill)** by **Voquill, Inc.** Enormous thanks to the Voquill team and contributors — this project would not exist without their work. 🙏

This project is licensed under the **GNU AGPLv3** (see [LICENSE](LICENSE)), the same license as upstream Voquill. Per the AGPL, the full source is available here and any modifications remain open.

> "OS Voice", "OSA", and "Miosa" branding © Miosa.ai. The underlying application is © 2025–present Voquill, Inc., used and modified under the AGPLv3.
