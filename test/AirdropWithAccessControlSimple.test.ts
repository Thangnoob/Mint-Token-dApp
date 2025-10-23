import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { AirdropWithAccessControl, MyMintableToken } from "../typechain";
import { MerkleTree } from "merkletreejs";

describe("AirdropWithAccessControl - Simple Tests", function () {
  let airdrop: AirdropWithAccessControl;
  let token: MyMintableToken;
  let owner: HardhatEthersSigner;
  let admin: HardhatEthersSigner;
  let pauser: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let merkleTree: MerkleTree;
  let merkleRoot: string;
  let recipients: Array<{ address: string; amount: any }>;

  beforeEach(async function () {
    [owner, admin, pauser, user1, user2] = await ethers.getSigners();

    // Test data
    recipients = [
      { address: user1.address, amount: ethers.parseEther("100") },
      { address: user2.address, amount: ethers.parseEther("200") },
    ];

    // Deploy token
    const TokenFactory = await ethers.getContractFactory("MyMintableToken");
    token = await TokenFactory.deploy();
    await token.waitForDeployment();
    const tokenAddress = await token.getAddress();

    // Create merkle tree
    const leaves = recipients.map((recipient) =>
      ethers.keccak256(ethers.solidityPacked(["address", "uint256"], [recipient.address, recipient.amount]))
    );
    merkleTree = new MerkleTree(leaves, ethers.keccak256, { sortPairs: true });
    merkleRoot = merkleTree.getHexRoot();

    // Deploy airdrop contract
    const AirdropFactory = await ethers.getContractFactory("AirdropWithAccessControl");
    airdrop = await AirdropFactory.deploy(tokenAddress, merkleRoot);
    await airdrop.waitForDeployment();

    // Grant roles
    await airdrop.grantAdminRole(admin.address);
    await airdrop.grantPauserRole(pauser.address);

    // Grant airdrop contract MINTER_ROLE on the token
    await token.grantMinterRole(await airdrop.getAddress());
  });

  describe("Deployment", function () {
    it("Should set the correct token address", async function () {
      expect(await airdrop.token()).to.equal(await token.getAddress());
    });

    it("Should set the correct merkle root", async function () {
      expect(await airdrop.merkleRoot()).to.equal(merkleRoot);
    });

    it("Should set owner as admin", async function () {
      expect(await airdrop.hasRole(await airdrop.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
      expect(await airdrop.hasRole(await airdrop.ADMIN_ROLE(), owner.address)).to.be.true;
    });

    it("Should set correct initial state", async function () {
      expect(await airdrop.isPaused()).to.be.false;
      expect(await airdrop.totalClaimed()).to.equal(0n);
      expect(await airdrop.maxClaimAmount()).to.equal(ethers.parseEther("1000"));
    });
  });

  describe("Role Management", function () {
    it("Should allow owner to grant admin role", async function () {
      await airdrop.connect(owner).grantAdminRole(user1.address);
      expect(await airdrop.hasRole(await airdrop.ADMIN_ROLE(), user1.address)).to.be.true;
    });

    it("Should allow owner to revoke admin role", async function () {
      await airdrop.connect(owner).grantAdminRole(user1.address);
      await airdrop.connect(owner).revokeAdminRole(user1.address);
      expect(await airdrop.hasRole(await airdrop.ADMIN_ROLE(), user1.address)).to.be.false;
    });

    it("Should allow admin to grant pauser role", async function () {
      await airdrop.connect(admin).grantPauserRole(user1.address);
      expect(await airdrop.hasRole(await airdrop.PAUSER_ROLE(), user1.address)).to.be.true;
    });

    it("Should allow admin to revoke pauser role", async function () {
      await airdrop.connect(admin).grantPauserRole(user1.address);
      await airdrop.connect(admin).revokePauserRole(user1.address);
      expect(await airdrop.hasRole(await airdrop.PAUSER_ROLE(), user1.address)).to.be.false;
    });
  });

  describe("Claiming", function () {
    it("Should allow valid claim", async function () {
      const leaf = ethers.keccak256(
        ethers.solidityPacked(["address", "uint256"], [user1.address, recipients[0].amount])
      );
      const proof = merkleTree.getHexProof(leaf);

      await airdrop.connect(user1).claim(recipients[0].amount, proof);

      expect(await airdrop.isClaimed(user1.address)).to.be.true;
      expect(await airdrop.totalClaimed()).to.equal(recipients[0].amount);
      expect(await token.balanceOf(user1.address)).to.equal(recipients[0].amount);
    });

    it("Should not allow double claiming", async function () {
      const leaf = ethers.keccak256(
        ethers.solidityPacked(["address", "uint256"], [user1.address, recipients[0].amount])
      );
      const proof = merkleTree.getHexProof(leaf);

      await airdrop.connect(user1).claim(recipients[0].amount, proof);

      try {
        await airdrop.connect(user1).claim(recipients[0].amount, proof);
        expect.fail("Expected transaction to revert");
      } catch (error: any) {
        expect(error.message).to.include("AlreadyClaimed");
      }
    });

    it("Should not allow claim with invalid proof", async function () {
      const invalidProof = merkleTree.getHexProof(
        ethers.keccak256(ethers.solidityPacked(["address", "uint256"], [user2.address, recipients[1].amount]))
      );

      try {
        await airdrop.connect(user1).claim(recipients[0].amount, invalidProof);
        expect.fail("Expected transaction to revert");
      } catch (error: any) {
        expect(error.message).to.include("InvalidProof");
      }
    });

    it("Should not allow claim with zero amount", async function () {
      const leaf = ethers.keccak256(ethers.solidityPacked(["address", "uint256"], [user1.address, 0]));
      const proof = merkleTree.getHexProof(leaf);

      try {
        await airdrop.connect(user1).claim(0, proof);
        expect.fail("Expected transaction to revert");
      } catch (error: any) {
        expect(error.message).to.include("ZeroAmount");
      }
    });
  });

  describe("Pause/Unpause", function () {
    it("Should allow pauser to pause", async function () {
      await airdrop.connect(pauser).pause();
      expect(await airdrop.isPaused()).to.be.true;
    });

    it("Should allow pauser to unpause", async function () {
      await airdrop.connect(pauser).pause();
      await airdrop.connect(pauser).unpause();
      expect(await airdrop.isPaused()).to.be.false;
    });

    it("Should not allow claim when paused", async function () {
      await airdrop.connect(pauser).pause();

      const leaf = ethers.keccak256(
        ethers.solidityPacked(["address", "uint256"], [user1.address, recipients[0].amount])
      );
      const proof = merkleTree.getHexProof(leaf);

      try {
        await airdrop.connect(user1).claim(recipients[0].amount, proof);
        expect.fail("Expected transaction to revert");
      } catch (error: any) {
        expect(error.message).to.include("AirdropPaused");
      }
    });
  });

  describe("Admin Functions", function () {
    it("Should allow admin to set max claim amount", async function () {
      const newMaxAmount = ethers.parseEther("500");
      await airdrop.connect(admin).setMaxClaimAmount(newMaxAmount);
      expect(await airdrop.maxClaimAmount()).to.equal(newMaxAmount);
    });

    it("Should allow admin to emergency withdraw", async function () {
      // First mint some tokens to the contract
      await token.mint(await airdrop.getAddress(), ethers.parseEther("1000"));

      const initialBalance = await token.balanceOf(admin.address);
      const withdrawAmount = ethers.parseEther("500");

      await airdrop.connect(admin).emergencyWithdraw(withdrawAmount);

      expect(await token.balanceOf(admin.address)).to.equal(initialBalance + withdrawAmount);
    });
  });

  describe("View Functions", function () {
    it("Should return correct hasClaimed status", async function () {
      expect(await airdrop.hasClaimed(user1.address)).to.be.false;

      const leaf = ethers.keccak256(
        ethers.solidityPacked(["address", "uint256"], [user1.address, recipients[0].amount])
      );
      const proof = merkleTree.getHexProof(leaf);

      await airdrop.connect(user1).claim(recipients[0].amount, proof);
      expect(await airdrop.hasClaimed(user1.address)).to.be.true;
    });

    it("Should return correct total claims", async function () {
      expect(await airdrop.getTotalClaims()).to.equal(0n);

      const leaf = ethers.keccak256(
        ethers.solidityPacked(["address", "uint256"], [user1.address, recipients[0].amount])
      );
      const proof = merkleTree.getHexProof(leaf);

      await airdrop.connect(user1).claim(recipients[0].amount, proof);
      expect(await airdrop.getTotalClaims()).to.equal(recipients[0].amount);
    });

    it("Should return correct status", async function () {
      expect(await airdrop.getStatus()).to.be.false;

      await airdrop.connect(pauser).pause();
      expect(await airdrop.getStatus()).to.be.true;
    });
  });

  describe("Multiple Claims", function () {
    it("Should handle multiple valid claims", async function () {
      // User1 claim
      const leaf1 = ethers.keccak256(
        ethers.solidityPacked(["address", "uint256"], [user1.address, recipients[0].amount])
      );
      const proof1 = merkleTree.getHexProof(leaf1);
      await airdrop.connect(user1).claim(recipients[0].amount, proof1);

      // User2 claim
      const leaf2 = ethers.keccak256(
        ethers.solidityPacked(["address", "uint256"], [user2.address, recipients[1].amount])
      );
      const proof2 = merkleTree.getHexProof(leaf2);
      await airdrop.connect(user2).claim(recipients[1].amount, proof2);

      // Verify all claims
      expect(await airdrop.isClaimed(user1.address)).to.be.true;
      expect(await airdrop.isClaimed(user2.address)).to.be.true;

      const totalExpected = recipients[0].amount + recipients[1].amount;
      expect(await airdrop.totalClaimed()).to.equal(totalExpected);

      expect(await token.balanceOf(user1.address)).to.equal(recipients[0].amount);
      expect(await token.balanceOf(user2.address)).to.equal(recipients[1].amount);
    });
  });
});
