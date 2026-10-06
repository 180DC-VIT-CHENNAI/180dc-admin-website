import fs from "node:fs";
import path from "node:path";

const dataDir = path.resolve(process.argv[2] || `../../Newsletters/public/data`);
const outFile = process.argv[3] || "C:\\Users\\L Kevin Daniel\\AppData\\Local\\Temp\\opencode\\newsletter-data.sql";

function esc(value) {
  return String(value ?? "").replace(/'/g, "''");
}

function blocksToHtml(blocks) {
  return blocks
    .map((b) => {
      switch (b.type) {
        case "lead":
        case "paragraph":
          return `<p>${esc(b.text)}</p>`;
        case "heading":
          return `<h3>${esc(b.text)}</h3>`;
        case "quote":
          return `<blockquote><p>${esc(b.text)}</p>${b.by ? `<cite>— ${esc(b.by)}</cite>` : ""}</blockquote>`;
        case "stats":
          return (
            "<ul>" +
            b.items
              .map((s) => `<li><strong>${esc(s.value)}</strong> — ${esc(s.label)}</li>`)
              .join("") +
            "</ul>"
          );
        case "image":
          return `<figure><img src="${esc(b.src)}" alt="${esc(b.alt || "")}" />${b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : ""}</figure>`;
        case "list":
          return "<ol>" + b.items.map((i) => `<li>${esc(i)}</li>`).join("") + "</ol>";
        case "note":
          return `<aside><strong>${esc(b.title)}</strong><br>${esc(b.text)}</aside>`;
        default:
          return "";
      }
    })
    .join("");
}

function issueToContent(issue) {
  return issue.sections
    .map((s) => {
      const parts = [];
      if (s.kicker) parts.push(`<h2>${esc(s.kicker)}</h2>`);
      if (s.title) parts.push(`<h3>${esc(s.title)}</h3>`);
      parts.push(blocksToHtml(s.blocks));
      return parts.join("");
    })
    .join("");
}

const files = fs
  .readdirSync(dataDir)
  .filter((f) => f.endsWith(".json"))
  .sort();

const statements = [];
for (const file of files) {
  const issue = JSON.parse(fs.readFileSync(path.join(dataDir, file), "utf8"));
  const id = issue.id || issue.slug;
  const slug = issue.slug || id;
  const title = issue.title || "Untitled issue";
  const description = issue.dek || "";
  const emailSubject = title;
  const content = issueToContent(issue);
  statements.push(
    `INSERT OR REPLACE INTO newsletters (id, title, description, email_subject, content, source_file_url, image_url, created_by, slug, sent_at) VALUES ('${esc(id)}', '${esc(title)}', '${esc(description)}', '${esc(emailSubject)}', '${esc(content)}', NULL, NULL, 'editorial-sync', '${esc(slug)}', NULL);`,
  );
}

fs.writeFileSync(outFile, statements.join("\n"), "utf8");
console.log(`Wrote ${statements.length} statement(s) to ${outFile}`);