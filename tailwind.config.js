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
        keyframes: {
            fillEgg: {
                "0%": {
                    fill: "#414141",
                },
                "100%": {
                    fill: "#4762fb",
                },
            },
            fillCircle: {
                "0%": {
                    "stroke-dashoffset": 440,
                },
                "100%": {
                    "stroke-dashoffset": 0,
                },
            },
            fadeIn: {
                "0%": {
                    transform: "translateY(calc(-50% + 20px)) translateX(-50%)",
                    opacity: 0,
                },
                "100%": {
                    transform: "translateY(-50%) translateX(-50%)",
                    opacity: 1,
                },
            },
        },
        extend: {
            animation: {
                "fill-circle": "fillCircle .7s linear .5s  1 both",
                "fill-egg": "fillEgg .2s linear 1.3s 1 both",
                fadeIn: "fadeIn .25s linear 1.3s 1 both",
            },
        },
    },
    plugins: [],
};