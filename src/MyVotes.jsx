import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Link } from 'react-router-dom';
import { FaInfoCircle, FaExclamationTriangle } from 'react-icons/fa';
import votingAbiString from './abi/Voting.json';
import { getEthersProvider, parseContractAbi, formatBigNumber } from './utils/ethersHelpers';
import { CONFIG } from './utils/config';
import './MyVotes.css';
import './ProposalModal.css';
import Loading from './Loading';

const votingAbi = parseContractAbi(votingAbiString);

const MyVotes = () => {
  const [votedProposals, setVotedProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState('');
  const [error, setError] = useState(null);
  const [provider, setProvider] = useState(null);
  const [voting, setVoting] = useState(null);
  const [totalProposals, setTotalProposals] = useState(0);
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [proposalList, setProposalList] = useState([]);
  const [loadingProposals, setLoadingProposals] = useState(false);

 // Validate configuration on component mount
  useEffect(() => {
    try {
      const isValid = CONFIG.validate();
      if (!isValid) {
        setError('Invalid application configuration. Please check the console for details.');
      }
    } catch (err) {
      console.error('Configuration error:', err);
      setError('Failed to load application configuration. Please try again later.');
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    
    const init = async () => {
      try {
        if (!window.ethereum) {
          throw new Error('MetaMask not detected. Please install MetaMask to use this application.');
        }

        // Check if already connected
        if (window.ethereum.selectedAddress) {
          setAccount(window.ethereum.selectedAddress);
        }

        // Initialize provider
        const provider = await getEthersProvider();
        if (!isMounted) return;
        
        setProvider(provider);

        // Get signer
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        if (!isMounted) return;
        
        setAccount(address);

        if (!CONFIG.VOTING_CONTRACT_ADDRESS) {
          throw new Error('Voting contract address is not configured');
        }

        // Initialize contract
        const votingContract = new ethers.Contract(
          CONFIG.VOTING_CONTRACT_ADDRESS,
          votingAbi,
          signer
        );
        
        setVoting(votingContract);

        try {
          // Get total number of proposals
          const count = await votingContract.proposalCount();
          if (!isMounted) return;
          
          setTotalProposals(count.toNumber());

          // Fetch all proposals where user has voted
          await fetchVotedProposals(votingContract, address, count.toNumber());
        } catch (contractErr) {
          console.error('Contract error:', contractErr);
          throw new Error('Failed to fetch proposals from the contract. Make sure you\'re on the correct network.');
        }
      } catch (err) {
        console.error('Initialization error:', err);
        if (isMounted) {
          setError(err.message || 'Failed to connect to the blockchain. Please try refreshing the page.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    init();

    // Handle account changes
    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        setError('Please connect your wallet');
        setAccount('');
      } else if (accounts[0] !== account) {
        window.location.reload();
      }
    };

    // Handle chain changes
    const handleChainChanged = () => {
      window.location.reload();
    };

    // Add event listeners
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
    }

    // Cleanup function
    return () => {
      isMounted = false;
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, []);

  const fetchVotedProposals = async (contract, userAddress, count) => {
    try {
      const votedProposalsList = [];
      const now = Math.floor(Date.now() / 1000);
      
      // Check each proposal to see if the user has voted
      for (let i = 1; i <= count; i++) {
        try {
          const voteWeight = await contract.getVoteWeight(i, userAddress);
          if (voteWeight.gt(0)) {
            const [description, totalVotes, closed, deadline, removed, creator] = await contract.getResults(i);
            if (!removed) {
              // Determine status
              let status;
              if (closed) {
                status = 'Closed';
              } else if (now >= deadline) {
                status = 'Ended';
              } else {
                status = 'Open';
              }
              
              votedProposalsList.push({
                id: i,
                description,
                totalVotes: totalVotes.toString(),
                closed,
                deadline: deadline.toNumber(),
                creator,
                voteWeight: voteWeight.toString(),
                status // Add status to the proposal object
              });
            }
          }
        } catch (err) {
          console.warn(`Error fetching proposal ${i}:`, err);
          // Continue with next proposal if there's an error
          continue;
        }
      }
      
      // Sort by status (Open first, then Ended, then Closed) and then by deadline
      const sortedProposals = votedProposalsList.sort((a, b) => {
        const statusOrder = { 'Open': 0, 'Ended': 1, 'Closed': 2 };
        if (statusOrder[a.status] !== statusOrder[b.status]) {
          return statusOrder[a.status] - statusOrder[b.status];
        }
        return a.deadline - b.deadline;
      });
      
      setVotedProposals(sortedProposals);
    } catch (err) {
      console.error('Error fetching voted proposals:', err);
      setError('Failed to load voting history. Please try again.');
    }
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleString();
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
  return (
    <div className="loading-proposals">
      <div className="loading-spinner"></div>
      Loading your Voting History...
    </div>
  );
}

  if (error) {
    return (
      <div className="error-container">
        <div className="error-box">
          <div className="error-flex">
            <div className="error-icon">
              <FaExclamationTriangle className="myvotes-error-faicon" />
            </div>
            <div className="error-message">
              <p>
                {error}
                <button 
                  onClick={() => window.location.reload()} 
                  className="error-retry"
                >
                  Try again
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
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
      <div className="header">
        <h1 className="title">|| My Voting History ||</h1>
      </div>

      {votedProposals.length === 0 ? (
        <div className="empty-state">
          <FaInfoCircle className="empty-icon" />
          <h2 className="empty-title">No voting history found</h2>
          <p className="empty-text">You haven't voted on any proposals yet.</p>
          <Link 
            to="/vote" 
            className="btn btn-view"
          >
            View Active Proposals
          </Link>
        </div>
      ) : (
        <div className="proposal-list-main">
          <div className="proposal-list-inner">
            <ul className="list">
              {votedProposals.map((proposal) => (
                <li key={proposal.id} className="list-item">
                  <div className="list-row">
                    <div className="list-main">
                      <div className="list-title-row">
                        <h3 className="list-title">
                          <Link to={`/proposal/${proposal.id}`} className="list-title-link">
                            Description: {proposal.description}
                          </Link>
                        </h3>
                        <span className={`list-status ${proposal.status ? proposal.status.toLowerCase() : 'unknown'}`}>
                          {proposal.status || 'Unknown'}
                        </span>
                      </div>
                      <div className="list-info" >
                        <p style={{ color: '#1d4ed8' }}>Total Votes: {proposal.totalVotes}</p>
                        <p style={{ color: '#1d4ed8' }}>Ends: {formatDate(proposal.deadline)}</p>
                      </div>
                    </div>
                    <div className="list-actions">
                      <Link
                        to={`/proposal/${proposal.id}`}
                        className="btn btn-details"
                      >
                        <FaInfoCircle className="btn-details-icon" />
                        View Details
                      </Link>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      
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
    </div>
    
  );
};

export default MyVotes;
