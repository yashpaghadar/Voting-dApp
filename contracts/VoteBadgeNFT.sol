// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title VoteBadgeNFT
 * @dev ERC721 token that represents voting participation badges
 * Each badge is minted when a user votes on a proposal
 */
contract VoteBadgeNFT is ERC721, Ownable {
    using Strings for uint256;
    
    // Base URI for token metadata
    string private _baseTokenURI;
    
    // Counter for token IDs
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIdCounter;
    
    // Voting contract address
    address public votingContract;
    
    // Mapping from proposal ID to voter address to badge status
    mapping(uint256 => mapping(address => bool)) private _voterBadges;
    
    // Mapping from token ID to NFT type (1: Ganesha, 2: Buddha, 3: Krishna)
    mapping(uint256 => uint256) public tokenIdToType;
    
    // Event emitted when a new badge is minted
    event BadgeMinted(address indexed to, uint256 indexed proposalId, uint256 indexed tokenId, uint256 nftType);
    
    // Modifier to restrict function calls to the voting contract
    modifier onlyVotingContract() {
        require(msg.sender == votingContract, "Caller is not the Voting contract");
        _;
    }

    /**
     * @dev Initializes the contract by setting a `name` and a `symbol` to the token collection.
     * Also sets the base URI for token metadata.
     */
    constructor(
        string memory name,
        string memory symbol,
        string memory baseTokenURI
    ) ERC721(name, symbol) {
        _baseTokenURI = baseTokenURI;
        // The deployer is the initial owner (can be transferred later)
        _transferOwnership(msg.sender);
    }

    function mintBadge(address to, uint256 proposalId, uint256 nftType) external onlyVotingContract {
        require(to != address(0), "Cannot mint to zero address");
        require(!_voterBadges[proposalId][to], "Badge already minted for this proposal");
        require(nftType >= 1 && nftType <= 3, "Invalid NFT type");

        // Generate a unique token ID
        _tokenIdCounter.increment();
        uint256 tokenId = _tokenIdCounter.current();

        // Mint the NFT to the voter
        _safeMint(to, tokenId);
        
        // Store the NFT type
        tokenIdToType[tokenId] = nftType;
        
        // Mark that this voter has received a badge for this proposal
        _voterBadges[proposalId][to] = true;

        emit BadgeMinted(to, proposalId, tokenId, nftType);
    }

    /**
     * @dev Checks if a voter has received a badge for a specific proposal
     * @param voter The address of the voter
     * @param proposalId The ID of the proposal
     * @return bool Whether the voter has a badge for the proposal
     */
    function hasBadge(address voter, uint256 proposalId) external view returns (bool) {
        return _voterBadges[proposalId][voter];
    }

    /**
     * @dev Returns the base URI for token metadata
     */
    function _baseURI() internal view virtual override returns (string memory) {
        return _baseTokenURI;
    }
    
    /**
     * @dev Returns the token URI for a given token ID
     */
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        require(_exists(tokenId), "ERC721Metadata: URI query for nonexistent token");
        
        uint256 nftType = tokenIdToType[tokenId];
        return string(abi.encodePacked(_baseTokenURI, nftType.toString(), ".json"));
    }
    
    /**
     * @dev Sets the voting contract address (only callable by owner)
     * @param _votingContract The address of the voting contract
     */
    function setVotingContract(address _votingContract) external onlyOwner {
        require(_votingContract != address(0), "Invalid address");
        votingContract = _votingContract;
    }
    
    /**
     * @dev Sets the base URI for all tokens
     * @param baseURI The base URI to set
     */
    function setBaseURI(string memory baseURI) external onlyOwner {
        _baseTokenURI = baseURI;
    }

    /**
     * @dev Returns the total number of badges minted
     * @return uint256 The total supply of badges
     */
    function totalSupply() external view returns (uint256) {
        return _tokenIdCounter.current();
    }
}
