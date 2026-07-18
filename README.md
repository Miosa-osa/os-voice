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

## 🎚️ Recommended models

**Transcription (Whisper)** — set in Settings → Transcription:

| Model | Best for |
|---|---|
| `large-v3-turbo` (**Turbo**) | **GPU** — top accuracy, many× faster than real time |
| `small` | **CPU** — great balance of speed + accuracy |
| `base` / `tiny` | low-end hardware / maximum speed |

**AI cleanup (Ollama)** — set in Settings → AI Post-Processing. Pick by your hardware:

| Model | Notes |
|---|---|
| `gemma4:12b` | **Recommended** — best topic-paragraph structure, faithful to your words (~1s on a strong GPU) |
| `qwen2.5:14b` | Solid all-rounder — faithful, good structure |
| `qwen3.5:9b` | Fastest faithful option; lighter on paragraph structure |
| `granite4.1:8b` | Faithful, instruction-tuned (IBM) |
| `llama3.2:3b` | Tiny + near-instant (~0.3s) — great for modest hardware |

All run **locally** via Ollama. Heavier models give better structure at the cost of more VRAM/latency; smaller ones are instant. The cleanup is **faithful by design** — it reformats your words and never invents content. Requires a recent Ollama (`ollama --version` ≥ 0.30) to pull the newest models.

## 💻 Hardware requirements

OS Voice runs entirely on your own machine. Whisper transcription always runs locally; AI cleanup (Ollama) is optional and also fully local. Sizing depends on which Whisper model and which Ollama model you pick — see **Recommended models** above.

Available Whisper models (download automatically on first use, from `huggingface.co/ggerganov/whisper.cpp`): `tiny`, `base`, `small`, `medium`, `large-v3` (`large`), `large-v3-turbo` (`large-turbo` — the recommended **Turbo** model).

| Tier | Hardware | Whisper model | AI cleanup (Ollama) | Notes |
|---|---|---|---|---|
| **Low-end** | Any modern CPU | `tiny` / `base` | Off | Smallest, fastest-to-download models; slower transcription, fine for short bursts |
| **Mid** | CPU, or entry-level GPU | `small` (CPU) / `medium` (GPU) | Optional — light model (`llama3.2:3b`, `qwen3.5:9b`) | Good balance of speed and accuracy |
| **High** | Dedicated GPU (Vulkan/CUDA) or Apple Silicon | `large-v3-turbo` (**Turbo**) | Yes — `gemma4:12b` / `qwen2.5:14b` or bigger | **Turbo needs GPU acceleration** (Vulkan on Linux/Windows, CUDA, or Apple Silicon) to hit its "many× faster than real time" speed — on CPU-only it's much slower, like the other large models |
| **Reference machine** | Mac Studio M3 Ultra, 96GB unified memory | `large-v3-turbo` | Yes — large local or Ollama cloud models | Enough headroom to run the top Whisper model and a large cleanup model at the same time with no compromises |

Approximate guidance (exact figures vary by build/quantization — treat as ballpark, not a spec):
- **Whisper models**: `tiny`/`base` are small downloads (tens of MB) and run comfortably on CPU; `small`/`medium` are roughly in the hundreds of MB up to ~1.5GB; `large-v3`/`large-v3-turbo` are roughly 1.5–3GB and benefit heavily from GPU acceleration. Each model is downloaded once and cached locally.
- **Ollama cleanup models**: a 3B model like `llama3.2:3b` needs only a few GB of RAM/VRAM and responds almost instantly; `gemma4:12b`/`qwen2.5:14b`-class models need roughly 8–16GB of RAM/VRAM depending on quantization; bigger models need more. Apple Silicon uses unified memory (shared between CPU/GPU), so a high-RAM Apple Silicon Mac can run both Turbo transcription and a large local LLM at once.
- **Disk**: budget a few GB if you try multiple Whisper models, plus a few GB per Ollama model you pull.

## 📥 Installing (end users)

Prebuilt installers are published to [GitHub Releases](https://github.com/Miosa-osa/os-voice/releases). Pick the package for your OS.

**Linux** — `.deb`, `.rpm`, or a portable **AppImage**. The `.deb`/`.rpm` install these runtime dependencies automatically (install them manually if you use the AppImage):

| Purpose | Debian/Ubuntu (`.deb`) | Fedora/openSUSE (`.rpm`) |
|---|---|---|
| Input injection (X11) | `libxdo3`, `xdotool` | `xdotool` |
| GPU transcription (Vulkan) | `libvulkan1` | `vulkan-loader` |
| Overlay pill (Wayland layer-shell) | `libgtk-layer-shell0` | `gtk-layer-shell` |
| Wayland typing | `wtype` | `wtype` |

**Windows** — `.msi` installer (bundles the WebView2 bootstrapper), or the NSIS `.exe` installer; a portable, no-admin `.exe` installer is also published.

**macOS** — `.dmg` (drag-to-Applications, universal Apple Silicon + Intel binary) or `.pkg`. Requires macOS 13.3 (Ventura) or later.

**After installing:**
- **Whisper transcription models download automatically** the first time you select them in Settings → Transcription — no manual setup.
- **AI cleanup is optional** and requires [Ollama](https://ollama.com) installed **separately**. Install Ollama, then pull a model (see **Recommended models** above), e.g.:
  ```bash
  ollama pull gemma4:12b
  ```
  Then enable it in Settings → AI Post-Processing.

## 🚀 Build & run (Linux)

Requires **Node 18+**, **Rust**, and the system deps in `apps/desktop/scripts/setup-linux.sh` (plus `glslc` for the GPU build, and `ydotool`/`wtype` for Wayland typing).

```bash
pnpm install
cd apps/desktop
pnpm run prepare:sidecars          # builds the Whisper engine + native pill
pnpm exec tauri build --bundles deb
```

For local **AI cleanup**, install [Ollama](https://ollama.com) and pull a model (e.g. `ollama pull gemma4:12b` — see **Recommended models** above), then enable it in **Settings → AI Post-Processing**.

See `CLAUDE.md` and `apps/desktop/scripts/setup-linux.sh` for full platform details.

---

## 🙏 Credits & license

OS Voice is a rebrand and continuation of the excellent open-source **[Voquill](https://github.com/voquill/voquill)** by **Voquill, Inc.** and its contributors. The architecture, Whisper engine, overlay, and essentially all of the application code originate from Voquill — **this project would not exist without their work.** Please go support them. ❤️ (See [CREDITS.md](CREDITS.md).)

Licensed under the **GNU AGPLv3** (see [LICENSE](LICENSE)), the same license as upstream Voquill — the full source is here and all modifications remain open.

> "OS Voice", "OSA", and "Miosa" branding © Miosa.ai. The underlying application is © 2025–present Voquill, Inc., used and modified under the AGPLv3. Bundled config files use placeholder/redacted credentials — supply your own to enable optional cloud features.
