const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  try {
    console.log("Starting Voting contract deployment...");
    
    // Get the deployer account
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    console.log("Account balance:", hre.ethers.utils.formatEther(await deployer.getBalance()), "ETH");

    // Check for required environment variables
    const voteTokenAddress = process.env.VITE_VOTE_TOKEN_ADDRESS;
    if (!voteTokenAddress) {
      throw new Error("VITE_VOTE_TOKEN_ADDRESS not found in .env file");
    }
    console.log("Using VoteToken address:", voteTokenAddress);

    // Deploy Voting contract
    console.log("Deploying Voting contract...");
    const Voting = await hre.ethers.getContractFactory("Voting");
    const voting = await Voting.deploy(voteTokenAddress);
    console.log("Deployment transaction hash:", voting.deployTransaction.hash);
    await voting.deployed();
    
    console.log("Voting deployed to:", voting.address);
    
    // Save ABI
    const abiDir = path.join(__dirname, '..', 'src', 'abi');
    if (!fs.existsSync(abiDir)) {
      fs.mkdirSync(abiDir, { recursive: true });
    }
    
    fs.writeFileSync(
      path.join(abiDir, 'Voting.json'),
      JSON.stringify(Voting.interface.format("json"), null, 2)
    );
    console.log("ABI saved to src/abi/Voting.json");
    
    // Update .env file
    const envPath = path.join(__dirname, '..', '.env');
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    
    // Remove existing voting contract address if it exists
    envContent = envContent.replace(/^VITE_VOTING_CONTRACT_ADDRESS=.*\n?/gm, '');
    
    // Add new voting contract address with Vite prefix
    envContent += `\nVITE_VOTING_CONTRACT_ADDRESS=${voting.address}`;
    
    // If VoteBadgeNFT address exists, set it in the Voting contract
    const voteBadgeNFTAddress = process.env.VITE_VOTE_BADGE_NFT_ADDRESS;
    if (voteBadgeNFTAddress) {
      console.log("Setting VoteBadgeNFT address in Voting contract...");
      await voting.setVoteBadgeNFT(voteBadgeNFTAddress);
      console.log("VoteBadgeNFT address set in Voting contract");
      
      // Also update the VoteBadgeNFT contract to point to this Voting contract
      const VoteBadgeNFT = await hre.ethers.getContractFactory("VoteBadgeNFT");
      const nft = await VoteBadgeNFT.attach(voteBadgeNFTAddress);
      await nft.setVotingContract(voting.address);
      console.log("Voting contract address set in VoteBadgeNFT");
    } else {
      console.log("VoteBadgeNFT not deployed yet. Please set it later with setVoteBadgeNFT()");
    }
    
    // Write back to .env file
    fs.writeFileSync(envPath, envContent.trim() + '\n');
    console.log('Updated .env file with new VOTING_CONTRACT_ADDRESS');
    
    console.log("\n=== Deployment Summary ===");
    console.log("Voting Contract:", voting.address);
    console.log("VoteToken Address:", voteTokenAddress);
    if (voteBadgeNFTAddress) {
      console.log("VoteBadgeNFT Address:", voteBadgeNFTAddress);
    }
    console.log("\nDeployment completed successfully!");
    
  } catch (error) {
    console.error("\n=== Deployment Failed ===");
    console.error("Error:", error.message);
    if (error.transactionHash) {
      console.error("Transaction hash:", error.transactionHash);
    }
    process.exit(1);
  }
}

main().then(() => process.exit(0));
