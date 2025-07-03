import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import Voting from './abi/Voting.json';
import { CONFIG } from './utils/config';
import { getEthersProvider, parseContractAbi } from './utils/ethersHelpers';
import Notification from './components/Notification';
import TransactionOverlay from './components/TransactionOverlay';
import './AdminPanel.css';

// Parse the ABI
let votingAbi;
try {
  votingAbi = parseContractAbi(Voting);
} catch (error) {
  console.error('Error parsing contract ABI:', error);
  votingAbi = [];
}

// Format Ethereum address to show first 4 and last 4 characters
const formatAddress = (address) => {
  if (!address || address.length < 10) return address;
  return `${address.substring(0, 7)}...${address.substring(address.length - 7)}`;
};

const AdminPanel = () => {
  const [account, setAccount] = useState('');
  const [adminAddress, setAdminAddress] = useState('');
  const [adminList, setAdminList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingAdmin, setIsAddingAdmin] = useState(false);
  const [isRemovingAdmin, setIsRemovingAdmin] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState(null);
  const [transactionMessage, setTransactionMessage] = useState('');
  const [showTransactionOverlay, setShowTransactionOverlay] = useState(false);
  
  // Transaction handlers
  const handleTransactionStart = () => {
    setShowTransactionOverlay(true);
    setTransactionStatus('loading');
  };

  const handleTransactionSuccess = (message) => {
    setTransactionStatus('success');
    setTransactionMessage(message);
  };

  // Parse transaction errors into user-friendly messages
  const parseTransactionError = (error) => {
    console.error('Transaction error:', error);
    
    // Handle user rejected transaction
    if (error.code === 4001 || error.code === 'ACTION_REJECTED' || error.message?.includes('user rejected transaction')) {
      return 'User Rejected the Transaction';
    }
    
    // Handle insufficient gas
    if (error.message?.includes('insufficient funds') || error.message?.includes('insufficient gas')) {
      return 'Insufficient Gas in Your Wallet';
    }
    
    // Handle common contract errors
    if (error.reason) {
      return error.reason;
    }
    
    // Handle network errors
    if (error.code === 'NETWORK_ERROR' || error.message?.includes('network error')) {
      return 'Network Error. Please Check Your Connection';
    }
    
    // Default fallback
    return 'Something went wrong with the Transaction';
  };

  const handleTransactionError = (error) => {
    const userFriendlyError = parseTransactionError(error);
    setTransactionStatus('error');
    setTransactionMessage(userFriendlyError);
    return userFriendlyError;
  };

  const handleClose = () => {
    setShowTransactionOverlay(false);
    setTransactionStatus(null);
    setTransactionMessage('');
  };

  // Notification state
  const [notification, setNotification] = useState({
    show: false,
    title: '',
    message: '',
    type: 'info' // 'success', 'error', 'warning', 'info'
  });
  
  const showNotification = useCallback((title, message, type = 'info') => {
    // Close any existing notification first
    setNotification(prev => ({ ...prev, show: false }));
    
    // Small delay to ensure the previous notification is fully hidden
    setTimeout(() => {
      setNotification({
        show: true,
        title,
        message,
        type
      });
      
      // Auto-hide after 5 seconds
      const timer = setTimeout(() => {
        setNotification(prev => ({
          ...prev,
          show: false
        }));
      }, 5000);
      
      return () => clearTimeout(timer);
    }, 100);
  }, []);
  
  const closeNotification = () => {
    setNotification(prev => ({ ...prev, show: false }));
  };

  const [isAdmin, setIsAdmin] = useState(false);
  const [contract, setContract] = useState(null);
  const [owner, setOwner] = useState('');
  const [isTransactionInProgress, setIsTransactionInProgress] = useState(false);
  const [transactionHash, setTransactionHash] = useState(null);

  const init = useCallback(async () => {
    try {
      // Check if contract address is set
      if (!CONFIG.VOTING_CONTRACT_ADDRESS) {
        throw new Error('Voting contract address is not configured. Please check your .env file.');
      }

      const provider = await getEthersProvider();
      if (!provider) {
        throw new Error('Failed to connect to Ethereum provider');
      }

      const signer = provider.getSigner();
      const userAddress = await signer.getAddress();
      setAccount(userAddress);

      console.log('Using contract address:', CONFIG.VOTING_CONTRACT_ADDRESS);
      
      // Initialize contract
      const votingContract = new ethers.Contract(
        CONFIG.VOTING_CONTRACT_ADDRESS,
        votingAbi,
        signer
      );
      setContract(votingContract);
      
      // Expose to window for debugging
      if (typeof window !== 'undefined') {
        window.reactContract = votingContract;
        window.votingAbi = votingAbi;
      }

      // Get contract owner
      const contractOwner = await votingContract.owner();
      setOwner(contractOwner);

      // Debug loggings
      console.log('Debug Info:');
      console.log('Connected Address:', userAddress);
      console.log('Contract Owner:', contractOwner);
      console.log('Addresses match:', userAddress.toLowerCase() === contractOwner.toLowerCase());
      
      // Check if user is the contract owner
      const isUserOwner = userAddress.toLowerCase() === contractOwner.toLowerCase();
      setIsAdmin(isUserOwner);
      
      console.log('Is Owner:', isUserOwner);
      
      // Fetch all admins from the contract
      const fetchAdmins = async () => {
        try {
          // Start with the owner
          const admins = [contractOwner];
          
          // Get all admin events to find all addresses that were ever made admins
          const adminAddedFilter = votingContract.filters.AdminAdded();
          const adminRemovedFilter = votingContract.filters.AdminRemoved();
          
          // Get all AdminAdded and AdminRemoved events
          const [addedEvents, removedEvents] = await Promise.all([
            votingContract.queryFilter(adminAddedFilter),
            votingContract.queryFilter(adminRemovedFilter)
          ]);
          
          // Create a map to track admin status
          const adminStatus = new Map();
          const allAddresses = new Set();
          
          // Collect all unique addresses from events
          addedEvents.forEach(event => allAddresses.add(event.args.admin.toLowerCase()));
          removedEvents.forEach(event => allAddresses.add(event.args.admin.toLowerCase()));
          
          // Check admin status directly from the contract for each address
          for (const address of allAddresses) {
            try {
              const isAdmin = await votingContract.admins(address);
              adminStatus.set(address, isAdmin);
              console.log(`Direct check - ${address}: ${isAdmin ? 'Admin' : 'Not Admin'}`);
            } catch (error) {
              console.error(`Error checking admin status for ${address}:`, error);
            }
          }
          
          // Add all current admins to the list
          adminStatus.forEach((isAdmin, address) => {
            if (isAdmin) {
              const checksumAddress = ethers.utils.getAddress(address);
              if (address !== contractOwner.toLowerCase()) {
                admins.push(checksumAddress);
              }
            }
          });
          
          // Remove duplicates and validate addresses
          const uniqueAdmins = [...new Set(admins)].filter(addr => 
            addr && ethers.utils.isAddress(addr)
          );
          
          console.log('=== Final Admin List ===');
          console.log('Owner:', contractOwner);
          console.log('Admins:', uniqueAdmins);
          
          setAdminList(uniqueAdmins);
          setIsLoading(false);
        } catch (error) {
          console.error('Error fetching admins:', error);
          setIsLoading(false);
        }
      };

      await fetchAdmins();

      // Set up event listeners
      votingContract.on('AdminAdded', (admin, event) => {
        console.log('AdminAdded event:', admin, event);
        fetchAdmins();
      });

      votingContract.on('AdminRemoved', (admin, event) => {
        console.log('AdminRemoved event:', admin, event);
        fetchAdmins();
      });

      return () => {
        if (votingContract) {
          votingContract.removeAllListeners();
        }
      };
    } catch (error) {
      console.error('Error initializing:', error);
      setIsLoading(false);
      const userFriendlyError = parseTransactionError(error);
      showNotification('Error', userFriendlyError, 'error');
    }
  }, [setNotification]);

  useEffect(() => {
    init();
    return () => {
      if (contract) {
        contract.removeAllListeners();
      }
    };
  }, [init]);

  const handleAddAdmin = async (e) => {
    e.preventDefault();
    const address = adminAddress.trim();
    
    if (!ethers.utils.isAddress(address)) {
      showNotification('Error', 'Please enter a valid Ethereum address', 'error');
      return;
    }

    if (address.toLowerCase() === account?.toLowerCase()) {
      showNotification('Warning', 'You are already an admin', 'warning');
      return;
    }

    try {
      handleTransactionStart();
      const tx = await contract.addAdmin(address);
      await tx.wait();
      handleTransactionSuccess('Admin added successfully');
      showNotification('Success', 'Admin added successfully', 'success');
      setAdminAddress('');
      await loadAdmins();
    } catch (error) {
      const userFriendlyError = handleTransactionError(error);
      if (userFriendlyError.includes('Already an admin')) {
        showNotification('Warning', 'You are already an admin', 'warning');
      } else {
        showNotification('Error', userFriendlyError, 'error');
      }
    } finally {
      setIsAddingAdmin(false);
    }
  };

  const handleRemoveAdmin = async (address) => {
    if (!window.confirm('Are you sure you want to remove this admin?')) {
      return;
    }

    try {
      handleTransactionStart();
      const tx = await contract.removeAdmin(address);
      await tx.wait();
      handleTransactionSuccess('Admin removed successfully');
      showNotification('Success', 'Admin removed successfully', 'success');
      await loadAdmins();
    } catch (error) {
      const userFriendlyError = handleTransactionError(error);
      showNotification('Error', userFriendlyError, 'error');
    } finally {
      setIsRemovingAdmin(false);
    }
  };

  const loadAdmins = useCallback(async () => {
    if (!contract) {
      console.log('Contract not initialized yet');
      return;
    }

    try {
      const admins = [owner];
      const adminStatus = new Map();
      const allAddresses = new Set();

      const adminAddedFilter = contract.filters.AdminAdded();
      const adminRemovedFilter = contract.filters.AdminRemoved();

      const [addedEvents, removedEvents] = await Promise.all([
        contract.queryFilter(adminAddedFilter),
        contract.queryFilter(adminRemovedFilter)
      ]);

      addedEvents.forEach(event => allAddresses.add(event.args.admin.toLowerCase()));
      removedEvents.forEach(event => allAddresses.add(event.args.admin.toLowerCase()));

      for (const address of allAddresses) {
        try {
          const isAdmin = await contract.admins(address);
          adminStatus.set(address, isAdmin);
        } catch (error) {
          console.error(`Error checking admin status for ${address}:`, error);
        }
      }

      adminStatus.forEach((isAdmin, address) => {
        if (isAdmin) {
          const checksumAddress = ethers.utils.getAddress(address);
          if (address !== owner.toLowerCase()) {
            admins.push(checksumAddress);
          }
        }
      });

      const uniqueAdmins = [...new Set(admins)].filter(addr => 
        addr && ethers.utils.isAddress(addr)
      );

      setAdminList(uniqueAdmins);
    } catch (error) {
      console.error('Error loading admins:', error);
    }
  }, [contract, owner, setAdminList]);


  useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);

  if (!isAdmin) {
    return (
      <div className="admin-panel">
        <div className="nav-buttons">
          <button onClick={() => window.location.href = '/'} className="nav-button">
            Home
          </button>
          <button onClick={() => window.location.href = '/vote'} className="nav-button">
            Vote Dashboard
          </button>
        </div>
        <h2>Admin Panel</h2>
        <div className="unauthorized">
          <strong>Access Denied</strong>
          <p>Only the contract owner can access this page.</p>
          <div className="debug-info">
            {!CONFIG.VOTING_CONTRACT_ADDRESS ? (
              <div className="config-error">
                <p><strong>Error:</strong> Voting contract address is not configured.</p>
                <p>Please create a <code>.env</code> file in your project root with:</p>
                <pre>VITE_VOTING_CONTRACT_ADDRESS=YOUR_CONTRACT_ADDRESS_HERE</pre>
                <p>And restart your development server.</p>
              </div>
            ) : (
              <>
                <p><strong>Connected account:</strong> {account || 'Not connected'}</p>
                {owner && (
                  <p><strong>Contract Owner:</strong> {owner}</p>
                )}
                {account && owner && (
                  <p>
                    <strong>Is Owner:</strong> {account.toLowerCase() === owner.toLowerCase() ? 'Yes' : 'No'}
                    {account.toLowerCase() !== owner.toLowerCase() && (
                      <span className="mismatch"> (Addresses don't match)</span>
                    )}
                  </p>
                )}
              </>
            )}
          </div>
          <p className="note">Please connect with the contract owner's wallet to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-panel">
      <Notification
        key={notification.show ? 'show' : 'hide'}
        show={notification.show}
        title={notification.title}
        message={notification.message}
        type={notification.type}
        onClose={closeNotification}
      />

      <TransactionOverlay 
        isVisible={showTransactionOverlay}
        status={transactionStatus}
        message={transactionMessage}
        onClose={handleClose}
      />

      <div className="nav-buttons">
        <button onClick={() => window.location.href = '/'} className="nav-button">
          Home
        </button>
        <button onClick={() => window.location.href = '/vote'} className="nav-button">
          Vote Dashboard
        </button>
      </div>
      
      <h2 style={{ marginBottom: '2rem' }}>|| Admin Panel ||</h2>
      
      <div className="admin-section">
        <h3>Add New Admin</h3>
        <form onSubmit={handleAddAdmin} className="admin-form">
          <input
            type="text"
            value={adminAddress}
            onChange={(e) => setAdminAddress(e.target.value)}
            placeholder="0x1234..."
            className="admin-input"
            spellCheck="false"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            required
          />
          <button 
            type="submit" 
            className={`btn btn-primary ${isAddingAdmin ? 'btn-loading' : ''}`}
            disabled={isLoading || isAddingAdmin || !ethers.utils.isAddress(adminAddress.trim())}
            data-tooltip={!ethers.utils.isAddress(adminAddress.trim()) ? 'Enter a valid Ethereum address' : ''}
          >
            {isAddingAdmin ? (
              <>
                Processing...
              </>
            ) : 'Add Admin'}
          </button>
        </form>
        <p className="form-hint" style={{ marginTop: '0.5rem', color: '#6b7280' }}>
          Enter the Ethereum address you want to grant admin privileges to.
        </p>
      </div>

      <div className="admin-section">
        <h3>Current Admins</h3>
        <div className="admin-list">
          {adminList.length > 0 ? (
            <ul style={{ padding: 0, margin: 0, listStyle: 'none' }}>
              {adminList.map((address, index) => {
                const isOwner = address.toLowerCase() === owner?.toLowerCase();
                const isCurrentUser = address.toLowerCase() === account?.toLowerCase();
                const canRemove = !isOwner && !isCurrentUser;
                
                return (
                  <li key={index} className="admin-item">
                    <span className={`admin-address ${isOwner ? 'owner' : ''}`}>
                      {formatAddress(address)}
                      {isOwner && ' (Owner)'}
                      {isCurrentUser && !isOwner && ' (You)'}
                      <span className="full-address" title={address}></span>
                    </span>
                    <div className="admin-actions">
                      {canRemove ? (
                        <button 
                          onClick={() => handleRemoveAdmin(address)}
                          className={`btn btn-danger btn-sm ${isRemovingAdmin ? 'btn-loading' : ''}`}
                          disabled={isLoading || isRemovingAdmin}
                          data-tooltip={isRemovingAdmin ? 'Removing admin...' : 'Remove admin'}
                        >
                          {isRemovingAdmin ? (
                            'Removing...'
                          ) : 'Remove'}
                        </button>
                      ) : (
                        <span className="admin-badge">
                          {isOwner ? 'Owner' : 'You'}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="empty-state">
              <p>No admins found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
