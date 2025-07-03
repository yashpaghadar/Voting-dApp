import React, { useState, useEffect, useCallback } from 'react';
import Notification from './components/Notification';
import { useParams, Link } from 'react-router-dom';
import { ethers } from 'ethers';
import votingAbiString from './abi/Voting.json';
import { FaVoteYea, FaInfoCircle, FaCheck, FaClock, FaCheckCircle, FaSpinner, FaUser, FaComments, FaPaperPlane, FaUserFriends, FaCopy, FaSyncAlt, FaLink } from 'react-icons/fa';
import { create } from 'blockies-ts';
import { uploadToIPFS, fetchFromIPFS, testPinataAuth } from './utils/pinata';
import './ProposalDetail.css';
import ProposalModal from './components/ProposalModal';
import { getEthersProvider, parseContractAbi, formatBigNumber } from './utils/ethersHelpers';
import ProposalDetailBanner from './components/ProposalDetailBanner';

const ethersVersion = window.ethers ? 'v5' : 'v6';
console.log(`Using ethers.js ${ethersVersion}`);

// Parse ABI
const votingAbi = parseContractAbi(votingAbiString);
const owner = import.meta.env.VITE_OWNER_ADDRESS;

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
  const [error, setError] = useState({ type: null, message: '', ipfsUrl: '' });
  const [voteWeight, setVoteWeight] = useState(null);
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [proposalList, setProposalList] = useState([]);
  // Comments state and management
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [isOwner, setIsOwner] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'info' });
  const [transactionStatus, setTransactionStatus] = useState({
    isProcessing: false,
    title: '',
    message: '',
    txHash: null
  });

  // Load comments from blockchain and IPFS
  const loadComments = useCallback(async () => {
    if (!voting || !id) return;
    
    setLoadingComments(true);
    try {
      // Get comment count
      const count = await voting.getCommentCount(id);
      setCommentCount(count.toNumber());
      
      // Get all comment hashes
      const commentHashes = await voting.getComments(id);
      
      // Fetch each comment from IPFS
      const commentsList = [];
      for (const hash of commentHashes) {
        try {
          const commentData = await fetchFromIPFS(hash);
          if (commentData) {
            commentsList.push({
              ...commentData,
              ipfsHash: hash,
              timestamp: commentData.timestamp || Math.floor(Date.now() / 1000)
            });
          }
        } catch (error) {
          console.error(`Error fetching comment ${hash}:`, error);
        }
      }
      
      // Sort by timestamp (newest first)
      const sortedComments = commentsList.sort((a, b) => b.timestamp - a.timestamp);
      setComments(sortedComments);
      
    } catch (error) {
      console.error('Error loading comments:', error);
      showNotification('Failed to load comments', 'error');
    } finally {
      setLoadingComments(false);
    }
  }, [voting, id]);

  const showNotification = (message, type = 'info') => {
    setNotification({
      show: true,
      message,
      type
    });
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      setNotification(prev => ({
        ...prev,
        show: false
      }));
    }, 5000);
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    
    // Check if proposal exists and is not removed
    if (!proposal) {
      showNotification('Proposal not found', 'error');
      return;
    }
    
    if (proposal.removed) {
      showNotification('This proposal has been removed by admin', 'error');
      return;
    }
    
    // Validate input
    if (!newComment.trim()) {
      showNotification('Please enter a comment', 'error');
      return;
    }
    
    if (!account) {
      showNotification('Please connect your wallet to post a comment', 'error');
      return;
    }
    
    if (isPostingComment) return;
    
    setIsPostingComment(true);
    
    try {
      // Get the signer's address
      let signerAddress;
      try {
        signerAddress = await signer?.getAddress();
        if (!signerAddress) throw new Error('Unable to get signer address');
      } catch (error) {
        console.error('Error getting signer address:', error);
        showNotification('Failed to get wallet address. Please ensure your wallet is connected properly.', 'error');
        return;
      }
      
      // Create comment object
      const commentData = {
        content: newComment.trim(),
        author: signerAddress,
        timestamp: Math.floor(Date.now() / 1000),
        proposalId: id
      };
      
      console.log('Uploading comment to IPFS...');
      let ipfsHash;
      try {
        const ipfsResponse = await uploadToIPFS(JSON.stringify(commentData));
        console.log('IPFS Response:', ipfsResponse);
        
        if (!ipfsResponse?.success || !ipfsResponse.ipfsHash?.trim()) {
          throw new Error(ipfsResponse?.error || 'Invalid IPFS response');
        }
        
        ipfsHash = ipfsResponse.ipfsHash.trim();
        console.log('IPFS upload successful, hash:', ipfsHash);
      } catch (error) {
        console.error('IPFS upload error:', error);
        showNotification('Failed to upload comment to IPFS. Please try again.', 'error');
        return;
      }
      
      // Add comment to blockchain
      try {
        console.log('Adding comment to blockchain...');
        
        // Show transaction overlay
        setTransactionStatus({
          isProcessing: true,
          title: 'Posting Your Comment',
          message: 'Please confirm the transaction in your MetaMask wallet',
          txHash: null
        });
        
        const tx = await voting.addComment(id, ipfsHash);
        
        // Update with transaction hash
        setTransactionStatus(prev => ({
          ...prev,
          message: 'Waiting for transaction confirmation...',
          txHash: tx.hash
        }));
        
        // Wait for transaction to be mined
        await tx.wait();
        
        // Hide overlay
        setTransactionStatus({ isProcessing: false });
        
        // Clear input and refresh comments
        setNewComment('');
        await loadComments();
        
        showNotification('Comment posted successfully!', 'success');
        
      } catch (error) {
        // Hide overlay on error
        setTransactionStatus({ isProcessing: false });
        
        console.error('Blockchain transaction error:', error);
        
        if (error.code === 4001 || error.message?.includes('user rejected')) {
          showNotification('Transaction was rejected', 'error');
        } else if (error.message?.includes('proposal does not exist')) {
          showNotification('This proposal no longer exists', 'error');
        } else if (error.message?.includes('proposal is removed')) {
          showNotification('This proposal has been removed', 'error');
          // Refresh proposal data in case it was removed
          loadProposalData(voting, account);
        } else {
          showNotification('Failed to post comment to blockchain', 'error');
        }
      }
      
    } catch (error) {
      console.error('Unexpected error in comment submission:', error);
      showNotification('An unexpected error occurred', 'error');
    } finally {
      setIsPostingComment(false);
    }
  };

  // Set up comment loading and event listeners
  useEffect(() => {
    if (!voting || !id) return;
    
    // Initial load
    loadComments();
    
    // Set up event listener for new comments
    const onCommentAdded = (proposalId, commenter, ipfsHash, event) => {
      if (proposalId.toString() === id) {
        loadComments();
      }
    };
    
    // Listen for new comments
    const commentFilter = voting.filters.CommentAdded(id);
    voting.on(commentFilter, onCommentAdded);
    
    // Clean up
    return () => {
      voting.off(commentFilter, onCommentAdded);
    };
  }, [voting, id, loadComments]);

  const VOTING_CONTRACT_ADDRESS = import.meta.env.VITE_VOTING_CONTRACT_ADDRESS;

  // Function to fetch voters for the current proposal
  const fetchVoters = useCallback(async (votingContract, proposalId) => {
    if (!votingContract || !proposalId) {
      console.log('Voting contract or proposal ID not available');
      return [];
    }

    console.log('Fetching voters for proposal:', proposalId);
    
    try {
      // Try to use event-based fetching
      const voteEvents = await votingContract.queryFilter(
        votingContract.filters.Voted(proposalId)
      );

      console.log('Found vote events:', voteEvents.length);

      // Process events to get timestamps and other details
      const votersList = [];
      for (const event of voteEvents) {
        try {
          const block = await event.getBlock();
          votersList.push({
            address: event.args.voter,
            id: event.args.proposalId?.toString() || proposalId,
            timestamp: block?.timestamp || Math.floor(Date.now() / 1000),
            voteWeight: event.args.voteWeight ? formatBigNumber(event.args.voteWeight) : '1',
            avatarColor: `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`
          });
        } catch (e) {
          console.warn('Could not get block for event:', e);
          votersList.push({
            address: event.args.voter,
            id: event.args.proposalId?.toString() || proposalId,
            timestamp: Math.floor(Date.now() / 1000),
            voteWeight: '1',
            avatarColor: `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`
          });
        }
      }
      
      // Remove duplicate voters (in case someone voted multiple times)
      return Array.from(new Map(votersList.map(voter => [voter.address, voter])).values());
      
    } catch (error) {
      console.error('Error in fetchVoters:', error);
      setError(prev => ({
        ...prev,
        message: 'Failed to load voters',
        show: true
      }));
      return [];
    }
  }, [formatBigNumber]);

  // Function to load all data for the proposal
  const loadProposalData = useCallback(async (votingContract, userAddress) => {
    if (!votingContract || !id) return;
    
    try {
      setLoading(true);
      
      // First check if proposal exists
      const proposalCount = await votingContract.proposalCount();
      if (id > proposalCount || id < 1) {
        throw new Error('Proposal not found. It may have been removed or never existed.');
      }
      
      // Fetch proposal data
      let proposalData;
      try {
        proposalData = await votingContract.getResults(id);
      } catch (error) {
        // If getResults fails, try getting basic proposal data
        console.log('getResults failed, trying getProposal...', error);
        proposalData = await votingContract.proposals(id);
      }

      // Always fetch voters, remove the !loading check
      try {
        const voters = await fetchVoters(votingContract, id);
        setVoters(voters);
      } catch (error) {
        console.warn('Could not load voters:', error);
        setVoters([]);
      }
      // If we still don't have valid data
      if (!proposalData) {
        throw new Error('Failed to load proposal data');
      }

      // Debug: Log the raw proposal data
      console.log('Raw proposal data:', proposalData);
      
      // Temporarily bypass removal check for debugging
      if (proposalData.removed) {
        console.warn('Proposal is marked as removed, but showing anyway for debugging');
        // Comment out the throw to see the proposal anyway
        // throw new Error('This proposal has been removed by the creator.');
      }
      
      // Check if proposal is closed
      const isClosed = proposalData.closed || 
                      (proposalData.deadline && 
                       Number(proposalData.deadline) * 1000 < Date.now());
      
      // Update proposal state
      setProposal(prev => {
        const newProposal = {
          id: id,
          description: proposalData.description || 'No description available',
          votes: proposalData.totalVotes || proposalData.voteCount || 0,
          closed: isClosed,
          deadline: Number(proposalData.deadline) || 0,
          removed: proposalData.removed || false,
          creator: proposalData.creator || '0x0000000000000000000000000000000000000000'
        };
        return JSON.stringify(prev) === JSON.stringify(newProposal) ? prev : newProposal;
      });
      
      // Check if current user has voted
      if (userAddress) {
        try {
          const voted = await votingContract.getVoteWeight(id, userAddress);
          setHasVoted(prevVoted => prevVoted === (voted > 0) ? prevVoted : voted > 0);
          setVoteWeight(prev => (prev?.eq?.(voted) ? prev : voted));
        } catch (error) {
          console.warn('Could not check vote status:', error);
          setHasVoted(false);
        }
      }
      
      // Fetch voters if not loading
      if (!loading) {
        try {
          const voters = await fetchVoters(votingContract, id);
          setVoters(voters);
        } catch (error) {
          console.warn('Could not load voters:', error);
          setVoters([]);
        }
      }
      
      // Clear any previous errors if we got this far
      setError(prev => ({
        ...prev,
        message: '',
        show: false,
        type: ''
      }));
      
    } catch (err) {
      console.error('Error loading proposal data:', err);
      
      // Set appropriate error message based on error type
      let errorMessage = 'Failed to load proposal data';
      if (err.message.includes('removed')) {
        errorMessage = 'This proposal has been removed by the creator.';
      } else if (err.message.includes('not found')) {
        errorMessage = 'Proposal not found. It may have been removed or never existed.';
      } else if (err.message.includes('execution reverted')) {
        errorMessage = 'Failed to load proposal. The contract may have reverted.';
      }
      
      showNotification(errorMessage, 'error');
      
      // Clear proposal data on error
      setProposal(null);
    } finally {
      setLoading(false);
    }
  }, [id, fetchVoters]);

  // Check if user is the contract owner
  const checkIfOwner = useCallback(async (votingContract, userAddress) => {
    if (!votingContract) return false;
    try {
      const contractOwner = await votingContract.owner();
      const isUserOwner = userAddress && contractOwner && 
                         userAddress.toLowerCase() === contractOwner.toLowerCase();
      setIsOwner(isUserOwner);
      return isUserOwner;
    } catch (error) {
      console.error('Error checking owner status:', error);
      return false;
    }
  }, []);

  // Initialize provider and set up wallet listeners
  useEffect(() => {
    let isMounted = true;
    let votingContract = null;
    
    const init = async () => {
      if (!isMounted) return;
      
      try {
        if (!window.ethereum) {
          showNotification('Please install MetaMask to use this application', 'error');
          setLoading(false);
          return;
        }
        
        // Initialize provider based on ethers version
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = await provider.getSigner();
        votingContract = new ethers.Contract(VOTING_CONTRACT_ADDRESS, votingAbi, signer);
        
        if (!isMounted) return;
        
        setProvider(provider);
        setVoting(votingContract);
        setSigner(signer);
        
        // Get initial account
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0 && isMounted) {
          const userAddress = accounts[0];
          setAccount(userAddress);
          await checkIfOwner(votingContract, userAddress);
          await loadProposalData(votingContract, userAddress);
        } else if (isMounted) {
          setAccount('');
          setHasVoted(false);
          setVoteWeight(null);
        }
        
      } catch (err) {
        console.error('Initialization error:', err);
        if (isMounted) {
          showNotification('Failed to initialize', 'error');
          setLoading(false);
        }
      }
    };
    
    // Set up account changed listener
    const handleAccountsChanged = async (accounts) => {
      if (!isMounted) return;
      
      try {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          if (votingContract) {
            await loadProposalData(votingContract, accounts[0]);
          }
        } else {
          setAccount('');
          setHasVoted(false);
          setVoteWeight(null);
        }
      } catch (err) {
        console.error('Error handling account change:', err);
      }
    };
    
    // Set up chain changed listener
    const handleChainChanged = () => {
      if (isMounted) {
        window.location.reload();
      }
    };
    
    // Initialize
    init();
    
    // Add event listeners
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
    }
    
    // Clean up
    return () => {
      isMounted = false;
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, [id, loadProposalData]);

  useEffect(() => {
    if (id && voting) {
      fetchVoters(voting, id);
    }
  }, [id, voting, fetchVoters]);

  const handleVote = async () => {
    if (!voting || !id) {
      showNotification('Voting contract not available', 'error');
      return;
    }
    
    try {
      setIsVoting(true);
      
      // Check if already voted
      if (hasVoted) {
        showNotification('You have already voted on this proposal', 'info');
        return;
      }
      
      // Check if voting is closed
      if (proposal?.closed) {
        showNotification('Voting is closed for this proposal', 'error');
        return;
      }
      
      // Check if proposal is removed
      if (proposal?.removed) {
        showNotification('This proposal has been removed', 'error');
        return;
      }
      
      // Check if voting deadline has passed
      const now = Math.floor(Date.now() / 1000);
      if (proposal?.deadline && proposal.deadline < now) {
        showNotification('Voting period has ended for this proposal', 'error');
        return;
      }
      
      try {
        // Show transaction overlay
        setTransactionStatus({
          isProcessing: true,
          title: 'Processing Your Vote',
          message: 'Please confirm the transaction in your MetaMask wallet',
          txHash: null
        });
        
        // Submit vote
        const tx = await voting.vote(id);
        
        // Update with transaction hash
        setTransactionStatus(prev => ({
          ...prev,
          message: 'Waiting for transaction confirmation...',
          txHash: tx.hash
        }));
        
        // Wait for transaction to be mined
        await tx.wait();
        
        // Hide overlay
        setTransactionStatus({ isProcessing: false });
        
        // Update UI
        setHasVoted(true);
        setProposal(prev => ({
          ...prev,
          votes: (parseInt(prev.votes) + 1).toString()
        }));
        
        showNotification('Vote submitted successfully!', 'success');
        
      } catch (error) {
        // Hide overlay on error
        setTransactionStatus({ isProcessing: false });
        
        if (error.code === 4001 || error.message?.includes('user rejected')) {
          showNotification('Transaction was rejected', 'error');
        } else if (error.message?.includes('already voted')) {
          setHasVoted(true);
          showNotification('You have already voted on this proposal', 'info');
        } else if (error.message?.includes('voting is closed')) {
          showNotification('Voting is closed for this proposal', 'error');
        } else {
          console.error('Voting error:', error);
          showNotification(error.message || 'Failed to submit vote', 'error');
        }
        throw error;
      }
      window.location.reload();
      
    } catch (error) {
      // Error already handled in inner catch
      console.error('Voting process error:', error);
    } finally {
      setIsVoting(false);
    }
  };

  const fetchAllProposals = async () => {
    setLoadingProposals(true);
    try {
      if (!voting) throw new Error('Contract not initialized');

      const proposalCount = await voting.proposalCount();
      const activeProposals = [];
      const removedProposals = [];
      const now = Math.floor(Date.now() / 1000);

      for (let i = 1; i <= proposalCount; i++) {
        try {
          const res = await voting.getResults(i);
          const [description, voteCount, closed, deadline, removed, creator] = res;
          const status = removed ? 'Removed' : (closed ? 'Closed' : (deadline.toNumber() < now ? 'Ended' : 'Open'));

          const proposalData = {
            id: i,
            description: description || 'No description',
            voteCount: voteCount.toNumber(),
            status,
            deadline: deadline.toNumber(),
            closed,
            removed,
            creator
          };

          if (removed) {
            removedProposals.push(proposalData);
          } else {
            activeProposals.push(proposalData);
          }
        } catch (err) {
          console.error(`Error loading proposal ${i}:`, err);
        }
      }

      // Sort active proposals by status and then by deadline
      const sortedActiveProposals = activeProposals.sort((a, b) => {
        const statusOrder = { 'Open': 0, 'Ended': 1, 'Closed': 2 };
        if (statusOrder[a.status] !== statusOrder[b.status]) {
          return statusOrder[a.status] - statusOrder[b.status];
        }
        return a.deadline - b.deadline;
      });

      // Combine active and removed proposals
      const allProposals = [...sortedActiveProposals, ...removedProposals];
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

  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  if (loading) {
    return (
      <div className="loading-proposals">
        <div className="loading-spinner"></div>
        Loading Your Proposal Details...
      </div>
    );
  }

  if (!proposal) {
    return <div className="error">Proposal not found</div>;
  }

  const currentTime = Math.floor(Date.now() / 1000);
  const isOpen = currentTime < proposal.deadline && !proposal.closed && !proposal.removed;

  const mainContentClass = `proposal-detail ${transactionStatus.isProcessing ? 'blur-content' : ''}`;

  return (
    <div className={mainContentClass}>
      {/* Transaction Processing Overlay */}
      {transactionStatus.isProcessing && (
        <div className="tx-loading-overlay">
          <div className="tx-loading-content">
            <div className="loading-spinner">
            </div>
            <h3 className="processing-text">{transactionStatus.title}</h3>
            <p>{transactionStatus.message}</p>          
          </div>
        </div>
      )}
      
      {notification.show && (
        <Notification 
          show={notification.show}
          title={notification.type === 'success' ? 'Success' : notification.type === 'error' ? 'Error' : 'Info'}
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(prev => ({ ...prev, show: false }))}
        />
      )}
      {/* Status Messages */}
      {error && error.show && (
        <div className={`alert ${error.type === 'success' ? 'alert-success' : 'alert-error'}`}>
          {error.description}
          {error.ipfsUrl && (
            <a 
              href={error.ipfsUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="ipfs-link"
            >
              <FaLink /> View on IPFS
            </a>
          )}
        </div>
      )}

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
            className="nav-button"
          >
            Admin Panel
          </button>
        )}
      </div>

      <ProposalDetailBanner proposal={proposal} id={id} />
      
      <ProposalModal 
        show={showProposalModal}
        onClose={() => setShowProposalModal(false)}
        proposals={proposalList}
        loading={loadingProposals}
      />

      {/* Voting Section */}
      <div className="voting-section glass-card">
        <h3>|| Proposal Details ||</h3>
        <div className="voting-options">
          <button 
            className={`vote-option ${hasVoted ? 'voted' : ''}`}
            onClick={() => {handleVote()}}
            disabled={proposal?.closed || proposal?.removed || isVoting || hasVoted}
          >
            {isVoting ? (
              <>
                <div className="loading-spinner"></div>Processing...
              </>
            ) : hasVoted ? (
              <>
                <FaCheck /> You've Voted
              </>
            ) : (
              <>
                <FaVoteYea /> Vote For This Proposal
              </>
            )}
          </button>
          
          <div className="vote-stats">
            <div className="stat-item">
              <span className="stat-label">Total Votes:</span>
              <span className="stat-value">{proposal ? formatBigNumber(proposal.votes) : '0'}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Status:</span>
              <span className={`status-badge ${proposal?.closed ? 'closed' : 'open'}`}>
                {proposal?.closed ? 'Voting Closed' : 'Voting Open'}
              </span>
            </div>
          </div>
        </div>
        
        {voters.length > 0 ? (
          <div className="voters-table-container">
            <table className="voters-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Voter Address</th>
                  <th>Vote Weight</th>
                  <th>Voted At</th>
                </tr>
              </thead>
              <tbody>
                {voters.map((voter, index) => (
                  <tr key={index} className="voter-row">
                    <td>{index + 1}</td>
                    <td className="voter-address-cell">
                      <FaUser className="voter-icon" />
                      <span className="voter-address" title={voter.address}>
                        {formatAddress(voter.address)}
                      </span>
                      <button 
                        className="copy-address"
                        onClick={() => {
                          navigator.clipboard.writeText(voter.address);
                          // Optional: Add a toast notification here
                        }}
                        title="Copy address"
                      >
                        <FaCopy />
                      </button>
                    </td>
                    <td>
                      <span className="vote-weight">
                        {voter.weight ? formatBigNumber(voter.weight) : '1'}
                      </span>
                    </td>
                    <td>
                      <div className="voted-time">
                        {voter.timestamp ? (
                          <>
                            <FaClock />
                            {new Date(voter.timestamp * 1000).toLocaleString()}
                          </>
                        ) : 'N/A'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="no-voters">
            <FaUserFriends className="no-voters-icon" />
            <p>No voters yet. Be the first to vote!</p>
          </div>
        )}
      </div>

      {/* Comments Section */}
      <div className="comments-section glass-card">
        <div className="comments-header">
          <h3>Discussion [{commentCount}]</h3>
          <button 
            onClick={loadComments} 
            className="refresh-comments"
            disabled={loadingComments}
            title="Refresh comments"
          >
            <FaSyncAlt className={loadingComments ? 'spin' : ''} />
          </button>
        </div>
        <form onSubmit={handleCommentSubmit} className="comment-form">
          <div className="form-group">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Share Your Thoughts on This Proposal..."
              rows="3"
              disabled={isPostingComment}
              className='comment-textarea'
            />
          </div>
          <button type="submit" disabled={isPostingComment || !newComment.trim() || !account}>
            {isPostingComment ? (
              <>
                <FaSpinner className="spin" /> Posting...
              </>
            ) : (
              <>
                <FaPaperPlane /> Post Comment
              </>
            )}
          </button>
          {!account && (
            <p style={{ marginTop: '0.5rem', color: '#ff6b6b', fontSize: '0.9rem' }}>
              Please connect your wallet to comment
            </p>
          )}
        </form>

        {loadingComments ? (
          <div className="comments-loading">
            <div className="loading-spinner"></div>
            <p>Loading comments...</p>
          </div>
        ) : comments.length === 0 ? (
          <div className="no-comments">
            <p>No comments yet. Be the first to share your thoughts!</p>
          </div>
        ) : (
          <div className="comment-table">
            <div className="comment-table-header">
              <div className="header-cell">#</div>
              <div className="header-cell">COMMENTER ADDRESS</div>
              <div className="header-cell">COMMENT</div>
              <div className="header-cell">COMMENTED AT</div>
            </div>
            <div className="comment-list">
            {comments.map((comment, index) => {
              console.log('Comment data:', comment); // Debug log
              
              // Parse the comment data
              let commentData;
              try {
                commentData = typeof comment.data === 'string' ? JSON.parse(comment.data) : comment;
              } catch (e) {
                console.error('Error parsing comment data:', e);
                commentData = {};
              }
              
              // Format timestamp
              const formatDateTime = (timestamp) => {
                if (!timestamp) return 'Just now';
                return new Date(timestamp * 1000).toLocaleString('en-US', {
                  month: 'numeric',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                });
              };

              // Format address to show first and last 4 characters
              const formatAddress = (address) => {
                if (!address) return 'Unknown';
                // Ensure address is a string and has at least 8 characters
                const addr = String(address);
                if (addr.length < 8) return 'Invalid';
                return `${addr.substring(0, 7)}...${addr.substring(addr.length - 7)}`;
              };

              // Get the actual address from comment data
              const userAddress = commentData.author || comment.author;
              const displayAddress = userAddress ? formatAddress(userAddress) : 'Unknown';
              const canCopy = !!userAddress;
              const commentContent = commentData.content || 'No content';
              
              // Generate identicon for the address
              const identicon = userAddress 
                ? create({
                    seed: userAddress.toLowerCase(),
                    size: 8,
                    scale: 5,
                    color: '#7c3aed',
                    bgcolor: '#1e293b',
                    spotcolor: '#000'
                  }).toDataURL() 
                : '';

              return (
                <div key={`${comment.ipfsHash}-${index}`} className="comment-card">
                  {/* Comment Number */}
                  <div>{index + 1}</div>
                  
                  {/* Commenter Address */}
                  <div className="comment-address-cell">
                    <FaUser className="comment-icon" />
                    <div className="comment-address" title={userAddress}>
                      {displayAddress}
                    </div>
                    <button 
                        className="copy-comment-address"
                        onClick={() => {
                          navigator.clipboard.writeText(userAddress);
                          // Optional: Add a toast notification here
                        }}
                        title="Copy address"
                      >
                        <FaCopy />
                      </button>
                  </div>
                  
                  {/* Comment Content */}
                  <div className="comment-content">
                    {commentContent.split('\n').map((paragraph, i) => (
                      <div key={i}>{paragraph || <br />}</div>
                    ))}
                  </div>
                  
                  {/* Comment Time */}
                  <div className="comment-time">
                    <FaClock className="comment-time-icon" />
                    <span>{formatDateTime(commentData.timestamp || comment.timestamp)}</span>
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default ProposalDetail;
