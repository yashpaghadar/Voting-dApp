const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  console.log("Deploying VoteBadgeNFT contract...");
  
  // Get the deployer's account
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deploying contracts with account: ${deployer.address}`);
  
  // Deploy VoteBadgeNFT
  const VoteBadgeNFT = await hre.ethers.getContractFactory("VoteBadgeNFT");
  const folderCID = "bafybeia5mi6nqajxb4bjhdhanlh7la25npdpzgytdyxmdmsmkt6lo5btdm";
  const baseURI = `https://gateway.pinata.cloud/ipfs/${folderCID}/`;

  console.log("Deploying VoteBadgeNFT...");
  const nft = await VoteBadgeNFT.deploy(
    "VoteBadge",
    "VBADGE",
    baseURI  // This will be the base for all token URIs (e.g., https://gateway.pinata.cloud/ipfs/bafybeia5mi6nqajxb4bjhdhanlh7la25npdpzgytdyxmdmsmkt6lo5btdm/1.json)
  );
  
  await nft.deployed()
  
  console.log(`✅ VoteBadgeNFT deployed to: ${nft.address}`);
  console.log(`🔗 Base URI set to: ${baseURI}`);
  
  // Get the Voting contract address from .env
  const envPath = path.join(__dirname, '..', '.env');
  const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  const votingAddressMatch = envContent.match(/VITE_VOTING_CONTRACT_ADDRESS=([^\n]+)/);
  
  if (votingAddressMatch && votingAddressMatch[1]) {
    const votingAddress = votingAddressMatch[1].trim();
    console.log(`🔗 Linking with Voting contract at: ${votingAddress}`);
    
    // Set the voting contract in the NFT contract
    await nft.setVotingContract(votingAddress);
    console.log("✅ VoteBadgeNFT linked to Voting contract");
    
    // Update the Voting contract to use this NFT contract
    const Voting = await hre.ethers.getContractFactory("Voting");
    const voting = await Voting.attach(votingAddress);
    await voting.setVoteBadgeNFT(nft.address);
    console.log("✅ Voting contract updated to use VoteBadgeNFT");
  } else {
    console.warn("⚠️  Could not find Voting contract address in .env - please set it manually");
  }
  
  // Update environment variables
  let updatedEnvContent = envContent
    .replace(/^VITE_VOTE_BADGE_NFT_ADDRESS=.*\n?/gm, '')
    .replace(/\n*$/, '') // Remove trailing newlines
    + `\nVITE_VOTE_BADGE_NFT_ADDRESS=${nft.address}\n`;
  
  fs.writeFileSync(envPath, updatedEnvContent);
  console.log("✅ Updated .env file with new contract addresses");
  console.log("Environment variables updated successfully");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });