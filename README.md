# 🗳️ Decentralized Voting dApp

A secure, transparent, and decentralized voting application built on the Ethereum blockchain. This dApp allows users to create proposals, vote on them using ERC-20 tokens, and view real-time results in a user-friendly interface.

## 🌟 Features

- **Decentralized Governance**: Built on Ethereum blockchain for transparency and security
- **Token-Based Voting**: Uses HLTK ERC-20 tokens for voting rights
- **User-Friendly Interface**: Clean, responsive UI with real-time updates
- **Secure Authentication**: Web3 wallet integration (MetaMask, WalletConnect, etc.)
- **Admin Panel**: Manage proposals and view analytics with admin controls
- **IPFS Integration**: Decentralized storage for proposal data
- **Real-time Results**: Live updates on voting progress with charts

## 🚀 Live Demo

[View Live Application]
- https://voting-dapp-with-tokens.vercel.app/


## 🏗️ Tech Stack

### Frontend
- React 18 + Vite
- Tailwind CSS
- Web3Modal (Wallet Connection)
- React Router
- React Query
- Chart.js (Data Visualization)

### Blockchain
- Solidity
- Hardhat (Development Environment)
- Ethers.js
- IPFS (Decentralized Storage)
- Sepolia Testnet (Deployment)

### Smart Contracts
- **Voting.sol**: Main voting contract with proposal and voting logic
- **HelloToken.sol**: ERC-20 token contract for voting rights

## 🛠️ Getting Started

### Prerequisites

- Node.js (v16 or later)
- npm or yarn
- MetaMask (or other Web3 wallet)
- Alchemy API Key
- Sepolia Testnet ETH (for deployment)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/voting-dapp.git
   cd voting-dapp
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory with:
   ```
   ALCHEMY_API_KEY=your_alchemy_api_key
   PRIVATE_KEY=your_wallet_private_key
   VITE_VOTING_CONTRACT_ADDRESS=0x...
   VITE_HELLO_TOKEN_ADDRESS=0x...
   ```

### Local Development

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📦 Deployment

### Deploying Smart Contracts

1. Compile the contracts:
   ```bash
   npx hardhat compile
   ```

2. Deploy to Sepolia testnet:
   ```bash
   npx hardhat run scripts/deploy-voting.cjs --network sepolia
   ```

### Deploying Frontend

1. Build the production version:
   ```bash
   npm run build
   ```

2. Deploy to Vercel:
   ```bash
   vercel --prod
   ```

## 🧪 Testing

Run the test suite:
```bash
npx hardhat test
```

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 📧 Contact

For any questions or feedback, please open an issue or contact the project maintainers.

Made by Yash Paghadar 