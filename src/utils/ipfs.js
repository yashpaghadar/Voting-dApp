import axios from 'axios';

const PINATA_API_URL = 'https://api.pinata.cloud';

// Initialize with environment variables
const PINATA_JWT = import.meta.env.VITE_PINATA_JWT;

if (!PINATA_JWT) {
  console.warn('PINATA_JWT is not set. IPFS functionality may be limited.');
}

/**
 * Upload a file to IPFS using Pinata
 * @param {File} file - The file to upload
 * @returns {Promise<string>} - IPFS hash of the uploaded file
 */
export const uploadToIPFS = async (file) => {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await axios.post(
      `${PINATA_API_URL}/pinning/pinFileToIPFS`,
      formData,
      {
        maxBodyLength: 'Infinity',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${formData._boundary}`,
          'Authorization': `Bearer ${PINATA_JWT}`
        }
      }
    );

    return `ipfs://${response.data.IpfsHash}`;
  } catch (error) {
    console.error('Error uploading to IPFS:', error);
    throw new Error('Failed to upload to IPFS');
  }
};

/**
 * Upload JSON metadata to IPFS
 * @param {Object} metadata - The metadata object to upload
 * @returns {Promise<string>} - IPFS hash of the uploaded metadata
 */
export const uploadMetadataToIPFS = async (metadata) => {
  try {
    const response = await axios.post(
      `${PINATA_API_URL}/pinning/pinJSONToIPFS`,
      metadata,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${PINATA_JWT}`
        }
      }
    );

    return `ipfs://${response.data.IpfsHash}`;
  } catch (error) {
    console.error('Error uploading metadata to IPFS:', error);
    throw new Error('Failed to upload metadata to IPFS');
  }
};

/**
 * Generate and upload NFT metadata to IPFS
 * @param {Object} params - Metadata parameters
 * @param {string} params.name - NFT name
 * @param {string} params.description - NFT description
 * @param {string} params.imageUrl - IPFS URL of the image
 * @param {Array} params.attributes - Array of trait objects
 * @returns {Promise<string>} - IPFS URL of the uploaded metadata
 */
export const createNFTMetadata = async ({ name, description, imageUrl, attributes = [] }) => {
  const metadata = {
    name,
    description,
    image: imageUrl,
    attributes,
    created_at: new Date().toISOString()
  };

  return await uploadMetadataToIPFS(metadata);
};

/**
 * Get IPFS gateway URL from IPFS hash or URL
 * @param {string} ipfsHash - IPFS hash or URL (ipfs://...)
 * @returns {string} - Gateway URL
 */
export const getIPFSGatewayUrl = (ipfsHash) => {
  if (!ipfsHash) return '';
  
  // Handle both ipfs:// and raw hashes
  const hash = ipfsHash.startsWith('ipfs://')
    ? ipfsHash.replace('ipfs://', '')
    : ipfsHash;
    
  return `https://ipfs.io/ipfs/${hash}`;
};
