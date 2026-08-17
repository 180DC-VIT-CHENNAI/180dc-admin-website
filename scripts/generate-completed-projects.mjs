#!/usr/bin/env node
// Generate static completedProjects.json from the live API.
// Run before builds to embed the latest completed projects data.
// Usage: node scripts/generate-completed-projects.mjs [API_URL]

const API_URL = process.argv[2] || "https://180dcvitc.org/api/projects/completed";
const OUTPUT = new URL("../apps/frontend/src/data/completedProjects.json", import.meta.url);

function escapeForJson(val) {
  if (typeof val !== "string") return "";
  return val
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function main() {
  console.log(`Fetching completed projects from ${API_URL} ...`);
  const res = await fetch(API_URL);
  if (!res.ok) {
    console.error(`Failed to fetch: ${res.status} ${res.statusText}`);
    process.exit(1);
  }
  const json = await res.json();
  if (!json.success || !Array.isArray(json.data)) {
    console.error("Unexpected response format:", JSON.stringify(json).slice(0, 200));
    process.exit(1);
  }

  const data = json.data.map((p) => ({
    id: p.id,
    name: escapeForJson(p.name),
    description: escapeForJson(p.description || ""),
    company_org: escapeForJson(p.company_org || ""),
    deadline: p.deadline || null,
    created_at: p.created_at,
  }));

  const { writeFile } = await import("node:fs/promises");
  await writeFile(OUTPUT, JSON.stringify(data, null, 2) + "\n");
  console.log(`Wrote ${data.length} completed projects to ${OUTPUT.pathname}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
