# 🎁 Upgradeable Token Airdrop System

Hệ thống airdrop token sử dụng Merkle Tree verification và UUPS Proxy pattern cho khả năng upgrade.

---

## 📋 Tổng Quan

### Features

- ✅ **Merkle Tree Airdrop**: Gas-efficient verification, unlimited recipients
- ✅ **UUPS Upgradeable**: Upgrade logic mà không mất data, proxy address không đổi
- ✅ **Access Control**: Role-based permissions (Admin, Minter, Burner)
- ✅ **Type-Safe**: TypeChain auto-generated TypeScript types

---

## 🏗️ Kiến Trúc

```
Recipients List → Generate Merkle Tree → Deploy Contracts → Users Claim

┌─────────────┐
│ Recipients  │  (JSON file)
└──────┬──────┘
       ▼
┌─────────────┐
│  Merkle     │  (Root + Proofs)
│  Generator  │
└──────┬──────┘
       │
       ├──────► Deploy (với merkle root)
       │
       └──────► Users Claim (với proofs)
```

### UUPS Proxy Pattern

```
User → Proxy Contract → Implementation Contract
       (Storage)        (Logic)

Upgrade: Deploy new implementation → Proxy points to new logic
```

---

## 📜 Smart Contracts

### **MyMintableToken.sol**

- ERC20 token với mint/burn functions
- Role-based access control
- Deployer nhận DEFAULT_ADMIN_ROLE

### **Airdrop.sol**

- UUPS upgradeable contract
- Merkle tree verification cho claims
- One-time claim per address
- Admin có thể update merkle root và upgrade

---

## 🔄 Luồng Hoạt Động

### 1. **Setup Recipients**

```bash
# Edit danh sách người nhận
vim scripts/merkle/recipients.json

# Format: [{"address": "0x...", "amount": "1000000000000000000"}]
```

### 2. **Generate Merkle Tree**

```bash
npx hardhat run scripts/merkle/generateMerkle.ts

# Output:
# - merkle.json (root + proofs)
# - tree-structure.json (debug info)
```

### 3. **Deploy Contracts**

```bash
# Localhost
npx hardhat node                           # Terminal 1
npx hardhat deploy --network localhost     # Terminal 2

# Sepolia Testnet
npx hardhat deploy --network sepolia
```

**Deploy script tự động:**

1. Deploy MyMintableToken
2. Load merkle root từ `merkle.json`
3. Deploy Airdrop (UUPS proxy)
4. Initialize với (token, root, admin)
5. Grant MINTER_ROLE cho Airdrop contract

### 4. **Claim Airdrop**

**Contract verification flow:**

```solidity
claim(amount, proof):
  ✓ Check not claimed
  ✓ Verify merkle proof
  ✓ Mark as claimed
  ✓ Mint tokens to user
```

**Test scripts:**

```bash
# Localhost (với impersonation)
npx hardhat run scripts/airdrop/1_airdrop.ts --network localhost

# Sepolia (real transactions)
npx hardhat run scripts/airdrop/2_airdrop.ts --network sepolia
```

### 5. **Update Recipients (Optional)**

```bash
# 1. Edit recipients
vim scripts/merkle/recipients.json

# 2. Regenerate merkle tree
npx hardhat run scripts/merkle/generateMerkle.ts

# 3. Update contract (với ADMIN_ADDRESS)
npx hardhat run scripts/airdrop/setMerkleRoot.ts --network <network>
```

### 6. **Upgrade Contract (Optional)**

```bash
# 1. Edit contract
vim contracts/Airdrop.sol

# 2. Compile
npx hardhat compile

# 3. Upgrade
npx hardhat run scripts/upgrade/upgrade-airdrop.ts --network <network>

# Proxy address không đổi, implementation mới, data preserved ✅
```

---

## ⚙️ Setup & Installation

### Prerequisites

- Node.js >= 18
- Yarn or npm

### Installation

