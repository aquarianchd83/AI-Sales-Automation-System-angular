// Guards the Content-Security-Policy of the production web app (see docs/SECURITY-HEADERS.md).
//
//   node scripts/check-csp.mjs          source check: index.prod.html differs from index.html ONLY by the policy block, and the policy
//                                       keeps its protective directives.
//   node scripts/check-csp.mjs --dist   also checks the BUILT index.html: no inline script, no inline event handler (those are what a
//                                       strict script-src blocks, and Angular's critical-CSS inlining adds one), and the policy is there.
import { readFileSync, existsSync } from 'node:fs';

const fail = (message) => {
  console.error(`check:csp FAILED - ${message}`);
  process.exit(1);
};

const dev = readFileSync('src/index.html', 'utf8');
const prod = readFileSync('src/index.prod.html', 'utf8');

const block = /[ \t]*<!-- csp:start -->[\s\S]*?<!-- csp:end -->\r?\n?/;
if (!block.test(prod)) fail('src/index.prod.html has no <!-- csp:start --> ... <!-- csp:end --> block');
if (block.test(dev)) fail('src/index.html (used by `ng serve` and development builds) must not carry the policy');
if (prod.replace(block, '') !== dev) fail('src/index.prod.html differs from src/index.html outside the csp block - keep them identical');

const policy = /<meta http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(prod)?.[1];
if (!policy) fail('no Content-Security-Policy <meta> in src/index.prod.html');

const directives = Object.fromEntries(
  policy.split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
    const [name, ...values] = d.split(/\s+/);
    return [name, values];
  })
);

if (!directives['script-src']?.includes("'self'")) fail("script-src must allow 'self'");
for (const unsafe of ["'unsafe-inline'", "'unsafe-eval'", '*', 'https:', 'http:', 'data:']) {
  if (directives['script-src']?.includes(unsafe)) fail(`script-src must not contain ${unsafe} - that is what the policy exists to prevent`);
}
if (!directives['object-src']?.includes("'none'")) fail("object-src must be 'none'");
if (!directives['base-uri']?.includes("'self'")) fail("base-uri must be 'self'");
if (!directives['default-src']) fail('default-src is missing');

if (process.argv.includes('--dist')) {
  const file = 'dist/whatsapp-admin-panel/index.html';
  if (!existsSync(file)) fail(`${file} not found - run \`ng build --configuration production\` first`);
  const built = readFileSync(file, 'utf8');
  if (!built.includes('Content-Security-Policy')) fail('the production build lost the policy');
  const inlineScripts = [...built.matchAll(/<script(?![^>]*\bsrc=)[^>]*>/gi)];
  if (inlineScripts.length) fail(`the production build has ${inlineScripts.length} inline <script> - script-src 'self' would block it`);
  const handlers = [...built.matchAll(/<[a-z][^>]*\s(on[a-z]+)=/gi)].map((m) => m[1]);
  if (handlers.length) fail(`the production build has inline event handlers (${[...new Set(handlers)].join(', ')}) - script-src 'self' would block them. Is styles.inlineCritical back on?`);
}

console.log('check:csp ok');
