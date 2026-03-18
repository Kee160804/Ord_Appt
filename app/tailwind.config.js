// /** @type {import('tailwindcss').Config} */
// module.exports = {
//   content: [
//     "./app/**/*.{js,ts,jsx,tsx}",
//     "./pages/**/*.{js,ts,jsx,tsx}",
//     "./components/**/*.{js,ts,jsx,tsx}",
//   ],
//   darkMode: "class", 
//   theme: {
//     extend: {},
//   },
//  plugins: [
//     // function ({ addVariant }) {
//     //   addVariant("light", ".light &");
//     // },
//   ],
// };



/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class", 
  theme: {
    extend: {},
  },
  plugins: [
    function ({ addVariant }) {
      addVariant("light", ".light &");
    },
  ],
};