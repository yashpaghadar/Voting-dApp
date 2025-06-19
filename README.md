# Decentralized Voting Application

A blockchain-based voting system built with:
- Frontend: React + Vite
- Smart Contracts: Solidity (Ethereum)
- Deployment: Vercel + Sepolia Testnet

## Features
- Create proposals with token-based fees
- Vote on active proposals (one vote per address)
- Real-time voting results
- Token-based authentication (HLTK token)
- Duplicate vote prevention

## Live Demo
[View Live Application]
- https://voting-dapp-with-tokens.vercel.app/

## Smart Contracts
- **Voting.sol**: Main voting contract
- **HelloToken.sol**: ERC-20 token for voting fees

## Environment Setup
1. Clone the repository
2. Install dependencies:
```bash
npm install
```
3. Create `.env` file with:
```
ALCHEMY_API_KEY=your_key
PRIVATE_KEY=your_key
VITE_VOTING_CONTRACT_ADDRESS=0x...
VITE_HELLO_TOKEN_ADDRESS=0x...
```

## Deployment
1. Deploy contracts:
```bash
npx hardhat run scripts/deploy-voting.cjs --network sepolia
```


## Technologies Used
- React
- Ethers.js
- Hardhat
- Vercel
- Sepolia Testnet
