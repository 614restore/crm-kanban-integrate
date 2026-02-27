#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const checks = [];

function addCheck(name, pass, detail) {
  checks.push({ name, pass, detail });
}

function fileExists(relPath) {
  return fs.existsSync(path.join(root, relPath));
}

function readJson(relPath) {
  const fullPath = path.join(root, relPath);
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

try {
  addCheck('package.json exists', fileExists('package.json'), 'Required for scripts and dependencies');
  addCheck('vite config exists', fileExists('vite.config.ts'), 'Required for build');
  addCheck('env example exists', fileExists('.env.example'), 'Required for onboarding');
  addCheck('e2e invite script exists', fileExists('scripts/e2e-invite.mjs'), 'Used by CI workflow');

  if (fileExists('package.json')) {
    const pkg = readJson('package.json');
    const requiredScripts = ['build', 'lint', 'test', 'test:month', 'e2e:invite', 'doctor', 'ci:quality'];

    for (const script of requiredScripts) {
      addCheck(`npm script "${script}"`, Boolean(pkg.scripts?.[script]), `Expected in package.json scripts`);
    }
  }

  const requiredEnvVars = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];
  if (fileExists('.env.example')) {
    const envExample = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
    for (const envVar of requiredEnvVars) {
      addCheck(
        `.env.example contains ${envVar}`,
        envExample.includes(`${envVar}=`),
        'Required for runtime auth and data access'
      );
    }
  }

  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.length - passed;

  for (const check of checks) {
    const icon = check.pass ? 'PASS' : 'FAIL';
    console.log(`${icon} ${check.name} - ${check.detail}`);
  }

  console.log(`\nDoctor summary: ${passed}/${checks.length} checks passed`);

  if (failed > 0) {
    process.exit(1);
  }
} catch (error) {
  console.error('Doctor failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
}
