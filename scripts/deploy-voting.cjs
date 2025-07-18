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
    const ownerAddress = process.env.VITE_OWNER_ADDRESS;
    
    // Check if the current signer is the owner
    const currentSigner = await deployer.getAddress();
    if (currentSigner.toLowerCase() !== ownerAddress.toLowerCase()) {
      console.log(`Current signer (${currentSigner}) is not the owner (${ownerAddress}).`);
      console.log('Please run the deployment with the owner account or update the VITE_OWNER_ADDRESS in .env');
      console.log('Skipping VoteBadgeNFT setup...');
    } else if (voteBadgeNFTAddress) {
      try {
        console.log("Setting VoteBadgeNFT address in Voting contract...");
        const tx = await voting.setVoteBadgeNFT(voteBadgeNFTAddress);
        await tx.wait();
        console.log("VoteBadgeNFT address set in Voting contract");
        
        // Also update the VoteBadgeNFT contract to point to this Voting contract
        const VoteBadgeNFT = await hre.ethers.getContractFactory("VoteBadgeNFT");
        const nft = await VoteBadgeNFT.attach(voteBadgeNFTAddress);
        const tx2 = await nft.setVotingContract(voting.address);
        await tx2.wait();
        console.log("Voting contract address set in VoteBadgeNFT");
      } catch (error) {
        console.error("Error setting up VoteBadgeNFT:", error.message);
        console.log("Please set up the VoteBadgeNFT address manually after deployment");
      }
    } else {
      console.log("VoteBadgeNFT not deployed yet. Please set it later with setVoteBadgeNFT()");
    }
    
    // Write back to .env file
    fs.writeFileSync(envPath, envContent.trim() + '\n');
    console.log('Updated .env file with new VOTING_CONTRACT_ADDRESS');
    
    // Verify contract on block explorer if network supports it
    if (hre.network.name !== 'hardhat' && hre.network.name !== 'localhost') {
      console.log('\nVerifying contract on block explorer...');
      try {
        await hre.run('verify:verify', {
          address: voting.address,
          constructorArguments: [voteTokenAddress],
        });
        console.log('Contract verified successfully!');
      } catch (error) {
        if (error.message.includes('Already Verified')) {
          console.log('Contract is already verified');
        } else {
          console.warn('Contract verification failed:', error.message);
        }
      }
    }
    
    console.log("\n=== Deployment Summary ===");
    console.log("Network:", hre.network.name);
    console.log("Voting Contract:", voting.address);
    console.log("VoteToken Address:", voteTokenAddress);
    if (voteBadgeNFTAddress) {
      console.log("VoteBadgeNFT Address:", voteBadgeNFTAddress);
    }
    
    // Log contract interaction details
    console.log("\n=== Contract Interaction Guide ===");
    console.log("1. Create a proposal:", `await voting.createProposal(\"Your proposal description\")`);
    console.log("2. Vote on a proposal:", `await voting.vote(proposalId)`);
    console.log("3. Add a comment:", `await voting.addComment(proposalId, \"ipfs-hash-here\")`);
    console.log("4. Get comments:", `await voting.getComments(proposalId)`);
    
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
