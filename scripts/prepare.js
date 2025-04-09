import { execSync } from 'child_process';

export function prepareHusky() {
  const isCI = process.env.CI === 'true';
  const isVercel = !!process.env.VERCEL;

  if (isCI || isVercel) {
    console.log('Skipping husky install in CI/Vercel');
    process.exit(0);
  }

  console.log('Running husky install...');
  execSync('husky install', { stdio: 'inherit' });
}
