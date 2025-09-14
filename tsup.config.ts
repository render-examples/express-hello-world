import { defineConfig } from "tsup";

export default defineConfig({
  clean: true,
  entry: ["src/app.ts"],
  minify: true,
  target: "node22",
});
