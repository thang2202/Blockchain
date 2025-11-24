const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Digital Art Auction Platform...');

const services = [
  {
    name: 'MongoDB',
    command: 'mongod --dbpath ./mongodb-data',
    cwd: process.cwd()
  },
  {
    name: 'IPFS',
    command: 'ipfs',
    args: ['daemon'],
    cwd: process.cwd()
  },
  {
    name: 'Blockchain',
    command: 'npx',
    args: ['hardhat', 'node'],
    cwd: path.join(process.cwd(), 'contracts')
  },
  {
    name: 'Backend',
    command: 'npm',
    args: ['run', 'dev'],
    cwd: path.join(process.cwd(), 'backend')
  },
  {
    name: 'Frontend',
    command: 'npm',
    args: ['start'],
    cwd: path.join(process.cwd(), 'frontend')
  }
];

services.forEach(service => {
  console.log(`Starting ${service.name}...`);
  
  const child = spawn(service.command, service.args || [], {
    cwd: service.cwd,
    stdio: 'inherit',
    shell: true
  });

  child.on('error', (error) => {
    console.error(`❌ Failed to start ${service.name}:`, error.message);
  });

  child.on('exit', (code) => {
    if (code !== 0) {
      console.log(`⚠️ ${service.name} exited with code ${code}`);
    }
  });
});

console.log('✅ All services started!');
console.log('📱 Frontend: http://localhost:3000');
console.log('🔧 Backend: http://localhost:5000');
console.log('⛓️ Blockchain: http://localhost:8545');