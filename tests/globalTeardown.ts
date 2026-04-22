import { execSync } from 'child_process';
import path from 'path';

export default async () => {
  console.log('\n🛑 Stopping test containers...');
  try {
    const composeFile = path.resolve(__dirname, '../docker-compose.test.yml');
    execSync(`docker compose -f ${composeFile} down`, { stdio: 'inherit' });
    console.log('✅ Test containers stopped.\n');
  } catch (error) {
    console.error('❌ Failed to stop test containers:', error);
  }
};
