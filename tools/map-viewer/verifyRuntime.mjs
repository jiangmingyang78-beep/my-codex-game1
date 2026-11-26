import { runUnitTests } from "../../tests/run-unit-tests.mjs";

await runUnitTests([
  "tests/runtimeRules.test.ts",
  "tests/survivalTuning.test.ts",
]);
