/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./pages/**/*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        screens: {
            tablet: { max: "650px" },
            smallDesk: { max: "800px" },
        },
        extend: {},
    },
    plugins: [],
};