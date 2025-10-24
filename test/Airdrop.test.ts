import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { Airdrop, MyMintableToken } from "../typechain";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { MerkleTree } from "merkletreejs";
import keccak256 from "keccak256";

// Import chai matchers
import "@nomicfoundation/hardhat-chai-matchers";

describe("Airdrop (Upgradeable)", function () {
  let airdrop: Airdrop;
  let token: MyMintableToken;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;
  let notInTree: SignerWithAddress;

  let merkleTree: any;
  let merkleRoot: string;
  let user1Proof: string[];
  let user2Proof: string[];
  let user3Proof: string[];

  const user1Amount = ethers.parseEther("100");
  const user2Amount = ethers.parseEther("200");
  const user3Amount = ethers.parseEther("300");

  beforeEach(async function () {
    [owner, user1, user2, user3, notInTree] = await ethers.getSigners();

    // Deploy Token
    const Token = await ethers.getContractFactory("MyMintableToken");
    token = await Token.deploy();
    await token.waitForDeployment();

    // Create Merkle Tree
    // Create leaves using the same hashing as contract: keccak256(abi.encodePacked(address, amount))
    const leaf1 = keccak256(ethers.solidityPacked(["address", "uint256"], [user1.address, user1Amount]));
    const leaf2 = keccak256(ethers.solidityPacked(["address", "uint256"], [user2.address, user2Amount]));
    const leaf3 = keccak256(ethers.solidityPacked(["address", "uint256"], [user3.address, user3Amount]));

    const leaves = [leaf1, leaf2, leaf3];
    merkleTree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    merkleRoot = "0x" + merkleTree.getRoot().toString("hex");

    // Get proofs
    user1Proof = merkleTree.getHexProof(leaf1);
    user2Proof = merkleTree.getHexProof(leaf2);
    user3Proof = merkleTree.getHexProof(leaf3);

    // Deploy Airdrop (Upgradeable)
    const Airdrop = await ethers.getContractFactory("Airdrop");
    airdrop = (await upgrades.deployProxy(Airdrop, [await token.getAddress(), merkleRoot, owner.address], {
      initializer: "initialize",
      kind: "uups",
    })) as unknown as Airdrop;
    await airdrop.waitForDeployment();

    // Grant MINTER_ROLE to airdrop
    const MINTER_ROLE = await token.MINTER_ROLE();
    await token.grantRole(MINTER_ROLE, await airdrop.getAddress());
  });

  describe("Deployment & Initialization", function () {
    it("Should initialize with correct token address", async function () {
      expect(await airdrop.token()).to.equal(await token.getAddress());
    });

    it("Should initialize with correct merkle root", async function () {
      expect(await airdrop.merkleRoot()).to.equal(merkleRoot);
    });

    it("Should grant DEFAULT_ADMIN_ROLE to admin", async function () {
      const DEFAULT_ADMIN_ROLE = await airdrop.DEFAULT_ADMIN_ROLE();
      expect(await airdrop.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
    });

    it("Should not allow re-initialization", async function () {
      await expect(airdrop.initialize(await token.getAddress(), merkleRoot, owner.address)).to.be.reverted;
    });

    it("Should be UUPS upgradeable", async function () {
      const implementationAddress = await upgrades.erc1967.getImplementationAddress(await airdrop.getAddress());
      expect(implementationAddress).to.not.equal(ethers.ZeroAddress);
    });
  });

  describe("Claiming Airdrop", function () {
    it("Should allow valid user to claim airdrop", async function () {
      await expect(airdrop.connect(user1).claim(user1Amount, user1Proof))
        .to.emit(airdrop, "AirdropClaimed")
        .withArgs(user1.address, user1Amount);

      expect(await token.balanceOf(user1.address)).to.equal(user1Amount);
      expect(await airdrop.hasClaimed(user1.address)).to.be.true;
    });

    it("Should allow multiple users to claim", async function () {
      await airdrop.connect(user1).claim(user1Amount, user1Proof);
      await airdrop.connect(user2).claim(user2Amount, user2Proof);
      await airdrop.connect(user3).claim(user3Amount, user3Proof);

      expect(await token.balanceOf(user1.address)).to.equal(user1Amount);
      expect(await token.balanceOf(user2.address)).to.equal(user2Amount);
      expect(await token.balanceOf(user3.address)).to.equal(user3Amount);
    });

    it("Should not allow claiming twice", async function () {
      await airdrop.connect(user1).claim(user1Amount, user1Proof);

      await expect(airdrop.connect(user1).claim(user1Amount, user1Proof)).to.be.revertedWithCustomError(
        airdrop,
        "AlreadyClaimed"
      );
    });

    it("Should not allow invalid proof", async function () {
      await expect(airdrop.connect(user1).claim(user1Amount, user2Proof)).to.be.revertedWithCustomError(
        airdrop,
        "InvalidProof"
      );
    });

    it("Should not allow claiming with wrong amount", async function () {
      const wrongAmount = ethers.parseEther("999");
      await expect(airdrop.connect(user1).claim(wrongAmount, user1Proof)).to.be.revertedWithCustomError(
        airdrop,
        "InvalidProof"
      );
    });

    it("Should not allow user not in tree to claim", async function () {
      await expect(airdrop.connect(notInTree).claim(user1Amount, user1Proof)).to.be.revertedWithCustomError(
        airdrop,
        "InvalidProof"
      );
    });

    it("Should not allow claiming zero amount", async function () {
      await expect(airdrop.connect(user1).claim(0, user1Proof)).to.be.revertedWithCustomError(airdrop, "ZeroAmount");
    });

    it("Should mint tokens to user on claim", async function () {
      const balanceBefore = await token.balanceOf(user1.address);
      await airdrop.connect(user1).claim(user1Amount, user1Proof);
      const balanceAfter = await token.balanceOf(user1.address);

      expect(balanceAfter - balanceBefore).to.equal(user1Amount);
    });

    it("Should update hasClaimed mapping", async function () {
      expect(await airdrop.hasClaimed(user1.address)).to.be.false;
      await airdrop.connect(user1).claim(user1Amount, user1Proof);
      expect(await airdrop.hasClaimed(user1.address)).to.be.true;
    });
  });

  describe("Merkle Root Management", function () {
    it("Should allow admin to update merkle root", async function () {
      const newRoot = ethers.keccak256(ethers.toUtf8Bytes("new-root"));

      await expect(airdrop.setMerkleRoot(newRoot)).to.emit(airdrop, "MerkleRootUpdated").withArgs(newRoot);

      expect(await airdrop.merkleRoot()).to.equal(newRoot);
    });

    it("Should not allow non-admin to update merkle root", async function () {
      const newRoot = ethers.keccak256(ethers.toUtf8Bytes("new-root"));

      await expect(airdrop.connect(user1).setMerkleRoot(newRoot)).to.be.reverted;
    });

    it("Should work with new merkle root", async function () {
      // User1 claims with old root
      await airdrop.connect(user1).claim(user1Amount, user1Proof);

      // Create new merkle tree (only user2 and user3)
      const newLeaf2 = keccak256(ethers.solidityPacked(["address", "uint256"], [user2.address, user2Amount]));
      const newLeaf3 = keccak256(ethers.solidityPacked(["address", "uint256"], [user3.address, user3Amount]));
      const newLeaves = [newLeaf2, newLeaf3];
      const newTree = new MerkleTree(newLeaves, keccak256, { sortPairs: true });
      const newRoot = "0x" + newTree.getRoot().toString("hex");

      // Update merkle root
      await airdrop.setMerkleRoot(newRoot);

      // User2 can still claim with new tree
      const newUser2Proof = newTree.getHexProof(newLeaf2);

      // User2 can claim (not claimed before)
      await expect(airdrop.connect(user2).claim(user2Amount, newUser2Proof))
        .to.emit(airdrop, "AirdropClaimed")
        .withArgs(user2.address, user2Amount);
    });
  });

  describe("Upgradeability", function () {
    it("Should allow admin to upgrade", async function () {
      const AirdropV2 = await ethers.getContractFactory("Airdrop");
      const upgraded = await upgrades.upgradeProxy(await airdrop.getAddress(), AirdropV2);

      expect(await upgraded.getAddress()).to.equal(await airdrop.getAddress());
    });

    it("Should not allow non-admin to upgrade", async function () {
      const AirdropV2 = await ethers.getContractFactory("Airdrop", user1);

      await expect(upgrades.upgradeProxy(await airdrop.getAddress(), AirdropV2)).to.be.reverted;
    });

    it("Should preserve state after upgrade", async function () {
      // Claim before upgrade
      await airdrop.connect(user1).claim(user1Amount, user1Proof);

      // Upgrade
      const AirdropV2 = await ethers.getContractFactory("Airdrop");
      const upgraded = (await upgrades.upgradeProxy(await airdrop.getAddress(), AirdropV2)) as unknown as Airdrop;

      // Check state is preserved
      expect(await upgraded.hasClaimed(user1.address)).to.be.true;
      expect(await upgraded.merkleRoot()).to.equal(merkleRoot);
      expect(await upgraded.token()).to.equal(await token.getAddress());
    });

    it("Should work after upgrade", async function () {
      // Upgrade
      const AirdropV2 = await ethers.getContractFactory("Airdrop");
      const upgraded = (await upgrades.upgradeProxy(await airdrop.getAddress(), AirdropV2)) as unknown as Airdrop;

      // Should work normally
      await expect(upgraded.connect(user1).claim(user1Amount, user1Proof))
        .to.emit(upgraded, "AirdropClaimed")
        .withArgs(user1.address, user1Amount);
    });
  });

  describe("Access Control", function () {
    it("Should have correct DEFAULT_ADMIN_ROLE", async function () {
      const DEFAULT_ADMIN_ROLE = await airdrop.DEFAULT_ADMIN_ROLE();
      expect(await airdrop.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
    });

    it("Should allow admin to grant roles", async function () {
      const DEFAULT_ADMIN_ROLE = await airdrop.DEFAULT_ADMIN_ROLE();
      await airdrop.grantRole(DEFAULT_ADMIN_ROLE, user1.address);
      expect(await airdrop.hasRole(DEFAULT_ADMIN_ROLE, user1.address)).to.be.true;
    });

    it("Should allow admin to revoke roles", async function () {
      const DEFAULT_ADMIN_ROLE = await airdrop.DEFAULT_ADMIN_ROLE();
      await airdrop.grantRole(DEFAULT_ADMIN_ROLE, user1.address);
      await airdrop.revokeRole(DEFAULT_ADMIN_ROLE, user1.address);
      expect(await airdrop.hasRole(DEFAULT_ADMIN_ROLE, user1.address)).to.be.false;
    });
  });

  describe("Edge Cases", function () {
    it("Should handle large amounts", async function () {
      const largeAmount = ethers.parseEther("1000000000");
      const leaf = keccak256(ethers.solidityPacked(["address", "uint256"], [user1.address, largeAmount]));
      const tree = new MerkleTree([leaf], keccak256, { sortPairs: true });
      const root = "0x" + tree.getRoot().toString("hex");
      const proof = tree.getHexProof(leaf);

      await airdrop.setMerkleRoot(root);

      await expect(airdrop.connect(user1).claim(largeAmount, proof))
        .to.emit(airdrop, "AirdropClaimed")
        .withArgs(user1.address, largeAmount);
    });

    it("Should handle many users in tree", async function () {
      // Create tree with 10 users
      const signers = await ethers.getSigners();
      const leaves = signers
        .slice(0, 10)
        .map((s, i) =>
          keccak256(ethers.solidityPacked(["address", "uint256"], [s.address, ethers.parseEther((i + 1).toString())]))
        );

      const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
      const root = "0x" + tree.getRoot().toString("hex");
      await airdrop.setMerkleRoot(root);

      // Each user should be able to claim
      for (let i = 0; i < 5; i++) {
        const proof = tree.getHexProof(leaves[i]);
        const amount = ethers.parseEther((i + 1).toString());
        await expect(airdrop.connect(signers[i]).claim(amount, proof))
          .to.emit(airdrop, "AirdropClaimed")
          .withArgs(signers[i].address, amount);
      }
    });
  });

  describe("Events", function () {
    it("Should emit AirdropClaimed event", async function () {
      await expect(airdrop.connect(user1).claim(user1Amount, user1Proof))
        .to.emit(airdrop, "AirdropClaimed")
        .withArgs(user1.address, user1Amount);
    });

    it("Should emit MerkleRootUpdated event", async function () {
      const newRoot = ethers.keccak256(ethers.toUtf8Bytes("new-root"));
      await expect(airdrop.setMerkleRoot(newRoot)).to.emit(airdrop, "MerkleRootUpdated").withArgs(newRoot);
    });
  });
});
