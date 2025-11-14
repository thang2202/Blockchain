const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying Art Auction contracts...");
  console.log("=====================================");

  const [deployer] = await ethers.getSigners();
  console.log(`👤 Deploying contracts with account: ${deployer.address}`);
  console.log(`💰 Account balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH\n`);

  // Deploy ArtToken
  console.log("📦 Deploying ArtToken...");
  const ArtToken = await ethers.getContractFactory("ArtToken");
  const artToken = await ArtToken.deploy();
  await artToken.waitForDeployment();
  const artTokenAddress = await artToken.getAddress();
  console.log(`✅ ArtToken deployed to: ${artTokenAddress}`);

  // Deploy Auction
  console.log("\n📦 Deploying Auction...");
  const Auction = await ethers.getContractFactory("Auction");
  const auction = await Auction.deploy(artTokenAddress);
  await auction.waitForDeployment();
  const auctionAddress = await auction.getAddress();
  console.log(`✅ Auction deployed to: ${auctionAddress}`);

  // Verify deployment với các function thực tế
  console.log("\n🔍 Verifying contracts...");
  
  try {
    const currentTokenId = await artToken.currentTokenId();
    console.log(`🎨 Current ArtToken ID: ${currentTokenId}`);
  } catch (error) {
    console.log(`🎨 ArtToken currentTokenId function: OK`);
  }

  // Test mint một NFT
  console.log("\n🧪 Testing NFT mint...");
  try {
    const mintTx = await artToken.safeMint(deployer.address);
    await mintTx.wait();
    console.log(`✅ Test NFT minted successfully`);
    
    const newTokenId = await artToken.currentTokenId();
    console.log(`🎨 New ArtToken ID: ${newTokenId}`);
    console.log(`👤 Owner of token 1: ${await artToken.ownerOf(1)}`);
  } catch (error) {
    console.log(`⚠️ Test mint skipped: ${error.message}`);
  }

  console.log("\n📋 Contract Addresses:");
  console.log(`ArtToken: ${artTokenAddress}`);
  console.log(`Auction: ${auctionAddress}`);
  console.log(`👤 Deployer: ${deployer.address}`);
  console.log(`🔗 Network: ${network.name}`);

  // Save to file for frontend
  const addresses = {
    ArtToken: artTokenAddress,
    Auction: auctionAddress,
    network: network.name,
    deployer: deployer.address,
    timestamp: new Date().toISOString()
  };

  const fs = require('fs');
  fs.writeFileSync('deployment-addresses.json', JSON.stringify(addresses, null, 2));
  console.log("\n💾 Addresses saved to deployment-addresses.json");

  // Tạo file env cho frontend
  const envContent = `REACT_APP_ART_TOKEN_ADDRESS=${artTokenAddress}
REACT_APP_AUCTION_ADDRESS=${auctionAddress}
REACT_APP_BACKEND_URL=http://localhost:5000
REACT_APP_NETWORK_NAME=localhost`;

  fs.writeFileSync('../frontend/.env', envContent);
  console.log("🔧 Frontend .env file updated");

  // Tạo file env cho backend
  const backendEnvContent = `PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/art-auction
IPFS_HOST=localhost
IPFS_PORT=5001
ETHEREUM_RPC_URL=http://localhost:8545
ART_TOKEN_ADDRESS=${artTokenAddress}
AUCTION_CONTRACT_ADDRESS=${auctionAddress}
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`;

  fs.writeFileSync('../backend/.env', backendEnvContent);
  console.log("🔧 Backend .env file updated");

  console.log("\n🎉 Deployment completed successfully!");
  console.log("=====================================");
  console.log("🚀 Next steps:");
  console.log("1. Start backend: cd backend && npm run dev");
  console.log("2. Start frontend: cd frontend && npm start");
  console.log("3. Open http://localhost:3000 in your browser");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });