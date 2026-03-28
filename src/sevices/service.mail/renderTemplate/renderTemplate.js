import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import handlebars from "handlebars";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// yaha templates folder ka path set hai (tumhare current code jaisa)
const TEMPLATES_DIR = path.join(__dirname, "../templates");

// optional: template cache (fast)
const cache = new Map();

const readTemplateFile = (filePath) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Template not found: ${filePath}`);
  }
  return fs.readFileSync(filePath, "utf-8");
};

// helpers register once
let helpersDone = false;
const registerHelpers = () => {
  if (helpersDone) return;

  // optional helpers (useful but not required)
  handlebars.registerHelper("eq", (a, b) => String(a) === String(b));
  handlebars.registerHelper("default", (a, b) => (a ? a : b));

  helpersDone = true;
};

const getCompiled = (absPath) => {
  const cached = cache.get(absPath);
  if (cached) return cached;

  const source = readTemplateFile(absPath);
  const compiled = handlebars.compile(source, {
    noEscape: false, // handlebars will escape {{var}} by default, {{{var}}} raw
    strict: false,
  });

  cache.set(absPath, compiled);
  return compiled;
};

/**
 * renderTemplate("withdrawal.html", data)
 * template path: ../templates/withdrawal.html
 */
export default function renderTemplate(templateName, data = {}) {
  registerHelpers();

  const filePath = path.join(TEMPLATES_DIR, templateName);
  const template = getCompiled(filePath);

  return template({
    year: new Date().getFullYear(),
    ...data,
  });
}

// optional: dev me changes pick karne ke liye
export const clearTemplateCache = () => cache.clear();