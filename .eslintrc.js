const path = require("path");

module.exports = {
    extends: path.join(__dirname, "./.eslintrc.thingweb.js"),
    overrides: [
        {
            files: ["*.ts", "*.tsx"],
            parserOptions: {
                tsconfigRootDir: __dirname,
                project: ["./tsconfig.eslint.json"],
            },
        },
    ],
  //  files: ["*.ts", "*.tsx"],
    parserOptions: {
        tsconfigRootDir: __dirname,
        project: ["./tsconfig.eslint.json"],
    },
};

