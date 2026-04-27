// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract INFT is ERC721, Ownable {
   
    uint256 private _nextTokenId = 1;


    mapping(uint256 => bytes32) public genomeId;

    mapping(uint256 => uint256[2]) public parents;

    event AgentMinted(
        uint256 indexed tokenId,
        bytes32 indexed genomeId,
        uint256 parentA,
        uint256 parentB
    );

    event AgentBurned(uint256 indexed tokenId);

    constructor(string memory name, string memory symbol)
        ERC721(name, symbol)
        Ownable(msg.sender)
    {}


    function mint(
        address to,
        bytes32 _genomeId,
        uint256 parentA,
        uint256 parentB
    ) external onlyOwner returns (uint256) {
        uint256 tokenId = _nextTokenId++;

        _safeMint(to, tokenId);

        genomeId[tokenId] = _genomeId;
        parents[tokenId] = [parentA, parentB];

        emit AgentMinted(tokenId, _genomeId, parentA, parentB);

        return tokenId;
    }

   
    function burn(uint256 tokenId) external onlyOwner {
        _burn(tokenId);

        delete genomeId[tokenId];
        delete parents[tokenId];

        emit AgentBurned(tokenId);
    }

    function getGenomeId(uint256 tokenId) external view returns (bytes32) {
        return genomeId[tokenId];
    }

    function getParents(uint256 tokenId)
        external
        view
        returns (uint256 parentA, uint256 parentB)
    {
        parentA = parents[tokenId][0];
        parentB = parents[tokenId][1];
    }

    function totalMinted() external view returns (uint256) {
        return _nextTokenId - 1;
    }
}