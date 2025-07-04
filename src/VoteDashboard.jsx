import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { FaInfoCircle, FaCheck, FaExclamationTriangle, FaVoteYea, FaClock, FaTimes, FaSpinner, FaChartBar, FaWallet, FaImage } from 'react-icons/fa';
import votingAbiData from './abi/Voting.json';
import Notification from './components/Notification';
import ProposalModal from './components/ProposalModal';
import { Link, useNavigate } from 'react-router-dom';
import './VoteDashboard.css';
import { getEthersProvider, parseEther, formatBigNumber } from './utils/ethersHelpers';
import VotingResultsChart from './VotingResultsChart';


// Parse ABI safely
const parseContractAbi = (abiData) => {
  try {
    // Check if the ABI is a string that needs to be parsed
    if (typeof abiData === 'string') {
      try {
        abiData = JSON.parse(abiData);
      } catch (e) {
        console.error('Failed to parse ABI string:', e);
        return [];
      }
    }
    
    // Handle case where ABI is an array of objects
    if (Array.isArray(abiData)) {
      return abiData;
    }
    
    // Handle case where ABI is nested under 'abi' property
    if (abiData.abi && Array.isArray(abiData.abi)) {
      return abiData.abi;
    }
    
    // Handle case where ABI is a single object
    return [abiData];
  } catch (e) {
    console.error('Error parsing contract ABI:', e);
    return [];
  }
};

