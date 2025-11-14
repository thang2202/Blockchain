// Quick start script for Hardhat
const { run } = require("hardhat");

async function main() {
  console.log("🎯 Digital Art Auction Platform - Quick Start");
  console.log("=============================================");
  
  // Compile contracts
  console.log("\n📦 Compiling contracts...");
  await run("compile");
  console.log("✅ Contracts compiled successfully!");
  
  // Start local node
  console.log("\n🔗 Starting local blockchain node...");
  console.log("   Run this in a separate terminal:");
  console.log("   npx hardhat node");
  
  console.log("\n🚀 Deployment command:");
  console.log("   npx hardhat run scripts/deploy.js --network localhost");
  
  console.log("\n🧪 Testing command:");
  console.log("   npx hardhat test");
  
  console.log("\n📝 Don't forget to:");
  console.log("   1. Update .env files with contract addresses");
  console.log("   2. Start IPFS: ipfs daemon");
  console.log("   3. Start MongoDB: mongod");
  console.log("   4. Start backend: cd backend && npm run dev");
  console.log("   5. Start frontend: cd frontend && npm start");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});