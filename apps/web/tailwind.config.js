/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f7ff",
          100: "#e0effe",
          500: "#0284c7",
          600: "#0369a1",
          700: "#075985",
        },
        ums: {
          navy: "#07172f",
          navy2: "#0b2548",
          red: "#ed1c24",
          blue: "#1769ff",
          green: "#15a866",
          orange: "#ff9416",
          bg: "#f6f8fb",
          border: "#e5e9f0",
          text: "#101828",
        },
      },
      fontFamily: {
        sans: ["Arial", "Helvetica", "sans-serif"],
      },
    },
  },
  plugins: [],
};
