import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

dotenv.config();

console.log('1. From process.env (including .env file):');
console.log('   OPENAI_API_KEY set:', !!process.env.OPENAI_API_KEY, 'Length:', (process.env.OPENAI_API_KEY || '').length);

console.log('\n2. .env file on disk:');
if (fs.existsSync('.env')) {
  const content = fs.readFileSync('.env', 'utf-8');
  console.log('   .env lines:');
  content.split('\n').forEach(line => {
    if (line.includes('OPENAI_API_KEY')) {
      const parts = line.split('=');
      const val = parts.slice(1).join('=').trim();
      console.log(`   OPENAI_API_KEY=${val ? (val.substring(0, 7) + '...' + val.slice(-4) + ' (length: ' + val.length + ')') : '(empty)'}`);
    } else {
      console.log('   ' + line.trim());
    }
  });
} else {
  console.log('   .env file does not exist.');
}

console.log('\n3. Windows User environment:');
try {
  const userKey = execSync('powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable(\'OPENAI_API_KEY\', \'User\')"', { encoding: 'utf-8' }).trim();
  console.log('   User env set:', !!userKey, 'Length:', userKey.length);
  if (userKey) {
    console.log('   Preview:', userKey.substring(0, 7) + '...' + userKey.slice(-4));
  }
} catch (e) {
  console.log('   Error reading User env:', e.message);
}

console.log('\n4. Windows Machine environment:');
try {
  const machineKey = execSync('powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable(\'OPENAI_API_KEY\', \'Machine\')"', { encoding: 'utf-8' }).trim();
  console.log('   Machine env set:', !!machineKey, 'Length:', machineKey.length);
  if (machineKey) {
    console.log('   Preview:', machineKey.substring(0, 7) + '...' + machineKey.slice(-4));
  }
} catch (e) {
  console.log('   Error reading Machine env:', e.message);
}
