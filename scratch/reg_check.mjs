import { execSync } from 'child_process';

try {
  const out1 = execSync('reg query HKCU\\Environment', { encoding: 'utf-8' });
  console.log('=== HKCU\\Environment ===\n' + out1);
} catch (e) {
  console.log('HKCU error:', e.message);
}

try {
  const out2 = execSync('reg query "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment" /v OPENAI_API_KEY', { encoding: 'utf-8' });
  console.log('=== HKLM OPENAI_API_KEY ===\n' + out2);
} catch (e) {
  console.log('HKLM: OPENAI_API_KEY is not in system environment.');
}
