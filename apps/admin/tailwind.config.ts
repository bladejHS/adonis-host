import type { Config } from "tailwindcss";
import tokens from "../../packages/design-tokens/tokens.json";

/**
 * Tema Tailwind „Adonis Riviera”. Culorile semantice citesc variabilele CSS din
 * src/styles/globals.css; scările brute vin direct din tokens.json.
 */
type Group = Record<string, unknown>;
const scale = (group: Group) =>
  Object.fromEntries(
    Object.entries(group)
      .filter(([k]) => !k.startsWith("$"))
      .map(([k, v]) => [k, (v as { $value: string }).$value]),
  );
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const { color, font, radius, shadow } = tokens;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: v("background"),
        surface: v("surface"),
        muted: v("surface-muted"),
        line: v("border"),
        "line-strong": v("border-strong"),
        ink: v("text"),
        heading: v("heading"),
        subtle: v("text-muted"),
        primary: { DEFAULT: v("primary"), hover: v("primary-hover"), fg: v("primary-fg") },
        gold: { ...scale(color.gold), DEFAULT: v("accent"), text: v("accent-text"), soft: v("accent-soft") },
        success: { DEFAULT: v("success"), soft: v("success-soft") },
        warning: { DEFAULT: v("warning"), soft: v("warning-soft") },
        error: { DEFAULT: v("error"), soft: v("error-soft") },
        info: { DEFAULT: v("info"), soft: v("info-soft") },
        navy: scale(color.navy),
        ivory: scale(color.ivory),
        channel: {
          booking: color.navy["500"].$value,
          airbnb: color.status["channel-airbnb"].$value,
          direct: color.navy["800"].$value,
          phone: color.gold["600"].$value,
        },
      },
      fontFamily: {
        display: ["var(--font-display)", ...font.family.display.$value],
        sans: ["var(--font-body)", ...font.family.body.$value],
      },
      letterSpacing: { label: font["letter-spacing"].label.$value },
      borderRadius: { sm: radius.sm.$value, DEFAULT: radius.md.$value, md: radius.md.$value, lg: radius.lg.$value, arch: radius.arch.$value },
      boxShadow: { hairline: shadow.hairline.$value, soft: shadow.sm.$value, lift: shadow.lg.$value },
      transitionTimingFunction: { lux: "cubic-bezier(0.22, 1, 0.36, 1)" },
      gridTemplateColumns: { 14: "repeat(14, minmax(0, 1fr))" },
    },
  },
  plugins: [],
};

export default config;
