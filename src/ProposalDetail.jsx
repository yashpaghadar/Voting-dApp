import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ethers } from 'ethers';
import votingAbiString from './abi/Voting.json';
import { FaVoteYea, FaInfoCircle, FaCheck, FaClock, FaTimes, FaSpinner } from 'react-icons/fa';
import './ProposalDetail.css';
import './ProposalModal.css';
import { getEthersProvider, parseContractAbi, formatBigNumber } from './utils/ethersHelpers';
import ProposalDetailBanner from './components/ProposalDetailBanner';

const ethersVersion = window.ethers ? 'v5' : 'v6';
console.log(`Using ethers.js ${ethersVersion}`);

// Parse ABI
const votingAbi = parseContractAbi(votingAbiString);

const ProposalDetail = () => {
  const { id } = useParams();
  const [proposal, setProposal] = useState(null);
  const [voters, setVoters] = useState([]);
  const [account, setAccount] = useState('');
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [voting, setVoting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingProposals, setLoadingProposals] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [error, setError] = useState(null);
  const [voteWeight, setVoteWeight] = useState(null);
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [proposalList, setProposalList] = useState([]);
  
  const VOTING_CONTRACT_ADDRESS = import.meta.env.VITE_VOTING_CONTRACT_ADDRESS;

  useEffect(() => {
    const init = async () => {
      try {
        if (!window.ethereum) {
          setError('Please install MetaMask to use this application');
          setLoading(false);
          return;
        }
        
        // Initialize provider based on ethers version
        let provider, signer;
        
        if (ethersVersion === 'v5') {
          provider = new ethers.providers.Web3Provider(window.ethereum);
          signer = provider.getSigner();
        } else {
          // For ethers v6
          provider = new ethers.providers.Web3Provider(window.ethereum);
          signer = await provider.getSigner();
        }
        
        // Request accounts
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        
        if (!accounts || accounts.length === 0) {
          throw new Error('No accounts found');
        }
        
        const voting = new ethers.Contract(VOTING_CONTRACT_ADDRESS, votingAbi, signer);
        
        setProvider(provider);
        setSigner(signer);
        setVoting(voting);
        setAccount(accounts[0]);
        
        // Fetch proposal data
        const proposalData = await voting.getResults(id);
        setProposal({
          description: proposalData.description,
          votes: proposalData.totalVotes,
          closed: proposalData.closed,
          deadline: Number(proposalData.deadline),
          removed: proposalData.removed,
          creator: proposalData.creator
        });
        
        // Check if current user has voted
        const voted = await voting.getVoteWeight(id, accounts[0]);
        setHasVoted(voted > 0);
        setVoteWeight(voted);
        
        setLoading(false);
      } catch (err) {
        setError(err.message || 'Failed to connect to wallet');
        setLoading(false);
      }
    };
    
    init();
  }, [id]);
  
  const fetchVoters = async () => {
    try {
      if (!voting || !id) {
        throw new Error('Contract not initialized');
      }
      
      // Try to parse id as number if it's a string
      const proposalId = typeof id === 'string' ? parseInt(id) : id;
      
      // First check if getVoters exists
      if (typeof voting.getVoters === 'function') {
        const voters = await voting.getVoters(proposalId);
        setVoters(voters);
      } 
      // Fallback to event-based fetching
      else {
        const voteEvents = await voting.queryFilter(
          voting.filters.Voted(proposalId)
        );
        
        const votersList = voteEvents.map(event => ({
          address: event.args.voter,
          id: event.args.proposalId.toString()
        }));
        
        setVoters(votersList);
      }
    } catch (err) {
      handleError(err, 'Failed to fetch voters');
    }
  };

  useEffect(() => {
    if (id && voting) {
      fetchVoters();
    }
  }, [id, voting]);

  const handleVote = async () => {
    try {
      setIsVoting(true);
      const tx = await voting.vote(id);
      await tx.wait();
      setHasVoted(true);
      setProposal(prev => ({
        ...prev,
        votes: prev.votes.add(1)
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setIsVoting(false);
    }
  };
  


const fetchAllProposals = async () => {
  setLoadingProposals(true);
  try {
    if (!voting) throw new Error('Contract not initialized');
    
    const proposalCount = await voting.proposalCount();
    const proposals = [];
    const now = Math.floor(Date.now() / 1000);
    
    for (let i = 1; i <= proposalCount; i++) {
      try {
        const res = await voting.getResults(i);
        // Skip removed proposals
        if (res[4] === true) continue;
        
        const description = res[0] || "";
        const deadline = Number(res[3]) || 0;
        const closed = res[2];
        
        // Determine status
        let status;
        if (closed) {
          status = 'Closed';
        } else if (now >= deadline) {
          status = 'Ended';
        } else {
          status = 'Open';
        }
        
        proposals.push({
          id: i,
          description,
          status,
          deadline,
          closed
        });
      } catch (err) {
        console.warn(`Failed to fetch proposal ${i}:`, err);
      }
    }
    
    // Sort by status (Open first, then Ended, then Closed) and then by deadline
    const sortedProposals = proposals.sort((a, b) => {
      const statusOrder = { 'Open': 0, 'Ended': 1, 'Closed': 2 };
      if (statusOrder[a.status] !== statusOrder[b.status]) {
        return statusOrder[a.status] - statusOrder[b.status];
      }
      return a.deadline - b.deadline;
    });
     
    
    setProposalList(proposals);
  } catch (err) {
    handleError(err, 'Failed to load proposals');
  } finally {
    setLoadingProposals(false);
  }
};

const openProposalModal = async () => {
  setShowProposalModal(true);
  if (proposalList.length === 0) {
    await fetchAllProposals();
  }
};


  const handleError = (error, context) => {
    console.error(context, error);
    setError({
      show: true,
      type: 'proposal',
      description: `${context}: ${error.message}`
    });
  };

  if (loading) {
    return <div className="loading">
      <div className="loading-spinner"></div>
      Loading Proposal Details...</div>;
  }
  
  if (error) {
    return <div className="error">{error}</div>;
  }
  
  if (!proposal) {
    return <div className="not-found">Proposal not found</div>;
  }
  
  const currentTime = Math.floor(Date.now() / 1000);
  const isOpen = currentTime < proposal.deadline && !proposal.closed && !proposal.removed;
  
  return (
    <div className="proposal-detail">

      <div className="nav-buttons">
        <button 
          onClick={() => window.location.href = '/vote'}
          className="nav-button"
        >
          Vote Dashboard
        </button>
        <button 
          onClick={openProposalModal}
          className="nav-button"
        >
          Proposal Details
        </button>
        <button 
          onClick={() => window.location.href = '/my-votes'}
          className="nav-button"
        >
          My Votes
        </button>
        <button 
          onClick={() => window.location.href = '/my-nfts'}
          className="nav-button"
        >
          My NFTs
        </button>
      </div>

      <ProposalDetailBanner proposal={proposal} id={id} />
      {showProposalModal && (
        <div className="modal-overlay">
          <div className="proposal-modal">
            <div className="modal-header">
              <h2>All Proposals</h2>
              <button 
                className="close-modal" 
                onClick={() => setShowProposalModal(false)}
              >
                ×
              </button>
            </div>
            
            {loadingProposals ? (
              <div className="loading-proposals">
                <div className="loading-spinner"></div>
                Loading proposals...
              </div>
            ) : (
              <div className="proposal-list">
                {proposalList?.length > 0 ? (
                  proposalList.map(proposal => (
                    <div key={proposal.id} className="proposal-item">
                      <span className="proposal-id">Proposal #{proposal.id}</span>
                      <span className="proposal-description" style={{ margin: 0 }}>{proposal.description}</span>
                      <span className="proposal-status" status={proposal.status.toLowerCase()}>
                        {proposal.status}
                      </span>
                      <Link 
                        to={`/proposal/${proposal.id}`}
                        className="view-details-btn"
                        onClick={() => setShowProposalModal(false)}
                      >
                        <FaInfoCircle className="view-details-icon" />
                         View Details
                      </Link>
                    </div>
                  ))
                ) : (
                  <p>No proposals found</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* ProposalDetailBanner replaces header/meta section */}
      <div className="proposal-content">
      
        {isOpen && !hasVoted && (
          <button 
            className="submit-btn vote-glow-btn" 
            onClick={handleVote}
            disabled={isVoting}
          >
            {isVoting && (
              <div className="tx-loading-overlay">
                <div className="tx-loading-content">
                  <div className="loading-spinner"></div>
                  <p>Processing Transaction...</p>
                  <small>Please confirm in MetaMask</small>
                </div>
              </div>
            )}
            {isVoting ? 'Voting...' : (
              <>
                <FaVoteYea /> Vote
              </>
            )}
          </button>
        )}
        
        {hasVoted && (
          <div className="voted-notice">
            <FaCheck /> You have already voted on this proposal
          </div>
        )}
        
        <div className="vote-weight">
          Your vote weight: {formatBigNumber(voteWeight)}
        </div>
        
        <div className="voters-section voters-shadow">
          <h3 className="voters-title">Number of Voters: {voters.length}</h3>
          {voters.length > 0 ? (
            <div className="voters-list">
              {voters.map((voter, index) => (
                <div key={index} className="voter-item" style={{ marginBottom: '10px' }}>
                  <span className="voter-address">
                    {`${voter.address.substring(0, 10)}...${voter.address.substring(voter.address.length - 10)}`}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p>No voters yet</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProposalDetail;
