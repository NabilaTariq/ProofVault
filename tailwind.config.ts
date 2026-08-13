import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#6D2932",
          50: "#FBF7F0",
          100: "#F4ECDF",
          300: "#D3C4B2",
          500: "#A9917A",
          700: "#82313D",
          900: "#561C24",
        },
        paper: {
          DEFAULT: "#F4ECDF",
          50: "#FBF7F0",
          100: "#F4ECDF",
          200: "#E8D8C4",
        },
        brass: {
          DEFAULT: "#C7B7A3",
          400: "#D8C4A9",
          600: "#A9917A",
        },
        stamp: {
          DEFAULT: "#82313D",
          700: "#561C24",
        },
        verified: "#6D2932",
        wine: {
          DEFAULT: "#6D2932",
          950: "#561C24",
          900: "#6D2932",
          800: "#82313D",
          700: "#9A4B55",
          100: "#E8D8C4",
          50: "#F4ECDF",
        },
        sand: {
          DEFAULT: "#E8D8C4",
          100: "#F4ECDF",
          200: "#E8D8C4",
          300: "#D8C4A9",
        },
        taupe: {
          DEFAULT: "#C7B7A3",
          100: "#E2D7CA",
          200: "#D3C4B2",
          400: "#A9917A",
          600: "#7D6554",
        },
        cream: {
          DEFAULT: "#F4ECDF",
          50: "#FBF7F0",
          100: "#F4ECDF",
        },
        ember: {
          DEFAULT: "#561C24",
          700: "#6D2932",
        },
      },
      fontFamily: {
        display: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        body: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Consolas", "monospace"],
      },
      backgroundImage: {
        grain: "radial-gradient(circle at 1px 1px, rgba(86,28,36,0.08) 1px, transparent 0)",
      },
      backgroundSize: {
        grain: "18px 18px",
      },
      boxShadow: {
        soft: "0 24px 60px rgba(86, 28, 36, 0.12)",
        lift: "0 16px 36px rgba(86, 28, 36, 0.14)",
      },
    },
  },
  plugins: [],
};

export default config;
