// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ArtToken is ERC721, Ownable {
    uint256 private _nextTokenId;

    constructor() ERC721("ArtToken", "ART") Ownable(msg.sender) {}

    function safeMint(address to) public onlyOwner returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        return tokenId;
    }

    function currentTokenId() public view returns (uint256) {
        return _nextTokenId;
    }
}