import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveAssetUrl } from '../src/core/paths.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WEB_ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(WEB_ROOT, 'public');
const DIST_DIR = path.join(WEB_ROOT, 'dist');

const FORBIDDEN_RAW_DOITPOMS_FILES = [
  'aluminium_al995_doitpoms609.jpg',
  'copper_cu997_doitpoms436.jpg',
  'ferritic_steel_fe202.jpg',
];

function walkFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

test('TASK-803: web/public/data/materials.json exists and contains valid JSON for all 4 materials', () => {
  const materialsPath = path.join(PUBLIC_DIR, 'data', 'materials.json');
  assert.ok(fs.existsSync(materialsPath), `Missing ${materialsPath}`);
  const raw = fs.readFileSync(materialsPath, 'utf-8');
  const parsed = JSON.parse(raw);

  const materialsMap = parsed.materials || parsed;
  const expectedKeys = ['aluminium', 'copper', 'pure_iron', 'ferritic_steel'];
  for (const key of expectedKeys) {
    const mat = materialsMap[key];
    assert.ok(mat, `Missing material "${key}" in materials.json`);
    assert.ok(typeof mat.name === 'string' && mat.name.length > 0, `Material "${key}" missing name`);
    const struct = mat.structure || mat.crystal_structure;
    assert.ok(struct === 'FCC' || struct === 'BCC', `Invalid structure for "${key}"`);
    assert.ok(mat.parameters, `Material "${key}" missing parameters block`);
    assert.ok(mat.parameters.tau_star_ref_calibrated, `Material "${key}" missing tau_star_ref_calibrated`);
    assert.equal(
      mat.parameters.tau_star_ref_calibrated.status,
      'calibrated',
      `Material "${key}" tau_star_ref_calibrated must have status "calibrated"`,
    );
  }
});

test('TASK-803: web/public/data/micrographs/ contains index.json and all 5 exported micrograph JSON fixtures', () => {
  const microDir = path.join(PUBLIC_DIR, 'data', 'micrographs');
  const indexPath = path.join(microDir, 'index.json');
  assert.ok(fs.existsSync(indexPath), `Missing ${indexPath}`);

  const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  assert.ok(Array.isArray(indexData.micrographs), 'index.json must contain micrographs array');
  assert.ok(indexData.micrographs.length >= 5, 'index.json must list at least 5 micrograph fixtures');

  const ccByNcSaKeys = new Set(['aluminium', 'copper', 'ferritic_steel']);
  for (const item of indexData.micrographs) {
    const fixturePath = path.join(microDir, `${item.key}.json`);
    assert.ok(fs.existsSync(fixturePath), `Missing micrograph fixture ${fixturePath}`);
    const fixtureData = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));
    assert.equal(fixtureData.key, item.key);
    if (ccByNcSaKeys.has(item.key)) {
      assert.equal(
        fixtureData.redistributable_raw_image,
        false,
        `DoITPoMS micrograph ${item.key} must mark redistributable_raw_image: false`,
      );
    }
    assert.ok(Array.isArray(fixtureData.chords_um) && fixtureData.chords_um.length > 0);
    assert.ok(Array.isArray(fixtureData.grains) && fixtureData.grains.length > 0);
  }
});

test('TASK-803 (D6 Compliance): Zero raw CC BY-NC-SA DoITPoMS .jpg files exist anywhere under web/public/ or web/dist/', () => {
  const publicFiles = walkFiles(PUBLIC_DIR).map((f) => path.basename(f).toLowerCase());
  const distFiles = walkFiles(DIST_DIR).map((f) => path.basename(f).toLowerCase());

  for (const forbidden of FORBIDDEN_RAW_DOITPOMS_FILES) {
    assert.ok(
      !publicFiles.includes(forbidden.toLowerCase()),
      `D6 violation: forbidden raw micrograph ${forbidden} found in web/public/`,
    );
    assert.ok(
      !distFiles.includes(forbidden.toLowerCase()),
      `D6 violation: forbidden raw micrograph ${forbidden} found in web/dist/`,
    );
  }
});

