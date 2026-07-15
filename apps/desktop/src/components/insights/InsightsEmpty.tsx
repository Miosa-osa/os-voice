import { Card, Typography } from "@mui/material";
import { FormattedMessage } from "react-intl";

export const InsightsEmpty = ({ message }: { message?: React.ReactNode }) => (
  <Card sx={{ p: 4, textAlign: "center" }}>
    <Typography color="textSecondary">
      {message ?? (
        <FormattedMessage defaultMessage="Start dictating to unlock your insights." />
      )}
    </Typography>
  </Card>
);
