// import { expect } from "chai";
// import { ethers } from "hardhat";
// import { MyMintableToken } from "../typechain-types";
// import { Signer } from "ethers";

// describe("MyMintableToken", function () {
//   let token: MyMintableToken;
//   let owner: Signer;
//   let addr1: Signer;

//   beforeEach(async function () {
//     [owner, addr1] = await ethers.getSigners();
//     const Token = await ethers.getContractFactory("MyMintableToken");
//     token = (await Token.deploy()) as MyMintableToken;
//     await token.waitForDeployment();
//   });

//   it("should mint tokens", async function () {
//     const amount = ethers.parseEther("1000");
//     await token.mint(await addr1.getAddress(), amount);
//     expect(await token.balanceOf(await addr1.getAddress())).to.equal(amount);

//     // Test emit event
//     await expect(token.mint(await addr1.getAddress(), amount))
//       .to.emit(token, "Mint")
//       .withArgs(await addr1.getAddress(), amount);
//   });

//   it("should burn tokens", async function () {
//     const amount = ethers.parseEther("1000");
//     await token.mint(await addr1.getAddress(), amount);
//     await token.burn(await addr1.getAddress(), amount);
//     expect(await token.balanceOf(await addr1.getAddress())).to.equal(0);

//     // Test emit event
//     await expect(token.burn(await addr1.getAddress(), 0))
//       .to.emit(token, "Burn")
//       .withArgs(await addr1.getAddress(), 0);
//   });

//   it("should restrict minting to owner", async function () {
//     const amount = ethers.parseEther("1000");
//     await expect(token.connect(addr1).mint(await addr1.getAddress(), amount))
//       .to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount")
//       .withArgs(await addr1.getAddress());
//   });
// });
