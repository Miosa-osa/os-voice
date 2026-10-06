#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { chmodSync, existsSync, watch } from "node:fs";
import { join } from "node:path";

// macOS ties Accessibility (and Input Monitoring) grants to a binary's
// designated requirement. Cargo emits an ad-hoc, linker-signed binary whose
// requirement is a bare `cdhash`, so every rebuild produces a different identity
// and macOS silently revokes the grant. The app then stops its key listener and
// dictation hotkeys go dead with no error shown.
//
// Signing with a real Developer ID replaces that cdhash requirement with an
// identity-based one (identifier + team OU), which survives rebuilds:
//
//   designated => identifier "com.osvoice.desktop.local" and anchor apple generic
//                 and certificate leaf[subject.OU] = "<team>"
//
// `tauri dev` builds and launches in a single blocking step, so there is no hook
// between the two. Watch the binary instead and re-sign it whenever cargo
// relinks it. Entirely optional: without a Developer ID in the keychain this is
// skipped and dev behaves exactly as before.
const DEV_SIGN_IDENTIFIER = "com.osvoice.desktop.local";

const tauriArgs = process.argv.slice(2);
const tauriCommand = tauriArgs[0];
const requestedTarget = readOptionValue(tauriArgs, "--target");

if (tauriCommand === "build" || tauriCommand === "dev") {
  const targets = resolveTargets(requestedTarget);
  const sidecarProfile =
    process.env.VOQUILL_SIDECAR_PROFILE ||
    (tauriCommand === "build" ? "release" : "debug");

  for (const target of targets) {
    const prepareEnv = {
      ...process.env,
      VOQUILL_SIDECAR_PROFILE: sidecarProfile,
    };

    if (target) {
      prepareEnv.CARGO_BUILD_TARGET = target;
    } else {
      delete prepareEnv.CARGO_BUILD_TARGET;
    }

    run("node", ["scripts/prepare-sidecars.mjs"], prepareEnv);
  }

  if (requestedTarget === "universal-apple-darwin") {
    composeUniversalMacSidecars();
  }
}

if (tauriCommand === "dev" && process.platform === "darwin") {
  // The signing watcher below relies on fs.watch callbacks and timers, so tauri
  // has to run asynchronously here. `run()` uses spawnSync, which blocks the
  // event loop for the entire dev session and would leave the watcher dormant.
  startDevSigningWatcher();
  runAsync("tauri", tauriArgs, process.env);
} else {
  run("tauri", tauriArgs, process.env);
}

function runAsync(command, args, env) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    stdio: "inherit",
    env,
    shell: true,
  });

  const forward = (signal) => {
    try {
      child.kill(signal);
    } catch {
      // child already gone
    }
  };
  process.on("SIGINT", () => forward("SIGINT"));
  process.on("SIGTERM", () => forward("SIGTERM"));

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });

  child.on("error", (error) => {
    process.stderr.write(
      `[tauri-sidecar] Failed to start ${command}: ${error.message}\n`,
    );
    process.exit(1);
  });
}

function startDevSigningWatcher() {
  const identity = resolveSigningIdentity();
  if (!identity) {
    process.stdout.write(
      "[tauri-sign] No Developer ID in keychain; skipping dev signing. " +
        "Accessibility permission will need re-granting after rebuilds.\n",
    );
    return;
  }

  const binaryPath = join(
    process.cwd(),
    "src-tauri",
    "target",
    "debug",
    "OSVoice",
  );
  const watchDir = join(process.cwd(), "src-tauri", "target", "debug");

  if (!existsSync(watchDir)) {
    return;
  }

  let pending = null;
  const signSoon = () => {
    clearTimeout(pending);
    // Cargo writes the binary in stages; wait for the link to settle so we do
    // not sign a half-written file.
    pending = setTimeout(() => signBinary(binaryPath, identity), 750);
  };

  try {
    watch(watchDir, (_event, filename) => {
      if (filename === "OSVoice") {
        signSoon();
      }
    });
  } catch {
    return;
  }

  if (existsSync(binaryPath)) {
    signSoon();
  }

  process.stdout.write(
    `[tauri-sign] Watching dev binary; will re-sign as ${DEV_SIGN_IDENTIFIER} using ${identity}\n`,
  );
}