// Parse the ABI
let votingAbi;
try {
  // Handle case where the ABI might be a JSON string
  const abiData = typeof votingAbiData === 'string' ? JSON.parse(votingAbiData) : votingAbiData;
  votingAbi = parseContractAbi(abiData);
  console.log('Parsed ABI:', votingAbi);
  
  // Add contract to window for debugging
  if (typeof window !== 'undefined') {
    window.votingAbi = votingAbi;
  }
} catch (error) {
  console.error('Failed to process voting ABI:', error);
  votingAbi = [];
}

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
  // Notification state
  const [notification, setNotification] = useState({
    show: false,
    title: '',
    message: '',
    type: 'info' // 'info', 'success', 'error', 'warning'
  });
  const [notificationTimeout, setNotificationTimeout] = useState(null);

  // Cleanup notification timeout on component unmount
  useEffect(() => {
    return () => {
      if (notificationTimeout) {
        clearTimeout(notificationTimeout);
      }
    };
  }, [notificationTimeout]);

  // Show notification function
  const showNotification = (title, message, type = 'info') => {
    // Clear any existing timeout
    if (notificationTimeout) {
      clearTimeout(notificationTimeout);
    }
    
    // Ensure we have a valid notification type
    const notificationType = ['success', 'error', 'warning', 'info'].includes(type) ? type : 'info';
    
    // Create a new notification object
    const newNotification = {
      show: true,
      title: title || '',
      message: message || '',
      type: notificationType
    };
    
    console.log('Showing notification:', newNotification);
    
    setNotification(newNotification);

    // Auto-hide after 5 seconds
    const timeoutId = setTimeout(() => {
      setNotification(prev => ({ ...prev, show: false }));
    }, 5000);
    
    setNotificationTimeout(timeoutId);
    
    // Return cleanup function
    return () => clearTimeout(timeoutId);
  };

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
  const [lastTransactionHash, setLastTransactionHash] = useState('');
  const [isOwner, setIsOwner] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [proposalName, setProposalName] = useState("");
  const [showNFTModal, setShowNFTModal] = useState(false);
  const navigate = useNavigate();

  // Cleanup notification timeout on unmount
  useEffect(() => {
    return () => {
      if (notificationTimeout) {
        clearTimeout(notificationTimeout);
      }
    };
  }, [notificationTimeout]);

  // Check if user is admin or owner
  const checkAdminStatus = useCallback(async () => {
    if (!voting || !account) return false;
    
    try {
      const contractOwner = await voting.owner();
      const isContractOwner = account.toLowerCase() === contractOwner.toLowerCase();
      setIsOwner(isContractOwner);
      
      if (isContractOwner) {
        setIsAdmin(true);
        return true;
      }
      
      // Check if the account is in the admin list
      const isUserAdmin = await voting.admins(account);
      setIsAdmin(isUserAdmin);
      return isUserAdmin;
    } catch (error) {
      console.error('Error checking admin status:', error);
      return false;
    }
  }, [voting, account]);

  // Check admin status when account or contract changes
  useEffect(() => {
    if (voting && account) {
      console.log('Account or contract changed, checking admin status...');
      checkAdminStatus();
    }
  }, [voting, account, checkAdminStatus]);

  // Function to load proposals
  const loadProposals = useCallback(async (votingContract) => {
    console.log('Starting to load proposals...');
    setLoading(true);
    
    try {
      console.log('Getting proposal count...');
      const count = await votingContract.proposalCount();
      const totalProposals = count.toNumber();
      console.log(`Found ${totalProposals} proposals to load`);
      
      if (totalProposals === 0) {
        console.log('No proposals found');
        setProposals([]);
        setProposalList([]);
        setLoading(false);
        return [];
      }
      
      const proposals = [];
      
      // Get all proposals using the getResults function
      for (let i = 1; i <= totalProposals; i++) {
        console.log(`Loading proposal ${i}/${totalProposals}`);
        
        try {
          // Use getResults to get proposal details
          const result = await votingContract.getResults(i);
          const [description, voteCount, closed, deadline, removed, creator] = result;
          
          // Determine the status based on the proposal's state
          const currentTime = Math.floor(Date.now() / 1000);
          const isExpired = deadline ? (Number(deadline) < currentTime) : false;
          
          let status = 'Open';
          if (removed) {
            status = 'Removed';
          } else if (closed) {
            status = 'Closed';
          } else if (isExpired) {
            status = 'Ended';
          }
          
          const proposalData = {
            id: i,
            name: `Proposal ${i}`, // The contract doesn't have a name field
            description: description || '',
            voteCount: voteCount ? voteCount.toNumber() : 0,
            deadline: deadline ? Number(deadline) : 0,
            creator: creator || ethers.constants.AddressZero,
            closed: closed || false,
            removed: removed || false,
            status: status
          };
          
          console.log(`Processed proposal ${i}:`, proposalData);
          proposals.push(proposalData);
        } catch (error) {
          console.error(`Error loading proposal ${i}:`, error);
          // Push a placeholder for failed loads
          proposals.push({
            id: i,
            name: `Proposal ${i} (Error Loading)`,
            description: 'Could not load proposal details',
            voteCount: 0,
            deadline: 0,
            creator: ethers.constants.AddressZero,
            closed: false,
            removed: false,
            error: true
          });
        }
      }
      
      console.log('Proposals loaded:', proposals);
      setProposals(proposals);
      setLoading(false); // Make sure to set loading to false when done
      setProposalList(proposals);
      return proposals;
    } catch (error) {
      console.error('Error loading proposals:', error);
      setError('Failed to load proposals');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize contract and check connection
  useEffect(() => {
    let isMounted = true;
    let provider, signer, votingContract;

    const initializeContract = async () => {
      try {
        if (!window.ethereum) {
          console.error('MetaMask not detected');
          showNotification('MetaMask Not Found', 'Please install MetaMask to use this application', 'warning');
          return;
        }

        // Initialize provider and signer
        provider = new ethers.providers.Web3Provider(window.ethereum);
        signer = provider.getSigner();
        
        if (!VOTING_CONTRACT_ADDRESS) {
          console.error('Contract address not found in environment variables');
          return;
        }

        console.log('Initializing contract with address:', VOTING_CONTRACT_ADDRESS);
        votingContract = new ethers.Contract(
          VOTING_CONTRACT_ADDRESS,
          votingAbi,
          signer
        );
        
        if (isMounted) {
          setVoting(votingContract);
          setSigner(signer);
          setProvider(provider);
          
          // Load proposals
          await loadProposals(votingContract);
          
          // Check if wallet is already connected
          const accounts = await provider.listAccounts();
          if (accounts.length > 0) {
            setAccount(accounts[0]);
          }
        }
      } catch (error) {
        console.error('Error initializing contract:', error);
        if (isMounted) {
          setError('Failed to connect to the blockchain');
        }
      }
    };

    // Handle account changes
    const handleAccountsChanged = async (accounts) => {
      console.log('Accounts changed:', accounts);
      if (!isMounted) return;
      
      if (accounts.length === 0) {
        setAccount('');
        setProposals([]);
        setProposalList([]);
      } else {
        const newAccount = accounts[0];
        setAccount(newAccount);
        
        // Reload proposals when account changes
        if (voting) {
          await loadProposals(voting);
        }
      }
    };

    // Initialize contract and set up event listeners
    const init = async () => {
      await initializeContract();
      
      if (window.ethereum) {
        // Set up event listeners
        window.ethereum.on('accountsChanged', handleAccountsChanged);
        
        // Handle chain changes
        window.ethereum.on('chainChanged', () => {
          window.location.reload();
        });
        
        // Request account access if needed
        try {
          const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
          if (accounts.length > 0) {
            setAccount(accounts[0]);
          }
        } catch (error) {
          console.error('Error requesting accounts:', error);
        }
      }
    };

    init();

    // Clean up
    return () => {
      isMounted = false;
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      }
    };
  }, [loadProposals]);

  // Fetch admin list
  const fetchAdmins = useCallback(async () => {
    if (!voting) return;
    
    try {
      const owner = await voting.owner();
      const admins = [owner];
      
      // If the contract has a getAdmins function, use it
      if (typeof voting.getAdmins === 'function') {
        const additionalAdmins = await voting.getAdmins();
        if (Array.isArray(additionalAdmins)) {
          // Filter out invalid addresses and the owner (already included)
          const validAdmins = additionalAdmins.filter(addr => 
            addr && 
            ethers.utils.isAddress(addr) && 
            addr.toLowerCase() !== owner.toLowerCase()
          );
          admins.push(...validAdmins);
        }
      }
      
      setAdminList(admins);
    } catch (error) {
      console.error('Error fetching admins:', error);
    }
  }, [voting, isOwner]);
  
  // Remove an admin
  const handleRemoveAdmin = async (adminAddress) => {
    if (!voting || !ethers.utils.isAddress(adminAddress)) return;
    
    try {
      setIsTxPending(true);
      const tx = await voting.removeAdmin(adminAddress);
      await tx.wait();
      showNotification('Success', 'Admin removed successfully', 'info');
      await fetchAdmins();
    } catch (error) {
      console.error('Error removing admin:', error);
      showNotification('Error', error.message || 'Failed to remove admin', 'error');
    } finally {
      setIsTxPending(false);
    }
  };

  // Notification component with icons
  const Notification = () => {
    if (!notification.show) return null;

    const notificationStyles = {
      info: {
        bg: 'bg-blue-100 border-blue-400 text-blue-700',
        icon: <FaInfoCircle className="text-blue-500 text-xl mr-2" />
      },
      success: {
        bg: 'bg-green-100 border-green-400 text-green-700',
        icon: <FaCheck className="text-green-500 text-xl mr-2" />
      },
      error: {
        bg: 'bg-red-100 border-red-400 text-red-700',
        icon: <FaExclamationTriangle className="text-red-500 text-xl mr-2" />
      },
      warning: {
        bg: 'bg-yellow-100 border-yellow-400 text-yellow-700',
        icon: <FaExclamationTriangle className="text-yellow-500 text-xl mr-2" />
      }
    };

    const style = notificationStyles[notification.type] || notificationStyles.info;

    return (
      <div className={`fixed top-4 right-4 p-4 rounded border-l-4 ${style.bg} shadow-lg z-50 min-w-64`}>
        <div className="flex items-start">
          <div className="flex-shrink-0">
            {style.icon}
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-start">
              <h3 className="font-bold">{notification.title}</h3>
              <button 
                onClick={() => setNotification(prev => ({ ...prev, show: false }))}
                className="ml-4 text-lg font-bold opacity-70 hover:opacity-100"
                aria-label="Close notification"
              >
                &times;
              </button>
            </div>
            <p className="text-sm mt-1">{notification.message}</p>
          </div>
        </div>
      </div>
    );
  };

  // Auto-hide notification after 5 seconds
  useEffect(() => {
    if (notification.show) {
      if (notificationTimeout) {
        clearTimeout(notificationTimeout);
      }
      const timeoutId = setTimeout(() => {
        setNotification(prev => ({ ...prev, show: false }));
      }, 5000);
      setNotificationTimeout(timeoutId);
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
          showNotification(
            'MetaMask Not Found',
            'Please install MetaMask to use this application',
            'warning'
          );
          setLoading(false);
          return;
        }
        
        try {
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
              
        // Show success notification
        showNotification(
          'Wallet Connected',
          'Your wallet has been successfully connected!',
          'success'
        );

        // Check admin status
        await checkAdminStatus();
        
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
        
          await Promise.all([
            fetchProposals(voting),
            isOwner && fetchAdmins()
          ]);
        } catch (error) {
          if (error.message === 'Please connect your wallet to continue') {
            showNotification(
              'Connection Rejected',
              'You need to connect your wallet to continue',
              'error'
            );
          } else {
            console.error('Connection error:', error);
            showNotification(
              'Connection Error',
              error.message || 'Failed to connect to wallet',
              'error'
            );
          }
        }
      } catch (error) {
        console.error('Initialization error:', error);
        showNotification(
          'Error',
          error.message || 'Failed to initialize application',
          'error'
        );
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
            id: i, // Use the actual proposal ID from blockchain
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
      setLoading(false);ss
    }
  };

  const checkTokenBalance = async (requiredAmount) => {
    try {
      const tokenContract = new ethers.Contract(
        VOTE_TOKEN_ADDRESS,
        ['function balanceOf(address) view returns (uint256)'],
        signer
      );
      const balance = await tokenContract.balanceOf(account);
      const requiredBalance = parseEther(ethers, requiredAmount.toString());
      
      if (balance.lt(requiredBalance)) {
        throw { 
          code: 'INSUFFICIENT_BALANCE', 
          message: `You need at least ${requiredAmount} VOTE tokens to perform this action` 
        };
      }
      return true;
    } catch (error) {
      console.error('Token balance check failed:', error);
      throw error;
    }
  };

  const handleVote = async (displayId) => {
    let tx;
    try {
      // Set initial loading state
      setIsTxPending(true);
      setTxStatus('Checking token balance...');
      
      // Check token balance first
      await checkTokenBalance(VOTE_FEE);
      
      if (votedProposals.size > 0) {
        showNotification('Already Voted', 'You have already voted in this session', 'error');
        return;
      }
      
      // Check token approval
      if (needsApproval) {
        // Set loading state for token approval
        setIsVotingLoading(true);
        setTxStatus('Approving tokens. Please confirm in your wallet...');
        
        try {
          await approveTokens();
          setNeedsApproval(false);
          showNotification('Success', 'Token approval successful', 'success');
          
          // Update status and add small delay for UX
          setTxStatus('Token approved. Processing your vote...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } catch (error) {
          console.error('Token approval failed:', error);
          showNotification('Error', 'Token approval failed. Please try again.', 'error');
          throw error; // Re-throw to be caught by the outer catch
        } finally {
          // Only clear the loading state if we're not proceeding to vote
          if (needsApproval) {
            setIsVotingLoading(false);
            setIsTxPending(false);
          }
        }
      }
      
      // Set voting loading state
      setTxStatus('Processing your vote. Please confirm in your wallet...');
      setIsVotingLoading(true);
      
      // Submit vote
      try {
        tx = await voting.vote(displayId);
        setTxStatus('Waiting for transaction confirmation. This may take a moment...');
        const receipt = await tx.wait();
        setLastTransactionHash(receipt.transactionHash);
      } catch (error) {
        console.error('Voting failed:', error);
        showNotification('Error', 'Voting failed. Please try again.', 'error');
        throw error; // Re-throw to be caught by the outer catch
      }
      
      // Update UI with success state
      setTxStatus('Updating voting data...');
      
      // Refresh data from contract
      await fetchProposals(voting);
      debugContractMethods(voting);
      
      // Update frontend state
      const allProposalIds = proposals.map(p => p.id);
      setVotedProposals(new Set(allProposalIds));
      
      // Show success notification
      showNotification('Success', 'Your vote has been recorded!', 'success');
      
      // Show NFT modal
      setShowNFTModal(true);
      
      // Update token balance after successful vote
      try {
        await checkTokenBalance(VOTE_FEE);
      } catch (error) {
        // Just log the error, don't fail the vote
        console.warn('Failed to check token balance after vote:', error);
        showNotification('Warning', 'You may not have enough tokens for another vote', 'warning');
      }
      
      setHasVoted(true);
      // No need to reload the page, we've already updated the state
      // window.location.reload();
    } catch (error) {
      console.error('Voting error:', error);
      
      if (error.code === 4001 || error.code === 'ACTION_REJECTED') {
        // User rejected the transaction
        showNotification('Transaction Rejected', 'You rejected the transaction', 'error');
      } else if (error.message.includes('Already voted') || 
                error.reason?.includes('Already voted') ||
                error?.data?.message?.includes('Already voted')) {
        showNotification('Already Voted', 'You can only vote once per proposal', 'error');
        // Sync voting state
        const allProposalIds = proposals.map(p => p.id);
        setVotedProposals(new Set(allProposalIds));
      } else {
        showNotification('Voting Failed', error.reason || error.message || 'An error occurred while voting', 'error');
      }
    } finally {
      setIsVotingLoading(false);
      setIsTxPending(false);
      setTxStatus('');
    }
  };
  const checkProposalExists = async (proposalName) => {
    // First check in local state (fastest)
    const normalizedInput = proposalName.toLowerCase();
    const existingProposal = proposals.find(p => 
      p.description.toLowerCase() === normalizedInput
    );

    if (existingProposal) {
      return { exists: true, removed: existingProposal.removed };
    }

    // If not found locally, try to check directly by name (single blockchain call)
    try {
      // Try to get the proposal by name (if such a view function exists in your contract)
      const proposalId = await voting.getProposalIdByName(proposalName);
      if (proposalId > 0) {
        const [, , , , removed] = await voting.getResults(proposalId);
        return { exists: true, removed };
      }
    } catch (err) {
      console.log('Error checking proposal by name, falling back to other methods', err);
    }

    // Fallback: Check if we have any proposals in the current view that match
    const matchingProposal = proposals.find(p => 
      p.description.toLowerCase().includes(normalizedInput)
    );

    // If we have a partial match, it might be the same proposal with different case
    if (matchingProposal) {
      return { 
        exists: true, 
        removed: matchingProposal.removed,
        suggestion: matchingProposal.description
      };
    }

    return { exists: false };
  };

  const handleRemoveProposal = async (e) => {
    e.preventDefault();
    
    if (!removeProposalName.trim()) {
      showNotification('Error', 'Please enter a proposal name', 'error');
      return;
    }

    setRemoving(true);
    setTxStatus("Verifying proposal...");
    
    try {
      if (!voting) throw new Error("Voting contract not loaded");
      
      // Check proposal status (fast local check first)
      const { exists, removed, suggestion } = await checkProposalExists(removeProposalName);
      
      if (!exists) {
        throw { 
          code: 'PROPOSAL_NOT_FOUND', 
          message: suggestion 
            ? `Proposal not found. Did you mean "${suggestion}"?`
            : `Proposal "${removeProposalName}" not available`
        };
      }
      
      if (removed) {
        throw { 
          code: 'PROPOSAL_ALREADY_REMOVED', 
          message: `Proposal "${removeProposalName}" has already been removed` 
        };
      }
      
      // Only proceed with transaction if all checks pass
      setTxStatus("Removing proposal...");
      setIsTxPending(true);
      
      try {
        const tx = await voting.removeProposalByName(removeProposalName);
        await tx.wait();
        
        showNotification('Success', `Proposal "${removeProposalName}" removed successfully`, 'success');
        
        setShowRemoveForm(false);
        setRemoveProposalName('');
        await loadProposals(voting);
      } catch (txError) {
        console.error('Transaction error:', txError);
        
        // Handle specific contract errors
        if (txError.message?.includes('Proposal already removed')) {
          throw { 
            code: 'PROPOSAL_ALREADY_REMOVED', 
            message: `Proposal "${removeProposalName}" was just removed by another transaction` 
          };
        }
        throw txError; // Re-throw to be caught by the outer catch
      }
    } catch (err) {
      console.error('Remove proposal error:', err);
      
      if (err.code === 4001 || err.code === 'ACTION_REJECTED') {
        showNotification('Transaction Rejected', 'You rejected the transaction', 'error');
      } else if (err.code === 'PROPOSAL_ALREADY_REMOVED') {
        showNotification('Proposal Already Removed', err.message, 'warning');
      } else if (err.code === 'PROPOSAL_NOT_FOUND') {
        showNotification('Proposal Not Available', err.message, 'error');
      } else if (err.message?.includes('Proposal does not exist')) {
        showNotification('Proposal Not Found', `Proposal "${removeProposalName}" does not exist`, 'error');
      } else if (err.message?.includes('Proposal already removed')) {
        showNotification('Already Removed', `Proposal "${removeProposalName}" has already been removed by admin`, 'warning');
      } else {
        showNotification('Error', err.reason || err.message || 'Failed to remove proposal', 'error');
      }
    } finally {
      setIsTxPending(false);
      setRemoving(false);
      setTxStatus('');
    }
  };
  
  const now = Math.floor(Date.now() / 1000);

  const handleCreateProposal = async (e) => {
    e.preventDefault();
    if (!proposalName.trim()) {
      showNotification('Validation Error', 'Proposal name cannot be empty', 'error');
      return;
    }
    
    try {
      setIsCreatingProposal(true);
      setTxStatus('Checking wallet and balance...');
      
      // Check if wallet is connected
      if (!account) {
        throw { code: 'NO_ACCOUNT', message: 'Please connect your wallet first' };
      }
      
      // Check token balance first
      await checkTokenBalance(PROPOSAL_FEE);
      
      // Handle token approval if needed
      if (needsApproval) {
        try {
          setTxStatus('Approving VOTE tokens...');
          await approveTokens();
          setNeedsApproval(false);
          // Small delay to ensure the approval is processed
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          if (error.code === 4001 || error.code === 'ACTION_REJECTED') {
            throw { code: 'REJECTED_APPROVAL', message: 'Token approval was rejected' };
          }
          throw error;
        }
      }
      
      // Create the proposal
      try {
        setTxStatus('Creating proposal...');
        setIsTxPending(true);
        const tx = await voting.createProposal(proposalName);
        const receipt = await tx.wait();
        
        // Update token balance after successful proposal creation
        try {
          await checkTokenBalance(PROPOSAL_FEE);
        } catch (error) {
          // Just log the error, don't fail the proposal creation
          console.warn('Failed to check token balance after proposal creation:', error);
        }
        
        showNotification('Success', 'Proposal created successfully!', 'success');
        setProposalName('');
        setShowInput(false);
        await fetchProposals(voting);
      } catch (error) {
        if (error.code === 4001 || error.code === 'ACTION_REJECTED') {
          throw { code: 'TRANSACTION_REJECTED', message: 'Transaction was rejected' };
        }
        throw error;
      }
    } catch (error) {
      console.error('Create proposal error:', error);
      
      // Handle specific error cases
      if (error.code === 'NO_ACCOUNT') {
        showNotification('Wallet Not Connected', 'Please connect your wallet first', 'error');
      } else if (error.code === 'INSUFFICIENT_BALANCE') {
        showNotification('Insufficient Balance', error.message, 'error');
      } else if (error.code === 'NETWORK_ERROR') {
        showNotification('Network Error', 'Failed to connect to the blockchain. Please check your connection.', 'error');
      } else if (error.code === 'REJECTED_APPROVAL') {
        showNotification('Approval Rejected', 'Token approval was rejected', 'error');
      } else if (error.code === 'TRANSACTION_REJECTED') {
        showNotification('Transaction Rejected', 'You rejected the transaction', 'error');
      } else if (error.message?.includes('user rejected transaction')) {
        showNotification('Transaction Rejected', 'You rejected the transaction', 'error');
      } else if (error.code === 'CALL_EXCEPTION') {
        showNotification('Transaction Failed', 'The transaction failed. Please try again.', 'error');
      } else if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
        showNotification('Transaction Error', 'Failed to estimate gas. Please try again.', 'error');
      } else if (error.message?.includes('MetaMask Tx Signature: User denied transaction signature')) {
        showNotification('Transaction Rejected', 'You rejected the transaction', 'error');
      } else if (error.message?.includes('already voted')) {
        showNotification('Already Voted', 'You have already voted on this proposal', 'error');
      } else if (error.message) {
        // Generic error handling
        showNotification('Error', error.message, 'error');
      } else {
        showNotification('Error', 'An unknown error occurred. Please try again.', 'error');
      }
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
    setTxStatus('Approving VOTE tokens...');
    
    try {
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
      showNotification('Success', 'VOTE tokens approved successfully!', 'success');
      return true;
    } catch (error) {
      console.error('Approval error:', error);
      if (error.code === 4001 || error.code === 'ACTION_REJECTED') {
        throw { code: 'REJECTED_APPROVAL', message: 'Token approval was rejected' };
      }
      throw error;
      
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
      const voting = new ethers.Contract(
        VOTING_CONTRACT_ADDRESS,
        votingAbi,
        signer
      );
      
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
        const totalVotes = res[1];
        const closed = res[2];
        const deadline = Number(res[3]) || 0;
        const removed = res[4];
        const creator = res[5];
        
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
        
        proposals.push({
          id: i,
          description,
          votes: totalVotes,
          closed,
          deadline,
          removed,
          creator,
          status,
        });
      } catch (err) {
        console.warn(`Failed to fetch proposal ${i}:`, err);
      }
    }
    
    // Sort by status (Open -> Ended -> Removed) and then by deadline within each status
    const sortedProposals = proposals.sort((a, b) => {
      // Define the order of statuses
      const statusOrder = { 'Open': 0, 'Ended': 1, 'Removed': 2 };
      
      // Get the status values for comparison
      const statusA = a.removed ? 'Removed' : a.status;
      const statusB = b.removed ? 'Removed' : b.status;
      
      // First sort by status
      if (statusOrder[statusA] !== statusOrder[statusB]) {
        return statusOrder[statusA] - statusOrder[statusB];
      }
      
      // If status is the same, sort by deadline (earliest first)
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
            disabled={!account}
          >
            Vote Dashboard
          </button>
          <button 
            onClick={openProposalModal} 
            className="nav-link"
            disabled={!account}
          >
            Proposal Details
          </button>
          <button
            onClick={() => window.location.href = "/my-votes"}
            className="nav-link"
            disabled={!account}
          >
            My Votes
          </button>
          <button
            onClick={() => window.location.href = "/my-nfts"}
            className="nav-link"
            disabled={!account}
          >
            My NFTs
          </button>
          {isOwner && (
            <button
              onClick={() => window.location.href = "/admin-panel"}
              className="nav-link"
              disabled={!account}
            >
              Admin Panel
            </button>
          )}
        </div>
      </nav>

      {notification.show && (
        <div className={`notification notification-${notification.type || 'info'}`}>
          <div className="notification-content">
            {notification.type === 'error' ? (
              <FaExclamationTriangle className="notification-icon" />
            ) : notification.type === 'info' ? (
              <FaInfoCircle className="notification-icon" />
            ) : notification.type === 'warning' ? (
              <FaExclamationTriangle className="notification-icon" />
            ) : (
              <FaCheck className="notification-icon" />
            )}
            <div>
              {notification.title && <span className="notification-title">{notification.title}</span>}
              {notification.message && <p className="notification-message">{notification.message}</p>}
            </div>
          </div>
        </div>
      )}
      
      {/* Show Loading overlay for proposal viewing, not during wallet/tx loading */}
      {isProposalLoading && !isConnectingWallet && !isTxPending && (
        <>
        <div className='loading-overlay'>
          <div className="loading-spinner"></div>
          Loading Proposal...
          </div>
        </>
      )}
      
      {/* Wallet Connection */}
      {isConnectingWallet && (
        <div className="wallet-connecting-overlay">
          <div className="wallet-connecting-content">
            <div className="loading-spinner"></div>
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
            <div style={{ width: '100%', textAlign: 'center' }}>
              <h2 className="wallet-header">Welcome to Voting DApp</h2>
              <div className="wallet-box" style={{ margin: '20px auto', maxWidth: '400px' }}>
                <FaWallet className="wallet-icon" style={{ fontSize: '48px', marginBottom: '15px' }} />
                <p className="wallet-address" style={{ fontSize: '18px', marginBottom: '20px' }}>Wallet Not Connected</p>
              </div>
              <p className="mt-1 text-md" style={{ color: '#f59e0b', fontWeight: 500, marginBottom: '30px' }}>
                Please connect your wallet to view proposals and vote
              </p>
              <button
                onClick={async () => {
                  if (window.ethereum) {
                    setIsConnectingWallet(true);
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
                      await loadProposals(_voting);
                    } catch (e) {
                      console.error('Error connecting wallet:', e);
                      setError(`Failed to connect wallet: ${e?.reason || e?.message || 'Unknown error'}`);
                    } finally {
                      setIsConnectingWallet(false);
                    }
                  } else {
                    setError("MetaMask not detected. Please install MetaMask to continue.");
                  }
                  window.location.reload();
                }}
                className="connect-wallet-btn"
                disabled={isConnectingWallet}
                style={{
                  backgroundColor: '#f59e0b',
                  color: 'white',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto',
                  minWidth: '200px',
                  transition: 'background-color 0.2s',
                }}
              >
                {isConnectingWallet ? (
                  <>
                    <FaSpinner className="animate-spin mr-2" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <FaWallet className="mr-2" />
                    Connect Wallet
                  </>
                )}
              </button>
              
              <div style={{ marginTop: '40px', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px', maxWidth: '600px', margin: '40px auto 0' }}>
                <h3 style={{ color: '#4a5568', marginBottom: '15px' }}>How to get started</h3>
                <ol style={{ textAlign: 'left', paddingLeft: '20px' }}>
                  <li>Install MetaMask extension</li>
                  <li>Connect your wallet using the button above</li>
                  <li>View and vote on active proposals</li>
                </ol>
              </div>
            </div>
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
        window.location.reload();
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
      
      {/* Proposals Table - Only show when wallet is connected */}
      {account && (
        <div className="proposals-table">
          <div className="table-header">
            <h2 className="active-proposals-header" style={{marginBottom: '1rem'}}>Active Proposals</h2>
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
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time Remaining</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Votes</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {proposals.map((p, index) => {
                  const isOpen = !p.closed && now < p.deadline;
                  const isEnded = !p.closed && now >= p.deadline;
                  const status = p.closed ? 'Closed' : isEnded ? 'Ended' : 'Open';
                  const displayNumber = p.id; // Sequential number starting from 1
                  
                  return (
                    <tr key={p.id} className={p.removed ? 'opacity-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">#{displayNumber}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                        <div className="font-medium"> {p.description} </div>
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
                              onClick={() => {handleVote(p.id)}}
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
      )}
      {/* Admin Controls and Create Proposal */}
      {account && (
        <div className="space-y-4 mb-6">
          <div className="flex flex-wrap gap-4">
            {(isOwner || isAdmin) && !showInput && !showRemoveForm && (
              <>
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
                
                <button
                  onClick={() => {
                    setShowRemoveForm(true);
                    setShowInput(false);
                  }}
                  className="remove-proposal-btn"
                >
                  Remove Proposal
                </button>
              </>
            )}
          </div>

        {/* Create Proposal Form */}
        {showInput && (
          <div className="proposal-form-container">
            <h2 className="proposal-form-title">Create New Proposal</h2>
            <p className="proposal-form-text">Costs {formatBigNumber(PROPOSAL_FEE)} VOTE to create a proposal.</p>
            
            <form onSubmit={handleCreateProposal}>
              <div>
                <input
                  id="proposalName"
                  type="text"
                  value={proposalName}
                  onChange={(e) => {
                    if (e.target.value.length <= 20) {
                      setProposalName(e.target.value);
                      setError(null);
                    } else {
                      setError('Proposal length more than 20 characters');
                    }
                  }}
                  placeholder="Enter Proposal Name.."
                  className="proposal-form-input"
                  required
                  maxLength={20}
                />
                {proposalName.length > 20 && (
                  <p className="text-red-500 text-sm mt-1">Proposal length more than 20 characters</p>
                )}
                <p className="text-sm text-gray-500 mt-1">{proposalName.length}/20 characters</p>
              </div>
              <div className="proposal-form-actions">
                <button
                  type="submit"
                  disabled={isCreatingProposal || proposalName.length > 20 || proposalName.trim() === ''}
                  className={`proposal-form-button proposal-form-submit ${
                    isCreatingProposal || proposalName.length > 20 || proposalName.trim() === '' ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {isCreatingProposal ? (
                    <>
                      Creating...
                    </>
                  ) : 'Create Proposal'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowInput(false)}
                  className="proposal-form-button proposal-form-cancel"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
        </div>
      )}

      {showRemoveForm && (
        <div className="proposal-form-container">
          <h2 className="proposal-form-title">Remove Proposal</h2>
          <p className="proposal-form-text">Proposal Remove by Name.</p>
          <form onSubmit={handleRemoveProposal}>
            <div>
              <input
                id="removeProposalName"
                type="text"
                value={removeProposalName}
                onChange={(e) => setRemoveProposalName(e.target.value)}
                placeholder="Enter the Proposal Name...."
                className="proposal-form-input"
                required
                autoFocus
              />
            </div>
            
            <div className="proposal-form-actions">
              <button
                type="submit"
                disabled={removing || !removeProposalName.trim()}
                className="proposal-form-button proposal-form-submit"
              >
                {removing ? (
                  <>
                    Removing...
                  </>
                ) : 'Remove Proposal'}
              </button>
              
              <button
                type="button"
                onClick={() => {
                  setShowRemoveForm(false);
                  setRemoveProposalName('');
                }}
                className="proposal-form-button proposal-form-cancel"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}


      {/* Current Winner Section - Only show when wallet is connected and there are active proposals */}
      {account && proposals.filter(p => !p.removed).length > 0 && (
        <div className="winner-box">
          <div className="winner-header">
            <h2><FaChartBar className="inline mr-2" /> Current Leader</h2>
          </div>
          <div className="winner-content">
            {(() => {
              try {
                const validProposals = proposals.filter(p => typeof p.votes === 'number' && !isNaN(p.votes) && !p.removed);
                if (!validProposals.length) return (
                  <p className="text-gray-500" style={{ fontSize: '1rem', textAlign: 'center' }}>No valid proposals to determine a leader.</p>
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
                        <div className="winner-name" style={{ fontSize: '1rem', textAlign: 'center' }}>
                          {winner.description}
                        </div>
                        <div className="winner-votes" style={{ fontSize: '1rem', textAlign: 'center' }}>
                          {formatBigNumber(winner.votes)} {winner.votes === 1 ? 'vote' : 'votes'}
                        </div>
                      </>
                    )}
                  </div>
                );
              } catch (e) {
                return <p className="text-gray-500">Error determining leader</p>;
              }
            })()}
          </div>
        </div>
      )}

      {/* Voting Results Chart - Only show when wallet is connected and there are active proposals */}
      {account && proposals.filter(p => !p.removed).length > 0 && (
        <div className="chart-box mt-6">
          <div className="chart-header">
            <h2><FaChartBar className="inline mr-2" />Voting Results</h2>
          </div>
          <div className="chart-content">
            <VotingResultsChart proposals={proposals} />
          </div>
        </div>
      )}

      {isTxPending && (
        <div className="tx-loading-overlay">
          <div className="tx-loading-content">
            <div className="loading-spinner"></div>
            <p>Processing Transaction...</p>
            <small>Please confirm in MetaMask</small>
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

export default VoteDashboard;