module.exports = [
    {
        ignores: ["node_modules/**"],
        files: ["**/*.js"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "commonjs",
            globals: {
                require: "readonly",
                module: "readonly",
                __dirname: "readonly",
                __filename: "readonly",
                process: "readonly"
            }
        },
        rules: {
            "no-unused-vars": "warn",
            "no-undef": "warn",
            "object-curly-spacing": ["error", "never"]
        }
    }
];