```bash
# 1. Install dependencies
yarn install

# 2. Setup environment
cp .env.example .env
vim .env

# Add:
TESTNET_PRIVATE_KEY=your_private_key
ETHERSCAN_API_KEY=your_api_key

# 3. Compile
npx hardhat compile

# 4. Run tests
npx hardhat test
```

---

## 📖 Quick Start Guide

### Localhost Development

```bash
# Terminal 1: Start node
npx hardhat node

# Terminal 2: Deploy & Test
# 1. Tạo recipients list
vim scripts/merkle/recipients.json

# 2. Generate merkle tree
npx hardhat run scripts/merkle/generateMerkle.ts

# 3. Deploy contracts
npx hardhat deploy --network localhost

# 4. Test airdrop
npx hardhat run scripts/airdrop/1_airdrop.ts --network localhost
```

### Sepolia Testnet

```bash
# 1. Get Sepolia ETH from https://sepoliafaucet.com/

# 2. Generate merkle tree
npx hardhat run scripts/merkle/generateMerkle.ts

# 3. Deploy
npx hardhat deploy --network sepolia

# 4. Test claim
npx hardhat run scripts/airdrop/2_airdrop.ts --network sepolia
```

---

## 📜 Scripts Reference

### Merkle Tree

| Script              | Mục đích                           | Command                                            |
| ------------------- | ---------------------------------- | -------------------------------------------------- |
| `generateMerkle.ts` | Generate merkle tree từ recipients | `npx hardhat run scripts/merkle/generateMerkle.ts` |

### Airdrop

| Script             | Mục đích                            | Network   |
| ------------------ | ----------------------------------- | --------- |
| `1_airdrop.ts`     | Test toàn bộ flow với impersonation | localhost |
| `2_airdrop.ts`     | Test với real wallet                | sepolia   |
| `claim.ts`         | Claim cho địa chỉ cụ thể            | all       |
| `setMerkleRoot.ts` | Update merkle root                  | all       |

### Upgrade

| Script                 | Mục đích                  | Network   |
| ---------------------- | ------------------------- | --------- |
| `test-upgrade-flow.ts` | Test upgrade flow         | localhost |
| `upgrade-airdrop.ts`   | Upgrade deployed contract | all       |

---

## 🔧 Utility Scripts

### Claim cho địa chỉ cụ thể

```bash
# 1. Gán địa chỉ trong file
vim scripts/airdrop/claim.ts
# let CLAIMER_ADDRESS = "0x...";

# 2. Run
npx hardhat run scripts/airdrop/claim.ts --network <network>
```

### Update Merkle Root

```bash
# 1. Gán admin address (optional)
vim scripts/airdrop/setMerkleRoot.ts
# let ADMIN_ADDRESS = "0x...";  // Must have DEFAULT_ADMIN_ROLE

# 2. Run
npx hardhat run scripts/airdrop/setMerkleRoot.ts --network <network>
```

**Notes:**

- **Localhost**: Có thể impersonate bất kỳ địa chỉ nào
- **Sepolia**: Chỉ dùng được signer từ TESTNET_PRIVATE_KEY trong `.env`

---

## 🧪 Testing

```bash
# Run all tests
npx hardhat test

# Run specific test
npx hardhat test test/Airdrop.test.ts

# With gas report
REPORT_GAS=1 npx hardhat test

# With coverage
npx hardhat coverage
```

**Test Categories:**

- ✅ Token: Minting, burning, roles, ERC20 functions
- ✅ Airdrop: Claims, proofs, double-claim prevention, merkle updates

---

## 🔐 Access Control & Roles

### MyMintableToken

| Role                 | Permissions        | Who Has It                 |
| -------------------- | ------------------ | -------------------------- |
| `DEFAULT_ADMIN_ROLE` | Grant/revoke roles | Deployer                   |
| `MINTER_ROLE`        | Mint tokens        | Deployer, Airdrop contract |
| `BURNER_ROLE`        | Burn tokens        | Deployer                   |

