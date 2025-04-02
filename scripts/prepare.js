// scripts/prepare.js
const isCI = process.env.CI === 'true';
const isVercel = !!process.env.VERCEL;

if (isCI || isVercel) {
  console.log('Skipping husky install in CI/Vercel');
  process.exit(0);
}

console.log('Running husky install...');
require('child_process').execSync('husky install', { stdio: 'inherit' });
