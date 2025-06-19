const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const helloTokenAddress = process.env.HELLO_TOKEN_ADDRESS;
  if (!helloTokenAddress) {
    throw new Error("Please set HELLO_TOKEN_ADDRESS in your .env file");
  }

  const Voting = await hre.ethers.getContractFactory("Voting");
  const voting = await Voting.deploy(helloTokenAddress);
  await voting.deployed();
  console.log("Voting deployed to:", voting.address);
  
  // Save ABI
  fs.writeFileSync(
    "./src/abi/Voting.json",
    JSON.stringify(Voting.interface.format("json"), null, 2)
  );
 
  // Update .env file
  const envPath = path.join(__dirname, '..', '.env');
  let envContent = '';
  
  // Read existing .env file if it exists
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
    
    // Remove existing voting contract address if it exists
    envContent = envContent.replace(/^VITE_VOTING_CONTRACT_ADDRESS=.*\n?/gm, '');
  }
  
  // Add new voting contract address with Vite prefix
  envContent += `\nVITE_VOTING_CONTRACT_ADDRESS=${voting.address}`;
  
  // Write back to .env file
  fs.writeFileSync(envPath, envContent.trim() + '\n');
  console.log('Updated .env file with new VOTING_CONTRACT_ADDRESS');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
