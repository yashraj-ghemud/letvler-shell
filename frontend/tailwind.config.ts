import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./hooks/**/*.{js,ts,jsx,tsx,mdx}",
        "./lib/**/*.{js,ts,jsx,tsx,mdx}"
    ],
    theme: {
        extend: {
            colors: {
                hacker: {
                    bg: "var(--bg)",
                    green: "var(--green)",
                    cyan: "var(--cyan)",
                    amber: "var(--amber)",
                    red: "var(--red)",
                    dim: "var(--dim)"
                }
            },
            boxShadow: {
                phosphor: "0 0 12px rgba(0, 255, 65, 0.35), inset 0 0 24px rgba(0, 212, 255, 0.08)"
            }
        }
    },
    plugins: []
};

export default config;