const { execSync } = require('child_process');

const vars = [
  'DATABASE_URL',
  'PROJECT_TOKEN',
  'PROJECT_ID',
];

const missing = vars.filter(v => !process.env[v]);

if (missing.length) {
  console.log('\nMissing required environment variables:');
  missing.forEach(v => console.log(` - ${v}`));
  console.log('\nSet them using Railway CLI:');
  missing.forEach(v => {
    console.log(`   railway variables:set ${v} <value>`);
  });
  console.log('\nAfter setting the variables, rerun this script.');
  process.exit(1);
}

function runCommand(cmd) {
  try {
    console.log(`\nRunning: ${cmd}`);
    execSync(cmd, { stdio: 'inherit' });
    console.log('✅ Success\n');
  } catch (err) {
    console.error('❌ Failed to run command:', cmd);
    process.exit(1);
  }
}

runCommand(`railway login --token ${process.env.PROJECT_TOKEN}`);
runCommand(`railway link ${process.env.PROJECT_ID}`);
runCommand('railway up');

