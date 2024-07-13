/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./src/**/*.{js,jsx,ts,tsx}"],
    theme: {
        extend: {
            padding: {
                0.75: "0.1875rem", // 0.75 * 4px = 3px
            },
        },
    },
    plugins: [],
};
