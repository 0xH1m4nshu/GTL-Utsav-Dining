// Copies dist output to gtl_restaurant_backend/static for Flask to serve
import { cpSync, rmSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, 'dist');
const staticDir = join(__dirname, '..', 'gtl_restaurant_backend', 'static');

if (!existsSync(distDir)) {
  console.error('dist folder not found. Run "npm run build" first.');
  process.exit(1);
}
if (existsSync(staticDir)) rmSync(staticDir, { recursive: true });
mkdirSync(staticDir, { recursive: true });
cpSync(distDir, staticDir, { recursive: true });
console.log('Copied dist -> gtl_restaurant_backend/static');
