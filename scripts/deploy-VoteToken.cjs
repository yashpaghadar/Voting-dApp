const fs = require('fs');
const path = require('path');

async function main() {
    try {
        console.log("Starting deployment...");
        
        // Get the deployer account
        const [deployer] = await ethers.getSigners();
        console.log("Deploying with account:", deployer.address);
        console.log("Account balance:", ethers.utils.formatEther(await deployer.getBalance()), "ETH");

        // Deploy the contract
        console.log("Deploying VoteToken contract...");
        const VoteToken = await ethers.getContractFactory("VoteToken");
        const voteToken = await VoteToken.deploy(1000000); // 1,000,000 initial supply
        console.log("Contract deployment initiated. Waiting for deployment...");
        
        // Wait for deployment
        const deployTx = await voteToken.deployTransaction;
        console.log("Deployment transaction hash:", deployTx.hash);
        await voteToken.deployed();
        
        // Log deployment details
        console.log("\n=== Deployment Complete ===");
        console.log("Contract Address:", voteToken.address);
        console.log("Network:", network.name);
        console.log("Deployer:", deployer.address);
        const decimals = await voteToken.decimals();
        const totalSupply = await voteToken.totalSupply();
        const formattedSupply = ethers.utils.formatEther(totalSupply, "ETH");
        console.log("Initial Supply:", formattedSupply);
        console.log("Decimals:", decimals);
        
        // Verify the initial supply is correct
        const deployerBalance = await voteToken.balanceOf(deployer.address);
        const formattedBalance = ethers.utils.formatEther(deployerBalance,  "ETH");
        console.log("Deployer's token balance:", formattedBalance);
      

        // Update .env file
        const envPath = path.join(__dirname, '..', '.env');
        let envContent = '';
        
        // Read existing .env file if it exists
        if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf8');
            
            // Remove existing token address if it exists
            envContent = envContent.replace(/^VITE_VOTE_TOKEN_ADDRESS=.*\n?/gm, '');
        }
        
        // Add new token address with Vite prefix
        envContent += `\nVITE_VOTE_TOKEN_ADDRESS=${voteToken.address}`;
        
        // Write back to .env file
        fs.writeFileSync(envPath, envContent.trim() + '\n');
        console.log('Updated .env file with new VOTE_TOKEN_ADDRESS');
        
        console.log("\nDeployment successful!");
    } catch (error) {
        console.error("\n=== Deployment Failed ===");
        console.error("Error:", error.message);
        console.error("Stack trace:", error.stack);
        process.exit(1);
    }
}

main();
