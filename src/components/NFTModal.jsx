import React from 'react';
import { FaCheckCircle, FaExternalLinkAlt, FaTimes } from 'react-icons/fa';

const NFTModal = ({ isOpen, onClose, transactionHash, network = 'sepolia' }) => {
  if (!isOpen) return null;

  // Generate OpenSea testnet URL
  const getOpenSeaUrl = () => {
    const baseUrl = network === 'sepolia' 
      ? 'https://testnets.opensea.io/assets/sepolia'
      : 'https://opensea.io/assets/ethereum';
    
    if (!transactionHash) return 'https://testnets.opensea.io';
    return `${baseUrl}/${transactionHash}`;
  };

  // Generate Etherscan URL
  const getEtherscanUrl = () => {
    const baseUrl = network === 'sepolia'
      ? 'https://sepolia.etherscan.io/tx'
      : 'https://etherscan.io/tx';
    
    return `${baseUrl}/${transactionHash}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
          aria-label="Close modal"
        >
          <FaTimes className="w-5 h-5" />
        </button>
        
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
            <FaCheckCircle className="h-10 w-10 text-green-600" />
          </div>
          
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            Vote Successful! 🎉
          </h3>
          
          <p className="text-gray-600 mb-6">
            Thank you for voting! You've earned a special VoteBadge NFT to commemorate your participation.
          </p>
          
          {transactionHash && (
            <div className="space-y-4">
              <div className="bg-blue-50 p-3 rounded-lg text-left">
                <p className="text-sm text-blue-700 font-medium">
                  <div className="space-y-4">
                    {transactionHash && (
                      <div>
                        <a
                          href={getEtherscanUrl()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-blue-600 hover:text-blue-800"
                        >
                          View on Etherscan <FaExternalLinkAlt className="ml-1" />
                        </a>
                      </div>
                    )}
                    
                    {tokenId && (
                      <div>
                        <a
                          href={getOpenSeaUrl()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-blue-600 hover:text-blue-800"
                        >
                          View on OpenSea <FaExternalLinkAlt className="ml-1" />
                        </a>
                      </div>
                    )}
                    
                    {nftMetadata?.image && (
                      <div>
                        <a
                          href={getIPFSGatewayUrl(nftMetadata.image)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm"
                        >
                          View IPFS Metadata <FaExternalLinkAlt className="ml-1" />
                        </a>
                      </div>
                    )}
                  </div>
                </p>
              </div>
            </div>
          )}
          
          <div className="mt-6">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NFTModal;
