import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import {
  parseManualCases,
  renderPlaywrightTests,
  validateBaseUrl,
} from "./generator.js";

const defaultOutput = "tests/generated/manual.spec.ts";
const usage = `Usage:
  npm run generate -- --url <website-url> --cases <cases.json> [--out <test-file>]

Options:
  --url     Website URL to open at the start of each test case (http or https)
  --cases   JSON file containing manual cases and steps
  --out     Generated Playwright test path (default: ${defaultOutput})
  --help    Show this help
`;

interface Options {
  url?: string;
  casesPath?: string;
  outputPath: string;
  help: boolean;
}

function parseArguments(args: string[]): Options {
  const options: Options = { outputPath: defaultOutput, help: false };
  const seen = new Set<string>();

  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (flag === "--help") {
      options.help = true;
      continue;
    }

    if (flag !== "--url" && flag !== "--cases" && flag !== "--out") {
      throw new Error(`Unknown option "${flag}".\n\n${usage}`);
    }
    if (seen.has(flag)) {
      throw new Error(`Option "${flag}" may only be specified once.`);
    }
    seen.add(flag);

    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Option "${flag}" requires a value.`);
    }
    index += 1;

    if (flag === "--url") {
      options.url = value;
    } else if (flag === "--cases") {
      options.casesPath = value;
    } else {
      options.outputPath = value;
    }
  }

  return options;
}

async function main(): Promise<void> {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    console.log(usage);
    return;
  }
  if (!options.url || !options.casesPath) {
    throw new Error(`Both --url and --cases are required.\n\n${usage}`);
  }

  const baseUrl = validateBaseUrl(options.url);
  const casesFile = resolve(options.casesPath);
  const outputFile = resolve(options.outputPath);
  const caseData: unknown = JSON.parse(await readFile(casesFile, "utf8"));
  const cases = parseManualCases(caseData);
  const generated = renderPlaywrightTests(baseUrl, cases);

  await mkdir(dirname(outputFile), { recursive: true });
  await writeFile(outputFile, generated, "utf8");
  console.log(`Generated ${cases.length} test case(s) at ${relative(process.cwd(), outputFile)}.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
