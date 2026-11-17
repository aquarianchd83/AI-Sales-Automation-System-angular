// Production build that lands in the publish repo's working folder.
//
//   npm run build:publish
//
// Builds into dist/publish-tmp first, then replaces the contents of the publish folder with it. The publish folder is a git
// checkout, so .git and .gitignore are NEVER touched (Angular's own output-path cleaning would delete them, which is why the build
// does not write there directly). Override the target with PUBLISH_DIR.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DEFAULT_TARGET = 'D:\\Projects\\-AI-Sales-Automation-System\\publish\\AI-Sales-Automation-System-angular-publish';
const KEEP = new Set(['.git', '.gitignore']);

const target = resolve(process.env.PUBLISH_DIR || DEFAULT_TARGET);
const staging = resolve('dist', 'publish-tmp');

rmSync(staging, { recursive: true, force: true });

const build = spawnSync('npx', ['ng', 'build', '--configuration', 'production', '--output-path', staging], {
  stdio: 'inherit',
  shell: true,
});
if (build.status !== 0 || !existsSync(join(staging, 'index.html'))) {
  console.error('Build failed; the publish folder was left untouched.');
  process.exit(build.status || 1);
}

mkdirSync(target, { recursive: true });
for (const name of readdirSync(target)) {
  if (!KEEP.has(name)) rmSync(join(target, name), { recursive: true, force: true });
}
for (const name of readdirSync(staging)) {
  if (!KEEP.has(name)) cpSync(join(staging, name), join(target, name), { recursive: true });
}
rmSync(staging, { recursive: true, force: true });

console.log(`\nBuild copied to ${target} (.git and .gitignore preserved).`);
