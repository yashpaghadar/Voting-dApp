/**
 * Safely gets an environment variable with optional default value
 * @param {string} key - The environment variable name (without VITE_ prefix)
 * @param {any} defaultValue - Default value if the variable is not set
 * @returns {string} The environment variable value or default value
 */
export const getEnv = (key, defaultValue = '') => {
  try {
    // In Vite, import.meta.env is used to access environment variables
    const value = import.meta.env[`VITE_${key}`] || process.env[`VITE_${key}`] || defaultValue;
    
    if (value === undefined || value === null) {
      console.warn(`Environment variable VITE_${key} is not set`);
      return defaultValue;
    }
    
    return value;
  } catch (error) {
    console.error(`Error accessing environment variable VITE_${key}:`, error);
    return defaultValue;
  }
};

// Export contract addresses with validation
export const CONFIG = {
  VOTE_TOKEN_ADDRESS: getEnv('VOTE_TOKEN_ADDRESS'),
  VOTING_CONTRACT_ADDRESS: getEnv('VOTING_CONTRACT_ADDRESS'),
  NFT_CONTRACT_ADDRESS: getEnv('VOTE_BADGE_NFT_ADDRESS'),
  NFT_BASE_URI: window.location.origin + '/nft-metadata/',
  APP_ENV: getEnv('APP_ENV', 'development'),
  
  // Validate required environment variables
  validate: function() {
    const requiredVars = ['VOTE_TOKEN_ADDRESS', 'VOTING_CONTRACT_ADDRESS'];
    const missingVars = [];
    
    requiredVars.forEach(varName => {
      if (!this[varName]) {
        missingVars.push(varName);
      }
    });
    
    if (missingVars.length > 0) {
      const errorMsg = `Missing required environment variables: ${missingVars.join(', ')}`;
      console.error(errorMsg);
      if (this.APP_ENV === 'production') {
        throw new Error(errorMsg);
      }
      return false;
    }
    
    return true;
  }
};

// Log configuration in development
if (import.meta.env.DEV) {
  console.log('App Configuration:', {
    ...CONFIG,
    // Don't log private keys or sensitive data
    validate: undefined
  });
}
