const { execSync } = require('child_process');

if (!process.env.DATABASE_URL) {
  console.log('Skip migrations (DATABASE_URL missing)');
  process.exit(0);
}

try {
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
} catch (error) {
  console.error('Migration failed:', error.message);
  process.exit(1);
}
