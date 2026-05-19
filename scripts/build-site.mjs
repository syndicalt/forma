import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const docsRoot = "docs";
const siteRoot = "site";
const githubRoot = "https://github.com/syndicalt/forma";
const markdownRoots = ["guides", "language", "packages"];
const navSections = [
  {
    title: "Start",
    items: [
      ["Overview", "index.html", "01"],
      ["Golden workflow", "guides/golden-workflow.html", "02"],
      ["Quickstart", "guides/quickstart.html", "03"],
      ["First-use audit", "guides/first-use-audit.html", "04"],
    ],
  },
  {
    title: "Build",
    items: [
      ["Language", "language/overview.html", "Ref"],
      ["Runtime results", "guides/runtime-results.html", "API"],
      ["Providers", "guides/provider-adapters.html", "Host"],
      ["Task authoring", "guides/task-authoring.html", "Guide"],
    ],
  },
  {
    title: "Ship",
    items: [
      ["CLI", "packages/cli.html", "Tool"],
      ["Package registry", "packages/registry.html", "Spec"],
      ["Package consumers", "guides/package-consumer-quickstart.html", "Lock"],
      ["Verification", "guides/testing-and-verification.html", "CI"],
    ],
  },
];

mkdirSync("docs/assets", { recursive: true });

const homeHtml = readFileSync(path.join(siteRoot, "index.html"), "utf8");
writeFileSync(path.join(docsRoot, "index.html"), rewriteHomepageLinks(homeHtml));
copyFileSync(path.join(siteRoot, "site.css"), path.join(docsRoot, "assets/site.css"));
copyFileSync(path.join(siteRoot, "assets/social-card.png"), path.join(docsRoot, "assets/social-card.png"));

for (const root of markdownRoots) {
  const sourceDir = path.join(docsRoot, root);
  for (const file of readdirSync(sourceDir).sort()) {
    if (!file.endsWith(".md")) continue;
    const sourcePath = path.join(sourceDir, file);
    const outputPath = sourcePath.replace(/\.md$/, ".html");
    const markdown = readFileSync(sourcePath, "utf8");
    writeFileSync(outputPath, renderMarkdownPage(markdown, sourcePath, outputPath));
  }
}

console.log("site built");

function rewriteHomepageLinks(html) {
  return html.replace(/href="([^"]+)"/g, (_match, href) => {
    if (href === "../examples/function_repair/README.md") {
      return `href="${githubRoot}/tree/main/examples/function_repair"`;
    }
    return `href="${rewriteMarkdownHref(href, path.join(docsRoot, "index.md"), path.join(docsRoot, "index.html"))}"`;
  });
}

function renderMarkdownPage(markdown, sourcePath, outputPath) {
  const headings = [];
  const article = renderMarkdown(markdown, sourcePath, outputPath, headings);
  const title = headings[0]?.text ?? titleFromPath(sourcePath);
  const relativeRoot = path.posix.relative(path.posix.dirname(toPosix(outputPath)), docsRoot) || ".";
  const assetPrefix = relativeRoot === "." ? "" : `${relativeRoot}/`;
  const sourceUrl = `${githubRoot}/blob/main/${toPosix(sourcePath)}`;
  const section = path.posix.basename(path.posix.dirname(toPosix(sourcePath)));

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)} | Forma Documentation</title>
    <meta name="description" content="Forma documentation for ${escapeHtml(title)}.">
    <link rel="stylesheet" href="${assetPrefix}assets/site.css">
  </head>
  <body>
    <div class="page-frame doc-page">
      <header class="topbar">
        <a class="brand" href="${linkFrom(outputPath, path.join(docsRoot, "index.html"))}" aria-label="Forma documentation home">
          <span class="brand-mark" aria-hidden="true">F</span>
          <span>Forma</span>
        </a>
        <nav class="topnav" aria-label="Primary navigation">
          <a href="${linkFrom(outputPath, path.join(docsRoot, "guides/golden-workflow.html"))}">Docs</a>
          <a href="${githubRoot}/tree/main/examples">Examples</a>
          <a href="${linkFrom(outputPath, path.join(docsRoot, "packages/registry.html"))}">Packages</a>
          <a href="${githubRoot}">GitHub</a>
        </nav>
      </header>

      <div class="docs-shell">
        <aside class="sidebar" aria-label="Documentation sections">
          <label class="search-label" for="site-search">Search docs</label>
          <input id="site-search" class="search" type="search" aria-label="Search docs">
          ${renderNav(outputPath)}
        </aside>

        <main class="content markdown-content" id="main">
          <div class="breadcrumb">Docs / ${escapeHtml(titleCase(section))} / <span>${escapeHtml(title)}</span></div>
          <article class="markdown-body">
${article}
          </article>
        </main>

        <aside class="right-rail" aria-label="Page context">
          <section class="rail-card">
            <h2>On this page</h2>
            ${renderToc(headings)}
          </section>
          <section class="rail-card">
            <h2>Source</h2>
            <p><a href="${sourceUrl}">View Markdown source on GitHub</a></p>
          </section>
        </aside>
      </div>
    </div>
  </body>
</html>
`;
}

function renderNav(outputPath) {
  return navSections
    .map((section) => `<section class="nav-group">
            <h2>${escapeHtml(section.title)}</h2>
${section.items
  .map(([label, target, code]) => {
    const targetPath = path.posix.join(docsRoot, target);
    const active = normalizePath(outputPath) === targetPath ? " active" : "";
    return `            <a class="nav-item${active}" href="${linkFrom(outputPath, targetPath)}"><span>${escapeHtml(label)}</span><code>${escapeHtml(code)}</code></a>`;
  })
  .join("\n")}
          </section>`)
    .join("\n\n");
}

function renderToc(headings) {
  const entries = headings.filter((heading) => heading.level === 2 || heading.level === 3).slice(0, 12);
  if (entries.length === 0) return `<p>No sections detected.</p>`;
  return `<ol class="page-list">
${entries.map((heading) => `              <li><a href="#${heading.id}">${escapeHtml(heading.text)}</a></li>`).join("\n")}
            </ol>`;
}

function renderMarkdown(markdown, sourcePath, outputPath, headings) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let paragraph = [];
  let listType = null;
  let table = null;
  let codeFence = null;
  let codeLines = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    html.push(`            <p>${renderInline(paragraph.join(" "), sourcePath, outputPath)}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!listType) return;
    html.push(`            </${listType}>`);
    listType = null;
  };
  const flushTable = () => {
    if (!table) return;
    html.push(renderTable(table, sourcePath, outputPath));
    table = null;
  };
  const closeFlow = () => {
    flushParagraph();
    flushList();
    flushTable();
  };

  for (const line of lines) {
    const fence = line.match(/^```(.*)$/);
    if (fence) {
      if (codeFence !== null) {
        html.push(`            <pre><code${codeFence ? ` class="language-${escapeAttribute(codeFence)}"` : ""}>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        codeFence = null;
        codeLines = [];
      } else {
        closeFlow();
        codeFence = fence[1].trim().split(/\s+/)[0] ?? "";
        codeLines = [];
      }
      continue;
    }

    if (codeFence !== null) {
      codeLines.push(line);
      continue;
    }

    if (!line.trim()) {
      closeFlow();
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      closeFlow();
      const level = heading[1].length;
      const text = stripInlineMarkdown(heading[2].trim());
      const id = uniqueSlug(text, headings);
      headings.push({ level, text, id });
      html.push(`            <h${level} id="${id}">${renderInline(heading[2].trim(), sourcePath, outputPath)}</h${level}>`);
      continue;
    }

    if (isTableLine(line)) {
      flushParagraph();
      flushList();
      table ??= [];
      table.push(line);
      continue;
    }

    flushTable();

    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      flushParagraph();
      const nextListType = unordered ? "ul" : "ol";
      if (listType !== nextListType) {
        flushList();
        listType = nextListType;
        html.push(`            <${listType}>`);
      }
      const item = unordered?.[1] ?? ordered?.[1] ?? "";
      html.push(`              <li>${renderInline(item, sourcePath, outputPath)}</li>`);
      continue;
    }

    const quote = line.match(/^>\s?(.+)$/);
    if (quote) {
      closeFlow();
      html.push(`            <blockquote><p>${renderInline(quote[1], sourcePath, outputPath)}</p></blockquote>`);
      continue;
    }

    paragraph.push(line.trim());
  }

  if (codeFence !== null) {
    html.push(`            <pre><code${codeFence ? ` class="language-${escapeAttribute(codeFence)}"` : ""}>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  }
  closeFlow();
  return html.join("\n");
}

function renderTable(lines, sourcePath, outputPath) {
  const rows = lines
    .filter((line) => !/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line))
    .map((line) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim()));
  if (rows.length === 0) return "";
  const [head, ...body] = rows;
  return `            <table>
              <thead><tr>${head.map((cell) => `<th>${renderInline(cell, sourcePath, outputPath)}</th>`).join("")}</tr></thead>
              <tbody>
${body.map((row) => `                <tr>${row.map((cell) => `<td>${renderInline(cell, sourcePath, outputPath)}</td>`).join("")}</tr>`).join("\n")}
              </tbody>
            </table>`;
}

function renderInline(text, sourcePath, outputPath) {
  const chunks = text.split(/(`[^`]*`)/g);
  return chunks
    .map((chunk) => {
      if (chunk.startsWith("`") && chunk.endsWith("`")) {
        return `<code>${escapeHtml(chunk.slice(1, -1))}</code>`;
      }
      return escapeHtml(chunk)
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => `<a href="${escapeAttribute(rewriteMarkdownHref(href, sourcePath, outputPath))}">${label}</a>`)
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    })
    .join("");
}

