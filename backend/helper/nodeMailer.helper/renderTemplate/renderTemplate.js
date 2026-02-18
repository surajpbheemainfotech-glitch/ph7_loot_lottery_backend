import fs from "fs";
import path from "path";

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const renderTemplate = (templateName, data = {}) => {
  const filePath = path.join(process.cwd(), "templates", templateName);
  let html = fs.readFileSync(filePath, "utf-8");

  // 1) RAW placeholders: {{{key}}} (no escaping)
  html = html.replace(/\{\{\{\s*([\w.]+)\s*\}\}\}/g, (_, key) => {
    return String(data[key] ?? "");
  });

  // 2) Normal placeholders: {{key}} (escaped)
  html = html.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    return escapeHtml(data[key] ?? "");
  });

  return html;
};

export default renderTemplate;
