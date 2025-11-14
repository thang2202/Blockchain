import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Deploying Art Auction contracts...");

  // Deploy ArtToken
  const ArtToken = await ethers.getContractFactory("ArtToken");
  const artToken = await ArtToken.deploy();
  await artToken.waitForDeployment();
  console.log(`✅ ArtToken deployed to: ${await artToken.getAddress()}`);

  // Deploy Auction
  const Auction = await ethers.getContractFactory("Auction");
  const auction = await Auction.deploy(await artToken.getAddress());
  await auction.waitForDeployment();
  console.log(`✅ Auction deployed to: ${await auction.getAddress()}`);

  console.log("\n📋 Contract Addresses:");
  console.log(`ArtToken: ${await artToken.getAddress()}`);
  console.log(`Auction: ${await auction.getAddress()}`);

  // Verify ownership
  const [deployer] = await ethers.getSigners();
  console.log(`\n👤 Deployer: ${deployer.address}`);
  console.log(`🔗 Network: ${network.name}`);

  // Save to file for frontend
  const addresses = {
    ArtToken: await artToken.getAddress(),
    Auction: await auction.getAddress(),
    network: network.name
  };

  const fs = await import('fs');
  fs.writeFileSync('deployment-addresses.json', JSON.stringify(addresses, null, 2));
  console.log("\n💾 Addresses saved to deployment-addresses.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });