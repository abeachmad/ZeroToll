# Technology Stack

## Programming Languages

### Frontend
- **JavaScript/JSX** - React 19 components and application logic
- **CSS** - Tailwind CSS utility classes and custom styles

### Backend
- **Python 3.x** - FastAPI service implementation

### Smart Contracts
- **Solidity 0.8.24** - Ethereum smart contracts

### Relayer
- **TypeScript/JavaScript** - Node.js service

## Frameworks & Libraries

### Frontend Stack
- **React 19.0.0** - UI framework
- **React Router DOM 7.5.1** - Client-side routing
- **wagmi 2.19.2** - React hooks for Ethereum
- **viem 2.x** - TypeScript Ethereum library
- **@web3modal/wagmi 5.1.11** - Wallet connection modal
- **@tanstack/react-query 5.90.6** - Data fetching and caching
- **@pythnetwork/pyth-evm-js 2.0.0-alpha2** - Pyth oracle integration

### UI Components
- **Radix UI** - Headless accessible components (dialogs, dropdowns, tooltips, etc.)
- **Tailwind CSS 3.4.17** - Utility-first CSS framework
- **tailwindcss-animate 1.0.7** - Animation utilities
- **lucide-react 0.507.0** - Icon library
- **sonner 2.0.3** - Toast notifications
- **class-variance-authority 0.7.1** - Component variant management
- **clsx 2.1.1** - Conditional className utility

### Backend Stack
- **FastAPI 0.104.1** - Modern Python web framework
- **uvicorn 0.24.0** - ASGI server
- **web3 6.15.1** - Python Ethereum library
- **eth-account 0.10.0** - Ethereum account management
- **motor 3.3.2** - Async MongoDB driver
- **pymongo 4.6.0** - MongoDB driver
- **httpx 0.25.2** - Async HTTP client
- **pydantic 2.5.0** - Data validation

### Smart Contracts Stack
- **Hardhat** - Ethereum development environment
- **OpenZeppelin** - Secure contract libraries
- **ERC-4337** - Account abstraction standard

### Indexing
- **The Graph** - Blockchain data indexing
- **@graphprotocol/graph-cli 0.98.1** - Graph CLI tools

## Build Systems

### Frontend
- **Package Manager**: Yarn 1.22.22
- **Build Tool**: Create React App (CRA) with CRACO 7.1.0
- **Bundler**: Webpack (via CRA)
- **PostCSS 8.4.49** - CSS processing
- **Autoprefixer 10.4.20** - CSS vendor prefixing

### Backend
- **Package Manager**: pip
- **Virtual Environment**: venv
- **Server**: uvicorn with auto-reload

### Contracts
- **Package Manager**: Yarn
- **Build Tool**: Hardhat
- **Compiler**: solc (Solidity compiler)

### Workspace
- **pnpm** - Monorepo package manager
- **pnpm-workspace.yaml** - Workspace configuration

## Development Commands

### Frontend
```bash
cd frontend
yarn install          # Install dependencies
yarn start           # Start dev server (port 3000)
yarn build           # Production build
yarn test            # Run tests
```

### Backend
```bash
cd backend
python -m venv venv                    # Create virtual environment
source venv/bin/activate               # Activate (Unix/macOS)
pip install -r requirements.txt        # Install dependencies
uvicorn server:app --reload            # Start dev server (port 8000)
uvicorn server:app --host 0.0.0.0 --port 8000  # Production
```

### Contracts
```bash
cd packages/contracts
yarn install                           # Install dependencies
npx hardhat compile                    # Compile contracts
npx hardhat test                       # Run tests
npx hardhat run scripts/deploy.js      # Deploy contracts
```

### Quick Start (All Services)
```bash
bash start-dev.sh                      # Start backend + frontend
bash start-frontend-only.sh            # Frontend only
```

## Environment Configuration

### Frontend (.env)
```
REACT_APP_API_URL=http://localhost:8000
REACT_APP_CHAIN_ID=80002
REACT_APP_ROUTER_HUB_ADDRESS=0xc6Dd26D3eE0F58fAb15Dc87bEe3A66896B6D4127
```

### Backend (.env)
```
POLYGON_AMOY_RPC=https://rpc-amoy.polygon.technology
ETHEREUM_SEPOLIA_RPC=https://rpc.sepolia.org
PRIVATE_KEY=<deployment_key>
MONGODB_URI=mongodb://localhost:27017
```

### Contracts (.env)
```
PRIVATE_KEY=<deployment_private_key>
POLYGONSCAN_API_KEY=<api_key>
ETHERSCAN_API_KEY=<api_key>
```

## Network Configuration

### Polygon Amoy Testnet
- Chain ID: 80002
- RPC: https://rpc-amoy.polygon.technology
- Explorer: https://amoy.polygonscan.com
- Faucet: https://faucet.polygon.technology

### Ethereum Sepolia Testnet
- Chain ID: 11155111
- RPC: https://rpc.sepolia.org
- Explorer: https://sepolia.etherscan.io
- Faucet: https://sepoliafaucet.com

## Code Quality Tools

### Frontend
- **ESLint 9.23.0** - JavaScript linting
- **eslint-plugin-react 7.37.4** - React-specific rules
- **eslint-plugin-jsx-a11y 6.10.2** - Accessibility linting
- **eslint-plugin-import 2.31.0** - Import/export validation

### Formatting
- Tailwind CSS class ordering
- Consistent component structure
- JSDoc comments for complex functions

## Version Control
- **Git** - Source control
- **.gitignore** - Excludes node_modules, build artifacts, .env files

## Browser Support

### Production
- >0.2% market share
- Not dead browsers
- Not Opera Mini

### Development
- Latest Chrome
- Latest Firefox
- Latest Safari
