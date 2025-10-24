import { expect } from "chai";
import { ethers } from "hardhat";
import { MyMintableToken } from "../typechain/contracts/MyMintableToken";
import { MyMintableToken__factory } from "../typechain/factories/contracts/MyMintableToken__factory";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

// Import chai matchers
import "@nomicfoundation/hardhat-chai-matchers";

describe("MyMintableToken", function () {
  let token: MyMintableToken;
  let owner: SignerWithAddress;
  let minter: SignerWithAddress;
  let burner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  beforeEach(async function () {
    [owner, minter, burner, user1, user2] = await ethers.getSigners();

    // Deploy token
    token = await new MyMintableToken__factory(owner).deploy();
    await token.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right name and symbol", async function () {
      expect(await token.name()).to.equal("MyMintableToken");
      expect(await token.symbol()).to.equal("MMT");
    });

    it("Should grant DEFAULT_ADMIN_ROLE to deployer", async function () {
      const DEFAULT_ADMIN_ROLE = await token.DEFAULT_ADMIN_ROLE();
      expect(await token.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
    });

    it("Should grant MINTER_ROLE to deployer", async function () {
      const MINTER_ROLE = await token.MINTER_ROLE();
      expect(await token.hasRole(MINTER_ROLE, owner.address)).to.be.true;
    });

    it("Should grant BURNER_ROLE to deployer", async function () {
      const BURNER_ROLE = await token.BURNER_ROLE();
      expect(await token.hasRole(BURNER_ROLE, owner.address)).to.be.true;
    });

    it("Should start with zero total supply", async function () {
      expect(await token.totalSupply()).to.equal(0);
    });
  });

  describe("Minting", function () {
    it("Should allow MINTER_ROLE to mint tokens", async function () {
      const amount = ethers.parseEther("100");

      await expect(token.mint(user1.address, amount)).to.emit(token, "Mint").withArgs(user1.address, amount);

      expect(await token.balanceOf(user1.address)).to.equal(amount);
      expect(await token.totalSupply()).to.equal(amount);
    });

    it("Should not allow non-minter to mint tokens", async function () {
      const amount = ethers.parseEther("100");

      await expect(token.connect(user1).mint(user2.address, amount)).to.be.reverted;
    });

    it("Should allow minting to multiple addresses", async function () {
      const amount1 = ethers.parseEther("100");
      const amount2 = ethers.parseEther("200");

      await token.mint(user1.address, amount1);
      await token.mint(user2.address, amount2);

      expect(await token.balanceOf(user1.address)).to.equal(amount1);
      expect(await token.balanceOf(user2.address)).to.equal(amount2);
      expect(await token.totalSupply()).to.equal(amount1 + amount2);
    });

    it("Should allow minting zero tokens", async function () {
      await expect(token.mint(user1.address, 0)).to.emit(token, "Mint").withArgs(user1.address, 0);
    });
  });

  describe("Burning", function () {
    beforeEach(async function () {
      // Mint some tokens first
      await token.mint(user1.address, ethers.parseEther("1000"));
    });

    it("Should allow BURNER_ROLE to burn tokens", async function () {
      const burnAmount = ethers.parseEther("100");
      const initialBalance = await token.balanceOf(user1.address);

      await expect(token.burn(user1.address, burnAmount)).to.emit(token, "Burn").withArgs(user1.address, burnAmount);

      expect(await token.balanceOf(user1.address)).to.equal(initialBalance - burnAmount);
    });

    it("Should not allow non-burner to burn tokens", async function () {
      const burnAmount = ethers.parseEther("100");

      await expect(token.connect(user1).burn(user1.address, burnAmount)).to.be.reverted;
    });

    it("Should revert when burning more than balance", async function () {
      const balance = await token.balanceOf(user1.address);
      const burnAmount = balance + ethers.parseEther("1");

      await expect(token.burn(user1.address, burnAmount)).to.be.reverted;
    });

    it("Should update total supply after burning", async function () {
      const burnAmount = ethers.parseEther("100");
      const initialSupply = await token.totalSupply();

      await token.burn(user1.address, burnAmount);

      expect(await token.totalSupply()).to.equal(initialSupply - burnAmount);
    });
  });

  describe("Role Management", function () {
    it("Should allow admin to grant MINTER_ROLE", async function () {
      const MINTER_ROLE = await token.MINTER_ROLE();

      await token.grantRole(MINTER_ROLE, minter.address);

      expect(await token.hasRole(MINTER_ROLE, minter.address)).to.be.true;
    });

    it("Should allow admin to grant BURNER_ROLE", async function () {
      const BURNER_ROLE = await token.BURNER_ROLE();

      await token.grantRole(BURNER_ROLE, burner.address);

      expect(await token.hasRole(BURNER_ROLE, burner.address)).to.be.true;
    });

    it("Should allow admin to revoke MINTER_ROLE", async function () {
      const MINTER_ROLE = await token.MINTER_ROLE();

      await token.grantRole(MINTER_ROLE, minter.address);
      await token.revokeRole(MINTER_ROLE, minter.address);

      expect(await token.hasRole(MINTER_ROLE, minter.address)).to.be.false;
    });

    it("Should not allow non-admin to grant roles", async function () {
      const MINTER_ROLE = await token.MINTER_ROLE();

      await expect(token.connect(user1).grantRole(MINTER_ROLE, user2.address)).to.be.reverted;
    });

    it("Should allow new minter to mint tokens", async function () {
      const MINTER_ROLE = await token.MINTER_ROLE();
      await token.grantRole(MINTER_ROLE, minter.address);

      const amount = ethers.parseEther("100");
      await expect(token.connect(minter).mint(user1.address, amount))
        .to.emit(token, "Mint")
        .withArgs(user1.address, amount);
    });

    it("Should allow new burner to burn tokens", async function () {
      // Mint tokens first
      await token.mint(user1.address, ethers.parseEther("1000"));

      // Grant burner role
      const BURNER_ROLE = await token.BURNER_ROLE();
      await token.grantRole(BURNER_ROLE, burner.address);

      const burnAmount = ethers.parseEther("100");
      await expect(token.connect(burner).burn(user1.address, burnAmount))
        .to.emit(token, "Burn")
        .withArgs(user1.address, burnAmount);
    });
  });

  describe("ERC20 Standard Functions", function () {
    beforeEach(async function () {
      await token.mint(user1.address, ethers.parseEther("1000"));
    });

    it("Should transfer tokens between accounts", async function () {
      const amount = ethers.parseEther("100");

      await token.connect(user1).transfer(user2.address, amount);

      expect(await token.balanceOf(user2.address)).to.equal(amount);
    });

    it("Should approve and transferFrom", async function () {
      const amount = ethers.parseEther("100");

      await token.connect(user1).approve(user2.address, amount);
      await token.connect(user2).transferFrom(user1.address, user2.address, amount);

      expect(await token.balanceOf(user2.address)).to.equal(amount);
    });

    it("Should return correct allowance", async function () {
      const amount = ethers.parseEther("100");

      await token.connect(user1).approve(user2.address, amount);

      expect(await token.allowance(user1.address, user2.address)).to.equal(amount);
    });
  });

  describe("Events", function () {
    it("Should emit Mint event on minting", async function () {
      const amount = ethers.parseEther("100");

      await expect(token.mint(user1.address, amount)).to.emit(token, "Mint").withArgs(user1.address, amount);
    });

    it("Should emit Burn event on burning", async function () {
      await token.mint(user1.address, ethers.parseEther("1000"));
      const burnAmount = ethers.parseEther("100");

      await expect(token.burn(user1.address, burnAmount)).to.emit(token, "Burn").withArgs(user1.address, burnAmount);
    });

    it("Should emit Transfer event on minting", async function () {
      const amount = ethers.parseEther("100");

      await expect(token.mint(user1.address, amount))
        .to.emit(token, "Transfer")
        .withArgs(ethers.ZeroAddress, user1.address, amount);
    });
  });
});
