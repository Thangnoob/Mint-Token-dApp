import { expect } from "chai";
import { ethers } from "hardhat";
import { readFileSync } from "fs";
import { MerkleTree } from "merkletreejs";

describe("Airdrop Claim Tests", function () {
  let token: any;
  let airdrop: any;
  let merkleRoot: string;
  let merkleTree: MerkleTree;
  let recipientsWithProofs: any[];
  let deployer: any;
  let recipient1: any;
  let recipient2: any;

  beforeEach(async function () {
    // Get signers
    [deployer, recipient1, recipient2] = await ethers.getSigners();

    // Read recipients data
    const recipientsData = JSON.parse(readFileSync("scripts/whitelist/recipients.json", "utf8"));

    // Create Merkle tree
    const leaves = recipientsData.map((recipient: any) =>
      ethers.keccak256(ethers.solidityPacked(["address", "uint256"], [recipient.address, recipient.amount]))
    );
    merkleTree = new MerkleTree(leaves, ethers.keccak256, { sortPairs: true });
    merkleRoot = merkleTree.getHexRoot();

    // Generate proofs for each recipient
    recipientsWithProofs = recipientsData.map((recipient: any) => {
      const leaf = ethers.keccak256(
        ethers.solidityPacked(["address", "uint256"], [recipient.address, recipient.amount])
      );
      const proof = merkleTree.getHexProof(leaf);

      return {
        address: recipient.address,
        amount: recipient.amount,
        proof: proof,
      };
    });

    // Deploy token
    const TokenFactory = await ethers.getContractFactory("MyMintableToken");
    token = await TokenFactory.deploy();
    await token.waitForDeployment();

    // Deploy airdrop
    const AirdropFactory = await ethers.getContractFactory("AirdropWithAccessControl");
    airdrop = await AirdropFactory.deploy(await token.getAddress(), merkleRoot);
    await airdrop.waitForDeployment();

    // Grant MINTER_ROLE to airdrop
    await token.grantMinterRole(await airdrop.getAddress());
  });

  describe("Merkle Tree Generation", function () {
    it("Should generate Merkle tree correctly", async function () {
      expect(merkleRoot).to.not.equal("0x0000000000000000000000000000000000000000000000000000000000000000");
      expect(recipientsWithProofs).to.have.length(2);
    });

    it("Should generate valid proofs for all recipients", async function () {
      for (let i = 0; i < recipientsWithProofs.length; i++) {
        const recipient = recipientsWithProofs[i];
        const leaf = ethers.keccak256(
          ethers.solidityPacked(["address", "uint256"], [recipient.address, recipient.amount])
        );
        const isValid = merkleTree.verify(recipient.proof, leaf, merkleRoot);
        expect(isValid).to.be.true;
      }
    });
  });

  describe("Contract Deployment", function () {
    it("Should deploy token contract", async function () {
      expect(await token.getAddress()).to.not.equal(ethers.ZeroAddress);
      expect(await token.name()).to.equal("MyMintableToken");
      expect(await token.symbol()).to.equal("MMT");
    });

    it("Should deploy airdrop contract", async function () {
      expect(await airdrop.getAddress()).to.not.equal(ethers.ZeroAddress);
      expect(await airdrop.token()).to.equal(await token.getAddress());
      expect(await airdrop.merkleRoot()).to.equal(merkleRoot);
    });

    it("Should grant MINTER_ROLE to airdrop", async function () {
      const minterRole = await token.MINTER_ROLE();
      expect(await token.hasRole(minterRole, await airdrop.getAddress())).to.be.true;
    });
  });

  describe("Claiming Functionality", function () {
    it("Should allow valid claims", async function () {
      const recipient = recipientsWithProofs[0];

      // Impersonate the recipient
      await ethers.provider.send("hardhat_impersonateAccount", [recipient.address]);
      const recipientSigner = await ethers.getSigner(recipient.address);

      // Fund the recipient with ETH for gas
      await deployer.sendTransaction({
        to: recipient.address,
        value: ethers.parseEther("1"),
      });

      const initialBalance = await token.balanceOf(recipient.address);
      expect(initialBalance).to.equal(0n);

      // Claim tokens
      const tx = await airdrop.connect(recipientSigner).claim(recipient.amount, recipient.proof);
      await tx.wait();

      const finalBalance = await token.balanceOf(recipient.address);
      expect(finalBalance).to.equal(BigInt(recipient.amount));
      expect(await airdrop.isClaimed(recipient.address)).to.be.true;

      // Stop impersonation
      await ethers.provider.send("hardhat_stopImpersonatingAccount", [recipient.address]);
    });

    it("Should prevent double claiming", async function () {
      const recipient = recipientsWithProofs[0];

      // Impersonate the recipient
      await ethers.provider.send("hardhat_impersonateAccount", [recipient.address]);
      const recipientSigner = await ethers.getSigner(recipient.address);

      // Fund the recipient with ETH for gas
      await deployer.sendTransaction({
        to: recipient.address,
        value: ethers.parseEther("1"),
      });

      // First claim should succeed
      const tx1 = await airdrop.connect(recipientSigner).claim(recipient.amount, recipient.proof);
      await tx1.wait();

      // Second claim should fail
      try {
        await airdrop.connect(recipientSigner).claim(recipient.amount, recipient.proof);
        expect.fail("Expected AlreadyClaimed error");
      } catch (error: any) {
        expect(error.message).to.include("AlreadyClaimed");
      }

      // Stop impersonation
      await ethers.provider.send("hardhat_stopImpersonatingAccount", [recipient.address]);
    });

    it("Should reject invalid proofs", async function () {
      const invalidProof = ["0x0000000000000000000000000000000000000000000000000000000000000000"];

      try {
        await airdrop.claim(ethers.parseEther("1"), invalidProof);
        expect.fail("Expected InvalidProof error");
      } catch (error: any) {
        expect(error.message).to.include("InvalidProof");
      }
    });

    it("Should reject claims when paused", async function () {
      const recipient = recipientsWithProofs[0];

      // Pause airdrop
      await airdrop.pause();
      expect(await airdrop.isPaused()).to.be.true;

      // Try to claim while paused
      try {
        await airdrop.claim(recipient.amount, recipient.proof);
        expect.fail("Expected AirdropPaused error");
      } catch (error: any) {
        expect(error.message).to.include("AirdropPaused");
      }

      // Unpause airdrop
      await airdrop.unpause();
      expect(await airdrop.isPaused()).to.be.false;
    });

    it("Should reject zero amount claims", async function () {
      const recipient = recipientsWithProofs[0];

      try {
        await airdrop.claim(0, recipient.proof);
        expect.fail("Expected ZeroAmount error");
      } catch (error: any) {
        expect(error.message).to.include("ZeroAmount");
      }
    });

    it("Should reject claims exceeding max amount", async function () {
      const recipient = recipientsWithProofs[0];
      const maxAmount = await airdrop.maxClaimAmount();
      const excessiveAmount = maxAmount + 1n;

      try {
        await airdrop.claim(excessiveAmount, recipient.proof);
        expect.fail("Expected ExceedsMaxClaimAmount error");
      } catch (error: any) {
        expect(error.message).to.include("ExceedsMaxClaimAmount");
      }
    });
  });

  describe("Admin Functions", function () {
    it("Should allow admin to pause/unpause", async function () {
      expect(await airdrop.isPaused()).to.be.false;

      await airdrop.pause();
      expect(await airdrop.isPaused()).to.be.true;

      await airdrop.unpause();
      expect(await airdrop.isPaused()).to.be.false;
    });

    it("Should allow admin to update max claim amount", async function () {
      const newMaxAmount = ethers.parseEther("1000");
      await airdrop.setMaxClaimAmount(newMaxAmount);
      expect(await airdrop.maxClaimAmount()).to.equal(newMaxAmount);
    });

    it("Should allow admin to emergency withdraw", async function () {
      // Mint some tokens to airdrop contract
      await token.mint(await airdrop.getAddress(), ethers.parseEther("1000"));

      const initialBalance = await token.balanceOf(deployer.address);
      const withdrawAmount = ethers.parseEther("500");

      await airdrop.emergencyWithdraw(withdrawAmount);

      const finalBalance = await token.balanceOf(deployer.address);
      expect(finalBalance - initialBalance).to.equal(withdrawAmount);
    });
  });

  describe("View Functions", function () {
    it("Should return correct token address", async function () {
      expect(await airdrop.token()).to.equal(await token.getAddress());
    });

    it("Should return correct merkle root", async function () {
      expect(await airdrop.merkleRoot()).to.equal(merkleRoot);
    });

    it("Should return correct total claimed", async function () {
      expect(await airdrop.totalClaimed()).to.equal(0n);
    });

    it("Should return correct max claim amount", async function () {
      const maxAmount = await airdrop.maxClaimAmount();
      expect(Number(maxAmount)).to.be.greaterThan(0);
    });
  });

  describe("Role Management", function () {
    it("Should have correct roles assigned to deployer", async function () {
      const adminRole = await airdrop.ADMIN_ROLE();
      const pauserRole = await airdrop.PAUSER_ROLE();
      const claimManagerRole = await airdrop.CLAIM_MANAGER_ROLE();

      expect(await airdrop.hasRole(adminRole, deployer.address)).to.be.true;
      expect(await airdrop.hasRole(pauserRole, deployer.address)).to.be.true;
      expect(await airdrop.hasRole(claimManagerRole, deployer.address)).to.be.true;
    });
  });

  describe("Integration Tests", function () {
    it("Should handle multiple recipients claiming", async function () {
      let totalClaimed = 0n;

      for (let i = 0; i < recipientsWithProofs.length; i++) {
        const recipient = recipientsWithProofs[i];

        // Impersonate the recipient
        await ethers.provider.send("hardhat_impersonateAccount", [recipient.address]);
        const recipientSigner = await ethers.getSigner(recipient.address);

        // Fund the recipient with ETH for gas
        await deployer.sendTransaction({
          to: recipient.address,
          value: ethers.parseEther("1"),
        });

        // Claim tokens
        const tx = await airdrop.connect(recipientSigner).claim(recipient.amount, recipient.proof);
        await tx.wait();

        totalClaimed += BigInt(recipient.amount);

        // Stop impersonation
        await ethers.provider.send("hardhat_stopImpersonatingAccount", [recipient.address]);
      }

      expect(await airdrop.totalClaimed()).to.equal(totalClaimed);
    });

    it("Should emit Claimed event on successful claim", async function () {
      const recipient = recipientsWithProofs[0];

      // Impersonate the recipient
      await ethers.provider.send("hardhat_impersonateAccount", [recipient.address]);
      const recipientSigner = await ethers.getSigner(recipient.address);

      // Fund the recipient with ETH for gas
      await deployer.sendTransaction({
        to: recipient.address,
        value: ethers.parseEther("1"),
      });

      // Claim tokens and check event
      const tx = await airdrop.connect(recipientSigner).claim(recipient.amount, recipient.proof);
      const receipt = await tx.wait();

      // Check if Claimed event was emitted
      const claimedEvent = receipt?.logs.find((log: any) => {
        try {
          const parsed = airdrop.interface.parseLog(log);
          return parsed?.name === "Claimed";
        } catch {
          return false;
        }
      });

      expect(claimedEvent).to.not.be.undefined;

      // Stop impersonation
      await ethers.provider.send("hardhat_stopImpersonatingAccount", [recipient.address]);
    });
  });
});
