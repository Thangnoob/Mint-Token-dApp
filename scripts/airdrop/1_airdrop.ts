import { ethers, network } from "hardhat";
import { Airdrop, MyMintableToken } from "../../typechain";
import { Airdrop__factory } from "../../typechain/factories/contracts/Airdrop.sol";
import { MyMintableToken__factory } from "../../typechain/factories/contracts";
import fs from "fs";

async function main() {
  console.log("🧪 Testing Airdrop on", network.name);

  const [deployer, user1, user2] = await ethers.getSigners();

  const deploymentPath = `deployments/${network.name}/Airdrop.json`;
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`❌ Deployment not found for ${network.name}`);
  }

  const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const airdropAddress = deploymentInfo.address;

  const tokenDeploymentPath = `deployments/${network.name}/MyMintableToken.json`;
  const tokenDeploymentInfo = JSON.parse(fs.readFileSync(tokenDeploymentPath, "utf8"));
  const tokenAddress = tokenDeploymentInfo.address;

  const airdrop = Airdrop__factory.connect(airdropAddress, deployer);
  const token = MyMintableToken__factory.connect(tokenAddress, deployer);

  const merkleRoot = await airdrop.merkleRoot();

  let recipients = [];
  let merkleJsonRoot = "";
  try {
    const merkleData = JSON.parse(fs.readFileSync("scripts/merkle/merkle.json", "utf8"));
    recipients = merkleData.recipients || [];
    merkleJsonRoot = merkleData.root || "";
  } catch (error) {
    console.log("❌ No merkle.json found");
  }

  if (merkleJsonRoot && merkleJsonRoot !== merkleRoot) {
    console.log("⚠️  Root mismatch! Run: npx hardhat run scripts/airdrop/setMerkleRoot.ts");
  }

  console.log("Airdrop:", airdropAddress);
  console.log("Token:", tokenAddress);
  console.log("Root:", merkleRoot);
  console.log("Recipients:", recipients.length);

  // Test 1: setMerkleRoot (Admin)
  console.log("\n[Test 1] Admin setMerkleRoot");
  try {
    const originalRoot = await airdrop.merkleRoot();
    const newRoot = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    await (await airdrop.connect(deployer).setMerkleRoot(newRoot)).wait();
    console.log("✓ Updated:", (await airdrop.merkleRoot()) === newRoot);
    await (await airdrop.setMerkleRoot(originalRoot)).wait();
    console.log("✓ Restored");
  } catch (error) {
    console.log("✗", (error as Error).message);
  }

  // Test 2: setMerkleRoot (Non-Admin)
  console.log("\n[Test 2] Non-admin blocked");
  try {
    await airdrop.connect(user1).setMerkleRoot("0x0000000000000000000000000000000000000000000000000000000000000000");
    console.log("✗ Not blocked!");
  } catch (error) {
    console.log("✓ Blocked");
  }

  // Test 3: Valid Claim
  console.log("\n[Test 3] Valid claim");
  if (recipients.length === 0) {
    console.log("❌ No recipients");
    return;
  }

  if (merkleJsonRoot && merkleJsonRoot !== merkleRoot) {
    console.log("⚠️  Root mismatch. Run: npx hardhat run scripts/airdrop/setMerkleRoot.ts");
    return;
  }

  const testRecipient = recipients[0];
  const amount = BigInt(testRecipient.amount);
  const proof = testRecipient.proof;

  const hasClaimed = await airdrop.hasClaimed(testRecipient.account);
  console.log("Address:", testRecipient.account);
  console.log("Claimed:", hasClaimed);

  if (!hasClaimed) {
    if (network.name === "localhost" || network.name === "hardhat") {
      await ethers.provider.send("hardhat_impersonateAccount", [testRecipient.account]);
      const recipientSigner = await ethers.getSigner(testRecipient.account);
      await deployer.sendTransaction({ to: testRecipient.account, value: ethers.parseEther("1") });

      const initialBalance = await token.balanceOf(testRecipient.account);
      await (await airdrop.connect(recipientSigner).claim(amount, proof)).wait();
      const finalBalance = await token.balanceOf(testRecipient.account);

      console.log("✓ Claimed:", ethers.formatEther(finalBalance - initialBalance), "tokens");
    } else if (network.name === "sepolia") {
      console.log("⚠️  Sepolia: Use frontend or claim.ts script");
    }
  } else {
    console.log("✓ Already claimed");
  }

  // Test 4: Invalid Claim
  console.log("\n[Test 4] Invalid claim rejected");

  if (network.name === "localhost" || network.name === "hardhat") {
    try {
      const randomAddress = ethers.Wallet.createRandom().address;
      await ethers.provider.send("hardhat_impersonateAccount", [randomAddress]);
      const randomSigner = await ethers.getSigner(randomAddress);
      await deployer.sendTransaction({ to: randomAddress, value: ethers.parseEther("1") });

      await airdrop
        .connect(randomSigner)
        .claim(ethers.parseEther("100"), ["0x0000000000000000000000000000000000000000000000000000000000000000"]);
      console.log("✗ Not rejected!");
    } catch (error) {
      console.log("✓ Rejected");
    }
  } else {
    console.log("⚠️  Skipped (localhost only)");
  }

  // Test 5: Double Claim Prevention
  console.log("\n[Test 5] Double claim prevented");

  if (network.name === "localhost" || network.name === "hardhat") {
    try {
      await ethers.provider.send("hardhat_impersonateAccount", [testRecipient.account]);
      const recipientSigner = await ethers.getSigner(testRecipient.account);
      await airdrop.connect(recipientSigner).claim(amount, proof);
      console.log("✗ Not prevented!");
    } catch (error) {
      console.log("✓ Prevented");
    }
  } else {
    console.log("⚠️  Skipped (localhost only)");
  }

  // Test 6: Multiple Recipients
  console.log("\n[Test 6] Multiple recipients");

  if (recipients.length > 1) {
    const recipient2 = recipients[1];
    const hasClaimed2 = await airdrop.hasClaimed(recipient2.account);

    if (!hasClaimed2 && (network.name === "localhost" || network.name === "hardhat")) {
      await ethers.provider.send("hardhat_impersonateAccount", [recipient2.account]);
      const recipient2Signer = await ethers.getSigner(recipient2.account);
      await deployer.sendTransaction({ to: recipient2.account, value: ethers.parseEther("1") });

      const initialBalance2 = await token.balanceOf(recipient2.account);
      await (await airdrop.connect(recipient2Signer).claim(BigInt(recipient2.amount), recipient2.proof)).wait();
      const finalBalance2 = await token.balanceOf(recipient2.account);

      console.log("✓ Claimed:", ethers.formatEther(finalBalance2 - initialBalance2), "tokens");
    } else {
      console.log("✓ Already claimed or sepolia");
    }
  } else {
    console.log("⚠️  Only 1 recipient");
  }

  console.log("\n✅ All tests completed!");
}

main().catch((err) => {
  console.error("❌ Script failed:", err);
  process.exitCode = 1;
});