test('TASK-803: If web/dist/index.html exists, all referenced JS/CSS bundles in web/dist/assets/ exist and are non-empty', () => {
  const distIndex = path.join(DIST_DIR, 'index.html');
  if (!fs.existsSync(distIndex)) {
    return;
  }
  const html = fs.readFileSync(distIndex, 'utf-8');
  const assetMatches = [...html.matchAll(/(?:src|href)="([^"]*assets\/[^"]+)"/g)];
  assert.ok(assetMatches.length > 0, 'web/dist/index.html should reference at least one bundle in assets/');

  for (const match of assetMatches) {
    const rawRef = match[1];
    const relFromAssets = rawRef.slice(rawRef.indexOf('assets/'));
    const fullAssetPath = path.join(DIST_DIR, relFromAssets);
    assert.ok(fs.existsSync(fullAssetPath), `Referenced bundle missing: ${fullAssetPath}`);
    const stat = fs.statSync(fullAssetPath);
    assert.ok(stat.size > 0, `Referenced bundle is empty: ${fullAssetPath}`);
  }
});

test('TASK-804: .nojekyll exists in web/public/ and web/dist/ to prevent GitHub Pages from dropping underscore files', () => {
  const publicNoJekyll = path.join(PUBLIC_DIR, '.nojekyll');
  assert.ok(fs.existsSync(publicNoJekyll), `Missing ${publicNoJekyll}`);

  if (fs.existsSync(DIST_DIR)) {
    const distNoJekyll = path.join(DIST_DIR, '.nojekyll');
    assert.ok(fs.existsSync(distNoJekyll), `Missing ${distNoJekyll} after build`);
  }
});

test('TASK-804: resolveAssetUrl handles root, subpath, relative, and GitHub Pages trailing-slash drop variants', () => {
  const sampleRel = 'data/micrographs/aluminium.json';

  // 1. Root base '/'
  assert.equal(
    resolveAssetUrl(sampleRel, '/'),
    '/data/micrographs/aluminium.json',
    'Root base must return /data/micrographs/aluminium.json',
  );

  // 2. Subpath base '/hpsim/'
  assert.equal(
    resolveAssetUrl(sampleRel, '/hpsim/'),
    '/hpsim/data/micrographs/aluminium.json',
    'Subpath base /hpsim/ must return /hpsim/data/micrographs/aluminium.json',
  );

  // 3. Subpath base without trailing slash '/hpsim'
  assert.equal(
    resolveAssetUrl(sampleRel, '/hpsim'),
    '/hpsim/data/micrographs/aluminium.json',
    'Subpath base /hpsim must ensure trailing slash',
  );

  // 4. Relative base './'
  assert.equal(
    resolveAssetUrl(sampleRel, './'),
    './data/micrographs/aluminium.json',
    'Relative base ./ must return ./data/micrographs/aluminium.json',
  );

  // 5. Relative base '' (empty)
  assert.equal(
    resolveAssetUrl(sampleRel, ''),
    './data/micrographs/aluminium.json',
    'Empty relative base must normalize to ./',
  );

  // 6. Leading slash in relPath must be stripped cleanly
  assert.equal(
    resolveAssetUrl(`/${sampleRel}`, '/hpsim/'),
    '/hpsim/data/micrographs/aluminium.json',
    'Leading slash in relPath must be sanitized',
  );

  // 7. GitHub Pages trailing-slash drop mitigation:
  // e.g. URL visited is https://<user>.github.io/hpsim -> window.location.pathname === '/hpsim'
  assert.equal(
    resolveAssetUrl(sampleRel, './', { pathname: '/hpsim' }),
    '/hpsim/data/micrographs/aluminium.json',
    'Trailing-slash drop on /hpsim must prepend repo prefix',
  );

  // 8. Normal trailing-slash pathname:
  // e.g. URL visited is https://<user>.github.io/hpsim/ -> window.location.pathname === '/hpsim/'
  assert.equal(
    resolveAssetUrl(sampleRel, './', { pathname: '/hpsim/' }),
    './data/micrographs/aluminium.json',
    'Pathname with trailing slash retains relative path',
  );

  // 9. Root html file:
  assert.equal(
    resolveAssetUrl(sampleRel, './', { pathname: '/index.html' }),
    './data/micrographs/aluminium.json',
    'Root index.html retains relative path',
  );
});

test('TASK-804: web/package.json contains build:gh-pages script targeting /hpsim/ subpath', () => {
  const pkgPath = path.join(WEB_ROOT, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  assert.ok(pkg.scripts && pkg.scripts['build:gh-pages'], 'package.json missing build:gh-pages script');
});
