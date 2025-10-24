import { ethers, network } from "hardhat";
import { Airdrop__factory } from "../../typechain/factories/contracts/Airdrop.sol";
import { MyMintableToken__factory } from "../../typechain/factories/contracts";
import fs from "fs";

/**
 * Sepolia Testnet Airdrop Testing Script
 *
 * This script tests the airdrop functionality on Sepolia testnet.
 * Note: You must use your actual wallet that is a recipient in the merkle tree.
 *
 * Prerequisites:
 * 1. Set TESTNET_PRIVATE_KEY in .env file
 * 2. Ensure your wallet has Sepolia ETH for gas
 * 3. Ensure you are a recipient in scripts/merkle/recipients.json
 * 4. Contracts must be deployed to Sepolia
 *
 * Usage:
 * npx hardhat run scripts/airdrop/2_airdrop.ts --network sepolia
 */

async function main() {
  console.log("🧪 Testing Airdrop on", network.name);

  if (network.name !== "sepolia") {
    console.log("❌ Sepolia only! Run: npx hardhat run scripts/airdrop/2_airdrop.ts --network sepolia");
    return;
  }

  const [signer] = await ethers.getSigners();
  console.log("Wallet:", signer.address);

  const balance = await ethers.provider.getBalance(signer.address);
  console.log("ETH:", ethers.formatEther(balance));

  if (balance < ethers.parseEther("0.01")) {
    console.log("⚠️  Low balance. Get ETH from: https://sepoliafaucet.com/");
  }

  // Load deployment
  const deploymentPath = `deployments/${network.name}/Airdrop.json`;
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`❌ Deployment not found for ${network.name}`);
  }

  const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const airdropAddress = deploymentInfo.address;

  const tokenDeploymentPath = `deployments/${network.name}/MyMintableToken.json`;
  const tokenDeploymentInfo = JSON.parse(fs.readFileSync(tokenDeploymentPath, "utf8"));
  const tokenAddress = tokenDeploymentInfo.address;

  console.log("Airdrop:", airdropAddress);
  console.log("Token:", tokenAddress);

  const airdrop = Airdrop__factory.connect(airdropAddress, signer);
  const token = MyMintableToken__factory.connect(tokenAddress, signer);

  const merkleRoot = await airdrop.merkleRoot();
  console.log("Contract root:", merkleRoot);

  let recipients: any[] = [];
  let merkleJsonRoot = "";

  try {
    const merkleData = JSON.parse(fs.readFileSync("scripts/merkle/merkle.json", "utf8"));
    recipients = merkleData.recipients || [];
    merkleJsonRoot = merkleData.root || "";
  } catch (error) {
    console.log("❌ Generate merkle: npx hardhat run scripts/merkle/generateMerkle.ts");
    return;
  }

  console.log("Merkle.json root:", merkleJsonRoot);
  console.log("Recipients:", recipients.length);

  if (merkleJsonRoot !== merkleRoot) {
    console.log("⚠️  Root mismatch! Run: npx hardhat run scripts/airdrop/setMerkleRoot.ts --network sepolia");
  }

  const DEFAULT_ADMIN_ROLE = await airdrop.DEFAULT_ADMIN_ROLE();
  const isAdmin = await airdrop.hasRole(DEFAULT_ADMIN_ROLE, signer.address);
  console.log("Is admin:", isAdmin);

  // Test 1: setMerkleRoot (if admin)
  if (isAdmin && merkleJsonRoot !== merkleRoot) {
    console.log("\n[Test 1] Updating merkle root...");
    try {
      const tx = await airdrop.setMerkleRoot(merkleJsonRoot);
      await tx.wait();
      console.log("✅ Updated:", await airdrop.merkleRoot());
    } catch (error) {
      console.log("❌", (error as Error).message);
    }
  }

  // Test 2: Check eligibility
  console.log("\n[Test 2] Checking eligibility...");

  const myRecipient = recipients.find((r) => r.account.toLowerCase() === signer.address.toLowerCase());

  if (!myRecipient) {
    console.log("❌ Not eligible. Add to scripts/merkle/recipients.json");
    return;
  }

  console.log("Amount:", ethers.formatEther(myRecipient.amount), "tokens");

  const hasClaimed = await airdrop.hasClaimed(signer.address);
  const currentBalance = await token.balanceOf(signer.address);
  console.log("Claimed:", hasClaimed);
  console.log("Balance:", ethers.formatEther(currentBalance), "tokens");

  // Test 3: Claim
  if (!hasClaimed) {
    console.log("\n[Test 3] Claiming...");
    try {
      const tx = await airdrop.claim(myRecipient.amount, myRecipient.proof);
      console.log("TX:", tx.hash);
      console.log("Etherscan: https://sepolia.etherscan.io/tx/" + tx.hash);

      await tx.wait();
      const newBalance = await token.balanceOf(signer.address);
      console.log("✅ Claimed:", ethers.formatEther(newBalance - currentBalance), "tokens");
    } catch (error: any) {
      console.log("❌", error.message);
    }
  }

  console.log("\n✅ Tests completed!");
}

main().catch((err) => {
  console.error("\n❌ Script failed:", err.message);
  process.exitCode = 1;
});
