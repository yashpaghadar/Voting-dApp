import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import votingAbiString from './abi/Voting.json';
import { FaVoteYea, FaInfoCircle, FaExclamationTriangle, FaCheck, FaClock, FaTimes, FaSpinner, FaChartBar, FaWallet, FaImage } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import './VoteDashboard.css';
import './ProposalModal.css';
import { getEthersProvider, parseEther, parseContractAbi, formatBigNumber } from './utils/ethersHelpers';
import VotingResultsChart from './VotingResultsChart';
import NFTModal from './components/NFTModal';
import Loading from './Loading';

const votingAbi = parseContractAbi(votingAbiString);

const ethersVersion = window.ethers ? 'v5' : 'v6';
console.log(`Using ethers.js ${ethersVersion}`);

const VOTING_CONTRACT_ADDRESS = import.meta.env.VITE_VOTING_CONTRACT_ADDRESS;
const VOTE_TOKEN_ADDRESS = import.meta.env.VITE_VOTE_TOKEN_ADDRESS;
const OWNER_ADDRESS = import.meta.env.VITE_OWNER_ADDRESS;

if (!VOTING_CONTRACT_ADDRESS || !VOTE_TOKEN_ADDRESS || !OWNER_ADDRESS) {
  console.error("Missing required environment variables for contract addresses");
  console.log("Current environment:", import.meta.env);
}
const VOTE_TOKEN_DECIMALS = 18;
const PROPOSAL_FEE = 25;
const VOTE_FEE = 10;

