# Airdrop Contract with AccessControl

Đây là một project Hardhat chứa contract Airdrop với tích hợp AccessControl, cho phép quản lý quyền hạn linh hoạt và an toàn.

## Cấu trúc Project

### Contracts

- **`AirdropWithAccessControl.sol`**: Contract chính với AccessControl integration
- **`MyMintableToken.sol`**: ERC20 token có thể mint với AccessControl

### Tests

- **`AirdropWithAccessControlSimple.test.ts`**: Test file với 21 test cases, tất cả đều pass

### Scripts

- **`deployAirdropWithAccessControl.ts`**: Script deploy contract với sample data
- **`generateMerkle.ts`**: Script tạo Merkle tree cho airdrop

## Tính năng chính

### AirdropWithAccessControl Contract

- **AccessControl Integration**: Sử dụng OpenZeppelin AccessControl
- **Role Management**:
  - `ADMIN_ROLE`: Quản lý các chức năng admin
  - `PAUSER_ROLE`: Có thể tạm dừng/khôi phục contract
  - `CLAIM_MANAGER_ROLE`: Quản lý việc claim
- **Core Functions**:
  - Claim airdrop với Merkle proof verification
  - Pause/Unpause functionality
  - Emergency withdraw
  - Max claim amount setting
  - Comprehensive error handling

### MyMintableToken Contract

- **ERC20 Token** với AccessControl
- **Minting/Burning** với role-based permissions
- **Role Management** cho MINTER_ROLE và BURNER_ROLE

## Cài đặt và Chạy

### Prerequisites

- Node.js
- Yarn hoặc npm

### Installation

```bash
yarn install
```

### Compile

```bash
npx hardhat compile
```

### Test

```bash
npx hardhat test
```

### Deploy

```bash
npx hardhat run scripts/deployAirdropWithAccessControl.ts
```

## Test Results

- **21/21 tests passing**
- Contract size: 5.129 KiB
- Tất cả core functionality đều hoạt động đúng

## Deployment Info

Sau khi deploy, thông tin sẽ được lưu trong:

- `deployments/localhost/AirdropWithAccessControl.json`

## Cấu trúc Files sau khi dọn dẹp

```
├── contracts/
│   ├── AirdropWithAccessControl.sol
│   └── MyMintableToken.sol
├── scripts/
│   ├── deployAirdropWithAccessControl.ts
│   └── generateMerkle.ts
├── test/
│   └── AirdropWithAccessControlSimple.test.ts
├── data/
│   └── merkle-data/
├── deployments/
│   ├── localhost/
│   └── sepolia/
└── artifacts/
```

## Lưu ý

- Project đã được dọn dẹp, loại bỏ các file thừa
- Chỉ giữ lại các file cần thiết cho functionality chính
- Tất cả test cases đều pass
- Contract sẵn sàng để deploy và sử dụng
