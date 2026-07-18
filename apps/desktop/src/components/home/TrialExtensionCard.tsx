import { CloseRounded } from "@mui/icons-material";
import { Box, IconButton, Stack, Typography, useTheme } from "@mui/material";
import { FormattedMessage, useIntl } from "react-intl";
import { produceAppState, useAppStore } from "../../store";
import { getIsOnTrial, getMyMember } from "../../utils/member.utils";

export function TrialExtensionCard() {
  const intl = useIntl();
  const theme = useTheme();
  const show = useAppStore((state) => {
    if (state.local.hasHiddenTrialExtensionCard) {
      return false;
    }

    if (!getIsOnTrial(state)) {
      return false;
    }

    const member = getMyMember(state);
    const trialEndsAt = member?.originalTrialEndsAt ?? member?.trialEndsAt;
    if (!trialEndsAt) {
      return false;
    }

    return new Date(trialEndsAt).getTime() > Date.now();
  });

  const wordsNeeded = useAppStore(
    (state) => state.config?.wordsNeededForTrialExtension ?? 200,
  );

  if (!show) {
    return null;
  }

  const handleDismiss = () => {
    produceAppState((draft) => {
      draft.local.hasHiddenTrialExtensionCard = true;
    });
  };

  return (
    <Box
      sx={{
        p: 3,
        py: 2,
        position: "relative",
        borderRadius: "15px",
        border: "1px solid",
        borderColor: "level2",
        backgroundColor: "level1",
        backgroundImage: `linear-gradient(135deg, ${theme.vars?.palette.goldBg} 0%, transparent 70%)`,
      }}
    >
      <IconButton
        size="small"
        onClick={handleDismiss}
        aria-label={intl.formatMessage({ defaultMessage: "Dismiss" })}
        sx={{ position: "absolute", top: 8, right: 8 }}
      >
        <CloseRounded fontSize="small" />
      </IconButton>
      <Stack spacing={1}>
        <Typography variant="h6" fontWeight={700} sx={{ color: "goldFg" }}>
          <FormattedMessage defaultMessage="Earn extra trial days for free" />
        </Typography>
        <Typography variant="body2" color="text.secondary">
          <FormattedMessage
            defaultMessage="For the first 7 days of your trial, each day you dictate {words}+ words you earn an extra day of OS Voice Pro."
            values={{ words: wordsNeeded }}
          />
        </Typography>
      </Stack>
    </Box>
  );
}
