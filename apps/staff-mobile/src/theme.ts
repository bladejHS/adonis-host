// Culorile Adonis Riviera (packages/design-tokens/tokens.json), pentru React Native.
export const c = {
  navy: "#0b2230",
  deep: "#081a25",
  gold: "#c6a15b",
  goldText: "#7d5f27",
  goldSoft: "#f6efdf",
  ivory: "#f8f5ee",
  pearl: "#fffdf9",
  line: "#e6dccb",
  text: "#14232d",
  muted: "#5f6a73",
  success: "#4e6b3d",
  successSoft: "#eef2e8",
  warning: "#9a6512",
  warningSoft: "#f8efdc",
  error: "#9b2c2c",
  errorSoft: "#f7e6e3",
  clay: "#a4563a",
  claySoft: "#f5e7e0",
};

export const font = { display: "CormorantGaramond_500Medium", body: "Jost_400Regular", bodyMedium: "Jost_500Medium" };

export const ROOM_STATUS = {
  clean: { label: "Pregătită", fg: c.success, bg: c.successSoft },
  dirty: { label: "De curățat", fg: c.clay, bg: c.claySoft },
  inspect: { label: "De verificat", fg: c.warning, bg: c.warningSoft },
  maintenance: { label: "În reparație", fg: c.error, bg: c.errorSoft },
} as const;

export const TASK_TYPE: Record<string, string> = {
  checkout_clean: "Curățenie la plecare",
  stay_clean: "Curățenie în sejur",
  linen_change: "Schimb lenjerie",
  inspection: "Verificare",
  maintenance: "Reparație",
};
