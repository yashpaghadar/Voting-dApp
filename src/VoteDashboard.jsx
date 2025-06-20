import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import votingAbi from './abi/Voting.json';
import { FaVoteYea, FaInfoCircle, FaExclamationTriangle, FaCheck, FaClock, FaTimes, FaSpinner} from 'react-icons/fa';
import './VoteDashboard.css';

const VOTING_CONTRACT_ADDRESS = import.meta.env.VITE_VOTING_CONTRACT_ADDRESS;
const HELLO_TOKEN_ADDRESS = import.meta.env.VITE_HELLO_TOKEN_ADDRESS;

if (!VOTING_CONTRACT_ADDRESS || !HELLO_TOKEN_ADDRESS) {
  console.error("Missing required environment variables for contract addresses");
  console.log("Current environment:", import.meta.env);
}
const HLTK_DECIMALS = 18;
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
  const [showInput, setShowInput] = useState(false);
  const [notification, setNotification] = useState({ 
    show: false, 
    title: '',
    description: '',
    isError: false,
    type: 'default' // 'default', 'error', 'wallet'
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
  const [isCreatingProposal, setIsCreatingProposal] = useState(false);
  const [isTxPending, setIsTxPending] = useState(false);
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);

  const handleError = (error, title) => {
    if (error.code === 4001) {
      setNotification({
        show: true,
        title: 'Transaction Rejected',
        description: 'User rejected the transaction',
        isError: true,
        type: 'error'
      });
    } else {
      setNotification({
        show: true,
        title,
        description: error?.message.includes('not a function')
          ? '!! Something went wrong !!'
          : error?.reason || error?.message || 'Unknown error',
        isError: true,
        type: 'error'
      });
    }
    setTimeout(() => setNotification(prev => ({ ...prev, show: false })), 5000);
    console.error(title, error);
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
      if (window.ethereum && !connectionRequested) {
        setIsConnectingWallet(true);
        setConnectionRequested(true);
        
        try {
          const _provider = new ethers.providers.Web3Provider(window.ethereum);
          setProvider(_provider);
          
          try {
            const accounts = await window.ethereum.request({ 
              method: 'eth_requestAccounts'
            }).finally(() => {
              setConnectionRequested(false);
              setIsConnectingWallet(false);
            });
            
            if (!accounts) return;
            
            const _signer = await _provider.getSigner();
            setSigner(_signer);
            const addr = await _signer.getAddress();
            setAccount(addr);
            const _voting = new ethers.Contract(
              VOTING_CONTRACT_ADDRESS,
              votingAbi,
              _signer
            );
            setVoting(_voting);
            const _owner = await _voting.owner();
            setOwner(_owner);
            console.log('Connected account:', addr);
            console.log('Contract owner:', _owner);
            
            // Add token allowance check
            try {
              const tokenContract = new ethers.Contract(
                HELLO_TOKEN_ADDRESS,
                [
                  'function allowance(address owner, address spender) external view returns (uint256)'
                ],
                _signer
              );
              const allowance = await tokenContract.allowance(addr, VOTING_CONTRACT_ADDRESS);
              setNeedsApproval(allowance.lt(ethers.utils.parseEther(VOTE_FEE.toString())));
            } catch (error) {
              console.error('Error checking token allowance:', error);
              setNeedsApproval(true);
            }
            
            await fetchProposals(_voting);
            debugContractMethods(_voting); // Pass the contract instance
          } catch (error) {
            setConnectionRequested(false);
            setIsConnectingWallet(false);
            if (error.code === 4001) {
              const newNotif = {
                show: true,
                title: 'Connection Rejected',
                description: 'Please approve the connection to continue',
                isError: true,
                type: 'wallet',
                key: Date.now()
              };
              setNotification(newNotif);
              setTimeout(() => setNotification({ show: false }), 5000);
            } else {
              handleError('Connecting to MetaMask Failed');
            }
          }
        } catch (error) {
          setConnectionRequested(false);
          setIsConnectingWallet(false);
          handleError('Initialization Error');
        }
      } else if (!window.ethereum) {
        setNotification({
          show: true,
          title: 'Metamask is Not Connected',
          description: 'Please connect your wallet to interact with the voting system',
          isError: false,
          type: 'wallet'
        });
        setTimeout(() => setNotification({ show: false }), 5000);
      }
    };
    init();
  }, []);

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
    try {
      setIsTxPending(true);
      if (votedProposals.size > 0) {
        setNotification({
          show: true,
          title: 'Already Voted',
          description: 'You have already voted in this session',
          isError: true,
          type: 'error' // Changed to error type
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
      const tx = await voting.vote(displayId);
      await tx.wait();
      
      // Refresh data from contract
      await fetchProposals();
      
      // Update frontend state
      const allProposalIds = proposals.map(p => p.id);
      setVotedProposals(new Set(allProposalIds));
      
      setNotification({
        show: true,
        title: 'Success',
        description: 'Your vote has been recorded!',
        isError: false,
        type: 'default'
      });
      setTimeout(() => setNotification({ show: false }), 5000);
      
      setHasVoted(true);
    } catch (error) {
      if (error.message.includes('Already voted') || 
          error.reason?.includes('Already voted') ||
          error?.data?.message?.includes('Already voted')) {
        
        setNotification({
          show: true,
          title: 'Already Voted',
          description: 'You can only vote once per proposal',
          isError: true, // Changed to true for red color
          type: 'error', // Changed to error type
          key: Date.now()
        });
        setTimeout(() => setNotification({ show: false }), 5000);
        
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
  
  const handleCloseProposal = async (displayId) => {
    setTxStatus("Closing...");
    try {
      setIsTxPending(true);
      if (!voting) throw new Error("Voting contract not loaded.");
      // Find the original ID using the display ID
      const proposal = proposals.find(p => p.id === displayId);
      if (!proposal) throw new Error("Proposal not found");
      
      const tx = await voting.closeProposal(proposal.originalId);
      await tx.wait();
      setNotification('Proposal closed!', '');
      setTimeout(() => setNotification({ show: false }), 5000);
      await fetchProposals(voting);
    } catch (e) {
      handleError(e, 'Closing failed');
      setTimeout(() => setNotification({ show: false }), 5000);
      console.error("Close proposal error:", e);
    } finally {
      setIsTxPending(false);
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
        HELLO_TOKEN_ADDRESS,
        ['function balanceOf(address) view returns (uint256)'],
        signer
      );
      const balance = await tokenContract.balanceOf(account);
      const requiredBalance = ethers.utils.parseEther(PROPOSAL_FEE.toString());
      
      if (balance.lt(requiredBalance)) {
        throw new Error(`You need at least ${PROPOSAL_FEE} HLTK to create a proposal`);
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
      HELLO_TOKEN_ADDRESS,
      ['function allowance(address,address) view returns (uint256)'],
      signer
    );
    
    const allowance = await tokenContract.allowance(account, VOTING_CONTRACT_ADDRESS);
    const requiredTokens = ethers.utils.parseUnits(PROPOSAL_FEE.toString(), HLTK_DECIMALS);
    setNeedsApproval(allowance.lt(requiredTokens));
  };

  const approveTokens = async () => {
    if (!account || !signer) return;
    
    setApproving(true);
    setTxStatus({ message: 'Approving HLTK tokens...', isError: false });
    
    try {
      setIsTxPending(true);
      const tokenContract = new ethers.Contract(
        HELLO_TOKEN_ADDRESS,
        ['function approve(address,uint256)'],
        signer
      );
      
      const tx = await tokenContract.approve(
        VOTING_CONTRACT_ADDRESS,
        ethers.constants.MaxUint256 // Approve unlimited tokens
      );
      
      await tx.wait();
      setNeedsApproval(false);
      setNotification('HLTK tokens approved successfully!', '');
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

  return (
    <div className="voting-dashboard">
      {notification.show && notification.type === 'wallet' && (
        <div className="notification-wallet">
          <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
            <FaInfoCircle className="notification-wallet-icon" />
            <span style={{fontWeight: 'bold'}}>Connect Your Wallet</span>
          </div>
          <span>{notification.description}</span>
        </div>
      )}
      {notification.show && notification.type !== 'wallet' && (
        <div className={
          notification.type === 'error' ? "notification-error" :
          notification.type === 'info' ? "notification-info" :
          "notification-success"
        }>
          {notification.type === 'error' ? (
            <FaExclamationTriangle className="notification-error-icon" />
          ) : notification.type === 'info' ? (
            <FaInfoCircle className="notification-info-icon" />
          ) : (
            <FaCheck className="notification-icon" />
          )}
          <span>{notification.title}</span>
          <p>{notification.description}</p>
        </div>
      )}
      
      <div className="dashboard-header">
        <h1 className="dashboard-title">
          <FaVoteYea className="dashboard-title-icon" />
          Voting Dashboard
        </h1>
 
      </div>
      
      {/* Wallet Connection */}
      {!account ? (
        <div className="wallet-connected">
          <div className="flex">
            <div className="flex-shrink-0">
              <FaExclamationTriangle className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3">
              <h2 className="text-sm font-medium text-yellow-800">|| Connect Your Wallet ||</h2>
              <div className="mt-2 text-sm text-yellow-700">
                <p>You need to connect your wallet to interact with the voting system.</p>
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
                        debugContractMethods(_voting); // Pass the contract instance
                      } catch (e) {
                        setTxStatus(`Failed to connect wallet: ${e?.reason || e?.message || 'Unknown error'}`);
                      }
                    } else {
                      setTxStatus("MetaMask not detected. Please install MetaMask to continue.");
                    }
                  }}
                  className="mt-2 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                >
                  {isConnectingWallet ? (
                    <>
                      {isConnectingWallet && (
                        <div className="tx-loading-overlay">
                          <div className="tx-loading-content">
                            <FaSpinner className="animate-spin" size={48} />
                            <p>Processing Transaction...</p>
                            <small>Please confirm in MetaMask</small>
                          </div>
                        </div>
                      )}
                      Connecting...
                    </>
                  ) : 'Connect MetaMask'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="wallet-connected">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-green-800">|| Wallet Connected ||</h2>
              <div className="mt-1 text-sm text-green-700">
                <p>Connected as: <span className="font-mono">{account}</span></p>
              </div>
            </div>
            <button
              onClick={() => {
                setAccount("");
                setProvider(null);
                setSigner(null);
                setVoting(null);
              }}
              className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-full shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Disconnect
            </button>
          </div>
        </div>
      )}
 
      {/* How It Works */}
      <div className="info-card">
        <div className="info-header">
          <FaInfoCircle className="info-icon" />
          <h2 className="info-title">|| How It Works ||</h2>
        </div>
        <div className="info-content">
          <div className="info-items">
            <div className="info-item">
              <div className="info-bullet">
                <div className="bullet-point">
                  <div className="bullet-inner"></div>
                </div>
              </div>
              <p className="info-text">
                <span className="label-text">Voting:</span> Each vote costs 10 HLTK (sent to contract owner)
              </p>
            </div>
            <div className="info-item">
              <div className="info-bullet">
                <div className="bullet-point">
                  <div className="bullet-inner"></div>
                </div>
              </div>
              <p className="info-text">
                <span className="label-text">Proposals:</span> Creating a proposal costs 25 HLTK (sent to contract owner)
              </p>
            </div>
            <div className="info-item">
              <div className="info-bullet">
                <div className="bullet-point">
                  <div className="bullet-inner"></div>
                </div>
              </div>
              <p className="info-text">
                <span className="label-text">Gas fees:</span> You'll need Sepolia ETH for transaction fees
              </p>
            </div>
            <div className="info-item">
              <div className="info-bullet">
                <div className="bullet-point">
                  <div className="bullet-inner"></div>
                </div>
              </div>
              <p className="info-text">
                <span className="label-text">Voting period:</span> Each proposal is open for voting until its deadline
              </p>
            </div>
            <div className="info-item">
              <div className="info-bullet">
                <div className="bullet-point">
                  <div className="bullet-inner"></div>
                </div>
              </div>
              <p className="info-text">
                <span className="label-text">Results:</span> See the current leader in the "Who's winning?" section below
              </p>
            </div>
          </div>
        </div>
      </div>
      {/* Proposals Table */}
      <div className="proposals-table">
        <div className="table-header">
          <h2 className="text-lg leading-6 font-medium text-gray-900">|| Active Proposals ||</h2>
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
                {proposals.map((p) => {
                  const isOpen = !p.closed && now < p.deadline;
                  const isEnded = !p.closed && now >= p.deadline;
                  const status = p.closed ? 'Closed' : isEnded ? 'Ended' : 'Open';
                  
                  return (
                    <tr key={p.id} className={p.removed ? 'opacity-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">#{p.id}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                        <div className="font-medium">{p.description}</div>
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
                          {p.votes || 0}
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
                          
                          {account && isEnded && !p.closed && !p.removed && (
                            <button 
                              onClick={() => handleCloseProposal(p.id)} 
                              className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded-full text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                              Close
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
              title={'Costs 25 HLTK to create a proposal.'}
            >
              Create New Proposal
            </button>
            
            {account && owner === account && (
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
          </div>
        )}
      </div>
      {/* Add Proposal Form */}
      {showInput && (
        <div className="proposal-box">
          <h2>Create New Proposal</h2>
          <p>Costs {PROPOSAL_FEE} HLTK to create a proposal.</p>
          
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
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-xs font-medium rounded-full text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
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
          <h2>Remove Proposal</h2>
            <form onSubmit={handleRemoveProposal}>
              <input
                type="text"
                value={removeProposalName}
                onChange={(e) => setRemoveProposalName(e.target.value)}
                placeholder="Enter proposal name to remove"
                className="proposal-input"
                required
              />
            <button 
              type="submit" 
              disabled={removing}
              className="submit-btn"
            >
              {removing ? 'Removing...' : 'Remove Proposal'}
            </button>
          </form>
        </div>
      )}

      {/* Current Winner Section */}
      <div className="winner-box">
        <div className="winner-header">
          <h2>|| Current Winner ||</h2>
        </div>
        <div className="winner-content">
          {proposals.filter(p => !p.removed).length > 0 ? (
            <div>
              {(() => {
                try {
                  const validProposals = proposals.filter(p => typeof p.votes === 'number' && !isNaN(p.votes) && !p.removed);
                  if (!validProposals.length) return (
                    <p className="text-gray-500">No valid proposals to determine a winner.</p>
                  );
                  
                  const winner = validProposals.reduce((a, b) => (a.votes > b.votes ? a : b));
                  const isTie = validProposals.filter(p => p.votes === winner.votes).length > 1;
                  
                  return (
                    <div>
                      {isTie ? (
                        <p className="winner-name">
                          It's a tie between multiple proposals with {winner.votes} votes each!
                        </p>
                      ) : (
                        <>
                          <div className="winner-name">{winner.description}</div>
                          <div className="winner-votes">
                            {winner.votes} {winner.votes === 1 ? 'vote' : 'votes'}
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
            <p className="text-gray-500">No proposals have been created yet</p>
          )}
        </div>
      </div>
      {isTxPending && (
        <div className="tx-loading-overlay">
          <div className="tx-loading-content">
            <div className="loading-spinner"></div>
            <p>Processing Transaction...</p>
            <small>Please confirm in MetaMask</small>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoteDashboard;
