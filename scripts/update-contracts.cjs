const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  try {
    console.log("Updating contract references...");
    
    // Load environment variables
    require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
    
    const votingAddress = process.env.VITE_VOTING_CONTRACT_ADDRESS;
    const nftAddress = process.env.VITE_VOTE_BADGE_NFT_ADDRESS;
    
    if (!votingAddress) {
      throw new Error("VITE_VOTING_CONTRACT_ADDRESS not found in .env file");
    }
    
    if (!nftAddress) {
      throw new Error("VITE_VOTE_BADGE_NFT_ADDRESS not found in .env file");
    }
    
    console.log("Voting Contract:", votingAddress);
    console.log("VoteBadgeNFT Contract:", nftAddress);
    
    // Get contract instances
    const Voting = await hre.ethers.getContractFactory("Voting");
    const VoteBadgeNFT = await hre.ethers.getContractFactory("VoteBadgeNFT");
    
    const voting = await Voting.attach(votingAddress);
    const nft = await VoteBadgeNFT.attach(nftAddress);
    
    // Update VoteBadgeNFT to point to Voting contract
    console.log("\nSetting Voting contract in VoteBadgeNFT...");
    const tx1 = await nft.setVotingContract(votingAddress);
    await tx1.wait();
    console.log("Voting contract set in VoteBadgeNFT");
    
    // Update Voting to point to VoteBadgeNFT
    console.log("\nSetting VoteBadgeNFT in Voting contract...");
    const tx2 = await voting.setVoteBadgeNFT(nftAddress);
    await tx2.wait();
    console.log("VoteBadgeNFT set in Voting contract");
    
    console.log("\n=== Update Complete ===");
    console.log("Contracts have been successfully linked!");
    
  } catch (error) {
    console.error("\n=== Update Failed ===");
    console.error("Error:", error.message);
    if (error.transactionHash) {
      console.error("Transaction hash:", error.transactionHash);
    }
    process.exit(1);
  }
}

main().then(() => process.exit(0));
