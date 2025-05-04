/**
 * Script to run the collection analysis and generate summaries
 */

const path = require('path');
const { exec } = require('child_process');
require('dotenv').config();

// Path to the generate-collection-summaries.js script
const scriptPath = path.join(__dirname, 'generate-collection-summaries.js');

// Run the script
console.log('Running collection analysis script...');
console.log(`Script path: ${scriptPath}`);

const child = exec(`node ${scriptPath}`, (error, stdout, stderr) => {
  if (error) {
    console.error(`Error executing script: ${error.message}`);
    return;
  }
  
  if (stderr) {
    console.error(`Script stderr: ${stderr}`);
  }
  
  console.log(`Script stdout: ${stdout}`);
  console.log('Collection analysis complete!');
});

// Log output in real-time
child.stdout.on('data', (data) => {
  console.log(data.toString());
});

child.stderr.on('data', (data) => {
  console.error(data.toString());
});

child.on('exit', (code) => {
  console.log(`Child process exited with code ${code}`);
});
