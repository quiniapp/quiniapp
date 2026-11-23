// Instala los hooks de git con husky 9 (`core.hooksPath = .husky/_`) al correr `npm install`.
// No corre en CI ni en los deploys (Vercel, Railway/Render en producción), donde no hay
// hooks que instalar y husky puede no estar (devDependency).
if (process.env.CI || process.env.VERCEL || process.env.NODE_ENV === 'production') {
  process.exit(0);
}

try {
  const husky = (await import('husky')).default;
  const message = husky();
  if (message) console.log(message);
} catch (error) {
  console.warn('husky no se pudo instalar:', error instanceof Error ? error.message : error);
}
