import 'dotenv/config';
import { migrateSaasTemplatesFromDatabase } from './migrateSaasTemplates.ts';

try {
  await migrateSaasTemplatesFromDatabase();
  console.log('SaaS template migration completed.');
  process.exit(0);
} catch (error) {
  console.error('SaaS template migration failed:', error);
  process.exit(1);
}
