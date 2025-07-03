import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Link } from 'react-router-dom';
import { FaInfoCircle, FaExclamationTriangle } from 'react-icons/fa';
import votingAbiString from './abi/Voting.json';
import { getEthersProvider, parseContractAbi, formatBigNumber } from './utils/ethersHelpers';
import { CONFIG } from './utils/config';
import './MyVotes.css';
import Loading from './Loading';
import ProposalModal from './components/ProposalModal';

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
  const [isOwner, setIsOwner] = useState(false);

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

  // Check if user is the contract owner
  const checkIfOwner = async (contract, userAddress) => {
    if (!contract) return false;
    try {
      const contractOwner = await contract.owner();
      const isUserOwner = userAddress && contractOwner && 
                         userAddress.toLowerCase() === contractOwner.toLowerCase();
      setIsOwner(isUserOwner);
      return isUserOwner;
    } catch (error) {
      console.error('Error checking owner status:', error);
      return false;
    }
  };

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
        
        // Check if user is owner after contract is initialized
        await checkIfOwner(votingContract, address);

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
      const activeProposals = [];
      const removedProposals = [];
      const now = Math.floor(Date.now() / 1000);
      
      // Check each proposal to see if the user has voted
      for (let i = 1; i <= count; i++) {
        try {
          const voteWeight = await contract.getVoteWeight(i, userAddress);
          if (voteWeight.gt(0)) {
            const [description, totalVotes, closed, deadline, removed, creator] = await contract.getResults(i);
            
            // Determine status
            let status;
            if (removed) {
              status = 'Removed';
            } else if (closed) {
              status = 'Closed';
            } else if (now >= deadline) {
              status = 'Ended';
            } else {
              status = 'Open';
            }
            
            const proposalData = {
              id: i,
              description: description || 'No description',
              totalVotes: totalVotes.toString(),
              closed,
              deadline: deadline.toNumber(),
              creator,
              voteWeight: voteWeight.toString(),
              status,
              removed
            };
            
            // Separate removed proposals
            if (removed) {
              removedProposals.push(proposalData);
            } else {
              activeProposals.push(proposalData);
            }
          }
        } catch (err) {
          console.warn(`Error fetching proposal ${i}:`, err);
          continue;
        }
      }
      
      // Sort active proposals by status and deadline
      const sortedActiveProposals = activeProposals.sort((a, b) => {
        const statusOrder = { 'Open': 0, 'Ended': 1, 'Closed': 2, 'Removed': 3 };
        if (statusOrder[a.status] !== statusOrder[b.status]) {
          return statusOrder[a.status] - statusOrder[b.status];
        }
        return a.deadline - b.deadline;
      });
      
      // Combine active and removed proposals (removed at the end)
      const allProposals = [...sortedActiveProposals, ...removedProposals];
      setVotedProposals(allProposals);
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
    const activeProposals = [];
    const endedProposals = [];
    const removedProposals = [];
    const now = Math.floor(Date.now() / 1000);
    
    for (let i = 1; i <= proposalCount; i++) {
      try {
        const res = await voting.getResults(i);
        const [description, totalVotes, closed, deadline, removed, creator] = res;
        const deadlineNum = Number(deadline) || 0;
        const isEnded = now >= deadlineNum;
        
        // Determine status
        let status;
        if (removed) {
          status = 'Removed';
        } else if (closed) {
          status = 'Closed';
        } else if (isEnded) {
          status = 'Ended';
        } else {
          status = 'Open';
        }
        
        const proposalData = {
          id: i,
          description: description || 'No description',
          voteCount: totalVotes.toString(),
          closed,
          deadline: deadlineNum,
          creator,
          removed,
          status
        };
        
        // Categorize proposals
        if (removed) {
          removedProposals.push(proposalData);
        } else if (isEnded) {
          endedProposals.push(proposalData);
        } else {
          activeProposals.push(proposalData);
        }
      } catch (err) {
        console.warn(`Failed to fetch proposal ${i}:`, err);
      }
    }
    
    // Sort active and ended proposals by status and deadline
    const sortProposals = (proposals) => {
      return proposals.sort((a, b) => {
        const statusOrder = { 'Open': 0, 'Ended': 1, 'Closed': 2, 'Removed': 3 };
        if (statusOrder[a.status] !== statusOrder[b.status]) {
          return statusOrder[a.status] - statusOrder[b.status];
        }
        return a.deadline - b.deadline;
      });
    };
    
    // Combine all proposals with removed ones at the end
    const allProposals = [
      ...sortProposals(activeProposals),
      ...sortProposals(endedProposals),
      ...removedProposals
    ];
    
    setProposalList(allProposals);
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
      Loading Your Voting History...
    </div>
  );
}

  if (error) {
    return (
      <div className="container">
      <div className="nav-buttons">
          <button
            onClick={() => window.location.href = '/vote'}
            className="nav-button"
            disabled={!account}
          >
            Vote Dashboard
          </button>
          <button
            onClick={openProposalModal}
            className="nav-button"
            disabled={!account}
          >
            Proposal Details
          </button>
          <button
            onClick={() => window.location.href = '/my-votes'}
            className="nav-button"
            disabled={!account}
          >
            My Votes
          </button>
          <button
            onClick={() => window.location.href = '/my-nfts'}
            className="nav-button"  
            disabled={!account}
          >
            My NFTs
          </button>
          {isOwner && (
            <button 
              onClick={() => window.location.href = '/admin-panel'}
              className="nav-button admin-button"
            >
              Admin Panel
            </button>
          )}
        </div>
      <div className="error-container">
        <div className="error-box">
          <div className="error-flex">
            <div className="error-icon">
              <FaExclamationTriangle className="myvotes-error-faicon" />
            </div>
            <div className="error-message">
              <p style={{color: '#161111'}}>
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
          {isOwner && (
            <button 
              onClick={() => window.location.href = '/admin-panel'}
              className="nav-button admin-button"
            >
              Admin Panel
            </button>
          )}
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
            style={{borderRadius: '2px', border: '#161111'}}
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
                  <div className="proposal-header">
                    <span className="proposal-description">
                      Name: {proposal.description}
                    </span>
                    <span className={`proposal-status ${proposal.status ? proposal.status.toLowerCase() : 'unknown'}`}>
                      {proposal.status || 'Unknown'}
                    </span>
                  </div>
                  <div className="proposal-details">
                    <div className="proposal-votes">
                      Total Votes: {proposal.totalVotes}
                    </div>
                    <div className="proposal-deadline" style={{marginBottom: '10px'}}>
                      End: {formatDate(proposal.deadline)}
                    </div>
                  </div>
                  <div className="proposal-actions">
                    <Link
                      to={`/proposal/${proposal.id}`}
                      className="btn-view-details"
                    >
                      View Description
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      
      <ProposalModal 
        show={showProposalModal}
        onClose={() => setShowProposalModal(false)}
        proposals={proposalList}
        loading={loadingProposals}
      />
    </div>
    
  );
};

export default MyVotes;
