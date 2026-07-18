import BookmarkAddOutlinedIcon from "@mui/icons-material/BookmarkAddOutlined";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import StarOutlineRoundedIcon from "@mui/icons-material/StarOutlineRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import {
  Alert,
  Chip,
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { getRec } from "@voquill/utilities";
import { invoke } from "@tauri-apps/api/core";
import dayjs from "dayjs";
import { useCallback, useMemo, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { showErrorSnackbar, showSnackbar } from "../../actions/app.actions";
import { sendTextToActiveRemoteTarget } from "../../actions/remote-output.actions";
import {
  openFlagTranscriptionDialog,
  openRetranscribeDialog,
  openTranscriptionDetailsDialog,
} from "../../actions/transcriptions.actions";
import { useLocalStorage } from "../../hooks/local-storage.hooks";
import {
  addRecurringCorrectionToDictionary,
  RecurringCorrection,
} from "../../lib/vocab/recurring-corrections";
import { getTranscriptionRepo } from "../../repos";
import { produceAppState, useAppStore } from "../../store";
import { getActiveRemoteTarget } from "../../utils/device.utils";
import { getIsVoquillCloudUser } from "../../utils/member.utils";
import { TypographyWithMore } from "../common/TypographyWithMore";
import { AudioPlayerPill } from "./AudioPlayerPill";

export type TranscriptionRowProps = {
  id: string;
  // A recurring "you keep correcting X -> Y" nudge, resolved by the page
  // from the loaded history + dictionary. Only ever attached to a single
  // row per correction, so it never repeats.
  nudge?: RecurringCorrection;
  // Favorite state + toggle are resolved by the page from a localStorage-backed
  // set of transcription ids, so "saved" items persist without any DB change.
  isFavorite?: boolean;
  onToggleFavorite?: (id: string) => void;
};

const DISMISSED_CORRECTION_NUDGES_KEY = "voquill:dismissed-correction-nudges";

export const TranscriptionRow = ({
  id,
  nudge,
  isFavorite = false,
  onToggleFavorite,
}: TranscriptionRowProps) => {
  const intl = useIntl();
  const isCloudUser = useAppStore(getIsVoquillCloudUser);
  const transcription = useAppStore((state) =>
    getRec(state.transcriptionById, id),
  );

  const [dismissedNudges, setDismissedNudges] = useLocalStorage<string[]>(
    DISMISSED_CORRECTION_NUDGES_KEY,
    [],
  );
  const [isAddingNudge, setIsAddingNudge] = useState(false);

  const visibleNudge =
    nudge && !dismissedNudges.includes(nudge.source.toLowerCase())
      ? nudge
      : undefined;

  const handleDismissNudge = useCallback(() => {
    if (!nudge) return;
    const key = nudge.source.toLowerCase();
    if (dismissedNudges.includes(key)) return;
    setDismissedNudges([...dismissedNudges, key]);
  }, [nudge, dismissedNudges, setDismissedNudges]);

  const handleAddNudgeToDictionary = useCallback(async () => {
    if (!nudge) return;
    setIsAddingNudge(true);
    try {
      await addRecurringCorrectionToDictionary(nudge);
      showSnackbar(
        intl.formatMessage(
          { defaultMessage: 'Added "{source}" to your dictionary' },
          { source: nudge.source },
        ),
        { mode: "success" },
      );
    } catch (error) {
      showErrorSnackbar(error);
    } finally {
      setIsAddingNudge(false);
    }
  }, [intl, nudge]);

  const hasMetadata = useMemo(() => {
    const model = transcription?.modelSize?.trim();
    const device = transcription?.inferenceDevice?.trim();
    return Boolean(model || device);
  }, [transcription?.inferenceDevice, transcription?.modelSize]);

  const isRetranscribing = useAppStore((state) =>
    state.transcriptions.retranscribingIds.includes(id),
  );

  const audioSnapshot = transcription?.audio;
  const activeRemoteTarget = useAppStore(getActiveRemoteTarget);
  const isRemoteTranscript = transcription?.remoteStatus === "received";
  const isSentToRemote = transcription?.remoteStatus === "sent";

  const handleDetailsOpen = useCallback(() => {
    openTranscriptionDetailsDialog(id);
  }, [id]);

  const handleCopyTranscript = useCallback(
    async (content: string) => {
      try {
        await navigator.clipboard.writeText(content);
        showSnackbar(
          intl.formatMessage({ defaultMessage: "Copied successfully" }),
          { mode: "success" },
        );
      } catch (error) {
        showErrorSnackbar(error);
      }
    },
    [intl],
  );

  const handleDeleteTranscript = useCallback(
    async (id: string) => {
      try {
        produceAppState((draft) => {
          delete draft.transcriptionById[id];
          draft.transcriptions.transcriptionIds =
            draft.transcriptions.transcriptionIds.filter(
              (transcriptionId) => transcriptionId !== id,
            );
        });
        await getTranscriptionRepo().deleteTranscription(id);
        showSnackbar(
          intl.formatMessage({ defaultMessage: "Delete successful" }),
          { mode: "success" },
        );
      } catch (error) {
        showErrorSnackbar(error);
      }
    },
    [intl],
  );

  const handleExport = useCallback(async () => {
    try {
      const saved = await invoke<boolean>("export_transcription", { id });
      if (saved) {
        showSnackbar(
          intl.formatMessage({ defaultMessage: "Export saved successfully" }),
          { mode: "success" },
        );
      }
    } catch (error) {
      showErrorSnackbar(error);
    }
  }, [id, intl]);

  const handleSendToReceiver = useCallback(async () => {
    try {
      await sendTextToActiveRemoteTarget(transcription?.transcript || "");
    } catch (error) {
      showErrorSnackbar(error);
    }
  }, [transcription?.transcript]);

  const handleToggleFavorite = useCallback(() => {
    onToggleFavorite?.(id);
  }, [id, onToggleFavorite]);

  const addToFavoritesLabel = intl.formatMessage({
    defaultMessage: "Add to favorites",
  });
  const removeFromFavoritesLabel = intl.formatMessage({
    defaultMessage: "Remove from favorites",
  });
  const favoriteToggleLabel = isFavorite
    ? removeFromFavoritesLabel
    : addToFavoritesLabel;

  return (
    <>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        mt={1.5}
        spacing={1}
      >
        <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
          <Typography variant="subtitle2" color="text.secondary">
            {dayjs(transcription?.createdAt).format("MMM D, YYYY h:mm A")}
          </Typography>
          {isRemoteTranscript && (
            <Chip
              size="small"
              variant="outlined"
              label={intl.formatMessage({ defaultMessage: "Remote" })}
            />
          )}
          {isSentToRemote && (
            <Chip
              size="small"
              variant="outlined"
              label={intl.formatMessage({ defaultMessage: "Sent" })}
            />
          )}
        </Stack>
        <Stack direction="row" spacing={1}>
          <Tooltip title={favoriteToggleLabel} placement="top">
            <IconButton
              aria-label={favoriteToggleLabel}
              aria-pressed={isFavorite}
              onClick={handleToggleFavorite}
              size="small"
              color={isFavorite ? "primary" : "default"}
            >
              {isFavorite ? (
                <StarRoundedIcon fontSize="small" />
              ) : (
                <StarOutlineRoundedIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
          <Tooltip
            title={intl.formatMessage({
              defaultMessage: "View transcription details",
            })}
            placement="top"
          >
            <IconButton
              aria-label={intl.formatMessage({
                defaultMessage: "View transcription details",
              })}
              onClick={handleDetailsOpen}
              size="small"
              color={hasMetadata ? "primary" : "default"}
            >
              <InfoOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip
            title={intl.formatMessage({ defaultMessage: "Copy transcript" })}
            placement="top"
          >
            <IconButton
              aria-label={intl.formatMessage({
                defaultMessage: "Copy transcript",
              })}
              onClick={() =>
                handleCopyTranscript(transcription?.transcript || "")
              }
              size="small"
            >
              <ContentCopyRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip
            title={intl.formatMessage({ defaultMessage: "Delete transcript" })}
            placement="top"
          >
            <IconButton
              aria-label={intl.formatMessage({
                defaultMessage: "Delete transcript",
              })}
              onClick={() => handleDeleteTranscript(id)}
              size="small"
            >
              <DeleteOutlineRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {!isRemoteTranscript && activeRemoteTarget && (
            <Tooltip
              title={intl.formatMessage(
                { defaultMessage: "Send to {name}" },
                { name: activeRemoteTarget.name },
              )}
              placement="top"
            >
              <IconButton
                aria-label={intl.formatMessage(
                  { defaultMessage: "Send to {name}" },
                  { name: activeRemoteTarget.name },
                )}
                onClick={handleSendToReceiver}
                size="small"
              >
                <SendRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </Stack>
      <TypographyWithMore
        variant="body2"
        color="text.primary"
        maxLines={3}
        sx={{ my: 1 }}
      >
        {transcription?.transcript}
      </TypographyWithMore>
      {visibleNudge && (
        <Alert
          severity="info"
          variant="outlined"
          icon={<BookmarkAddOutlinedIcon fontSize="small" />}
          sx={{ mb: 1, py: 0.25, alignItems: "center" }}
          action={
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Tooltip
                title={intl.formatMessage({
                  defaultMessage: "Add to dictionary",
                })}
                placement="top"
              >
                <IconButton
                  aria-label={intl.formatMessage({
                    defaultMessage: "Add to dictionary",
                  })}
                  size="small"
                  color="primary"
                  onClick={handleAddNudgeToDictionary}
                  disabled={isAddingNudge}
                >
                  <BookmarkAddOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip
                title={intl.formatMessage({ defaultMessage: "Dismiss" })}
                placement="top"
              >
                <IconButton
                  aria-label={intl.formatMessage({ defaultMessage: "Dismiss" })}
                  size="small"
                  onClick={handleDismissNudge}
                  disabled={isAddingNudge}
                >
                  <CloseRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          }
        >
          <Typography variant="body2" color="text.secondary">
            <FormattedMessage
              defaultMessage='You often correct "{source}" → "{destination}" ({count}×) — add to your dictionary?'
              values={{
                source: visibleNudge.source,
                destination: visibleNudge.destination,
                count: visibleNudge.count,
              }}
            />
          </Typography>
        </Alert>
      )}
      {audioSnapshot && (
        <AudioPlayerPill
          transcriptionId={id}
          durationMs={audioSnapshot.durationMs}
          disabled={isRetranscribing}
          actions={
            <>
              <Tooltip
                title={intl.formatMessage({
                  defaultMessage: "Retranscribe audio clip",
                })}
                placement="top"
              >
                <IconButton
                  aria-label={intl.formatMessage({
                    defaultMessage: "Retranscribe audio",
                  })}
                  size="small"
                  onClick={() => openRetranscribeDialog(id)}
                  disabled={isRetranscribing}
                  sx={{ p: 0.5 }}
                >
                  <ReplayRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip
                title={intl.formatMessage({
                  defaultMessage: "Export transcription",
                })}
                placement="top"
              >
                <IconButton
                  aria-label={intl.formatMessage({
                    defaultMessage: "Export transcription",
                  })}
                  size="small"
                  onClick={handleExport}
                  sx={{ p: 0.5 }}
                >
                  <FileDownloadOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              {isCloudUser && (
                <Tooltip
                  title={intl.formatMessage({
                    defaultMessage: "Report a problem with this transcription",
                  })}
                  placement="top"
                >
                  <IconButton
                    aria-label={intl.formatMessage({
                      defaultMessage:
                        "Report a problem with this transcription",
                    })}
                    size="small"
                    onClick={() => openFlagTranscriptionDialog(id)}
                    sx={{ p: 0.5 }}
                  >
                    <FlagOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </>
          }
        />
      )}
      <Divider sx={{ mt: 2 }} />
    </>
  );
};
