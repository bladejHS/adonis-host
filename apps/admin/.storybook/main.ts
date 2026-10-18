import type { StorybookConfig } from "@storybook/react-vite";
import path from "node:path";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.tsx"],
  addons: ["@storybook/addon-essentials"],
  framework: { name: "@storybook/react-vite", options: {} },
  staticDirs: ["../public"],
  viteFinal: async (cfg) => {
    cfg.resolve = { ...cfg.resolve, alias: { ...(cfg.resolve?.alias ?? {}), "@": path.resolve(__dirname, "../src") } };
    return cfg;
  },
};

export default config;
