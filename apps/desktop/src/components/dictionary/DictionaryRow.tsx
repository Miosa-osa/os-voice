import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import { PublicOutlined } from "@mui/icons-material";
import {
  CircularProgress,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { Term } from "@voquill/types";
import { getRec } from "@voquill/utilities";
import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { showErrorSnackbar } from "../../actions/app.actions";
import { WordCategory } from "../../lib/vocab/categorize";
import { getTermRepo } from "../../repos";
import { OllamaGenerateTextRepo } from "../../repos/generate-text.repo";
import { getAppState, produceAppState, useAppStore } from "../../store";
import { getLogger } from "../../utils/log.utils";
import { getMyUserPreferences } from "../../utils/user.utils";

// The native `Term` row can now carry an on-demand definition + category, but
// the shared `@voquill/types` `Term` doesn't declare those fields yet. Extend
// locally so this file can read/write them without an `any` escape hatch —
// every `Term` already structurally satisfies this (the extra fields are
// optional), so no cast is needed when reading from or writing to the store.
type DefinableTerm = Term & {
  definition?: string | null;
  category?: string | null;
  lastDefinedAt?: number | null;
};

// Mirrors the model + prompt shape used by `enrichLearnedVocabulary` in
// vocab.actions.ts so manual glossary/correction terms get definitions in the
// same voice as learned vocabulary.
const DEFINE_MODEL = "gpt-oss:120b-cloud";
const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434";
const VALID_CATEGORIES: ReadonlySet<string> = new Set<WordCategory>([
  "acronym",
  "technical",
  "proper",
  "phrase",
  "word",
]);

export type DictionaryRowProps = {
  id: string;
};

export const DictionaryRow = ({ id }: DictionaryRowProps) => {
  const intl = useIntl();
  const term = useAppStore((state) => getRec(state.termById, id)) as
    DefinableTerm | undefined;
  const [sourceValue, setSourceValue] = useState(term?.sourceValue ?? "");
  const [destinationValue, setDestinationValue] = useState(
    term?.destinationValue ?? "",
  );
  const [isDefining, setIsDefining] = useState(false);
  const isReplacement = term?.isReplacement ?? true;
  const isGlobal = term?.isGlobal ?? false;

  useEffect(() => {
    setSourceValue(term?.sourceValue ?? "");
    setDestinationValue(term?.destinationValue ?? "");
  }, [term?.sourceValue, term?.destinationValue]);

  const handleFieldChange =
    (field: "source" | "destination") =>
    (event: ChangeEvent<HTMLInputElement>) => {
      if (field === "source") {
        setSourceValue(event.target.value);
      } else {
        setDestinationValue(event.target.value);
      }
    };

  const handleCommit = useCallback(async () => {
    if (!term) {
      return;
    }

    if (
      term.sourceValue === sourceValue &&
      term.destinationValue === destinationValue
    ) {
      return;
    }

    const previousTerm = term;
    const updatedTerm = {
      ...term,
      sourceValue,
      destinationValue,
    };

    produceAppState((draft) => {
      draft.termById[id] = updatedTerm;
    });

    try {
      await getTermRepo().updateTerm(updatedTerm);
    } catch (error) {
      produceAppState((draft) => {
        draft.termById[id] = previousTerm;
      });
      setSourceValue(previousTerm.sourceValue);
      setDestinationValue(previousTerm.destinationValue);
      showErrorSnackbar(error);
    }
  }, [destinationValue, id, sourceValue, term]);

  const handleDelete = useCallback(async () => {
    if (!term) {
      return;
    }

    const previousTerm = term;
    const previousIds = [...getAppState().dictionary.termIds];

    produceAppState((draft) => {
      delete draft.termById[id];
      draft.dictionary.termIds = draft.dictionary.termIds.filter(
        (termId) => termId !== id,
      );
    });

    try {
      await getTermRepo().deleteTerm(id);
    } catch (error) {
      produceAppState((draft) => {
        draft.termById[id] = previousTerm;
        draft.dictionary.termIds = previousIds;
      });
      setSourceValue(previousTerm.sourceValue);
      setDestinationValue(previousTerm.destinationValue);
      showErrorSnackbar(error);
    }
  }, [id, term]);

  // On-demand definition for a manual glossary/correction term: same prompt
  // shape as the batched learned-vocabulary enrichment, but for a single term
  // triggered by the user. Fails quietly — leaves `definition` unset so the
  // action just reappears next time.
  const handleDefine = useCallback(async () => {
    if (!term || isDefining || !term.sourceValue.trim()) {
      return;
    }

    setIsDefining(true);
    try {
      const ollamaUrl =
        getMyUserPreferences(getAppState())?.postProcessingOllamaUrl ??
        DEFAULT_OLLAMA_URL;
      const repo = new OllamaGenerateTextRepo(ollamaUrl, DEFINE_MODEL);
      const system =
        "You are a precise lexicographer for a voice-dictation app's manual glossary. Respond with ONLY a JSON object, no prose or markdown.";
      const context = term.destinationValue?.trim();
      const prompt = `Define this term exactly as a user dictating would mean it${
        context ? `, which they've mapped to replace with "${context}"` : ""
      }:

"${term.sourceValue}"

Return ONLY a JSON object like:
{"category":"technical","definition":"One plain-language sentence under 25 words."}
The "category" must be one of "acronym" | "technical" | "proper" | "phrase" | "word".`;

      const { text } = await repo.generateText({ system, prompt });
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) {
        throw new Error("No JSON object found in model response");
      }
      const parsed = JSON.parse(match[0]) as unknown;
      if (!parsed || typeof parsed !== "object") {
        throw new Error("Malformed definition response");
      }
      const rec = parsed as Record<string, unknown>;
      const definition =
        typeof rec.definition === "string" && rec.definition.trim()
          ? rec.definition.trim()
          : undefined;
      if (!definition) {
        throw new Error("Model did not return a definition");
      }
      const category =
        typeof rec.category === "string" && VALID_CATEGORIES.has(rec.category)
          ? (rec.category as WordCategory)
          : undefined;

      const updatedTerm: DefinableTerm = {
        ...term,
        definition,
        category: category ?? term.category ?? undefined,
        lastDefinedAt: Date.now(),
      };

      produceAppState((draft) => {
        draft.termById[id] = updatedTerm;
      });

      try {
        const persisted: DefinableTerm =
          await getTermRepo().updateTerm(updatedTerm);
        // Some term repos don't yet round-trip definition/category — keep our
        // freshly generated copy even if the persisted response omits them,
        // so the UI doesn't lose what it just showed the user. Built as a
        // pre-typed `DefinableTerm` (not an inline literal) so assigning it
        // into `draft.termById` (typed `Record<string, Term>`) doesn't trip
        // TypeScript's excess-property check for the extra fields.
        const merged: DefinableTerm = {
          ...persisted,
          definition: persisted.definition ?? updatedTerm.definition,
          category: persisted.category ?? updatedTerm.category,
          lastDefinedAt: persisted.lastDefinedAt ?? updatedTerm.lastDefinedAt,
        };
        produceAppState((draft) => {
          draft.termById[id] = merged;
        });
      } catch (persistError) {
        showErrorSnackbar(persistError);
      }
    } catch (error) {
      getLogger().warning(
        `Failed to define term "${term.sourceValue}": ${error}`,
      );
    } finally {
      setIsDefining(false);
    }
  }, [id, isDefining, term]);

  if (!term) {
    return null;
  }

  return (
    <Stack spacing={0.25} py={1}>
      <Stack direction="row" spacing={2} alignItems="center">
        <TextField
          variant="outlined"
          size="small"
          placeholder={
            isReplacement
              ? intl.formatMessage({ defaultMessage: "Original" })
              : intl.formatMessage({ defaultMessage: "Glossary term" })
          }
          value={sourceValue}
          onChange={handleFieldChange("source")}
          onBlur={handleCommit}
          disabled={isGlobal}
          sx={{ flex: 1 }}
          error={!isGlobal && sourceValue.trim() === ""}
        />
        {isReplacement ? (
          <>
            <ArrowForwardRoundedIcon color="action" fontSize="small" />
            <TextField
              variant="outlined"
              size="small"
              placeholder={intl.formatMessage({
                defaultMessage: "Replacement",
              })}
              value={destinationValue}
              onChange={handleFieldChange("destination")}
              onBlur={handleCommit}
              disabled={isGlobal}
              multiline
              minRows={1}
              sx={{ flex: 1 }}
              error={!isGlobal && destinationValue.trim() === ""}
            />
          </>
        ) : null}
        {!isGlobal && !term.definition ? (
          <Tooltip
            disableInteractive
            title={
              <FormattedMessage defaultMessage="Generate a definition for this term" />
            }
          >
            <span>
              <IconButton
                size="small"
                aria-label={intl.formatMessage(
                  { defaultMessage: "Define {term}" },
                  { term: term.sourceValue },
                )}
                onClick={handleDefine}
                disabled={isDefining || sourceValue.trim() === ""}
              >
                {isDefining ? (
                  <CircularProgress size={16} />
                ) : (
                  <AutoAwesomeOutlinedIcon fontSize="small" />
                )}
              </IconButton>
            </span>
          </Tooltip>
        ) : null}
        {isGlobal ? (
          <Tooltip
            disableInteractive
            title={
              <FormattedMessage defaultMessage="This term is managed by your organization." />
            }
          >
            <span>
              <IconButton size="small" disabled>
                <PublicOutlined fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        ) : (
          <IconButton
            aria-label={intl.formatMessage(
              { defaultMessage: "Delete dictionary item {term}" },
              { term: term.sourceValue },
            )}
            onClick={handleDelete}
            size="small"
          >
            <DeleteOutlineRoundedIcon fontSize="small" />
          </IconButton>
        )}
      </Stack>
      {term.definition ? (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ pl: 0.5, display: "block" }}
        >
          {term.definition}
        </Typography>
      ) : null}
    </Stack>
  );
};
