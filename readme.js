/**
 * Exports the README.md content for the bold-ld module.
 * @module bold-ld/readme
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const README = readFileSync(join(__dirname, "README.md"), "utf-8");
