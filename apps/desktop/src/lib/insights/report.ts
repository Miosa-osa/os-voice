import { invoke } from "@tauri-apps/api/core";
import dayjs from "dayjs";
import { UsageStats } from "./compute";
import { AiVoiceProfile, Coaching, DailyProfile } from "./profile.types";

const heading = (level: number, text: string): string =>
  `${"#".repeat(level)} ${text}`;

const bullets = (items: string[] | undefined): string =>
  items && items.length > 0 ? items.map((i) => `- ${i}`).join("\n") : "";

const section = (title: string, body: string): string =>
  body.trim() ? `${heading(2, title)}\n\n${body.trim()}\n` : "";

// A single day's snapshot rendered as a markdown section, reusable both as
// part of the full profile report and standalone (buildDailyReport below).
const renderDailySection = (daily: DailyProfile): string => {
  const lines: string[] = [];
  lines.push(`**Date:** ${dayjs(daily.date).format("MMMM D, YYYY")}`);
  lines.push(
    `**Words today:** ${daily.wordsToday.toLocaleString()} across ${daily.dictationsToday} dictation${daily.dictationsToday === 1 ? "" : "s"}`,
  );
  lines.push("");
  if (daily.summary) lines.push(daily.summary, "");
  if (daily.mood || daily.energy) {
    lines.push(
      `**Mood:** ${daily.mood || "—"}  \n**Energy:** ${daily.energy || "—"}`,
      "",
    );
  }
  if (daily.focus.length > 0) {
    lines.push("**Focused on today:**", bullets(daily.focus), "");
  }
  if (daily.notable) {
    lines.push(`**Notable moment:** ${daily.notable}`, "");
  }
  if (daily.howYouSpokeToday) {
    lines.push(`**How you spoke today:** ${daily.howYouSpokeToday}`, "");
  }
  if (daily.comparedToUsual) {
    lines.push(`**Compared to usual:** ${daily.comparedToUsual}`, "");
  }
  return lines.join("\n");
};

export type ProfileReportInput = {
  profile: AiVoiceProfile;
  usage: UsageStats;
  // Falls back to profile.coaching when omitted.
  coaching?: Coaching;
  // When provided, appends a "Daily snapshot" section for that day.
  daily?: DailyProfile | null;
};

// Builds a clean markdown report for the stable CORE profile: portrait,
// identity, personality, motivations, expertise, ubiquitous language, how you
// think/speak, coaching, key stats, and (optionally) today's daily snapshot.
export const buildProfileReport = (input: ProfileReportInput): string => {
  const { profile, usage, daily } = input;
  const coaching = input.coaching ?? profile.coaching;
  const generatedAt = dayjs().format("MMMM D, YYYY [at] h:mm A");

  const parts: string[] = [];
  parts.push(heading(1, `${profile.name || "Your voice profile"}`));
  parts.push(`*Generated ${generatedAt}*`);
  parts.push("");

  if (profile.identity) parts.push(profile.identity, "");

  parts.push(section("Portrait", profile.portrait ?? ""));

  const keyStats = [
    `**Total words dictated:** ${usage.totalWords.toLocaleString()}`,
    `**Total dictations:** ${usage.totalDictations.toLocaleString()}`,
    `**Speaking pace:** ${usage.wpm} words/min`,
    `**Current streak:** ${usage.currentStreak} day${usage.currentStreak === 1 ? "" : "s"}`,
    `**Longest streak:** ${usage.longestStreak} day${usage.longestStreak === 1 ? "" : "s"}`,
  ].join("  \n");
  parts.push(section("Key stats", keyStats));

  if (profile.personality && profile.personality.length > 0) {
    parts.push(section("Personality", bullets(profile.personality)));
  }
  if (profile.motivations && profile.motivations.length > 0) {
    parts.push(section("What drives you", bullets(profile.motivations)));
  }
  if (profile.mindsetPatterns && profile.mindsetPatterns.length > 0) {
    parts.push(
      section("How your mind moves", bullets(profile.mindsetPatterns)),
    );
  }
  if (profile.howYouThink) {
    parts.push(section("How you think", profile.howYouThink));
  }
  if (profile.expertise && profile.expertise.length > 0) {
    parts.push(section("Your expertise", bullets(profile.expertise)));
  }
  if (profile.whatYouCareAbout && profile.whatYouCareAbout.length > 0) {
    parts.push(
      section("What you care about", bullets(profile.whatYouCareAbout)),
    );
  }
  if (profile.ubiquitousLanguage && profile.ubiquitousLanguage.length > 0) {
    parts.push(
      section(
        "Your ubiquitous language",
        profile.ubiquitousLanguage.join(", "),
      ),
    );
  }
  if (profile.howYouSpeak) {
    parts.push(section("How you speak", profile.howYouSpeak));
  }
  if (profile.communicationSuperpower) {
    parts.push(
      section("Your communication superpower", profile.communicationSuperpower),
    );
  }
  if (profile.howOthersExperienceYou) {
    parts.push(section("How you come across", profile.howOthersExperienceYou));
  }
  if (profile.blindSpots && profile.blindSpots.length > 0) {
    parts.push(section("Blind spots", bullets(profile.blindSpots)));
  }

  if (
    coaching &&
    (coaching.strengths.length > 0 ||
      coaching.growthAreas.length > 0 ||
      coaching.suggestions.length > 0)
  ) {
    const coachingLines: string[] = [];
    if (coaching.strengths.length > 0) {
      coachingLines.push(
        "**What you do well**",
        bullets(coaching.strengths),
        "",
      );
    }
    if (coaching.growthAreas.length > 0) {
      coachingLines.push(
        "**Where to grow**",
        bullets(coaching.growthAreas),
        "",
      );
    }
    if (coaching.suggestions.length > 0) {
      coachingLines.push(
        "**Try this next**",
        bullets(coaching.suggestions),
        "",
      );
    }
    parts.push(section("Coaching", coachingLines.join("\n")));
  }

  if (daily) {
    parts.push(
      section(`Daily snapshot: ${daily.date}`, renderDailySection(daily)),
    );
  }

  return parts.filter(Boolean).join("\n");
};

// A standalone markdown report for a single day's snapshot.
export const buildDailyReport = (
  daily: DailyProfile,
  opts?: { profileName?: string },
): string => {
  const generatedAt = dayjs().format("MMMM D, YYYY [at] h:mm A");
  const title = opts?.profileName
    ? `${opts.profileName} — Daily snapshot`
    : "Daily snapshot";
  return [
    heading(1, `${title}: ${dayjs(daily.date).format("MMMM D, YYYY")}`),
    `*Generated ${generatedAt}*`,
    "",
    renderDailySection(daily),
  ].join("\n");
};

// Saves report content to disk via the native save dialog. Reuses the same
// Tauri `export_dictionary` command already used for dictionary/transcript
// exports elsewhere in the app — it just saves a text file via a save
// dialog, regardless of the logical content. Resolves to `false` if the user
// cancels the save dialog.
export const downloadReport = async (
  filename: string,
  contents: string,
): Promise<boolean> => {
  return invoke<boolean>("export_dictionary", { filename, contents });
};
