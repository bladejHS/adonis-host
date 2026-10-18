// Style Dictionary v4 — generează CSS vars, JS și JSON plat din tokens.json.
// Rulare: pnpm --filter @adonis/design-tokens build
export default {
  source: ["tokens.json"],
  platforms: {
    css: {
      transformGroup: "css",
      prefix: "adonis",
      buildPath: "dist/css/",
      files: [{ destination: "tokens.css", format: "css/variables" }],
    },
    js: {
      transformGroup: "js",
      buildPath: "dist/js/",
      files: [
        { destination: "tokens.mjs", format: "javascript/es6" },
        { destination: "tokens.d.ts", format: "typescript/es6-declarations" },
      ],
    },
    mobile: {
      transformGroup: "react-native",
      buildPath: "dist/native/",
      files: [{ destination: "tokens.json", format: "json/flat" }],
    },
  },
};
