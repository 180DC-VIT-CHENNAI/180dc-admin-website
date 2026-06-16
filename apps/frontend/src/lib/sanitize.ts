const SAFE_TAGS = new Set([
  "p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li",
  "blockquote", "pre", "code", "strong", "b", "em", "i", "u",
  "br", "div", "span", "a", "img", "hr", "sub", "sup",
  "table", "thead", "tbody", "tr", "th", "td", "caption",
  "col", "colgroup", "dl", "dt", "dd", "figure", "figcaption",
]);

const SAFE_ATTRS = new Set([
  "href", "src", "alt", "title", "class", "target", "rel",
  "width", "height",
]);

const UNSAFE_TAGS = ["script", "iframe", "object", "embed", "frame", "meta", "link", "base", "style"];

function decodeEntities(str: string): string {
  return str
    .replace(/&#(\d+);/g, (_, c) => String.fromCodePoint(parseInt(c)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

// fallow-ignore-next-line complexity
export function sanitizeHtml(input: string): string {
  let s = input;

  for (const tag of UNSAFE_TAGS) {
    const re = new RegExp("<" + tag + "[\\s\\S]*?</" + tag + ">", "gi");
    s = s.replace(re, "");
    s = s.replace(new RegExp("<" + tag + "\\b[^>]*/?>", "gi"), "");
  }

  s = s.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");

  s = s.replace(/<(?!\/?[a-zA-Z])/g, "&lt;");

  s = s.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (match, slash, tagName, attrs) => {
    const lower = tagName.toLowerCase();
    if (!SAFE_TAGS.has(lower)) return escapeHtml(match);

    const safe = attrs.replace(/([a-zA-Z:-]+)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/g, (attr: string) => {
      const an = attr.match(/^([a-zA-Z:-]+)/i)?.[1]?.toLowerCase();
      if (!an || !SAFE_ATTRS.has(an)) return "";
      if (an === "href" || an === "src") {
        const v = decodeEntities(attr.replace(/^[^=]*=\s*/, "").replace(/^["']|["']$/g, "").toLowerCase());
        if (/^(javascript|data|vbscript):/.test(v)) return "";
      }
      return attr;
    });

    const selfClose = /\/$/.test(attrs.trim()) ? " /" : "";
    return "<" + slash + lower + (safe ? " " + safe.trim() : "") + selfClose + ">";
  });

  s = s.replace(/<[^>]*>/g, (match) => {
    const inner = match.slice(1, -1).trim();
    if (!inner) return "";
    const isClose = inner.startsWith("/");
    const name = (isClose ? inner.slice(1) : inner.split(/\s+/)[0]).toLowerCase();
    if (!SAFE_TAGS.has(name)) return "";
    return match;
  });

  return s;
}
