import { ethers } from "hardhat";
import { MerkleTree } from "merkletreejs";
import { AirdropWithAccessControl, MyMintableToken } from "../../typechain/contracts";
import fs from "fs";

async function main() {
  console.log("=== Airdrop Testing Script ===");

  // Get signers
  const [deployer, user1, user2, user3] = await ethers.getSigners();
  console.log("Available accounts:");
  console.log("- Deployer:", deployer.address);
  console.log("- User1:", user1.address);
  console.log("- User2:", user2.address);
  console.log("- User3:", user3.address);

  // Connect to deployed contracts
  const tokenContract: MyMintableToken = await ethers.getContract("MyMintableToken");
  const airdropContract: AirdropWithAccessControl = await ethers.getContract("AirdropWithAccessControl");

  console.log("\n=== Contract Information ===");
  console.log("Token Address:", await tokenContract.getAddress());
  console.log("Airdrop Address:", await airdropContract.getAddress());
  console.log("Merkle Root:", await airdropContract.merkleRoot());

  // Test 1: Check if contracts are paused
  console.log("\n=== Test 1: Contract State ===");
  console.log("Is Paused:", await airdropContract.isPaused());
  console.log("Total Claimed:", ethers.formatEther(await airdropContract.totalClaimed()), "MMT");

  // Test 2: Test pause/unpause functionality
  console.log("\n=== Test 2: Pause/Unpause ===");
  try {
    await airdropContract.pause();
    console.log("✓ Contract paused successfully");
    console.log("Is Paused:", await airdropContract.isPaused());

    await airdropContract.unpause();
    console.log("✓ Contract unpaused successfully");
    console.log("Is Paused:", await airdropContract.isPaused());
  } catch (error) {
    console.log("✗ Pause/Unpause test failed:", error);
  }

  // Test 3: Test role management
  console.log("\n=== Test 3: Role Management ===");
  try {
    const PAUSER_ROLE = await airdropContract.PAUSER_ROLE();
    const ADMIN_ROLE = await airdropContract.ADMIN_ROLE();

    console.log("Deployer has Admin role:", await airdropContract.hasRole(ADMIN_ROLE, deployer.address));
    console.log("Deployer has Pauser role:", await airdropContract.hasRole(PAUSER_ROLE, deployer.address));

    // Grant pauser role to user1
    await airdropContract.grantRole(PAUSER_ROLE, user1.address);
    console.log("✓ Granted Pauser role to User1");
    console.log("User1 has Pauser role:", await airdropContract.hasRole(PAUSER_ROLE, user1.address));
  } catch (error) {
    console.log("✗ Role management test failed:", error);
  }

  // Test 4: Test claiming functionality
  console.log("\n=== Test 4: Claim Testing ===");

  // Read merkle data from generated file
  const merkleData = JSON.parse(fs.readFileSync("scripts/merkle/merkle.json", "utf8"));
  const recipients = merkleData.recipients;
  const originalMerkleRoot = await airdropContract.merkleRoot();

  console.log("Merkle Root from file:", merkleData.root);
  console.log("Contract Merkle Root:", originalMerkleRoot);
  console.log("Roots match:", merkleData.root === originalMerkleRoot);
  console.log("Recipients count:", recipients.length);

  // Test claim for first recipient in merkle tree
  if (recipients.length > 0) {
    try {
      const testRecipient = recipients[0];
      const user1Amount = BigInt(testRecipient.amount);
      const proof = testRecipient.proof;

      console.log("Test recipient address:", testRecipient.account);
      console.log("Test recipient amount:", ethers.formatEther(user1Amount), "MMT");
      console.log("Merkle proof length:", proof.length);

      // Check if recipient can claim
      const canClaim = await airdropContract.canClaim(testRecipient.account, user1Amount, proof);
      console.log("Recipient can claim:", canClaim);

      if (canClaim) {
        // Get initial balance
        const initialBalance = await tokenContract.balanceOf(testRecipient.account);
        console.log("Initial balance:", ethers.formatEther(initialBalance), "MMT");

        // Attempt to claim (need to impersonate account for testing)
        await ethers.provider.send("hardhat_impersonateAccount", [testRecipient.account]);
        const recipientSigner = await ethers.getSigner(testRecipient.account);

        // Fund with ETH for gas
        await deployer.sendTransaction({
          to: testRecipient.account,
          value: ethers.parseEther("1"),
        });

        const claimTx = await airdropContract.connect(recipientSigner).claim(user1Amount, proof);
        await claimTx.wait();
        console.log("✓ Claim successful!");

        // Check final balance
        const finalBalance = await tokenContract.balanceOf(testRecipient.account);
        console.log("Final balance:", ethers.formatEther(finalBalance), "MMT");
        console.log("Tokens claimed:", ethers.formatEther(finalBalance - initialBalance), "MMT");
      } else {
        console.log("✗ Recipient cannot claim (not in merkle tree or already claimed)");
      }
    } catch (error) {
      console.log("✗ Claim test failed:", error);
    }
  } else {
    console.log("No recipients found in merkle data");
  }

  // Test 5: Test invalid claim
  console.log("\n=== Test 5: Invalid Claim Test ===");
  try {
    if (recipients.length > 1) {
      const testRecipient = recipients[1];
      const invalidAmount = ethers.parseEther("999");
      const invalidProof = testRecipient.proof; // Using wrong proof

      const canClaimInvalid = await airdropContract.canClaim(testRecipient.account, invalidAmount, invalidProof);
      console.log("Can claim with invalid amount:", canClaimInvalid);

      if (!canClaimInvalid) {
        console.log("✓ Invalid claim correctly rejected");
      } else {
        console.log("✗ Invalid claim was not rejected");
      }
    } else {
      console.log("Not enough recipients for invalid claim test");
    }
  } catch (error) {
    console.log("✓ Invalid claim correctly failed:", (error as Error).message);
  }

  // Test 6: Test double claim
  console.log("\n=== Test 6: Double Claim Test ===");
  try {
    if (recipients.length > 0) {
      const testRecipient = recipients[0];
      const amount = BigInt(testRecipient.amount);
      const proof = testRecipient.proof;

      // Try to claim again
      const canClaimAgain = await airdropContract.canClaim(testRecipient.account, amount, proof);
      console.log("Can claim again:", canClaimAgain);

      if (!canClaimAgain) {
        console.log("✓ Double claim correctly prevented");
      } else {
        console.log("✗ Double claim was not prevented");
      }
    } else {
      console.log("No recipients available for double claim test");
    }
  } catch (error) {
    console.log("✓ Double claim correctly failed:", (error as Error).message);
  }

  console.log("\n=== Test Summary ===");
  console.log("All airdrop tests completed!");
  console.log("Total Claimed:", ethers.formatEther(await airdropContract.totalClaimed()), "MMT");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
