import { ButtonBase, Stack, Typography } from "@mui/material";
import { getRec } from "@voquill/utilities";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useIntl } from "react-intl";
import { openTranscriptionDetailsDialog } from "../../actions/transcriptions.actions";
import { useAppStore } from "../../store";

dayjs.extend(relativeTime);

export type TranscriptPreviewRowProps = {
  id: string;
};

// Lightweight, read-only preview of a transcription for the Home screen: a
// 1-2 line snippet plus a relative timestamp, the whole row clickable to open
// the existing details dialog. The heavy action-button/audio-pill row stays
// exclusive to the History page.
export function TranscriptPreviewRow({ id }: TranscriptPreviewRowProps) {
  const intl = useIntl();
  const transcription = useAppStore((state) =>
    getRec(state.transcriptionById, id),
  );

  if (!transcription) {
    return null;
  }

  return (
    <ButtonBase
      onClick={() => openTranscriptionDetailsDialog(id)}
      aria-label={intl.formatMessage({
        defaultMessage: "View transcription details",
      })}
      sx={{
        display: "block",
        width: "100%",
        textAlign: "left",
        borderRadius: 1.5,
        px: 1,
        py: 1,
        "&:hover": { bgcolor: "level1" },
      }}
    >
      <Stack spacing={0.25}>
        <Typography
          variant="body2"
          color="text.primary"
          sx={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {transcription.transcript}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {dayjs(transcription.createdAt).fromNow()}
        </Typography>
      </Stack>
    </ButtonBase>
  );
}