### Airdrop Contract

| Role                 | Permissions            | Who Has It             |
| -------------------- | ---------------------- | ---------------------- |
| `DEFAULT_ADMIN_ROLE` | Upgrade, setMerkleRoot | Deployer (admin param) |

---

## 🚀 Deployment

### Deployer Address

```typescript
// hardhat.config.ts
namedAccounts: {
  deployer: 0; // accounts[0]
}
```

| Network       | Deployer                                                       |
| ------------- | -------------------------------------------------------------- |
| **Localhost** | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` (hardhat default) |
| **Sepolia**   | Địa chỉ từ `TESTNET_PRIVATE_KEY` trong `.env`                  |

### Deployment Files

Sau deploy, files được tạo trong `deployments/<network>/`:

- `MyMintableToken.json` - Token address & ABI
- `Airdrop.json` - Proxy address & ABI
- `Airdrop_Implementation.json` - Implementation address
- `Airdrop_Proxy.json` - Proxy details

---

## 🐛 Troubleshooting

| Error                       | Solution                                      |
| --------------------------- | --------------------------------------------- |
| `InvalidProof()`            | Regenerate merkle tree → Update contract root |
| `AlreadyClaimed()`          | User đã claim (expected behavior)             |
| `Deployment file not found` | Run `npx hardhat deploy`                      |
| `Not authorized`            | Check admin role / private key                |
| `Insufficient funds`        | Get ETH from faucet                           |

---

## 📊 Project Structure

```
├── contracts/
│   ├── Airdrop.sol              # Main airdrop contract (upgradeable)
│   ├── MyMintableToken.sol      # ERC20 token
│   └── v2/                      # Upgrade versions (optional)
├── deploy/
│   └── deploy.ts                # Deployment script
├── scripts/
│   ├── merkle/
│   │   ├── generateMerkle.ts    # Generate merkle tree
│   │   ├── recipients.json      # Input: Recipients list
│   │   ├── merkle.json          # Output: Root + proofs
│   │   └── tree-structure.json  # Output: Debug info
│   ├── airdrop/
│   │   ├── 1_airdrop.ts         # Localhost testing
│   │   ├── 2_airdrop.ts         # Sepolia testing
│   │   ├── claim.ts             # Claim utility
│   │   └── setMerkleRoot.ts     # Update root utility
│   └── upgrade/
│       ├── test-upgrade-flow.ts # Test upgrade locally
│       └── upgrade-airdrop.ts   # Upgrade deployed contract
├── test/
│   ├── MyMintableToken.test.ts  # Token tests
│   └── Airdrop.test.ts          # Airdrop tests
└── deployments/                 # Deployment artifacts
    ├── localhost/
    └── sepolia/
```

---

## ⚡ Commands Cheat Sheet

```bash
# Development
npx hardhat compile
npx hardhat test
npx hardhat node
npx hardhat clean

# Merkle Tree
npx hardhat run scripts/merkle/generateMerkle.ts

# Deploy
npx hardhat deploy --network localhost
npx hardhat deploy --network sepolia

# Test Airdrop
npx hardhat run scripts/airdrop/1_airdrop.ts --network localhost
npx hardhat run scripts/airdrop/2_airdrop.ts --network sepolia

# Utilities
npx hardhat run scripts/airdrop/claim.ts --network <network>
npx hardhat run scripts/airdrop/setMerkleRoot.ts --network <network>

# Upgrade
npx hardhat run scripts/upgrade/upgrade-airdrop.ts --network <network>
```

---

## 📚 Resources

- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)
- [Hardhat Documentation](https://hardhat.org/docs)
- [Merkle Trees](https://en.wikipedia.org/wiki/Merkle_tree)
- [UUPS Pattern](https://eips.ethereum.org/EIPS/eip-1822)

---

## 📝 License

ISC

---
