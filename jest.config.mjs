import nextJest from "next/jest";

const createJestConfig = nextJest({
    dir: "./",
});

const customJestConfig = {
    testEnvironment: "jsdom",
    moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
        "^yaml$": "<rootDir>/node_modules/yaml/dist/index.js",
    },
    testPathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/node_modules/"],
};

export default createJestConfig(customJestConfig);
