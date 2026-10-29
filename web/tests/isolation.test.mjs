/** NFR-04 for the browser core: web/src/core must not import UI/rendering/DOM modules. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const FORBIDDEN = /from\s+["'](react|react-dom|three|vite)[^"']*["']|document\.|window\.|HTMLElement|WebGL/;

test("web/src/core has no UI/rendering/DOM dependencies", () => {
  const files = fs.readdirSync("web/src/core").filter((f) => f.endsWith(".ts"));
  assert.ok(files.length >= 10, `expected core modules, found ${files.length}`);
  for (const f of files) {
    const src = fs.readFileSync(`web/src/core/${f}`, "utf-8");
    assert.ok(!FORBIDDEN.test(src), `forbidden UI/render dependency in web/src/core/${f}`);
    for (const m of src.matchAll(/from\s+["'](\.[^"']+)["']/g)) {
      assert.ok(!/render|ui|model/.test(m[1]), `core imports non-core module ${m[1]} in ${f}`);
    }
  }
});
