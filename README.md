<div align="center">

<img src="apps/desktop/src/assets/app-logo.svg" alt="OS Voice" width="110" />

# OS Voice

### Your voice is your new keyboard.

**Local-first, AI-powered voice-to-text that types into any app — private by design.**

A product of **[OSA](https://osa.dev)** · by **[Miosa.ai](https://miosa.ai)**

</div>

---

## What it is

**OS Voice** turns your voice into clean, structured text in any application. Press a hotkey, talk, and your words are transcribed locally, optionally polished by a local AI, and typed straight into whatever you're using — your editor, browser, chat, anywhere. It can run **100% offline**: no account, no cloud, no telemetry.

---

## ✨ Features

### 🎙️ Dictate anywhere — press-to-talk *or* hands-free
- **Tap** `Ctrl+Space` to **lock the mic** and dictate a whole paragraph without holding anything; **tap again** to stop.
- **Hold** the key for classic push-to-talk.
- Cancel a take instantly with the pill's ✕ or the cancel hotkey.
- Output is typed directly into the focused app (uses `ydotool`/`wtype` on Wayland, native input elsewhere).

### ⚡ Local Whisper transcription, GPU-accelerated
- Runs `whisper.cpp` **on your machine** — CPU or **GPU (Vulkan / CUDA)**.
- Model sizes from **Tiny → Large-v3-Turbo**; pick speed vs accuracy.
- On a modern GPU the **Turbo** model transcribes **dozens of times faster than real time** (a 10-second clip in a fraction of a second).
- Fully offline — your audio never leaves the device.

### 🧠 Local AI cleanup — the smart layer
Pipe the raw transcript through a **local LLM** (via [Ollama](https://ollama.com)) to get polished, structured writing:
- **Context-aware commands** — say "period" and it adds a `.` when you mean punctuation, but keeps the word when you mean the thing. Say "quote … unquote" and it wraps the phrase in quotation marks.
- **Filler removal** — drops "um", "uh", "you know", false starts, and repetitions.
- **Topic-based paragraphs** — automatically starts a new paragraph when you switch subjects, so a rambling brain-dump comes out structured.
- **Faithful** — keeps *your* words and voice; it cleans, it doesn't invent content.
- **No em-dashes** (and other house-style rules) — fully configurable via tones.
- Swap the cleanup model anytime (qwen3.5, qwen2.5, llama3.2, granite4.1, gemma4, …).

### ✍️ Writing styles (tones)
Switch how your words come out — on the fly with the arrow keys:
- **Polished** — natural, cleaned-up prose
- **Structured** — topic paragraphs, lists, tidy formatting
- **Email** — greeting / body / sign-off
- **Verbatim** — exactly what you said, no editing

### 📖 Personal dictionary
Teach OS Voice your world so it's always right:
- **Glossary** terms (names, brands, jargon) bias recognition.
- **Replacement rules** ("when I say X, write Y") fix things instantly.

### 🌍 More
100+ languages with hotkey switching · searchable transcript history · everything stored locally in SQLite · encrypted local key storage.

---

## 🔧 How it works

```
  🎤 mic
   │
   ▼
 Whisper engine (local, GPU)  ──►  raw transcript
   │
   ▼
 Local LLM cleanup (Ollama, optional)  ──►  polished + structured text
   │
   ▼
 ⌨️  typed into your active app
```

"Rust is the API, TypeScript is the brain" — all logic lives in TypeScript; Rust provides native capabilities (audio, input injection, the Whisper sidecar, the overlay pill).

**Stack:** Tauri 2 (Rust + TypeScript/React) · `whisper.cpp` (CPU + Vulkan/CUDA) via a sidecar engine · Ollama for AI post-processing · SQLite · Turborepo monorepo.

---

## 🚀 Build & run (Linux)

Requires **Node 18+**, **Rust**, and the system deps in `apps/desktop/scripts/setup-linux.sh` (plus `glslc` for the GPU build, and `ydotool`/`wtype` for Wayland typing).

```bash
pnpm install
cd apps/desktop
pnpm run prepare:sidecars          # builds the Whisper engine + native pill
pnpm exec tauri build --bundles deb
```

For local **AI cleanup**, install [Ollama](https://ollama.com) and pull a model, e.g. `ollama pull qwen2.5:14b`, then enable it in **Settings → AI Post-Processing**.

See `CLAUDE.md` and `apps/desktop/scripts/setup-linux.sh` for full platform details.

---

## 🙏 Credits & license

OS Voice is a rebrand and continuation of the excellent open-source **[Voquill](https://github.com/voquill/voquill)** by **Voquill, Inc.** and its contributors. The architecture, Whisper engine, overlay, and essentially all of the application code originate from Voquill — **this project would not exist without their work.** Please go support them. ❤️ (See [CREDITS.md](CREDITS.md).)

Licensed under the **GNU AGPLv3** (see [LICENSE](LICENSE)), the same license as upstream Voquill — the full source is here and all modifications remain open.

> "OS Voice", "OSA", and "Miosa" branding © Miosa.ai. The underlying application is © 2025–present Voquill, Inc., used and modified under the AGPLv3. Bundled config files use placeholder/redacted credentials — supply your own to enable optional cloud features.
