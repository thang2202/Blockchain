// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ArtToken.sol";

contract Auction {
    ArtToken public artToken;

    struct AuctionItem {
        uint256 tokenId;
        address payable seller;
        uint256 startTime;
        uint256 endTime;
        uint256 startPrice;
        address highestBidder;
        uint256 highestBid;
        bool ended;
    }

    mapping(uint256 => AuctionItem) public auctions;
    uint256 public auctionCount;

    event AuctionCreated(uint256 indexed auctionId, uint256 indexed tokenId, address seller, uint256 startPrice, uint256 endTime);
    event NewBid(uint256 indexed auctionId, address bidder, uint256 amount);
    event AuctionEnded(uint256 indexed auctionId, address winner, uint256 amount);

    constructor(address _artTokenAddress) {
        artToken = ArtToken(_artTokenAddress);
    }

    function createAuction(uint256 _tokenId, uint256 _startPrice, uint256 _durationInMinutes) external {
        require(artToken.ownerOf(_tokenId) == msg.sender, "Not the owner of the token");
        require(_durationInMinutes > 0, "Duration must be positive");
        require(_startPrice > 0, "Start price must be positive");

        // Approve the auction contract to transfer the NFT
        artToken.approve(address(this), _tokenId);
        artToken.transferFrom(msg.sender, address(this), _tokenId);

        uint256 startTime = block.timestamp;
        uint256 endTime = startTime + (_durationInMinutes * 1 minutes);

        auctionCount++;
        auctions[auctionCount] = AuctionItem({
            tokenId: _tokenId,
            seller: payable(msg.sender),
            startTime: startTime,
            endTime: endTime,
            startPrice: _startPrice,
            highestBidder: address(0),
            highestBid: _startPrice,
            ended: false
        });

        emit AuctionCreated(auctionCount, _tokenId, msg.sender, _startPrice, endTime);
    }

    function placeBid(uint256 _auctionId) external payable {
        AuctionItem storage auction = auctions[_auctionId];
        require(block.timestamp >= auction.startTime && block.timestamp <= auction.endTime, "Auction not active");
        require(msg.value > auction.highestBid, "Bid too low");
        require(!auction.ended, "Auction already ended");
        require(msg.sender != auction.seller, "Seller cannot bid");

        // Refund previous highest bidder
        if (auction.highestBidder != address(0)) {
            payable(auction.highestBidder).transfer(auction.highestBid);
        }

        auction.highestBidder = msg.sender;
        auction.highestBid = msg.value;

        emit NewBid(_auctionId, msg.sender, msg.value);
    }

    function endAuction(uint256 _auctionId) external {
        AuctionItem storage auction = auctions[_auctionId];
        require(block.timestamp > auction.endTime, "Auction not yet ended");
        require(!auction.ended, "Auction already ended");

        auction.ended = true;

        if (auction.highestBidder != address(0)) {
            // Transfer NFT to winner
            artToken.transferFrom(address(this), auction.highestBidder, auction.tokenId);
            // Transfer funds to seller
            auction.seller.transfer(auction.highestBid);
            emit AuctionEnded(_auctionId, auction.highestBidder, auction.highestBid);
        } else {
            // No bids, return NFT to seller
            artToken.transferFrom(address(this), auction.seller, auction.tokenId);
            emit AuctionEnded(_auctionId, address(0), 0);
        }
    }

    function getAuctionDetails(uint256 _auctionId) external view returns (AuctionItem memory) {
        return auctions[_auctionId];
    }

    function getAuctionCount() external view returns (uint256) {
        return auctionCount;
    }
}