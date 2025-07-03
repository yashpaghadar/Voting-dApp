// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./VoteBadgeNFT.sol";

contract Voting {
    struct Proposal {
        string description;
        uint256 deadline;
        uint256 votes;
        bool closed;
        bool removed;
        address winner;
        address creator;
        mapping(address => bool) hasVoted;
        mapping(address => uint256) voteWeights;
    }

    IERC20 public votetoken;
    VoteBadgeNFT public voteBadgeNFT;
    uint256 public proposalCount;
    mapping(uint256 => Proposal) private proposals;
    uint256 public constant VOTIVOTERIOD = 2 days; // 2 days
    address public owner;
    mapping(address => bool) public admins;
    event AdminAdded(address indexed admin);
    event AdminRemoved(address indexed admin);
    uint256 public constant PROPOSAL_FEE = 25 ether; // 25 VOTE (18 decimals)
    uint256 public constant VOTE_FEE = 10 ether; // 10 VOTE (18 decimals)

    event ProposalCreated(uint256 indexed proposalId, string description, uint256 deadline, address creator);
    event Voted(uint256 indexed proposalId, address indexed voter, uint256 weight);
    event ProposalClosed(uint256 indexed proposalId, address winner, uint256 votes);
    event ProposalRemoved(uint256 indexed proposalId, string description);
    event CommentAdded(uint256 indexed proposalId, address indexed commenter, string ipfsHash);

    constructor(address _VoteToken) {
        votetoken = IERC20(_VoteToken);
        owner = msg.sender;
        admins[msg.sender] = true; // Make deployer an admin
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    modifier onlyAdmin() {
        require(admins[msg.sender] || msg.sender == owner, "Not an admin");
        _;
    }

    function addAdmin(address _admin) external onlyOwner {
        require(_admin != address(0), "Invalid address");
        require(!admins[_admin], "Already an admin");
        admins[_admin] = true;
        emit AdminAdded(_admin);
    }
    
    function removeAdmin(address _admin) external onlyOwner {
        require(admins[_admin], "Not an admin");
        require(_admin != owner, "Cannot remove owner");
        admins[_admin] = false;
        emit AdminRemoved(_admin);
    }

    function setVoteBadgeNFT(address _voteBadgeNFT) external onlyAdmin {
        require(_voteBadgeNFT != address(0), "Invalid address");
        voteBadgeNFT = VoteBadgeNFT(_voteBadgeNFT);
    }

    function createProposal(string memory description) external {
        require(votetoken.balanceOf(msg.sender) >= PROPOSAL_FEE, "Not enough VOTE for proposal fee");
        require(votetoken.transferFrom(msg.sender, owner, PROPOSAL_FEE), "VOTE proposal fee transfer failed");
        proposalCount++;
        Proposal storage p = proposals[proposalCount];
        p.description = description;
        p.deadline = block.timestamp + VOTIVOTERIOD;
        p.closed = false;
        p.creator = msg.sender;
        emit ProposalCreated(proposalCount, description, p.deadline, msg.sender);
    }



    function _getRandomNFTType() private view returns (uint256) {
        uint256 random = uint256(keccak256(abi.encodePacked(
            block.timestamp,
            block.prevrandao, 
            msg.sender
        ))) % 3;
        return random + 1;
    }

    function vote(uint256 proposalId) external {
        Proposal storage p = proposals[proposalId];
        require(block.timestamp < p.deadline, "Voting period is over");
        require(!p.closed, "Proposal is closed");
        require(!p.hasVoted[msg.sender], "Already voted");
        require(votetoken.balanceOf(msg.sender) >= VOTE_FEE, "Not enough VOTE for vote fee");
        require(votetoken.transferFrom(msg.sender, owner, VOTE_FEE), "VOTE vote fee transfer failed");
        
        // Update voting state
        p.votes += 1;
        p.hasVoted[msg.sender] = true;
        p.voteWeights[msg.sender] = 1;
        
        // Mint NFT badge if NFT contract is set
        if (address(voteBadgeNFT) != address(0)) {
            // Get a random NFT type (1-3)
            uint256 nftType = _getRandomNFTType();
            
            try voteBadgeNFT.mintBadge{gas: 300000}(msg.sender, proposalId, nftType) {
                // Successfully minted NFT
            } catch Error(string memory) {
                // Log the error but don't revert the transaction
                emit Voted(proposalId, msg.sender, 1);
                return;
            } catch (bytes memory) {
                // Catch any other errors and continue
            }
        }
        
        emit Voted(proposalId, msg.sender, 1);
    }
   
   function getResults(uint256 proposalId) external view returns (
        string memory description,
        uint256 totalVotes,
        bool closed,
        uint256 deadline,
        bool removed,
        address creator
    ) {
        Proposal storage p = proposals[proposalId];
        return (p.description, p.votes, p.closed, p.deadline, p.removed, p.creator);
    }

    function getVoteWeight(uint256 proposalId, address voter) external view returns (uint256) {
        Proposal storage p = proposals[proposalId];
        return p.voteWeights[voter];
    }
    

    function hasVoterBadge(uint256 proposalId, address voter) external view returns (bool) {
        if (address(voteBadgeNFT) == address(0)) {
            return false;
        }
        return voteBadgeNFT.hasBadge(voter, proposalId);
    }

    // Mapping from proposal ID to array of IPFS hashes
    mapping(uint256 => string[]) public proposalComments;
    
    // Mapping from proposal ID to commenter addresses
    mapping(uint256 => mapping(address => bool)) public hasCommented;
    
    function removeProposalByName(string calldata name) external onlyAdmin {
        for (uint256 i = 1; i <= proposalCount; i++) {
            Proposal storage p = proposals[i];
            if (keccak256(bytes(p.description)) == keccak256(bytes(name)) && !p.removed) {
                p.removed = true;
                emit ProposalRemoved(i, name);
                return;
            }
        }
        revert("Proposal not found");
    }

    function addComment(uint256 proposalId, string calldata ipfsHash) external {
        require(proposalId > 0 && proposalId <= proposalCount, "Invalid proposal ID");
        require(bytes(ipfsHash).length > 0, "IPFS hash cannot be empty");
        
        Proposal storage p = proposals[proposalId];
        require(!p.removed, "Proposal has been removed");
        
        // Store the IPFS hash
        proposalComments[proposalId].push(ipfsHash);
        hasCommented[proposalId][msg.sender] = true;
        
        emit CommentAdded(proposalId, msg.sender, ipfsHash);
    }

    function getComments(uint256 proposalId) external view returns (string[] memory) {
        require(proposalId > 0 && proposalId <= proposalCount, "Invalid proposal ID");
        return proposalComments[proposalId];
    }
    
    function getCommentCount(uint256 proposalId) external view returns (uint256) {
        require(proposalId > 0 && proposalId <= proposalCount, "Invalid proposal ID");
        return proposalComments[proposalId].length;
    }
}
