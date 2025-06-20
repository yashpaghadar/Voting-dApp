// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Voting {
    struct Proposal {
        string description;
        uint256 deadline;
        uint256 votes;
        bool closed;
        bool removed;
        address winner;
        mapping(address => bool) hasVoted;
        mapping(address => uint256) voteWeights;
    }

    IERC20 public helloToken;
    uint256 public proposalCount;
    mapping(uint256 => Proposal) private proposals;
    uint256 public constant VOTING_PERIOD = 5 days; // 120 hours
    address public owner;
    uint256 public constant PROPOSAL_FEE = 25 ether; // 25 HLTK (18 decimals)
    uint256 public constant VOTE_FEE = 10 ether; // 10 HLTK (18 decimals)

    event ProposalCreated(uint256 indexed proposalId, string description, uint256 deadline);
    event Voted(uint256 indexed proposalId, address indexed voter, uint256 weight);
    event ProposalClosed(uint256 indexed proposalId, address winner, uint256 votes);
    event ProposalRemoved(uint256 indexed proposalId, string description);

    constructor(address _helloToken) {
        helloToken = IERC20(_helloToken);
        owner = msg.sender;
    }

    function createProposal(string memory description) external {
        require(helloToken.balanceOf(msg.sender) >= PROPOSAL_FEE, "Not enough HLTK for proposal fee");
        require(helloToken.transferFrom(msg.sender, owner, PROPOSAL_FEE), "HLTK proposal fee transfer failed");
        proposalCount++;
        Proposal storage p = proposals[proposalCount];
        p.description = description;
        p.deadline = block.timestamp + VOTING_PERIOD;
        p.closed = false;
        emit ProposalCreated(proposalCount, description, p.deadline);
    }

    function vote(uint256 proposalId) external {
        Proposal storage p = proposals[proposalId];
        require(block.timestamp < p.deadline, "Voting period is over");
        require(!p.closed, "Proposal is closed");
        require(!p.hasVoted[msg.sender], "Already voted");
        require(helloToken.balanceOf(msg.sender) >= VOTE_FEE, "Not enough HLTK for vote fee");
        require(helloToken.transferFrom(msg.sender, owner, VOTE_FEE), "HLTK vote fee transfer failed");
        p.votes += 1;
        p.hasVoted[msg.sender] = true;
        p.voteWeights[msg.sender] = 1;
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
        bool removed
    ) {
        Proposal storage p = proposals[proposalId];
        return (p.description, p.votes, p.closed, p.deadline, p.removed);
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
