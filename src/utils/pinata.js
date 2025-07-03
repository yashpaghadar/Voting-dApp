import axios from 'axios';

const PINATA_API_KEY = import.meta.env.VITE_PINATA_API_KEY || '';
const PINATA_SECRET_KEY = import.meta.env.VITE_PINATA_SECRET_KEY || '';
const PINATA_JWT = import.meta.env.VITE_PINATA_JWT || '';

// Upload JSON to IPFS via Pinata
export const uploadToIPFS = async (data) => {
  try {
    const response = await axios.post(
      'https://api.pinata.cloud/pinning/pinJSONToIPFS',
      {
        pinataContent: data,
        pinataMetadata: {
          name: `comment-${Date.now()}.json`,
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${PINATA_JWT}`,
        },
      }
    );

    return {
      success: true,
      ipfsHash: response.data.IpfsHash,
      ipfsUrl: `ipfs://${response.data.IpfsHash}`,
      gatewayUrl: `https://gateway.pinata.cloud/ipfs/${response.data.IpfsHash}`,
    };
  } catch (error) {
    console.error('Error uploading to IPFS via Pinata:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

// Fetch data from IPFS
export const fetchFromIPFS = async (ipfsHash) => {
  try {
    const response = await axios.get(
      `https://gateway.pinata.cloud/ipfs/${ipfsHash}`
    );
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Error fetching from IPFS:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

// Test Pinata authentication
export const testPinataAuth = async () => {
  try {
    const response = await axios.get('https://api.pinata.cloud/data/testAuthentication', {
      headers: {
        'Authorization': `Bearer ${PINATA_JWT}`,
      },
    });
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Pinata authentication failed:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};
