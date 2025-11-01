import baseConfig from "@repo/mobile-ui/tailwind";

/** @type {import('tailwindcss').Config} */
export default {
    ...baseConfig,
    content: [
        "./app/**/*.{ts,tsx}",
        "./components/**/*.{ts,tsx}",
        "./src/**/*.{ts,tsx}",
        "../../packages/mobile-ui/src/components/**/*.{ts,tsx}",
    ],
};