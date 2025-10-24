import { ethers, network } from "hardhat";
import { Airdrop__factory } from "../../typechain/factories/contracts/Airdrop.sol";
import fs from "fs";
import path from "path";

/**
 * Script để update Merkle Root trong Airdrop contract
 *
 * Configuration:
 * - Sửa ADMIN_ADDRESS để dùng admin khác (chỉ localhost)
 * - Hoặc để null để dùng signer mặc định
 * - Sửa NEW_MERKLE_ROOT để set root cụ thể, hoặc null để dùng từ merkle.json
 *
 * Usage:
 * npx hardhat run scripts/airdrop/setMerkleRoot.ts --network localhost
 * npx hardhat run scripts/airdrop/setMerkleRoot.ts --network sepolia
 */

// ============= CONFIGURATION =============
// 🔧 GÁN ĐỊA CHỈ ADMIN VÀO ĐÂY (hoặc null để dùng default signer):
// ⚠️  Địa chỉ này PHẢI có role: DEFAULT_ADMIN_ROLE
let ADMIN_ADDRESS: string | null = null;
// Ví dụ: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"

// 🔧 GÁN MERKLE ROOT VÀO ĐÂY (hoặc null để auto-load từ merkle.json):
let NEW_MERKLE_ROOT: string | null = null;
// Ví dụ: "0x2eb13a533ad2aa48460c9335d0c3f2a04e47142d531421cd12b2ee97f8433734"
// =========================================

async function main() {
  console.log("🌳 Setting Merkle Root on", network.name);

  // Get signer
  const [defaultSigner] = await ethers.getSigners();
  let admin = defaultSigner;
  let adminAddress = defaultSigner.address;

  console.log("\n📍 Signer từ .env (trả gas):", defaultSigner.address);

  // Nếu set ADMIN_ADDRESS, dùng impersonation (chỉ localhost)
  if (ADMIN_ADDRESS) {
    console.log("📍 Địa chỉ được GÁN:", ADMIN_ADDRESS);
    adminAddress = ADMIN_ADDRESS;

    if (network.name === "localhost" || network.name === "hardhat") {
      console.log("✅ Impersonating...");
      await ethers.provider.send("hardhat_impersonateAccount", [adminAddress]);
      admin = await ethers.getSigner(adminAddress);
      await defaultSigner.sendTransaction({
        to: adminAddress,
        value: ethers.parseEther("1"),
      });
    } else {
      console.log("⚠️  Sepolia: Không thể impersonate, dùng signer từ .env");
      adminAddress = defaultSigner.address;
    }
  }

  console.log("📍 Địa chỉ GỌI HÀM (msg.sender):", adminAddress);

  // Load deployment
  const deploymentPath = path.join(__dirname, `../../deployments/${network.name}/Airdrop.json`);
  if (!fs.existsSync(deploymentPath)) {
    console.error("❌ Deploy first: npx hardhat deploy --network", network.name);
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const airdrop = Airdrop__factory.connect(deployment.address, admin);

  // Check admin role
  const DEFAULT_ADMIN_ROLE = await airdrop.DEFAULT_ADMIN_ROLE();
  const isAdmin = await airdrop.hasRole(DEFAULT_ADMIN_ROLE, adminAddress);

  console.log("Required role: DEFAULT_ADMIN_ROLE");
  console.log("Has role:", isAdmin);

  if (!isAdmin) {
    console.error("❌ Address does not have DEFAULT_ADMIN_ROLE");
    console.error("Only admin can update merkle root");
    process.exit(1);
  }

  // Get current root
  const currentRoot = await airdrop.merkleRoot();

  // Get new root
  let newRoot: string;
  if (NEW_MERKLE_ROOT) {
    newRoot = NEW_MERKLE_ROOT;
  } else {
    try {
      const merkleData = JSON.parse(fs.readFileSync("scripts/merkle/merkle.json", "utf8"));
      newRoot = merkleData.root;
    } catch (error) {
      console.error("❌ Generate merkle first: npx hardhat run scripts/merkle/generateMerkle.ts");
      process.exit(1);
    }
  }

  // Check if same
  if (currentRoot === newRoot) {
    console.log("✅ Already up to date");
    return;
  }

  console.log("Old root:", currentRoot);
  console.log("New root:", newRoot);

  try {
    const tx = await airdrop.setMerkleRoot(newRoot);
    console.log("TX:", tx.hash);

    if (network.name === "sepolia") {
      console.log("Etherscan: https://sepolia.etherscan.io/tx/" + tx.hash);
    }

    await tx.wait();
    console.log("✅ Updated successfully!");
  } catch (error: any) {
    console.error("❌", error.message);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("\n❌ Script error:", error.message);
  process.exitCode = 1;
});
