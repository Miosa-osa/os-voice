import { invoke } from "@tauri-apps/api/core";
import type { ChatMessage, ToolPermission } from "@voquill/types";
import { isEqual } from "lodash-es";
import { useEffect, useRef } from "react";
import type { AppState, StreamingMessageState } from "../../state/app.state";
import { getAppState, useAppStore } from "../../store";
import { getLogger } from "../../utils/log.utils";

export const OverlaySyncSideEffects = () => {
  useNativePillAssistantSync();
  usePillPhaseSelfHeal();

  return null;
};

// Every phase push to the native pill (invoke("set_phase", ...)) is
// fire-and-forget with swallowed errors — see strategies/*.strategy.ts and
// DictationSideEffects.tsx. If the "idle" push at the end of a recording is
// dropped, the pill can be left stuck showing a stale phase (e.g. a
// waveform) with nothing to self-heal it. This is a pure safety net: it only
// reconciles the well-defined idle transition (recording/agent session
// ended) against the native-confirmed `overlayPhase`, and never touches the
// "recording"/"loading" transitions so it can't fight legitimate in-flight
// phase changes.
const PHASE_RECONCILE_RETRY_MS = 500;
const PHASE_RECONCILE_MAX_ATTEMPTS = 6;

const usePillPhaseSelfHeal = () => {
  const activeRecordingMode = useAppStore((s) => s.activeRecordingMode);
  const overlayPhase = useAppStore((s) => s.overlayPhase);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // Nothing to heal: either a session is active (leave "recording"/"loading"
    // alone) or the pill has already confirmed idle.
    if (activeRecordingMode !== null || overlayPhase === "idle") {
      return;
    }

    let attempt = 0;
    const reassertIdle = () => {
      attempt += 1;

      // Re-read live state instead of the closed-over values: a new
      // recording may have started, or the native ack may have landed,
      // since this timer was scheduled.
      const state = getAppState();
      if (state.activeRecordingMode !== null || state.overlayPhase === "idle") {
        return;
      }

      invoke<void>("set_phase", { phase: "idle" }).catch((error) => {
        getLogger().verbose(`Pill idle self-heal retry failed: ${error}`);
      });

      if (attempt < PHASE_RECONCILE_MAX_ATTEMPTS) {
        timerRef.current = setTimeout(reassertIdle, PHASE_RECONCILE_RETRY_MS);
      }
    };

    timerRef.current = setTimeout(reassertIdle, PHASE_RECONCILE_RETRY_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [activeRecordingMode, overlayPhase]);
};

type NativePillPayload = {
  type: "assistant_state";
  active: boolean;
  input_mode: string;
  compact: boolean;
  conversation_id: string | null;
  user_prompt: string | null;
  messages: {
    id: string;
    content: string | null;
    is_error: boolean;
    is_tool_result: boolean;
    tool_name: string | null;
    tool_description: string | null;
    reason: string | null;
  }[];
  streaming: {
    message_id: string;
    tool_calls: { id: string; name: string; done: boolean }[];
    reasoning: string;
    is_streaming: boolean;
  } | null;
  permissions: {
    id: string;
    tool_name: string;
    description: string | null;
    reason: string | null;
  }[];
};

const formatPromptPreview = (text: string): string | null => {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (!normalized) return null;
  const words = normalized.split(" ");
  if (words.length <= 9) return normalized;
  return `${words.slice(0, 4).join(" ")} ... ${words.slice(-5).join(" ")}`;
};

const buildNativePillMessages = (
  messages: ChatMessage[],
  streamingById: Record<string, StreamingMessageState>,
  toolInfoById: Record<string, { description: string }>,
): NativePillPayload["messages"] => {
  return messages
    .filter((m) => {
      if (m.role === "user") return false;
      if (m.role === "assistant" && !m.content?.trim()) {
        return !!streamingById[m.id];
      }
      return true;
    })
    .map((m) => {
      const meta = m.metadata as Record<string, unknown> | null;
      const isToolResult = meta?.type === "tool-result";
      const toolName = (meta?.toolName as string) ?? null;
      const reason = (meta?.reason as string) ?? null;
      const toolInfo = toolName ? toolInfoById[toolName] : undefined;
      return {
        id: m.id,
        content: m.content || null,
        is_error: m.role === "system",
        is_tool_result: isToolResult,
        tool_name: toolName,
        tool_description: toolInfo?.description ?? null,
        reason,
      };
    });
};

