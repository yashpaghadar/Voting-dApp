// Ethers.js version compatibility utilities
import { ethers } from 'ethers';
import { CONFIG } from './config';

/**
 * Gets an ethers.js provider instance
 * @returns {Promise<ethers.BrowserProvider|ethers.providers.Web3Provider>}
 * @throws {Error} If provider cannot be created
 */
export const getEthersProvider = async () => {
  try {
    // Check if window.ethereum is available
    if (!window.ethereum) {
      throw new Error('MetaMask or other Ethereum provider not found. Please install MetaMask!');
    }

    // Request account access
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts found. Please connect your wallet.');
    }
    
    let provider;
    let network;
    
    // Try v6 style first
    if (typeof ethers.BrowserProvider === 'function') {
      provider = new ethers.BrowserProvider(window.ethereum);
      // Verify the connection
      network = await provider.getNetwork();
      console.log('Connected to network (v6):', {
        name: network.name,
        chainId: network.chainId,
        network: network
      });
    } 
    // Fall back to v5 style
    else if (ethers.providers && typeof ethers.providers.Web3Provider === 'function') {
      provider = new ethers.providers.Web3Provider(window.ethereum);
      // Verify the connection
      network = await provider.getNetwork();
      console.log('Connected to network (v5):', {
        name: network.name,
        chainId: network.chainId,
        network: network
      });
    } else {
      throw new Error('No supported provider constructor found');
    }
    
    // Check if connected to the expected network
    const expectedChainId = CONFIG.APP_ENV === 'production' ? '0x1' : '0xaa36a7';
    const currentChainId = `0x${network.chainId.toString(16)}`;
    
    if (currentChainId !== expectedChainId) {
      console.warn(`Connected to chain ID ${currentChainId}, expected ${expectedChainId}`);
      // You might want to prompt the user to switch networks here
    }
    
    return provider;
  } catch (err) {
    console.error('Error creating provider:', err);
    
    // Handle specific error codes
    if (err.code === 4001) {
      throw new Error('Please connect your wallet to continue');
    } else if (err.code === -32002) {
      throw new Error('Already processing wallet connection. Please check your MetaMask.');
    } else if (err.code === -32603) {
      throw new Error('Internal error. Please try again.');
    } else if (err.code === 'NETWORK_ERROR') {
      throw new Error('Network error. Please check your internet connection.');
    }
    
    // For other errors, include more details in development
    if (CONFIG.APP_ENV === 'development') {
      throw new Error(`Connection error: ${err.message}`);
    } else {
      throw new Error('Failed to connect to the blockchain. Please try again.');
    }
  }
};

export const parseEther = (ethersLib, amount) => {
  try {
    // Try v6 style first
    if (typeof ethersLib.parseEther === 'function') {
      return ethersLib.parseEther(amount);
    }
    // Fall back to v5 style
    if (ethersLib.utils && typeof ethersLib.utils.parseEther === 'function') {
      return ethersLib.utils.parseEther(amount);
    }
    throw new Error('No supported parseEther function found');
  } catch (err) {
    console.error('Error parsing ether:', err);
    throw err;
  }
};

export const parseContractAbi = (abiString) => {
  try {
    const abi = JSON.parse(abiString);
    if (!Array.isArray(abi)) {
      throw new Error('Parsed ABI is not an array');
    }
    return abi;
  } catch (err) {
    console.error('Failed to parse contract ABI:', err);
    throw new Error('Invalid contract ABI format');
  }
};

export const formatBigNumber = (value) => {
  if (ethers.BigNumber.isBigNumber(value)) {
    return value.toString();
  }
  return value;
};

export const safeApproveToken = async (tokenContract, spenderAddress, amount) => {
  try {
    // Check current allowance first
    const currentAllowance = await tokenContract.allowance(
      await tokenContract.signer.getAddress(),
      spenderAddress
    );
    
    // Only approve if needed
    if (currentAllowance.lt(amount)) {
      const tx = await tokenContract.approve(spenderAddress, amount);
      await tx.wait();
      return tx;
    }
    return null;
  } catch (err) {
    console.error('Approval error:', err);
    throw new Error('Token approval failed');
  }
};
