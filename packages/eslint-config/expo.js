// https://docs.expo.dev/guides/using-eslint/
import { defineConfig } from "eslint/config";
import expoConfig from "eslint-config-expo/flat.js";
import tanStackQuery from "@tanstack/eslint-plugin-query";

export default defineConfig([
    ...expoConfig,
    tanStackQuery.configs["flat/recommended"],
    {
        ignores: ["dist/**"],
    },
]);
