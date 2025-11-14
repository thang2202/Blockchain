import { expect } from "chai";
import { ethers } from "hardhat";

describe("Art Auction System", function () {
  let ArtToken, artToken, Auction, auction;
  let owner, artist, bidder1, bidder2;

  beforeEach(async function () {
    [owner, artist, bidder1, bidder2] = await ethers.getSigners();

    // Deploy ArtToken
    ArtToken = await ethers.getContractFactory("ArtToken");
    artToken = await ArtToken.deploy();
    await artToken.waitForDeployment();

    // Deploy Auction
    Auction = await ethers.getContractFactory("Auction");
    auction = await Auction.deploy(await artToken.getAddress());
    await auction.waitForDeployment();

    // Mint NFT for testing
    await artToken.safeMint(artist.address);
  });

  describe("NFT Creation", function () {
    it("Should mint NFT successfully", async function () {
      expect(await artToken.ownerOf(1)).to.equal(artist.address);
    });

    it("Should increment token ID", async function () {
      await artToken.safeMint(artist.address);
      expect(await artToken.currentTokenId()).to.equal(2);
    });
  });

  describe("Auction Creation", function () {
    beforeEach(async function () {
      await artToken.connect(artist).approve(await auction.getAddress(), 1);
    });

    it("Should create auction successfully", async function () {
      await auction.connect(artist).createAuction(1, ethers.parseEther("1.0"), 60);
      
      const auctionDetails = await auction.auctions(1);
      expect(auctionDetails.seller).to.equal(artist.address);
      expect(auctionDetails.startPrice).to.equal(ethers.parseEther("1.0"));
      expect(auctionDetails.ended).to.be.false;
    });

    it("Should transfer NFT to auction contract", async function () {
      await auction.connect(artist).createAuction(1, ethers.parseEther("1.0"), 60);
      expect(await artToken.ownerOf(1)).to.equal(await auction.getAddress());
    });

    it("Should reject zero duration", async function () {
      await expect(
        auction.connect(artist).createAuction(1, ethers.parseEther("1.0"), 0)
      ).to.be.revertedWith("Duration must be positive");
    });
  });

  describe("Bidding", function () {
    beforeEach(async function () {
      await artToken.connect(artist).approve(await auction.getAddress(), 1);
      await auction.connect(artist).createAuction(1, ethers.parseEther("1.0"), 60);
    });

    it("Should accept higher bid", async function () {
      await auction.connect(bidder1).placeBid(1, { value: ethers.parseEther("1.5") });
      
      const auctionDetails = await auction.auctions(1);
      expect(auctionDetails.highestBidder).to.equal(bidder1.address);
      expect(auctionDetails.highestBid).to.equal(ethers.parseEther("1.5"));
    });

    it("Should reject lower bid", async function () {
      await expect(
        auction.connect(bidder1).placeBid(1, { value: ethers.parseEther("0.5") })
      ).to.be.revertedWith("Bid too low");
    });

    it("Should refund previous bidder", async function () {
      const initialBalance = await ethers.provider.getBalance(bidder1.address);
      
      await auction.connect(bidder1).placeBid(1, { value: ethers.parseEther("1.5") });
      await auction.connect(bidder2).placeBid(1, { value: ethers.parseEther("2.0") });
      
      // bidder1 should be refunded (balance should be close to initial)
      const finalBalance = await ethers.provider.getBalance(bidder1.address);
      const difference = finalBalance - initialBalance;
      expect(difference).to.be.closeTo(ethers.parseEther("-0.1"), ethers.parseEther("0.05"));
    });
  });

  describe("Auction Ending", function () {
    beforeEach(async function () {
      await artToken.connect(artist).approve(await auction.getAddress(), 1);
      await auction.connect(artist).createAuction(1, ethers.parseEther("1.0"), 1); // 1 minute
    });

    it("Should end auction and transfer NFT to winner", async function () {
      await auction.connect(bidder1).placeBid(1, { value: ethers.parseEther("1.5") });
      
      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [61]);
      await ethers.provider.send("evm_mine");
      
      await auction.connect(artist).endAuction(1);
      
      const auctionDetails = await auction.auctions(1);
      expect(auctionDetails.ended).to.be.true;
      expect(await artToken.ownerOf(1)).to.equal(bidder1.address);
    });

    it("Should return NFT to seller if no bids", async function () {
      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [61]);
      await ethers.provider.send("evm_mine");
      
      await auction.connect(artist).endAuction(1);
      
      expect(await artToken.ownerOf(1)).to.equal(artist.address);
    });
  });
});