function rewriteMarkdownHref(href, sourcePath, outputPath) {
  if (/^(https?:|mailto:|#)/.test(href)) return href;
  const [pathPart, fragment = ""] = href.split("#");
  if (!pathPart.endsWith(".md")) return href;

  const sourceDir = path.posix.dirname(toPosix(sourcePath));
  const target = pathPart.startsWith("docs/")
    ? toPosix(pathPart)
    : normalizePath(path.posix.join(sourceDir, pathPart));

  if (!target.startsWith("docs/")) {
    return githubUrlFor(target);
  }

  const htmlTarget = target.replace(/\.md$/, ".html");
  return `${linkFrom(outputPath, htmlTarget)}${fragment ? `#${fragment}` : ""}`;
}

function linkFrom(outputPath, targetPath) {
  const relative = path.posix.relative(path.posix.dirname(normalizePath(outputPath)), normalizePath(targetPath));
  return relative.startsWith(".") ? relative : `./${relative}`;
}

function githubUrlFor(target) {
  if (target === "README.md") return `${githubRoot}#readme`;
  if (target.endsWith("/README.md")) return `${githubRoot}/tree/main/${target.replace(/\/README\.md$/, "")}`;
  return `${githubRoot}/blob/main/${target}`;
}

function isTableLine(line) {
  return /^\s*\|.+\|\s*$/.test(line) || /^\s*[^|]+\s*\|.+\s*$/.test(line);
}

function stripInlineMarkdown(text) {
  return text.replace(/`([^`]+)`/g, "$1").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\*\*([^*]+)\*\*/g, "$1");
}

function uniqueSlug(text, headings) {
  const base = text.toLowerCase().replace(/`/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section";
  let slug = base;
  let index = 2;
  const seen = new Set(headings.map((heading) => heading.id));
  while (seen.has(slug)) {
    slug = `${base}-${index}`;
    index += 1;
  }
  return slug;
}

function titleFromPath(file) {
  return titleCase(path.posix.basename(file, ".md"));
}

function titleCase(text) {
  return text.replace(/[-_]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizePath(file) {
  return path.posix.normalize(toPosix(file));
}

function toPosix(file) {
  return file.split(path.sep).join(path.posix.sep);
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttribute(text) {
  return escapeHtml(text).replace(/'/g, "&#39;");
}
