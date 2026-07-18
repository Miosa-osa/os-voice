import "@mui/material/styles";
import "@mui/material/Button";
import "@mui/material/Card";
import "@mui/material/Paper";
import "@mui/material/Typography";

declare module "@mui/material/styles" {
  interface Palette {
    goldBg: string;
    goldFg: string;
    shadow: string;
    blue: string;
    blueHover: string;
    blueActive: string;
    onBlue: string;

    level0: string;
    level1: string;
    level2: string;
    level3: string;
  }
  interface PaletteOptions {
    goldBg?: string;
    goldFg?: string;
    shadow?: string;
    blue?: string;
    blueHover?: string;
    blueActive?: string;
    onBlue?: string;

    level0?: string;
    level1?: string;
    level2?: string;
    level3?: string;
  }
}

declare module "@mui/material/styles" {
  // MUI's createTypography supports a custom `pxToRem` override at runtime
  // (see createTypography.js) but doesn't expose it on TypographyVariantsOptions.
  interface TypographyVariantsOptions {
    pxToRem?: (px: number) => string;
  }
}

declare module "@mui/material/Button" {
  interface ButtonPropsVariantOverrides {
    flat: true;
    blue: true;
  }
}
declare module "@mui/material/Card" {
  interface CardPropsVariantOverrides {
    flat: true;
  }
}
declare module "@mui/material/Paper" {
  interface PaperPropsVariantOverrides {
    flat: true;
  }
}
