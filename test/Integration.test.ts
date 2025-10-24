import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { Airdrop, MyMintableToken } from "../typechain";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { MerkleTree } from "merkletreejs";
import keccak256 from "keccak256";

// Import chai matchers
import "@nomicfoundation/hardhat-chai-matchers";

describe("Integration Tests", function () {
  let airdrop: Airdrop;
  let token: MyMintableToken;
  let owner: SignerWithAddress;
  let users: SignerWithAddress[];

  describe("Complete Airdrop Flow", function () {
    it("Should complete full airdrop campaign", async function () {
      [owner, ...users] = await ethers.getSigners();

      // Step 1: Deploy Token
      const Token = await ethers.getContractFactory("MyMintableToken");
      token = await Token.deploy();
      await token.waitForDeployment();
      console.log("    ✓ Token deployed");

      // Step 2: Create Merkle Tree with 10 recipients
      const amounts = users.slice(0, 10).map((_, i) => ethers.parseEther((100 * (i + 1)).toString()));
      const leaves = users
        .slice(0, 10)
        .map((user, i) => keccak256(ethers.solidityPacked(["address", "uint256"], [user.address, amounts[i]])));

      const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
      const merkleRoot = "0x" + tree.getRoot().toString("hex");
      console.log("    ✓ Merkle tree created with 10 recipients");

      // Step 3: Deploy Airdrop Contract
      const Airdrop = await ethers.getContractFactory("Airdrop");
      airdrop = (await upgrades.deployProxy(Airdrop, [await token.getAddress(), merkleRoot, owner.address], {
        initializer: "initialize",
        kind: "uups",
      })) as unknown as Airdrop;
      await airdrop.waitForDeployment();
      console.log("    ✓ Airdrop contract deployed");

      // Step 4: Grant MINTER_ROLE to Airdrop
      const MINTER_ROLE = await token.MINTER_ROLE();
      await token.grantRole(MINTER_ROLE, await airdrop.getAddress());
      console.log("    ✓ MINTER_ROLE granted to Airdrop");

      // Step 5: Users claim their airdrops
      let totalClaimed = 0n;
      for (let i = 0; i < 10; i++) {
        const user = users[i];
        const amount = amounts[i];
        const proof = tree.getHexProof(leaves[i]);

        await airdrop.connect(user).claim(amount, proof);
        totalClaimed += amount;

        expect(await token.balanceOf(user.address)).to.equal(amount);
        expect(await airdrop.hasClaimed(user.address)).to.be.true;
      }
      console.log("    ✓ All 10 users claimed successfully");

      // Step 6: Verify total supply
      expect(await token.totalSupply()).to.equal(totalClaimed);
      console.log("    ✓ Total supply matches claimed amount");

      // Step 7: Verify no double claims
      for (let i = 0; i < 10; i++) {
        const proof = tree.getHexProof(leaves[i]);

        await expect(airdrop.connect(users[i]).claim(amounts[i], proof)).to.be.revertedWithCustomError(
          airdrop,
          "AlreadyClaimed"
        );
      }
      console.log("    ✓ Double claim prevention verified");
    });
  });

  describe("Upgrade Scenario", function () {
    let merkleRoot: string;
    let tree: any;
    let leaves: any[];
    let amounts: bigint[];

    beforeEach(async function () {
      [owner, ...users] = await ethers.getSigners();

      // Deploy Token
      const Token = await ethers.getContractFactory("MyMintableToken");
      token = await Token.deploy();
      await token.waitForDeployment();

      // Create Merkle Tree
      amounts = users.slice(0, 5).map((_, i) => ethers.parseEther((100 * (i + 1)).toString()));
      leaves = users
        .slice(0, 5)
        .map((user, i) => keccak256(ethers.solidityPacked(["address", "uint256"], [user.address, amounts[i]])));

      tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
      merkleRoot = "0x" + tree.getRoot().toString("hex");

      // Deploy Airdrop
      const Airdrop = await ethers.getContractFactory("Airdrop");
      airdrop = (await upgrades.deployProxy(Airdrop, [await token.getAddress(), merkleRoot, owner.address], {
        initializer: "initialize",
        kind: "uups",
      })) as unknown as Airdrop;
      await airdrop.waitForDeployment();

      // Grant MINTER_ROLE
      const MINTER_ROLE = await token.MINTER_ROLE();
      await token.grantRole(MINTER_ROLE, await airdrop.getAddress());
    });

    it("Should handle upgrade mid-campaign", async function () {
      // Phase 1: Some users claim before upgrade
      for (let i = 0; i < 2; i++) {
        const proof = tree.getHexProof(leaves[i]);
        await airdrop.connect(users[i]).claim(amounts[i], proof);
      }
      console.log("    ✓ 2 users claimed before upgrade");

      // Upgrade contract
      const AirdropV2 = await ethers.getContractFactory("Airdrop");
      const upgraded = (await upgrades.upgradeProxy(await airdrop.getAddress(), AirdropV2)) as unknown as Airdrop;
      console.log("    ✓ Contract upgraded");

      // Verify state preserved
      expect(await upgraded.hasClaimed(users[0].address)).to.be.true;
      expect(await upgraded.hasClaimed(users[1].address)).to.be.true;
      expect(await upgraded.merkleRoot()).to.equal(merkleRoot);
      console.log("    ✓ State preserved after upgrade");

      // Phase 2: Remaining users claim after upgrade
      for (let i = 2; i < 5; i++) {
        const proof = tree.getHexProof(leaves[i]);
        await upgraded.connect(users[i]).claim(amounts[i], proof);
      }
      console.log("    ✓ 3 users claimed after upgrade");

      // Verify all claims
      for (let i = 0; i < 5; i++) {
        expect(await upgraded.hasClaimed(users[i].address)).to.be.true;
        expect(await token.balanceOf(users[i].address)).to.equal(amounts[i]);
      }
      console.log("    ✓ All claims verified");
    });
  });

  describe("Multi-Round Airdrop", function () {
    it("Should handle multiple airdrop rounds with merkle root updates", async function () {
      [owner, ...users] = await ethers.getSigners();

      // Deploy contracts
      const Token = await ethers.getContractFactory("MyMintableToken");
      token = await Token.deploy();
      await token.waitForDeployment();

      const initialRoot = ethers.keccak256(ethers.toUtf8Bytes("initial"));
      const Airdrop = await ethers.getContractFactory("Airdrop");
      airdrop = (await upgrades.deployProxy(Airdrop, [await token.getAddress(), initialRoot, owner.address], {
        initializer: "initialize",
        kind: "uups",
      })) as unknown as Airdrop;
      await airdrop.waitForDeployment();

      const MINTER_ROLE = await token.MINTER_ROLE();
      await token.grantRole(MINTER_ROLE, await airdrop.getAddress());

      // Round 1: First 3 users
      console.log("    Round 1:");
      const round1Amounts = [100, 200, 300].map((v) => ethers.parseEther(v.toString()));
      const round1Leaves = users
        .slice(0, 3)
        .map((user, i) => keccak256(ethers.solidityPacked(["address", "uint256"], [user.address, round1Amounts[i]])));
      const round1Tree = new MerkleTree(round1Leaves, keccak256, { sortPairs: true });
      await airdrop.setMerkleRoot("0x" + round1Tree.getRoot().toString("hex"));

      for (let i = 0; i < 3; i++) {
        const proof = round1Tree.getHexProof(round1Leaves[i]);
        await airdrop.connect(users[i]).claim(round1Amounts[i], proof);
      }
      console.log("      ✓ 3 users claimed in round 1");

      // Round 2: Next 3 users (users 3-5)
      console.log("    Round 2:");
      const round2Amounts = [200, 400, 600].map((v) => ethers.parseEther(v.toString()));
      const round2Leaves = users
        .slice(3, 6)
        .map((user, i) => keccak256(ethers.solidityPacked(["address", "uint256"], [user.address, round2Amounts[i]])));
      const round2Tree = new MerkleTree(round2Leaves, keccak256, { sortPairs: true });
      await airdrop.setMerkleRoot("0x" + round2Tree.getRoot().toString("hex"));

      for (let i = 0; i < 3; i++) {
        const proof = round2Tree.getHexProof(round2Leaves[i]);
        await airdrop.connect(users[i + 3]).claim(round2Amounts[i], proof);
      }
      console.log("      ✓ 3 users claimed in round 2");

      // Verify all claims
      for (let i = 0; i < 3; i++) {
        expect(await token.balanceOf(users[i].address)).to.equal(round1Amounts[i]);
      }
      for (let i = 3; i < 6; i++) {
        expect(await token.balanceOf(users[i].address)).to.equal(round2Amounts[i - 3]);
      }
      console.log("    ✓ All balances verified");
    });
  });

  describe("Role Management Scenarios", function () {
    it("Should handle admin transfer", async function () {
      [owner, ...users] = await ethers.getSigners();

      // Setup
      const Token = await ethers.getContractFactory("MyMintableToken");
      token = await Token.deploy();
      await token.waitForDeployment();

      const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes("test"));
      const Airdrop = await ethers.getContractFactory("Airdrop");
      airdrop = (await upgrades.deployProxy(Airdrop, [await token.getAddress(), merkleRoot, owner.address], {
        initializer: "initialize",
        kind: "uups",
      })) as unknown as Airdrop;
      await airdrop.waitForDeployment();

      const DEFAULT_ADMIN_ROLE = await airdrop.DEFAULT_ADMIN_ROLE();

      // Transfer admin to user1
      await airdrop.grantRole(DEFAULT_ADMIN_ROLE, users[0].address);
      console.log("    ✓ Admin role granted to new admin");

      // New admin can update merkle root
      const newRoot = ethers.keccak256(ethers.toUtf8Bytes("new-test"));
      await expect(airdrop.connect(users[0]).setMerkleRoot(newRoot))
        .to.emit(airdrop, "MerkleRootUpdated")
        .withArgs(newRoot);
      console.log("    ✓ New admin can update merkle root");

      // Old admin can revoke their own role
      await airdrop.revokeRole(DEFAULT_ADMIN_ROLE, owner.address);
      console.log("    ✓ Old admin role revoked");

      // Old admin can no longer update merkle root
      await expect(airdrop.setMerkleRoot(merkleRoot)).to.be.reverted;
      console.log("    ✓ Old admin access revoked");
    });
  });

  describe("Gas Optimization", function () {
    it("Should measure gas costs for typical operations", async function () {
      [owner, ...users] = await ethers.getSigners();

      // Setup
      const Token = await ethers.getContractFactory("MyMintableToken");
      token = await Token.deploy();
      await token.waitForDeployment();

      const amounts = users.slice(0, 5).map((_, i) => ethers.parseEther((100 * (i + 1)).toString()));
      const leaves = users
        .slice(0, 5)
        .map((user, i) => keccak256(ethers.solidityPacked(["address", "uint256"], [user.address, amounts[i]])));
      const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });

      const Airdrop = await ethers.getContractFactory("Airdrop");
      airdrop = (await upgrades.deployProxy(
        Airdrop,
        [await token.getAddress(), "0x" + tree.getRoot().toString("hex"), owner.address],
        {
          initializer: "initialize",
          kind: "uups",
        }
      )) as unknown as Airdrop;
      await airdrop.waitForDeployment();

      const MINTER_ROLE = await token.MINTER_ROLE();
      await token.grantRole(MINTER_ROLE, await airdrop.getAddress());

      // Measure claim gas cost
      const proof = tree.getHexProof(leaves[0]);
      const tx = await airdrop.connect(users[0]).claim(amounts[0], proof);
      const receipt = await tx.wait();

      console.log(`    Gas used for claim: ${receipt?.gasUsed.toString()}`);
      expect(receipt?.gasUsed).to.be.lessThan(200000n); // Should be less than 200k gas
    });
  });
});
