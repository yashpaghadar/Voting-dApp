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
    uint256 public constant VOTIVOTERIOD = 1 days; // 24 hours
    address public owner;
    uint256 public constant PROPOSAL_FEE = 25 ether; // 25 VOTE (18 decimals)
    uint256 public constant VOTE_FEE = 10 ether; // 10 VOTE (18 decimals)

    event ProposalCreated(uint256 indexed proposalId, string description, uint256 deadline, address creator);
    event Voted(uint256 indexed proposalId, address indexed voter, uint256 weight);
    event ProposalClosed(uint256 indexed proposalId, address winner, uint256 votes);
    event ProposalRemoved(uint256 indexed proposalId, string description);

    constructor(address _VoteToken) {
        votetoken = IERC20(_VoteToken);
        owner = msg.sender;
    }

    function setVoteBadgeNFT(address _voteBadgeNFT) external {
        require(msg.sender == owner, "Only owner can set NFT contract");
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
        // This is a simple pseudo-random number generator
        // Not suitable for production use - consider using Chainlink VRF for production
        uint256 random = uint256(keccak256(abi.encodePacked(
            block.timestamp,
            block.prevrandao, // Replaced block.difficulty with block.prevrandao
            msg.sender
        ))) % 3;
        
        // Return a number between 1-3
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

    function closeProposal(uint256 proposalId) external {
        Proposal storage p = proposals[proposalId];
        require(block.timestamp >= p.deadline, "Voting still ongoing");
        require(!p.closed, "Already closed");
        p.closed = true;
        // For single winner, just set winner as address(0) (not meaningful in this context)
        p.winner = address(0);
        emit ProposalClosed(proposalId, p.winner, p.votes);
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

    function removeProposalByName(string calldata name) external {
        require(msg.sender == owner, "Only owner can remove proposals");
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
}