// Helper function to format time remaining
const formatTimeRemaining = (deadline, currentTime) => {
  const diff = deadline - currentTime;
  if (diff <= 0) return 'Ended';
  
  const hours = Math.floor(diff / (60 * 60));
  const minutes = Math.floor((diff % (60 * 60)) / 60);
  const seconds = diff % 60;
  
  // Format as HHh MMm SSs with leading zeros
  const pad = (num) => num.toString().padStart(2, '0');
  return `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
};

// Status badge component
const StatusBadge = ({ status }) => {
  const statusConfig = {
    'Open': { bg: 'bg-green-100', text: 'text-green-800', icon: <FaClock className="mr-1" /> },
    'Ended': { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: <FaExclamationTriangle className="mr-1" /> },
    'Closed': { bg: 'bg-red-100', text: 'text-red-800', icon: <FaTimes className="mr-1" /> },
    'Voted': { bg: 'bg-blue-100', text: 'text-blue-800', icon: <FaCheck className="mr-1" /> }
  };
  
  const config = statusConfig[status] || { bg: 'bg-gray-100', text: 'text-gray-800' };
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {config.icon}
      {status}
    </span>
  );
};

const VoteDashboard = () => {
  // ...existing state hooks...
  const [isProposalLoading, setIsProposalLoading] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [notification, setNotification] = useState({ 
    show: false, 
    title: '',
    description: '',
    isError: false,
    type: 'default' // 'default', 'error', 'wallet', 'info'
  });

  const [provider, setProvider] = useState();
  const [signer, setSigner] = useState();
  const [voting, setVoting] = useState();
  const [account, setAccount] = useState("");
  const [owner, setOwner] = useState("");
  const [removing, setRemoving] = useState(false);
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [txStatus, setTxStatus] = useState("");
  const [currentTime, setCurrentTime] = useState(Math.floor(Date.now() / 1000));
  const [approving, setApproving] = useState(false);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [showRemoveForm, setShowRemoveForm] = useState(false);
  const [removeProposalName, setRemoveProposalName] = useState('');
  const [votedProposals, setVotedProposals] = useState(new Set());
  const [connectionRequested, setConnectionRequested] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [isVotingLoading, setIsVotingLoading] = useState(false);
  const [isTxPending, setIsTxPending] = useState(false);
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);
  const [isCreatingProposal, setIsCreatingProposal] = useState(false);
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [proposalList, setProposalList] = useState([]);
  const [loadingProposals, setLoadingProposals] = useState(false);
  const [error, setError] = useState('');
  const [notificationTimeout, setNotificationTimeout] = useState(null);
  const [showNFTModal, setShowNFTModal] = useState(false);
  const [lastTransactionHash, setLastTransactionHash] = useState('');

  // Auto-hide notification after 5 seconds
  useEffect(() => {
    if (notification.show) {
      // Clear any existing timeout
      if (notificationTimeout) {
        clearTimeout(notificationTimeout);
      }
      
      // Set new timeout
      const timeoutId = setTimeout(() => {
        setNotification(prev => ({ ...prev, show: false }));
      }, 5000);
      
      setNotificationTimeout(timeoutId);
      
      // Cleanup function
      return () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      };
    }
  }, [notification.show]);

  const handleError = (error, context) => {
    console.error(context, error);
    setError(`${context}: ${error.message}`);
  };

  // Update current time every second for the countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        if (!window.ethereum) {
          setNotification({
            show: true,
            title: 'MetaMask Not Found',
            description: 'Please install MetaMask to use this application',
            isError: true,
            type: 'wallet'
          });
          setLoading(false);
          return;
        }
        
        const provider = await getEthersProvider(ethers);
        const accounts = await provider.send('eth_requestAccounts', []);
        
        if (!accounts || accounts.length === 0) {
          throw new Error('No accounts found');
        }
        
        const signer = await provider.getSigner();
        const voting = new ethers.Contract(VOTING_CONTRACT_ADDRESS, votingAbi, signer);
        
        setProvider(provider);
        setSigner(signer);
        setVoting(voting);
        setAccount(accounts[0]);
        
        // Add token allowance check
        try {
          const tokenContract = new ethers.Contract(
            VOTE_TOKEN_ADDRESS,
            [
              'function allowance(address owner, address spender) external view returns (uint256)'
            ],
            signer
          );
          const allowance = await tokenContract.allowance(accounts[0], VOTING_CONTRACT_ADDRESS);
          setNeedsApproval(allowance.lt(parseEther(ethers, VOTE_FEE.toString())));
        } catch (error) {
          console.error('Error checking token allowance:', error);
          setNeedsApproval(true);
        }
        
        await fetchProposals(voting);
      } catch (error) {
        console.error('Initialization error:', error);
      } finally {
        setLoading(false);
      }
    };
    
    init();
    
    // Cleanup function
    return () => {
      // Any cleanup if needed
    };
  }, []);

  // Log account and owner changes
  useEffect(() => {
    if (account && owner) {
      console.log('Current account:', account);
      console.log('Contract owner:', owner);
      console.log('Is owner?', account.toLowerCase() === owner.toLowerCase());
    }
  }, [account, owner]);

  const fetchProposals = async (_voting) => {
    // Fetch all proposals by iterating proposalCount
    try {
      const count = Number(await _voting.proposalCount());
      const items = [];
      let displayId = 1; // Start IDs from 1 for display
      
      for (let i = 1; i <= count; i++) {
        try {
          const res = await _voting.getResults(i);
          // Skip removed proposals
          if (res[4] === true) continue;
          
          let votes = 0;
          try {
            votes = Number(res[1]);
            if (isNaN(votes)) votes = 0;
          } catch (e) {
            votes = 0;
          }
          
          items.push({
            id: displayId++, // Use sequential display ID
            originalId: i,   // Keep original ID for contract calls
            description: res[0] || "",
            votes,
            closed: res[2],
            deadline: Number(res[3]) || 0,
            removed: false,
          });
        } catch (e) {
          console.error(`Error fetching proposal #${i}:`, e);
        }
      }
      console.log("Fetched active proposals:", items);
      setProposals(items);
      setLoading(false);
    } catch (e) {
      console.error("Error fetching proposals:", e);
      setLoading(false);
    }
  };

  const handleVote = async (displayId) => {
    let tx;
    try {
      setIsTxPending(true);
      if (votedProposals.size > 0) {
        setNotification({
          show: true,
          title: 'Already Voted',
          description: 'You have already voted in this session',
          isError: true,
          type: 'error'
        });
        setTimeout(() => setNotification(prev => ({ ...prev, show: false })), 5000);
        return;
      }
      
      setIsVotingLoading(true);
      setTxStatus('Voting...');
      
      // Check token approval
      if (needsApproval) {
        await approveTokens();
        setNeedsApproval(false);
      }
      
      // Submit vote
      tx = await voting.vote(displayId);
      const receipt = await tx.wait();
      setLastTransactionHash(receipt.transactionHash);
      
      // Refresh data from contract
      await fetchProposals(voting);
      debugContractMethods(voting); // Debug contract methods
      
      // Update frontend state
      const allProposalIds = proposals.map(p => p.id);
      setVotedProposals(new Set(allProposalIds));
      
      // Show success notification
      setNotification({
        show: true,
        title: 'Success',
        description: 'Your vote has been recorded!',
        isError: false,
        type: 'success',
        key: Date.now()
      });
      
      // Show NFT modal
      setShowNFTModal(true);
      
      setHasVoted(true);
    } catch (error) {
      console.error('Voting error:', error);
      
      if (error.message.includes('Already voted') || 
          error.reason?.includes('Already voted') ||
          error?.data?.message?.includes('Already voted')) {
        
        setNotification({
          show: true,
          title: 'Already Voted',
          description: 'You can only vote once per proposal',
          isError: true,
          type: 'error',
          key: Date.now()
        });
        
        // Sync voting state
        const allProposalIds = proposals.map(p => p.id);
        setVotedProposals(new Set(allProposalIds));
      } else {
        handleError(error, 'Voting failed');
      }
    } finally {
      setIsVotingLoading(false);
      setIsTxPending(false);
      setTxStatus('');
    }
  };
  const handleRemoveProposal = async (e) => {
    e.preventDefault();
    
    if (!removeProposalName.trim()) {
      handleError(new Error('Please enter a proposal name'), 'Missing name');
      return;
    }

    setRemoving(true);
    setTxStatus("Removing proposal...");
    
    try {
      setIsTxPending(true);
      if (!voting) throw new Error("Voting contract not loaded");
      
      const tx = await voting.removeProposalByName(removeProposalName);
      await tx.wait();
      
      setNotification({
        show: true,
        title: 'Success',
        description: `Proposal "${removeProposalName}" removed successfully`,
        isError: false
      });
      setTimeout(() => setNotification({ show: false }), 5000);
      
      setShowRemoveForm(false);
      setRemoveProposalName('');
      await fetchProposals(voting);
    } catch (err) {
      handleError(err, 'Failed to remove proposal');
    } finally {
      setIsTxPending(false);
      setRemoving(false);
    }
  };
  
  const [newProposal, setNewProposal] = useState("");
  const [creating, setCreating] = useState(false);
  const now = Math.floor(Date.now() / 1000);

  const handleCreateProposal = async (e) => {
    e.preventDefault();
    if (!newProposal.trim()) {
      handleError(new Error('Proposal description cannot be empty'), 'Validation Error');
      return;
    }
    
    try {
      setIsTxPending(true);
      setIsCreatingProposal(true);
      // Check token balance first
      const tokenContract = new ethers.Contract(
        VOTE_TOKEN_ADDRESS,
        ['function balanceOf(address) view returns (uint256)'],
        signer
      );
      const balance = await tokenContract.balanceOf(account);
      const requiredBalance = parseEther(ethers, PROPOSAL_FEE.toString());
      
      if (balance.lt(requiredBalance)) {
        throw new Error(`You need at least ${PROPOSAL_FEE} VOTE to create a proposal`);
      }
      
      // Handle token approval if needed
      if (needsApproval) {
        await approveTokens();
        setNeedsApproval(false);
      }
      
      setTxStatus('Creating proposal...');
      const tx = await voting.createProposal(newProposal);
      await tx.wait();
      
      setNotification({
        show: true,
        title: 'Success',
        description: 'Proposal created successfully!',
        isError: false,
        type: 'default'
      });
      setTimeout(() => setNotification({ show: false }), 5000);
      setNewProposal('');
      setShowInput(false);
      await fetchProposals(voting);
    } catch (error) {
      handleError(error, 'Create proposal error');
    } finally {
      setIsTxPending(false);
      setIsCreatingProposal(false);
      setTxStatus('');
    }
  };

  const checkTokenApproval = async () => {
    if (!account || !signer) return;
    
    const tokenContract = new ethers.Contract(
      VOTE_TOKEN_ADDRESS,
      ['function allowance(address,address) view returns (uint256)'],
      signer
    );
    
    const allowance = await tokenContract.allowance(account, VOTING_CONTRACT_ADDRESS);
    const requiredTokens = parseEther(ethers, PROPOSAL_FEE.toString());
    setNeedsApproval(allowance.lt(requiredTokens));
  };

  const approveTokens = async () => {
    if (!account || !signer) return;
    
    setApproving(true);
    setTxStatus({ message: 'Approving VOTE tokens...', isError: false });
    
    try {
      setIsTxPending(true);
      const tokenContract = new ethers.Contract(
        VOTE_TOKEN_ADDRESS,
        ['function approve(address,uint256)'],
        signer
      );
      
      const tx = await tokenContract.approve(
        VOTING_CONTRACT_ADDRESS,
        ethers.constants.MaxUint256 // Approve unlimited tokens
      );
      
      await tx.wait();
      setNeedsApproval(false);
      setNotification('VOTE tokens approved successfully!', '');
      setTimeout(() => setNotification({ show: false }), 5000);
    } catch (error) {
      setNotification('Approval failed', error.reason || error.message || 'Unknown error', true);
      setTimeout(() => setNotification({ show: false }), 5000);
    } finally {
      setIsTxPending(false);
      setApproving(false);
    }
  };

  useEffect(() => {
    if (account && signer) {
      checkTokenApproval();
    }
  }, [account, signer]);

  // Update the debug function to be more robust
  const debugContractMethods = async (contract) => {
    try {
      if (!contract) {
        console.error('Contract instance is null/undefined');
        return;
      }
      
      console.log('Contract address:', contract.address);
      console.log('Contract provider:', contract.provider);
      console.log('Contract signer:', contract.signer);
      
      const methods = Object.keys(contract.functions);
      console.log('Available contract methods:', methods);
      
      const removeMethods = methods.filter(m => m.includes('remove'));
      console.log('Remove-related methods:', removeMethods || 'None found');
    } catch (err) {
      console.error('Debug failed:', err);
    }
  };

  const connectWallet = async () => {
    try {
      setIsConnectingWallet(true);
      
      // Check if wallet connection is already pending
      if (connectionRequested) {
        throw { code: -32002, message: 'Connection request already pending' };
      }
      
      setConnectionRequested(true);
      
      // Get provider
      const provider = await getEthersProvider(ethers);
      
      // Get accounts
      const accounts = await provider.send('eth_requestAccounts', []);
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found');
      }
      
      const signer = await provider.getSigner();
      const voting = new ethers.Contract(VOTING_CONTRACT_ADDRESS, votingAbi, signer);
      
      setProvider(provider);
      setSigner(signer);
      setVoting(voting);
      setAccount(accounts[0]);
      
      // Check token approval
      await checkTokenApproval();
      
      setNotification({
        show: true,
        title: 'Wallet Connected',
        description: `Connected to account: ${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)}`,
        isError: false,
      });
      
      setConnectionRequested(false);
    } catch (err) {
      handleError(err, 'Wallet Connection Failed');
      setConnectionRequested(false);
    } finally {
      setIsConnectingWallet(false);
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
    
    setProposalList(sortedProposals);
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

if (loadingProposals) {
  return (
    <div className="loading">
      <div className="loading-spinner"></div>
      Loading Vote Dashboard...
    </div>
  );
}

  return (
    <div className="voting-dashboard">
      <nav className="nav-container">
        <div className="nav-links">
          <button 
            onClick={() => window.location.href = '/vote'}
            className="nav-link"
          >
            Vote Dashboard
          </button>
          <button 
            onClick={openProposalModal} 
            className="nav-link"
          >
            Proposal Details
          </button>
          <button
            onClick={() => window.location.href = "/my-votes"}
            className="nav-link"
          >
            My Votes
          </button>
          <button
            onClick={() => window.location.href = "/my-nfts"}
            className="nav-link"
          >
            My NFTs
          </button>
        </div>
      </nav>

      {notification && notification.show && (
        <div className={`notification notification-${notification.type || 'success'}`}>
          <div className="notification-content">
            {notification.type === 'error' ? (
              <FaExclamationTriangle className="notification-icon" />
            ) : notification.type === 'info' || notification.type === 'wallet' ? (
              <FaInfoCircle className="notification-icon" />
            ) : (
              <FaCheck className="notification-icon" />
            )}
            <div className="notification-text">
              <span className="notification-title">{notification.title || ''}</span>
              {notification.description && <p className="notification-description">{notification.description}</p>}
            </div>
          </div>
        </div>
      )}
      
      {/* Show Loading overlay for proposal viewing, not during wallet/tx loading */}
      {isProposalLoading && !isConnectingWallet && !isTxPending && (
        <Loading text="Loading Proposals..." />
      )}
      {isConnectingWallet && (
        <div className="wallet-connecting-overlay">
          <div className="wallet-connecting-content">
            <FaSpinner className="animate-spin" size={48} />
            <p>Connecting to MetaMask...</p>
            <small>Please approve the connection in your wallet</small>
          </div>
        </div>
      )}
      
      <header className="dashboard-header">
        <h1 className="dashboard-title">
          <FaVoteYea className="dashboard-title-icon" />
          Voting Dashboard
        </h1>
      </header>
      
      
      {/* Wallet Connection */}
      {!account ? (
        <div className="wallet-disconnected">
  <div className="wallet-status">
    <div style={{ width: '100%' }}>
      <h2 className="wallet-header">|| Connect Your Wallet ||</h2>
      <div className="wallet-box">
        <FaWallet className="wallet-icon" />
        <span className="wallet-address">Not Connected</span>
      </div>
      <p className="mt-1 text-sm" style={{ color: '#f59e0b', fontWeight: 500 }}>You need to connect your wallet to interact with the voting system.</p>
    </div>
    <button
      onClick={async () => {
        if (window.ethereum) {
          try {
            const _provider = new ethers.providers.Web3Provider(window.ethereum);
            await window.ethereum.request({ method: 'eth_requestAccounts' });
            const _signer = await _provider.getSigner();
            const addr = await _signer.getAddress();
            setProvider(_provider);
            setSigner(_signer);
            setAccount(addr);
            const _voting = new ethers.Contract(
              VOTING_CONTRACT_ADDRESS,
              votingAbi,
              _signer
            );
            setVoting(_voting);
            await fetchProposals(_voting);
            debugContractMethods(_voting);
          } catch (e) {
            setTxStatus(`Failed to connect wallet: ${e?.reason || e?.message || 'Unknown error'}`);
          }
        } else {
          setTxStatus("MetaMask not detected. Please install MetaMask to continue.");
        }
      }}
      className="btn btn-warning"
      disabled={isConnectingWallet}
    >
      {isConnectingWallet ? 'Connecting...' : 'Connect MetaMask'}
    </button>
  </div>
</div>
      ) : (
        <div className="wallet-connected">
  <div className="wallet-status">
    <div style={{ width: '100%' }}>
      <h2 className="wallet-header">|| Wallet Connected ||</h2>
      <div className="wallet-box">
        <FaWallet className="wallet-icon" /> Connected as: 
        <span className="wallet-address">{account}</span>
      </div>
      <p className="mt-1 text-sm" style={{ color: '#1d4ed8', fontWeight: 500 }}>You are connected and ready to vote!</p>
    </div>
    <button
      onClick={() => {
        setAccount("");
        setProvider(null);
        setSigner(null);
        setVoting(null);
      }}
      className="btn btn-warning"
    >
      Disconnect
    </button>
  </div>
</div>
      )}
 
      {/* How It Works */}
      <section className="info-card">
        <div className="info-header">
          <h2 className="info-header-title">|| How It Works ||</h2>
        </div>
        <div className="info-content">
          <div className="info-items">
            <div className="info-item">
              <div className="info-bullet">
                <div className="bullet-point" />
              </div>
              <p className="info-text">
                <span className="label-text">Voting:</span> Each vote costs {formatBigNumber(VOTE_FEE)} VOTE (sent to contract owner)
              </p>
            </div>
            <div className="info-item">
              <div className="info-bullet">
                <div className="bullet-point" />
              </div>
              <p className="info-text">
                <span className="label-text">Proposals:</span> Creating a proposal costs {formatBigNumber(PROPOSAL_FEE)} VOTE (sent to contract owner)
              </p>
            </div>
            <div className="info-item">
              <div className="info-bullet">
                <div className="bullet-point" />
              </div>
              <p className="info-text">
                <span className="label-text">Gas fees:</span> You'll need Sepolia ETH for transaction fees
              </p>
            </div>
            <div className="info-item">
              <div className="info-bullet">
                <div className="bullet-point" />
              </div>
              <p className="info-text">
                <span className="label-text">Voting period:</span> Each proposal is open for voting until its deadline
              </p>
            </div>
            <div className="info-item">
              <div className="info-bullet">
                <div className="bullet-point" />
              </div>
              <p className="info-text">
                <span className="label-text">Results:</span> See the current leader in the "Who's winning?" section below
              </p>
            </div>
          </div>
        </div>
      </section>
      
      {/* Proposals Table */}
      <div className="proposals-table">
        <div className="table-header">
          <h2 className="active-proposals-header">Active Proposals</h2>
        </div>
        
        {loading ? (
          <div className="simple-loading">
            <div className="loading-spinner"></div>
            <p>Loading Proposals...</p>
          </div>
        ) : proposals.length === 0 ? (
          <div className="empty-state">
            No Proposals Found. Be the first to create one!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deadline</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Votes</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {proposals.map((p, index) => {
                  const isOpen = !p.closed && now < p.deadline;
                  const isEnded = !p.closed && now >= p.deadline;
                  const status = p.closed ? 'Closed' : isEnded ? 'Ended' : 'Open';
                  const displayId = index + 1; // Sequential ID starting from 1
                  
                  return (
                    <tr key={p.id} className={p.removed ? 'opacity-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">#{displayId}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                        <div className="font-medium">
                          <a href={`/proposal/${p.id}`} className="proposal-link">
                            {p.description}
                          </a>
                        </div>
                        {p.removed && <span className="text-xs text-red-600">(Removed)</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatTimeRemaining(p.deadline, currentTime)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-16 bg-gray-200 rounded-full h-2.5 mr-2">
                            <div 
                              className="bg-blue-600 h-2.5 rounded-full" 
                              style={{ width: `${Math.min(100, (p.votes / Math.max(1, Math.max(...proposals.map(prop => prop.votes || 0)))) * 100)}%` }}
                            ></div>
                          </div>
                          {formatBigNumber(p.votes)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          {account && isOpen && !votedProposals.has(p.id) && !p.removed && (
                            <button 
                              onClick={() => handleVote(p.id)}
                              disabled={hasVoted || votedProposals.has(p.id) || isVotingLoading}
                              className={`vote-btn ${hasVoted ? 'disabled-btn' : ''}`}
                            >
                              {isVotingLoading ? <FaSpinner className="animate-spin mr-1" /> : <FaVoteYea className="mr-1" />}
                              {isVotingLoading ? 'Processing...' : 'Vote'}
                            </button>
                          )}
                          
                          
                          {(!account || p.closed) && !isOpen && !isEnded && (
                            <span className="text-sm text-gray-500">Voting closed</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* Owner Controls and Create Proposal */}
      <div className="button-group">
        {!showInput && !showRemoveForm && (
          <div className="button-group-container">
            <button
              onClick={() => {
                setShowInput(true);
                setShowRemoveForm(false);
              }}
              className="create-proposal-btn"
              title={'Costs 25 VOTE to create a proposal.'}
            >
              Create New Proposal
            </button>
            
            {account && account.toLowerCase() === OWNER_ADDRESS.toLowerCase() && (
              <button
                onClick={() => {
                  setShowRemoveForm(true);
                  setShowInput(false);
                }}
                className="remove-proposal-btn"
              >
                Remove Proposal
              </button>
            )}
            <button
              onClick={openProposalModal}
              className="view-all-proposals-btn"
            >
              View All Proposals
            </button>
          </div>
        )}
      </div>
      {/* Add Proposal Form */}
      {showInput && (
        <div className="proposal-box">
          <h2 className="proposal-box-title">Create New Proposal</h2>
          <p>Costs {formatBigNumber(PROPOSAL_FEE)} VOTE to create a proposal.</p>
          
          <form onSubmit={handleCreateProposal}>
            <input
              type="text"
              value={newProposal}
              onChange={(e) => setNewProposal(e.target.value)}
              placeholder="Enter proposal Name"
              className="proposal-input"
              required
              autoFocus
            />
            
            <div className="proposal-buttons">
              <button 
                type="submit" 
                disabled={isCreatingProposal}
                className="create-btn"
              >
               {isCreatingProposal && (
              <div className="tx-loading-overlay">
                <div className="tx-loading-content">
                  <div className="loading-spinner"></div>
                  <p>Processing Transaction...</p>
                  <small>Please confirm in MetaMask</small>
                </div>
              </div>
              )} 
              {isCreatingProposal ? 'Creating...' : 'Create Proposal'}
              </button>
              
              <button 
                type="button" 
                className="cancel-btn"
                onClick={() => setShowInput(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
      {showRemoveForm && (
        <div className="proposal-box">
          <h2 className="proposal-box-title">Remove Proposal</h2>
          <form onSubmit={handleRemoveProposal}>
            <input
              type="text"
              value={removeProposalName}
              onChange={(e) => setRemoveProposalName(e.target.value)}
              placeholder="Enter proposal name to remove"
              className="proposal-input"
              required
              autoFocus
            />
            
            <div className="proposal-buttons">
              <button 
                type="submit" 
                disabled={removing}
                className="submit-btn"
              >
                {removing ? 'Removing...' : 'Remove Proposal'}
              </button>
              
              <button 
                type="button" 
                className="cancel-btn"
                onClick={() => {
                  setShowRemoveForm(false);
                  setRemoveProposalName('');
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Determine if there are any active proposals */}
      {(() => {
        const hasActiveProposals = proposals && proposals.some(p => !p.removed && !p.closed);
        if (!hasActiveProposals) return null;
        return (
          <>
            {/* Current Winner Section */}
            <div className="winner-box">
              <div className="winner-header">
                <h2><FaChartBar className="inline mr-2" /> Current Winner</h2>
              </div>
              <div className="winner-content">
                {proposals.filter(p => !p.removed).length > 0 ? (
                  <div>
                    {(() => {
                      try {
                        const validProposals = proposals.filter(p => typeof p.votes === 'number' && !isNaN(p.votes) && !p.removed);
                        if (!validProposals.length) return (
                          <p className="text-gray-500" style={{ fontSize: '1rem', textAlign: 'center' }}>No valid proposals to determine a winner.</p>
                        );
                        
                        const winner = validProposals.reduce((a, b) => (a.votes > b.votes ? a : b));
                        const isTie = validProposals.filter(p => p.votes === winner.votes).length > 1;
                        
                        return (
                          <div>
                            {isTie ? (
                              <p className="winner-name">
                                It's a tie between multiple proposals with {formatBigNumber(winner.votes)} votes each!
                              </p>
                            ) : (
                              <>
                                <div className="winner-name" style={{ fontSize: '1rem', textAlign: 'center' }}>{winner.description}</div>
                                <div className="winner-votes" style={{ fontSize: '1rem', textAlign: 'center' }}>
                                  {formatBigNumber(winner.votes)} {winner.votes === 1 ? 'vote' : 'votes'}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      } catch (e) {
                        return <p className="text-gray-500">Error determining winner</p>;
                      }
                    })()}
                  </div>
                ) : (
                  <p className="text-gray-500" style={{ fontSize: '1rem', textAlign: 'center' }}>No proposals have been created yet</p>
                )}
              </div>
            </div>

            {/* Voting Results Chart */}
            <div className="chart-box mt-6">
              <div className="chart-header">
                <h2><FaChartBar className="inline mr-2" />Voting Results</h2>
              </div>
              <div className="chart-content">
                <VotingResultsChart proposals={proposals} />
              </div>
            </div>
          </>
        );
      })()}

      {isTxPending && (
        <div className="tx-loading-overlay">
          <div className="tx-loading-content">
            <div className="loading-spinner"></div>
            <p>Processing Transaction...</p>
            <small>Please confirm in MetaMask</small>
          </div>
        </div>
      )}
      {showProposalModal && (
        <div className="modal-overlay">
        <div className="proposal-modal">
          <div className="modal-header">
            <h2>All Proposals</h2>
            <button className="close-modal" onClick={() => setShowProposalModal(false)}>
              ×
            </button>
          </div>
          {loadingProposals ? (
            <div className="loading-proposals">
              <FaSpinner className="spinner" />
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

export default VoteDashboard;
