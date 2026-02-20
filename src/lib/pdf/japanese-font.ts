import fs from "fs";
import path from "path";

type FontPaths = {
  regular: string;
  bold: string;
};

const HIRAGINO_KAKU_W3 =
  "\u30d2\u30e9\u30ae\u30ce\u89d2\u30b4\u30b7\u30c3\u30af W3.ttc";
const HIRAGINO_KAKU_W6 =
  "\u30d2\u30e9\u30ae\u30ce\u89d2\u30b4\u30b7\u30c3\u30af W6.ttc";
const HIRAGINO_MARU_W4 = "\u30d2\u30e9\u30ae\u30ce\u4e38\u30b4 ProN W4.ttc";
const HIRAGINO_MARU_W6 = "\u30d2\u30e9\u30ae\u30ce\u4e38\u30b4 ProN W6.ttc";
const HIRAGINO_MINCHO = "\u30d2\u30e9\u30ae\u30ce\u660e\u671d ProN.ttc";

const expandVariants = (fontPath: string): string[] => {
  const variants = new Set<string>();
  variants.add(fontPath);
  try {
    variants.add(fontPath.normalize("NFD"));
    variants.add(fontPath.normalize("NFC"));
  } catch {
    // ignore normalize failures
  }
  return Array.from(variants);
};

const firstExisting = (candidates: string[]): string | null => {
  for (const candidate of candidates) {
    for (const variant of expandVariants(candidate)) {
      if (fs.existsSync(variant)) {
        return variant;
      }
    }
  }
  return null;
};

const JAPANESE_SAMPLE_CODEPOINTS = [0x3042, 0x30ab, 0x6f22];

const pickCollectionFontName = (fontPath: string): string | undefined => {
  try {
    const fontkit = require("fontkit");
    const opened = fontkit.openSync(fontPath);
    const fonts = opened?.fonts ?? [opened];
    const matched = fonts.find((font: any) =>
      JAPANESE_SAMPLE_CODEPOINTS.every((cp) =>
        typeof font.hasGlyphForCodePoint === "function"
          ? font.hasGlyphForCodePoint(cp)
          : true,
      ),
    );
    const chosen = matched || fonts[0];
    return chosen?.postscriptName || chosen?.fullName;
  } catch {
    return undefined;
  }
};

export function resolveJapaneseFontPaths(): FontPaths | null {
  const envRegular = process.env.PDF_FONT_PATH;
  const envBold = process.env.PDF_FONT_BOLD_PATH || envRegular;
  if (envRegular) {
    const regularPath = firstExisting([envRegular]);
    if (regularPath) {
      const boldPath = envBold ? firstExisting([envBold]) : null;
      return {
        regular: regularPath,
        bold: boldPath || regularPath,
      };
    }
  }

  if (process.platform === "darwin") {
    const base = "/System/Library/Fonts";
    const supplemental = "/System/Library/Fonts/Supplemental";
    const regular = firstExisting([
      path.join(base, HIRAGINO_KAKU_W3),
      path.join(base, HIRAGINO_MARU_W4),
      path.join(base, HIRAGINO_MINCHO),
      path.join(supplemental, "AppleGothic.ttf"),
    ]);
    if (!regular) return null;
    const bold = firstExisting([
      path.join(base, HIRAGINO_KAKU_W6),
      path.join(base, HIRAGINO_MARU_W6),
      path.join(base, HIRAGINO_MINCHO),
      path.join(supplemental, "AppleGothic.ttf"),
    ]);
    return { regular, bold: bold || regular };
  }

  if (process.platform === "win32") {
    const winDir = "C:\\Windows\\Fonts";
    const regular = firstExisting([
      path.join(winDir, "meiryo.ttc"),
      path.join(winDir, "YuGothM.ttc"),
      path.join(winDir, "YuGothR.ttc"),
      path.join(winDir, "msgothic.ttc"),
    ]);
    if (!regular) return null;
    const bold = firstExisting([
      path.join(winDir, "meiryob.ttc"),
      path.join(winDir, "YuGothB.ttc"),
      path.join(winDir, "msgothic.ttc"),
    ]);
    return { regular, bold: bold || regular };
  }

  const regular = firstExisting([
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansJP-Regular.otf",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/truetype/noto/NotoSansJP-Regular.ttf",
    "/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf",
    "/usr/share/fonts/opentype/ipafont-mincho/ipam.ttf",
  ]);
  if (!regular) return null;
  const bold = firstExisting([
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansJP-Bold.otf",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc",
    "/usr/share/fonts/truetype/noto/NotoSansJP-Bold.ttf",
    "/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf",
    "/usr/share/fonts/opentype/ipafont-mincho/ipam.ttf",
  ]);
  return { regular, bold: bold || regular };
}

export function registerJapaneseFonts(doc: any): {
  regular: string;
  bold: string;
} {
  const paths = resolveJapaneseFontPaths();
  if (!paths) {
    return { regular: "Helvetica", bold: "Helvetica-Bold" };
  }

  const envRegularFamily = process.env.PDF_FONT_FAMILY;
  const envBoldFamily = process.env.PDF_FONT_BOLD_FAMILY || envRegularFamily;

  const registerFont = (name: string, fontPath: string, family?: string) => {
    if (family) {
      doc.registerFont(name, fontPath, family);
    } else {
      doc.registerFont(name, fontPath);
    }
  };

  try {
    const regularFamily =
      envRegularFamily ?? pickCollectionFontName(paths.regular);
    const boldFamily = envBoldFamily ?? pickCollectionFontName(paths.bold);

    if (process.env.NODE_ENV === "development") {
      console.info("[pdf] Using Japanese font", {
        regular: paths.regular,
        regularFamily,
        bold: paths.bold,
        boldFamily,
      });
    }

    registerFont("JP-Regular", paths.regular, regularFamily);
    registerFont("JP-Bold", paths.bold, boldFamily);
    doc.font("JP-Regular");
    return { regular: "JP-Regular", bold: "JP-Bold" };
  } catch (error) {
    console.warn("Failed to register Japanese fonts:", error);
    return { regular: "Helvetica", bold: "Helvetica-Bold" };
  }
}