const buildNativePillStreaming = (
  messages: ChatMessage[],
  streamingById: Record<string, StreamingMessageState>,
): NativePillPayload["streaming"] => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const streaming = streamingById[msg.id];
    if (streaming) {
      return {
        message_id: msg.id,
        tool_calls: streaming.toolCalls.map((tc) => ({
          id: tc.toolCallId,
          name: tc.toolName,
          done: tc.done,
        })),
        reasoning: streaming.reasoning,
        is_streaming: streaming.isStreaming,
      };
    }
  }
  return null;
};

const buildNativePillPermissions = (
  permissions: Record<string, ToolPermission>,
  conversationId: string | null,
  toolInfoById: Record<string, { description: string }>,
): NativePillPayload["permissions"] => {
  if (!conversationId) return [];
  return Object.values(permissions)
    .filter(
      (p) => p.conversationId === conversationId && p.status === "pending",
    )
    .map((p) => ({
      id: p.id,
      tool_name: p.toolId,
      description: toolInfoById[p.toolId]?.description ?? null,
      reason: null,
    }));
};

type NativePillSyncState = {
  activeRecordingMode: AppState["activeRecordingMode"];
  assistantInputMode: AppState["assistantInputMode"];
  pillConversationId: AppState["pillConversationId"];
  chatMessageById: AppState["chatMessageById"];
  chatMessageIdsByConversationId: AppState["chatMessageIdsByConversationId"];
  toolPermissionById: AppState["toolPermissionById"];
  toolInfoById: AppState["toolInfoById"];
  streamingMessageById: AppState["streamingMessageById"];
};

const selectNativePillState = (s: AppState): NativePillSyncState => ({
  activeRecordingMode: s.activeRecordingMode,
  assistantInputMode: s.assistantInputMode,
  pillConversationId: s.pillConversationId,
  chatMessageById: s.chatMessageById,
  chatMessageIdsByConversationId: s.chatMessageIdsByConversationId,
  toolPermissionById: s.toolPermissionById,
  toolInfoById: s.toolInfoById,
  streamingMessageById: s.streamingMessageById,
});

const useNativePillAssistantSync = () => {
  const state = useAppStore(selectNativePillState);
  const prevRef = useRef<NativePillSyncState | null>(null);

  useEffect(() => {
    if (prevRef.current !== null && isEqual(prevRef.current, state)) {
      return;
    }
    prevRef.current = state;

    const active = state.activeRecordingMode === "agent";

    const conversationId = state.pillConversationId ?? null;
    const messageIds = conversationId
      ? (state.chatMessageIdsByConversationId[conversationId] ?? [])
      : [];
    const messages: ChatMessage[] = messageIds
      .map((id) => state.chatMessageById[id])
      .filter((m): m is ChatMessage => !!m);

    const pillMessages = buildNativePillMessages(
      messages,
      state.streamingMessageById,
      state.toolInfoById,
    );
    const streaming = buildNativePillStreaming(
      messages,
      state.streamingMessageById,
    );
    const permissions = buildNativePillPermissions(
      state.toolPermissionById,
      conversationId,
      state.toolInfoById,
    );

    const latestUserMessage = messages
      .slice()
      .reverse()
      .find((m) => m.role === "user");
    const userPrompt = latestUserMessage?.content
      ? formatPromptPreview(latestUserMessage.content)
      : null;

    const compact =
      state.assistantInputMode !== "type" &&
      messages.length === 0 &&
      permissions.length === 0;

    const payload: NativePillPayload = {
      type: "assistant_state",
      active,
      input_mode: state.assistantInputMode ?? "voice",
      compact,
      conversation_id: conversationId,
      user_prompt: userPrompt,
      messages: pillMessages,
      streaming,
      permissions,
    };

    invoke("sync_native_pill_assistant", {
      payload: JSON.stringify(payload),
    }).catch(() => {});
  }, [state]);
};
