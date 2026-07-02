import { Button, Snackbar, Stack, useTheme } from "@mui/material";
import { FormattedMessage } from "react-intl";
import {
  acceptDictionarySuggestion,
  dismissDictionarySuggestion,
} from "../../actions/dictionary.actions";
import { useAppStore } from "../../store";

export const DictionarySuggestionSnackbar = () => {
  const suggestedTerm = useAppStore((state) => state.dictionary.suggestedTerm);
  const theme = useTheme();

  return (
    <Snackbar
      open={suggestedTerm !== null}
      onClose={dismissDictionarySuggestion}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      message={
        <span style={{ color: "#fff" }}>
          <FormattedMessage
            defaultMessage="Add {term} to your dictionary?"
            values={{ term: <strong>{suggestedTerm}</strong> }}
          />
        </span>
      }
      action={
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            color="inherit"
            onClick={() => void acceptDictionarySuggestion()}
          >
            <FormattedMessage defaultMessage="Add" />
          </Button>
          <Button
            size="small"
            color="inherit"
            onClick={dismissDictionarySuggestion}
          >
            <FormattedMessage defaultMessage="Dismiss" />
          </Button>
        </Stack>
      }
      slotProps={{
        content: {
          style: {
            backgroundColor: theme.palette.primary.main,
          },
        },
      }}
    />
  );
};
