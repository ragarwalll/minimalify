/** @type {import('ts-jest').JestConfigWithTsJest} **/
export default {
  testEnvironment: "node",
  transform: {
    "^.+\.tsx?$": ["ts-jest", {}],
  },
  moduleNameMapper: {
    '^xxhash-wasm$': '__mocks__/xxhash-wasm.ts'
  }
};