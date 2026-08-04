import 'dotenv/config';
import { initDatabase } from './init.ts';

try {
  await initDatabase();
  console.log('Database initialization completed.');
  process.exit(0);
} catch (error) {
  console.error('Database initialization failed:', error);
  process.exit(1);
}
