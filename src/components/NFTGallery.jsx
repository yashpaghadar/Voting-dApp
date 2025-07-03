import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ethers } from 'ethers';
import votingBadgeNFTArtifact from '../abi/VoteBadgeNFT.json';
import votingContractArtifact from '../abi/Voting.json';
import { CONFIG } from '../utils/config';
import { FaImage, FaSpinner, FaExclamationTriangle, FaArrowLeft } from 'react-icons/fa';
import './NFTGallery.css';

const votingBadgeNFTAbi = votingBadgeNFTArtifact.abi;
const votingContractAbi = votingContractArtifact.abi;
const Owner = import.meta.env.VITE_OWNER_ADDRESS;
const NFTGallery = () => {
  const [nfts, setNfts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [account, setAccount] = useState(null);
  const [voting, setVoting] = useState(null);
  const [isOwner, setIsOwner] = useState(false);

  // Check if user is the contract owner
  const checkIfOwner = async (contract, userAddress) => {
    console.log('=== checkIfOwner called ===');
    console.log('Contract exists:', !!contract);
    console.log('User address:', userAddress);
    
    if (!contract) {
      console.log('No contract provided to checkIfOwner');
      setIsOwner(false);
      return false;
    }
    if (!userAddress) {
      console.log('No user address provided to checkIfOwner');
      setIsOwner(false);
      return false;
    }
    try {
      console.log('Getting contract owner...');
      const contractOwner = await contract.owner();
      console.log('Contract owner address:', contractOwner);
      console.log('Current user address:', userAddress);
      
      const isUserOwner = userAddress.toLowerCase() === contractOwner.toLowerCase();
      console.log('Is user owner?', isUserOwner);
      
      setIsOwner(isUserOwner);
      return isUserOwner;
    } catch (error) {
      console.error('Error checking owner status:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      setIsOwner(false);
      return false;
    }
  };

  // Debug effect to log state changes
  useEffect(() => {
    console.log('=== State Update ===');
    console.log('Account:', account);
    console.log('Voting contract:', voting ? 'Exists' : 'Not loaded');
    console.log('Is owner:', isOwner);
  }, [account, voting, isOwner]);

  // Effect to check owner status when voting contract or account changes
  useEffect(() => {
    console.log('=== Owner check effect triggered ===');
    console.log('Voting contract exists:', !!voting);
    console.log('Account exists:', !!account);
    
    if (voting && account) {
      console.log('Both contract and account available, checking owner status...');
      checkIfOwner(voting, account).catch(error => {
        console.error('Error in owner check effect:', error);
        setIsOwner(false);
      });
    } else {
      console.log('Contract or account not available, setting isOwner to false');
      setIsOwner(false);
    }
  }, [voting, account]);


  useEffect(() => {
    const fetchNFTs = async () => {
      try {
        if (!window.ethereum) {
          throw new Error('MetaMask not detected. Please install MetaMask to view your NFTs.');
        }

        // Request account access
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (!accounts || accounts.length === 0) {
          throw new Error('No accounts found. Please connect your wallet.');
        }
        
        const currentAccount = accounts[0];
        setAccount(currentAccount);

        if (!CONFIG.NFT_CONTRACT_ADDRESS) {
          throw new Error('NFT contract address is not configured');
        }

        // Using ethers v5
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();

        // Initialize voting contract after provider & signer are set
        if (CONFIG.VOTING_CONTRACT_ADDRESS && votingContractAbi && signer) {
          try {
            const votingContract = new ethers.Contract(
              CONFIG.VOTING_CONTRACT_ADDRESS,
              votingContractAbi,
              signer
            );
            console.log('Voting contract initialized');
            setVoting(votingContract);
            // The owner check will be handled by the effect hook
          } catch (e) {
            setVoting(null);
            console.error('Failed to initialize voting contract:', e);
          }
        } else {
          setVoting(null);
        }

        const nftContract = new ethers.Contract(
          CONFIG.NFT_CONTRACT_ADDRESS,
          votingBadgeNFTAbi,
          signer
        );

        console.log('Starting NFT fetch for account:', currentAccount);
        const tokenIds = [];
        
        try {
          // Try to get all Transfer events for this account
          console.log('Querying Transfer events...');
          const filter = nftContract.filters.Transfer(null, currentAccount, null);
          const events = await nftContract.queryFilter(filter, 'earliest', 'latest');
          console.log('Found Transfer events:', events);
          
          if (!events || events.length === 0) {
            console.log('No Transfer events found for this account');
            // Try alternative approach if no events found
            const balance = await nftContract.balanceOf(currentAccount);
            console.log('Account balance (NFTs):', balance.toString());
            
            // If there's a balance but no events, try to find tokens
            if (balance.gt(0)) {
              console.log('Account has NFTs but no Transfer events found. Trying alternative approach...');
              // Try getting tokens by checking recent mints
              const mintEvents = await nftContract.queryFilter(nftContract.filters.Transfer('0x0000000000000000000000000000000000000000', null, null));
              console.log('Found mint events:', mintEvents);
              
              // Check ownership of minted tokens
              const checkPromises = mintEvents.map(async (event) => {
                try {
                  const tokenId = event.args.tokenId.toString();
                  const owner = await nftContract.ownerOf(tokenId);
                  if (owner.toLowerCase() === currentAccount.toLowerCase()) {
                    return tokenId;
                  }
                } catch (err) {
                  console.error('Error checking minted token:', err);
                }
                return null;
              });
              
              const results = await Promise.all(checkPromises);
              results.forEach(tokenId => tokenId && tokenIds.push(tokenId));
            }
          } else {
            // Process transfer eventss
          const ownedTokens = new Set();
          for (const event of events) {
            if (event.args && event.args.tokenId) {
              const tokenId = event.args.tokenId.toString();
              console.log('Found token in Transfer event:', tokenId);
              ownedTokens.add(tokenId);
            }
          }
          
          // Verify ownership of each token
          const checkPromises = Array.from(ownedTokens).map(async (tokenId) => {
            try {
              const owner = await nftContract.ownerOf(tokenId);
              const isOwner = owner.toLowerCase() === currentAccount.toLowerCase();
              console.log(`Token ${tokenId} owner: ${owner}, isOwner: ${isOwner}`);
              return isOwner ? tokenId : null;
            } catch (err) {
              console.error(`Error checking token ${tokenId}:`, err);
              return null;
            }
          });
          
          const results = await Promise.all(checkPromises);
          results.forEach(tokenId => tokenId && tokenIds.push(tokenId));
        }
        
        console.log('Final token IDs:', tokenIds);
        } catch (err) {
          console.error('Error in NFT fetch process:', err);
          throw err; // Re-throw to be caught by the outer try-catch
        }

        // Fetch metadata for each token
        const nftData = await Promise.all(
          tokenIds.map(async (tokenId) => {
            try {
              const tokenURI = await nftContract.tokenURI(tokenId);
              // Use the token type to construct the metadata URL
              const tokenType = await nftContract.tokenIdToType(tokenId);
              const metadataUrl = `${CONFIG.NFT_BASE_URI}${tokenType}.json`;
              
              const response = await fetch(metadataUrl);
              if (!response.ok) {
                throw new Error(`Failed to fetch metadata for token ${tokenId}`);
              }
              
              const metadata = await response.json();
              return {
                tokenId: tokenId.toString(),
                tokenType: tokenType.toString(),
                ...metadata,
                image: metadata.image.startsWith('http') ? metadata.image : `${window.location.origin}${metadata.image}`
              };
            } catch (err) {
              console.error(`Error processing token ${tokenId}:`, err);
              return null;
            }
          })
        );

        // Filter out any failed token fetches
        setNfts(nftData.filter(nft => nft !== null));
      } catch (err) {
        console.error('Error in fetchNFTs:', err);
        setError(err.message || 'Failed to load NFTs');
      } finally {
        setLoading(false);
      }
    };

    fetchNFTs();
  }, []);

  if (loading) {
    return (
      <div className="loading-proposals">
        <div className="loading-spinner"></div>
        Loading Your NFTs...
      </div>
    );
  }

  if (error) {
    return (
      <div className="nftgallery-container">
        <div className="nav-buttons">
          <button 
            onClick={() => window.location.href = '/vote'}
            className="nav-button"
            disabled={!account}
          >
            Vote Dashboard
          </button>
          <button 
            onClick={() => window.location.href = '/proposal/1'}
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
          {account === Owner && (
            <button 
              onClick={() => window.location.href = '/admin-panel'}
              className="nav-button"
            >
              Admin Panel
            </button>
          )}
        </div>
        <div className="nftgallery-main">
          <div className="nftgallery-error-header">
            <div className="nftgallery-flex-center">
              <FaExclamationTriangle className="nftgallery-error-icon" />
              <h2 className="nftgallery-error-title">Error Loading NFTs</h2>
            </div>
          </div>
          <div className="nftgallery-padding">
            <div className="nftgallery-center-section">
              <div className="nftgallery-error-circle">
                <FaExclamationTriangle className="nftgallery-error-icon-lg" />
              </div>
              <h3 className="nftgallery-error-title-lg">Something went wrong</h3>
              <p className="nftgallery-text-secondary-sm" style={{ color:'#161111'}}>{error}</p>
              <div className="nftgallery-margin-top">
                <button
                  onClick={() => window.location.reload()}
                  className="nftgallery-btn-primary"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (nfts.length === 0) {
    return (
      <div className="nftgallery-container" style={{ width: '100%' }}>
        <div className="nav-buttons">
          <button 
            onClick={() => window.location.href = '/vote'}
            className="nav-button"
            disabled={!account}
          >
            Vote Dashboard
          </button>
          <button 
            onClick={() => window.location.href = '/proposal/1'}
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
          {account === Owner && (
            <button 
              onClick={() => window.location.href = '/admin-panel'}
              className="nav-button"
            >
              Admin Panel
            </button>
          )}
        </div>
        <div className="nftgallery-main-wide">
          <div className="nftgallery-empty-state">
            <div className="nftgallery-empty-illustration">
              <div className="nftgallery-empty-badge">
                <FaImage className="nftgallery-empty-icon" />
              </div>
              <div className="nftgallery-empty-shine"></div>
            </div>
            
            <h2 className="nftgallery-empty-title">No Voting Badges Yet</h2>
            <p className="nftgallery-empty-text">
              You haven't earned any voting badges yet. Participate in proposals and make your voice heard to earn special badges!
            </p>
            
            <div className="nftgallery-empty-actions">
              <Link to="/vote" className="nftgallery-empty-button secondary">
                View Active Proposals
              </Link>
              <Link to="/how-it-works" className="nftgallery-empty-button secondary">
                How It Works
              </Link>
            </div>
            
            <div className="nftgallery-empty-benefits">
              <div className="nftgallery-benefit">
                <div className="nftgallery-benefit-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                </div>
                <span>Earn badges by voting on proposals</span>
              </div>
              <div className="nftgallery-benefit">
                <div className="nftgallery-benefit-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
                  </svg>
                </div>
                <span>Collect different badge types</span>
              </div>
              <div className="nftgallery-benefit">
                <div className="nftgallery-benefit-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </div>
                <span>Showcase your governance participation</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="nftgallery-container">        
      <div className="nav-buttons">
        <button 
          onClick={() => window.location.href = '/vote'}
          className="nav-button"
        >
          Vote Dashboard
        </button>
        <button 
          onClick={() => window.location.href = '/proposal/1'}
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
        {account === Owner && (
          <button 
            onClick={() => window.location.href = '/admin-panel'}
            className="nav-button"
          >
            Admin Panel
          </button>
        )}
       </div>
      <div className="nftgallery-main-wide">
        <div className="nftgallery-header-card">
          <div className="nftgallery-header">
            <div className="nftgallery-header-content">
              <div>
                <h3>Your Voting Badges</h3>
                <p className="nftgallery-header-desc">
                  Badges you've earned by participating in the voting process
                </p>
              </div>
              <div className="nftgallery-back-btn-wrap">
                <Link
                  to="/vote"
                  className="nftgallery-back-btn"
                >
                  <FaArrowLeft className="nftgallery-back-icon" />
                  Back to Proposals
                </Link>
              </div>
            </div>
          </div>

         
          {account && (
            <div className="nftgallery-wallet">
              <p className="nftgallery-wallet">
                Connected wallet: <span className="nftgallery-wallet-mono">{`${account.substring(0, 10)} ... ${account.substring(32, 42)}`}</span>
              </p>
            </div>
          )}
          
          <div className="nftgallery-grid">
            {nfts.length > 0 ? (
              <div className="nftgallery-grid">
                {nfts.map((nft) => (
                  <div 
                    key={nft.tokenId} 
                    className="nftgallery-card"
                  >
                    <div className="nftgallery-card-img">
                      <img 
                        src={nft.image} 
                        alt={nft.name}
                        className="nftgallery-card-img-el"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = 'https://via.placeholder.com/300x300?text=Image+Not+Available';
                        }}
                      />
                    </div>
                    <div className="nftgallery-card-body">
                      <h3 className="nftgallery-card-title">{nft.name}</h3>
                      <p className="nftgallery-card-desc">{nft.description}</p>
                      
                      <div className="nftgallery-card-footer-wrap">
                        <div className="nftgallery-card-footer">
                          Token ID: {nft.tokenId}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="nftgallery-center-section-lg">
                <div className="nftgallery-image-circle">
                  <FaImage className="nftgallery-image-icon" />
                </div>
                <h3 className="nftgallery-title-lg">No voting badges yet</h3>
                <p className="nftgallery-text-secondary-sm">
                  You haven't earned any voting badges yet. Participate in proposals to earn special badges!
                </p>
              </div>
            )}
          </div>
        </div>
        
        <div className="nftgallery-about">
          <h3 className="nftgallery-about-title">About Voting Badges</h3>
          <div className="nftgallery-about-content">
            <p className="nftgallery-text-secondary" style={{color: "#373737"}}>
              Voting badges are special NFTs awarded when you participate in the governance process. 
              Each badge represents your contribution to the community and can have different rarities 
              based on your level of participation.
            </p>
            <ul className="nftgallery-list">
              <li className="nftgallery-list-item">
                <svg className="nftgallery-list-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Earn badges by voting on proposals</span>
              </li>
              <li className="nftgallery-list-item">
                <svg className="nftgallery-list-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Different badge types represent different achievements</span>
              </li>
              <li className="nftgallery-list-item">
                <svg className="nftgallery-list-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Collect them all to show your governance participation</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
      
    </div>
  );
};

export default NFTGallery;