function signBinary(binaryPath, identity) {
  if (!existsSync(binaryPath)) {
    return;
  }

  // Skip if this exact build is already signed by us, otherwise signing would
  // rewrite the file and retrigger the watcher forever.
  const current = spawnSync(
    "codesign",
    ["-d", "-r-", binaryPath],
    { encoding: "utf8" },
  );
  const requirement = `${current.stdout || ""}${current.stderr || ""}`;
  if (requirement.includes(`identifier "${DEV_SIGN_IDENTIFIER}"`)) {
    return;
  }

  const result = spawnSync(
    "codesign",
    [
      "--force",
      "--sign",
      identity,
      "--identifier",
      DEV_SIGN_IDENTIFIER,
      "--options",
      "runtime",
      binaryPath,
    ],
    { encoding: "utf8" },
  );

  if (result.status === 0) {
    process.stdout.write(
      "[tauri-sign] Signed dev binary; Accessibility grant will survive rebuilds\n",
    );
  } else {
    process.stderr.write(
      `[tauri-sign] Signing failed (non-fatal): ${(result.stderr || "").trim()}\n`,
    );
  }
}

function resolveSigningIdentity() {
  if (process.env.VOQUILL_DEV_SIGN_IDENTITY) {
    return process.env.VOQUILL_DEV_SIGN_IDENTITY;
  }

  const found = spawnSync(
    "security",
    ["find-identity", "-v", "-p", "codesigning"],
    { encoding: "utf8" },
  );

  if (found.status !== 0) {
    return null;
  }

  const match = (found.stdout || "").match(
    /"(Developer ID Application: [^"]+)"/,
  );
  return match ? match[1] : null;
}

function resolveTargets(requestedTarget) {
  if (!requestedTarget) {
    return [null];
  }

  if (requestedTarget === "universal-apple-darwin") {
    return ["aarch64-apple-darwin", "x86_64-apple-darwin"];
  }

  return [requestedTarget];
}

function readOptionValue(args, optionName) {
  const exactIndex = args.indexOf(optionName);
  if (exactIndex >= 0) {
    return args[exactIndex + 1] || null;
  }

  const inlinePrefix = `${optionName}=`;
  const inlineArg = args.find((arg) => arg.startsWith(inlinePrefix));
  if (!inlineArg) {
    return null;
  }

  const value = inlineArg.slice(inlinePrefix.length).trim();
  return value.length > 0 ? value : null;
}

function composeUniversalMacSidecars() {
  if (process.platform !== "darwin") {
    fail(
      "universal-apple-darwin sidecar composition requires a macOS runner with lipo",
    );
  }

  const binariesDir = join(process.cwd(), "src-tauri", "binaries");
  const sidecars = [
    "rust-transcription-cpu",
    "rust-transcription-gpu",
  ];

  for (const sidecarName of sidecars) {
    const arm64Path = join(binariesDir, `${sidecarName}-aarch64-apple-darwin`);
    const x64Path = join(binariesDir, `${sidecarName}-x86_64-apple-darwin`);
    const universalPath = join(
      binariesDir,
      `${sidecarName}-universal-apple-darwin`,
    );

    if (!existsSync(arm64Path) || !existsSync(x64Path)) {
      fail(
        `Missing architecture-specific sidecars for universal build: ${arm64Path}, ${x64Path}`,
      );
    }

    run(
      "lipo",
      ["-create", "-output", universalPath, arm64Path, x64Path],
      process.env,
    );
    chmodSync(universalPath, 0o755);

    process.stdout.write(
      `[tauri-sidecar] Prepared ${sidecarName} for universal-apple-darwin: ${universalPath}\n`,
    );
  }
}

function run(command, args, env) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: "inherit",
    env,
    shell: true,
  });

  if (result.status !== 0) {
    const rendered = [command, ...args].join(" ");
    process.stderr.write(
      `[tauri-sidecar] Command failed (${result.status ?? "unknown"}): ${rendered}\n`,
    );
    process.exit(result.status ?? 1);
  }
}

function fail(message) {
  process.stderr.write(`[tauri-sidecar] ${message}\n`);
  process.exit(1);
}
