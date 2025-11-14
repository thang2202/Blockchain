const { exec } = require('child_process');
const http = require('http');

console.log('🔍 Checking services...');

// Check MongoDB
exec('netstat -ano | findstr :27017', (error, stdout) => {
  if (stdout.includes('LISTENING')) {
    console.log('✅ MongoDB is running on port 27017');
  } else {
    console.log('❌ MongoDB is not running');
  }
});

// Check Backend
const checkBackend = () => {
  const req = http.request('http://localhost:5000/api/health', (res) => {
    if (res.statusCode === 200) {
      console.log('✅ Backend is running on port 5000');
    }
  });
  
  req.on('error', () => {
    console.log('❌ Backend is not running');
  });
  
  req.end();
};

setTimeout(checkBackend, 1000);

// Check Frontend
setTimeout(() => {
  const req = http.request('http://localhost:3000', (res) => {
    if (res.statusCode === 200) {
      console.log('✅ Frontend is running on port 3000');
    }
  });
  
  req.on('error', () => {
    console.log('❌ Frontend is not running');
  });
  
  req.end();
}, 2000);