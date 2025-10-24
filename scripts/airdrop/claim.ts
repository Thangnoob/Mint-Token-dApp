import { ethers, network } from "hardhat";
import { Airdrop__factory } from "../../typechain/factories/contracts/Airdrop.sol";
import fs from "fs";
import path from "path";

/**
 * Script để claim airdrop tokens
 *
 * Configuration:
 * - Sửa CLAIMER_ADDRESS để claim cho địa chỉ khác
 * - Hoặc để null để dùng signer mặc định
 *
 * Usage:
 * npx hardhat run scripts/airdrop/claim.ts --network localhost
 * npx hardhat run scripts/airdrop/claim.ts --network sepolia
 */

// ============= CONFIGURATION =============
// GÁN ĐỊA CHỈ VÀO ĐÂY để claim cho địa chỉ cụ thể:
let CLAIMER_ADDRESS: string | null = null;
// let CLAIMER_ADDRESS: string | null = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
// Hoặc set = null để dùng signer mặc định từ .env
// let CLAIMER_ADDRESS: string | null = null;
// =========================================

async function main() {
  console.log("🎁 Claiming Airdrop on", network.name);

  // Get signer
  const [defaultSigner] = await ethers.getSigners();
  let claimer = defaultSigner;
  let claimerAddress = defaultSigner.address;

  console.log("\n📍 Signer từ .env (trả gas):", defaultSigner.address);

  // Nếu set CLAIMER_ADDRESS, dùng impersonation (chỉ localhost)
  if (CLAIMER_ADDRESS) {
    console.log("📍 Địa chỉ được GÁN:", CLAIMER_ADDRESS);
    claimerAddress = CLAIMER_ADDRESS;

    if (network.name === "localhost" || network.name === "hardhat") {
      console.log("✅ Impersonating...");
      await ethers.provider.send("hardhat_impersonateAccount", [claimerAddress]);
      claimer = await ethers.getSigner(claimerAddress);
      await defaultSigner.sendTransaction({
        to: claimerAddress,
        value: ethers.parseEther("1"),
      });
    } else {
      console.log("⚠️  Sepolia: Không thể impersonate, dùng signer từ .env");
      claimerAddress = defaultSigner.address;
    }
  }

  console.log("📍 Địa chỉ GỌI HÀM (msg.sender):", claimerAddress);

  // Load deployment
  const deploymentPath = path.join(__dirname, `../../deployments/${network.name}/Airdrop.json`);
  if (!fs.existsSync(deploymentPath)) {
    console.error("❌ Deploy first: npx hardhat deploy --network", network.name);
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const airdrop = Airdrop__factory.connect(deployment.address, claimer);

  // Load merkle data
  let merkleData: any;
  try {
    merkleData = JSON.parse(fs.readFileSync("scripts/merkle/merkle.json", "utf8"));
  } catch (error) {
    console.error("❌ Generate merkle first: npx hardhat run scripts/merkle/generateMerkle.ts");
    process.exit(1);
  }

  // Check eligibility
  const recipient = merkleData.recipients.find((r: any) => r.account.toLowerCase() === claimerAddress.toLowerCase());
  if (!recipient) {
    console.error("❌ Not eligible. Add to scripts/merkle/recipients.json");
    process.exit(1);
  }

  const amount = BigInt(recipient.amount);
  const proof = recipient.proof;

  // Check already claimed
  const hasClaimed = await airdrop.hasClaimed(claimerAddress);
  if (hasClaimed) {
    console.log("⚠️  Already claimed");
    return;
  }

  console.log("Amount:", ethers.formatEther(amount), "tokens");

  try {
    const tx = await airdrop.claim(amount, proof);
    console.log("TX:", tx.hash);

    if (network.name === "sepolia") {
      console.log("Etherscan: https://sepolia.etherscan.io/tx/" + tx.hash);
    }

    await tx.wait();
    console.log("✅ Claimed successfully!");
  } catch (error: any) {
    console.error("❌", error.message);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("\n❌ Script error:", error.message);
  process.exitCode = 1;
});
