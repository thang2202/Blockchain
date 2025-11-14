const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying contracts to local network...");
  
  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log(`👤 Deploying with account: ${deployer.address}`);
  console.log(`💰 Account balance: ${ethers.formatEther(await deployer.provider.getBalance(deployer.address))} ETH`);

  // Deploy ArtToken
  console.log("\n📦 Deploying ArtToken...");
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

  console.log("\n🎉 Deployment completed!");
  console.log("=====================================");
  console.log(`ArtToken: ${artTokenAddress}`);
  console.log(`Auction: ${auctionAddress}`);
  console.log(`Network: localhost`);
  console.log(`ChainId: 31337`);
  console.log("=====================================");

  // Save to file
  const fs = require('fs');
  const addresses = {
    ArtToken: artTokenAddress,
    Auction: auctionAddress,
    network: "localhost",
    chainId: 31337,
    rpcUrl: "http://127.0.0.1:8545"
  };
  
  fs.writeFileSync('deployment-addresses.json', JSON.stringify(addresses, null, 2));
  console.log("\n💾 Addresses saved to deployment-addresses.json");

  // Verify contracts are working
  console.log("\n🔍 Verifying contracts...");
  const currentTokenId = await artToken.currentTokenId();
  console.log(`Current token ID: ${currentTokenId}`);
  
  const auctionArtToken = await auction.artToken();
  console.log(`Auction's ArtToken: ${auctionArtToken}`);
  console.log("✅ Contracts verified successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });