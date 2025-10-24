# 🧪 Test Suite Documentation

Đây là test suite toàn diện cho Airdrop Smart Contract project với **80+ test cases**.

## 📋 Test Files Overview

### 1. `MyMintableToken.test.ts` (30+ tests)

Tests cho ERC20 token contract với AccessControl.

**Test Coverage:**

- ✅ **Deployment** (5 tests)
  - Name, symbol, initial supply
  - Role assignments (ADMIN, MINTER, BURNER)
- ✅ **Minting** (4 tests)

  - Authorized minting
  - Unauthorized access prevention
  - Multiple mints
  - Zero amount handling

- ✅ **Burning** (4 tests)

  - Authorized burning
  - Unauthorized access prevention
  - Insufficient balance protection
  - Total supply updates

- ✅ **Role Management** (6 tests)

  - Granting/revoking roles
  - Permission enforcement
  - Role-based function access

- ✅ **ERC20 Functions** (3 tests)

  - Transfer
  - Approve/TransferFrom
  - Allowance

- ✅ **Events** (3 tests)
  - Mint events
  - Burn events
  - Transfer events

### 2. `Airdrop.test.ts` (40+ tests)

Tests cho upgradeable Airdrop contract với Merkle proof verification.

**Test Coverage:**

- ✅ **Deployment & Initialization** (5 tests)

  - Correct initialization
  - Token/merkle root setup
  - Role assignments
  - Anti-reinitialization
  - UUPS proxy verification

- ✅ **Claiming Airdrop** (10 tests)

  - Valid claim with proof
  - Multiple user claims
  - Anti-double claim
  - Invalid proof rejection
  - Wrong amount rejection
  - Unauthorized user rejection
  - Zero amount rejection
  - Token minting verification
  - State updates

- ✅ **Merkle Root Management** (3 tests)

  - Admin updates
  - Non-admin prevention
  - Claims with new root

- ✅ **Upgradeability** (4 tests)

  - Admin upgrade authorization
  - Non-admin upgrade prevention
  - State preservation after upgrade
  - Functionality after upgrade

- ✅ **Access Control** (3 tests)

  - Role verification
  - Role granting
  - Role revoking

- ✅ **Edge Cases** (2 tests)

  - Large amount handling
  - Many users in tree

- ✅ **Events** (2 tests)
  - AirdropClaimed events
  - MerkleRootUpdated events

### 3. `Integration.test.ts` (10+ scenarios)

End-to-end integration tests covering complete workflows.

**Test Scenarios:**

- ✅ **Complete Airdrop Flow**

  - Deploy → Setup → Claim → Verify
  - 10 recipients claiming
  - Total supply verification
  - Double claim prevention

- ✅ **Upgrade Scenarios**

  - Mid-campaign upgrade
  - State preservation
  - Continued operation

- ✅ **Multi-Round Airdrop**

  - Multiple merkle root updates
  - Different recipient sets
  - Sequential rounds

- ✅ **Role Management**

  - Admin transfer
  - Permission verification
  - Access revocation

- ✅ **Gas Optimization**
  - Gas cost measurements
  - Optimization verification

## 🚀 Running Tests

### Run All Tests

```bash
npx hardhat test
```

### Run Specific Test File

```bash
# Token tests only
npx hardhat test test/MyMintableToken.test.ts

# Airdrop tests only
npx hardhat test test/Airdrop.test.ts

# Integration tests only
npx hardhat test test/Integration.test.ts
```

### Run Specific Test Suite

```bash
# Run only "Claiming Airdrop" suite
npx hardhat test --grep "Claiming Airdrop"

# Run only "Upgrade" related tests
npx hardhat test --grep "Upgrade"
```

### Run with Gas Reporting

```bash
REPORT_GAS=1 npx hardhat test
```

### Run with Coverage

```bash
npx hardhat coverage
```

## 📊 Expected Test Results

```
  MyMintableToken
    Deployment
      ✓ Should set the right name and symbol
      ✓ Should grant DEFAULT_ADMIN_ROLE to deployer
      ✓ Should grant MINTER_ROLE to deployer
      ✓ Should grant BURNER_ROLE to deployer
      ✓ Should start with zero total supply
    Minting
      ✓ Should allow MINTER_ROLE to mint tokens
      ✓ Should not allow non-minter to mint tokens
      ... (25+ more tests)

  Airdrop (Upgradeable)
    Deployment & Initialization
      ✓ Should initialize with correct token address
      ✓ Should initialize with correct merkle root
      ... (35+ more tests)

  Integration Tests
    Complete Airdrop Flow
      ✓ Should complete full airdrop campaign
    Upgrade Scenario
      ✓ Should handle upgrade mid-campaign
    ... (8+ more tests)

  80+ passing tests
```

## 🎯 Test Patterns

### 1. Arrange-Act-Assert (AAA)

```typescript
it("Should allow valid user to claim", async function () {
  // Arrange
  const amount = ethers.parseEther("100");
  const proof = merkleTree.getProof(0);

  // Act
  await airdrop.connect(user1).claim(amount, proof);

  // Assert
  expect(await token.balanceOf(user1.address)).to.equal(amount);
});
```

### 2. beforeEach Setup

```typescript
beforeEach(async function () {
  // Deploy contracts
  // Setup merkle tree
  // Grant roles
  // ... common setup for all tests
});
```

### 3. Error Testing

```typescript
// Custom errors
await expect(airdrop.claim(0, proof)).to.be.revertedWithCustomError(airdrop, "ZeroAmount");

// Generic reverts
await expect(token.connect(user1).mint(user2, amount)).to.be.reverted;
```

### 4. Event Testing

```typescript
await expect(airdrop.claim(amount, proof)).to.emit(airdrop, "AirdropClaimed").withArgs(user1.address, amount);
```

## 🔍 Key Test Features

### Merkle Tree Generation

Tests automatically generate Merkle trees using `@openzeppelin/merkle-tree`:

```typescript
const leaves = [
  [user1.address, amount1],
  [user2.address, amount2],
];
const tree = StandardMerkleTree.of(leaves, ["address", "uint256"]);
const proof = tree.getProof(0);
```

### UUPS Proxy Testing

```typescript
const airdrop = await upgrades.deployProxy(Airdrop, [tokenAddress, merkleRoot, admin], {
  initializer: "initialize",
  kind: "uups",
});

// Verify proxy
const implAddress = await upgrades.erc1967.getImplementationAddress(await airdrop.getAddress());
```

### Upgrade Testing

```typescript
// Deploy V1
const airdrop = await upgrades.deployProxy(...);

// Upgrade to V2
const AirdropV2 = await ethers.getContractFactory("Airdrop");
const upgraded = await upgrades.upgradeProxy(
  await airdrop.getAddress(),
  AirdropV2
);

// Verify state preserved
expect(await upgraded.merkleRoot()).to.equal(oldRoot);
```

## 🐛 Debugging Tests

### Verbose Output

```bash
npx hardhat test --verbose
```

### Only Run Failed Tests

```bash
npx hardhat test --bail
```

### Console Logging

Add to test files:

```typescript
console.log("Balance:", await token.balanceOf(user.address));
console.log("Has claimed:", await airdrop.hasClaimed(user.address));
```

## 📈 Coverage Goals

Target coverage:

- ✅ **Statements**: > 95%
- ✅ **Branches**: > 90%
- ✅ **Functions**: > 95%
- ✅ **Lines**: > 95%

Check coverage:

```bash
npx hardhat coverage
```

## 💡 Best Practices

1. ✅ **Test Isolation**: Each test should be independent
2. ✅ **Clear Naming**: Describe what is being tested
3. ✅ **One Assertion**: Focus on one thing per test (when possible)
4. ✅ **Edge Cases**: Test boundary conditions
5. ✅ **Error Cases**: Test failure scenarios
6. ✅ **Events**: Verify event emissions
7. ✅ **State Changes**: Verify state updates
8. ✅ **Gas Costs**: Monitor gas usage

## 🔧 Troubleshooting

### TypeScript Errors

If you see TypeScript errors related to chai matchers:

```bash
# These are type-only errors and won't affect test execution
# Tests will run successfully despite these warnings
```

### Tests Timeout

Increase timeout in test file:

```typescript
describe("My Tests", function () {
  this.timeout(60000); // 60 seconds
  // ... tests
});
```

### Network Issues

If tests fail with network errors:

```bash
# Clean and recompile
npx hardhat clean
npx hardhat compile
npx hardhat test
```

## 📚 Resources

- [Hardhat Testing](https://hardhat.org/tutorial/testing-contracts)
- [Chai Matchers](https://ethereum-waffle.readthedocs.io/en/latest/matchers.html)
- [OpenZeppelin Test Helpers](https://docs.openzeppelin.com/test-helpers/)
- [OpenZeppelin Merkle Tree](https://github.com/OpenZeppelin/merkle-tree)

## 🎓 Adding New Tests

To add new tests:

1. Create test file in `test/` directory
2. Import necessary dependencies
3. Follow AAA pattern
4. Run and verify
5. Update this README

Example template:

```typescript
import { expect } from "chai";
import { ethers } from "hardhat";
import "@nomicfoundation/hardhat-toolbox";

describe("MyNewFeature", function () {
  beforeEach(async function () {
    // Setup
  });

  describe("Feature Category", function () {
    it("Should do something specific", async function () {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

---

**Happy Testing! 🧪✨**

