import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "smartfobs-reporting-tests-"));
const sourceIndex = path.resolve("lib/bookkeeping/index.ts");
const sourceReporting = path.resolve("lib/bookkeeping/reporting.ts");
const tempIndex = path.join(tempDir, "index.ts");
const tempReporting = path.join(tempDir, "reporting.ts");

fs.copyFileSync(sourceIndex, tempIndex);
fs.writeFileSync(
  tempReporting,
  fs.readFileSync(sourceReporting, "utf8").replace('from "./index";', 'from "./index.ts";'),
);

const result = spawnSync(
  process.execPath,
  ["--experimental-strip-types", "scripts/reporting-tests.mjs"],
  {
    cwd: process.cwd(),
    stdio: "inherit",
    env: {
      ...process.env,
      REPORTING_MODULE_PATH: pathToFileURL(tempReporting).href,
    },
  },
);

fs.rmSync(tempDir, { recursive: true, force: true });
process.exit(result.status ?? 1);
