import { execSync } from 'child_process';

const allEnv = Object.keys(process.env).filter(k => 
  k.toUpperCase().includes('OPENAI') || 
  k.toUpperCase().includes('API') || 
  k.toUpperCase().includes('KEY') ||
  k.toUpperCase().includes('VISION')
);
console.log('Matching keys in process.env:', allEnv);

try {
  const userVars = execSync('powershell -NoProfile -Command "Get-ChildItem Env: | Where-Object { $_.Name -match \'OPENAI|API|KEY|VISION\' } | Select-Object -ExpandProperty Name"', { encoding: 'utf-8' }).trim();
  console.log('Matching in User/Process Env:');
  console.log(userVars || '(None found)');
} catch (e) {
  console.log('PowerShell error:', e.message);
}

try {
  const userReg = execSync('powershell -NoProfile -Command "Get-ItemProperty -Path \'HKCU:\\Environment\' | Select-Object *"', { encoding: 'utf-8' }).trim();
  console.log('\nHKCU:\\Environment properties:');
  console.log(userReg.split('\n').filter(l => !l.includes('PSPath') && !l.includes('PSParentPath') && !l.includes('PSChildName') && !l.includes('PSDrive') && !l.includes('PSProvider')).join('\n'));
} catch (e) {
  console.log('Registry error:', e.message);
}
