import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("docs/assets", { recursive: true });
copyFileSync("site/index.html", "docs/index.html");
copyFileSync("site/site.css", "docs/assets/site.css");
copyFileSync("site/assets/social-card.png", "docs/assets/social-card.png");

console.log("site built");
