import type { Preview } from "@storybook/react";
import "../src/styles/globals.css";

const preview: Preview = {
  parameters: {
    backgrounds: { default: "fildeș", values: [{ name: "fildeș", value: "#f8f5ee" }, { name: "noapte", value: "#081a25" }] },
    layout: "padded",
  },
  decorators: [
    (Story) => (
      <div style={{ ["--font-display" as string]: "'Cormorant Garamond'", ["--font-body" as string]: "'Jost'" }}>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Jost:wght@300;400;500&display=swap" />
        <Story />
      </div>
    ),
  ],
};

export default preview;
