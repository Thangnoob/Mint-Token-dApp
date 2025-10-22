import { ethers } from "hardhat";
import { readFileSync } from "fs";
import { MerkleDistributor } from "../typechain";

async function main() {
  const [claimer] = await ethers.getSigners();
  console.log("Claiming with account:", claimer.address);

  // Read deployment info
  const deploymentInfo = JSON.parse(readFileSync("deployment.json", "utf8"));
  const distributorAddress = deploymentInfo.distributorAddress;

  // Read Merkle proofs
  const merkleData = JSON.parse(readFileSync("merkle.json", "utf8"));
  const proofData = merkleData.proofs.find(
    (p: { account: string }) => p.account.toLowerCase() === claimer.address.toLowerCase()
  );

  if (!proofData) {
    throw new Error("No proof found for claimer address");
  }

  // Connect to MerkleDistributor
  const Distributor = await ethers.getContractFactory("MerkleDistributor");
  const distributor = (await Distributor.attach(distributorAddress)) as MerkleDistributor;

  // Claim tokens
  const tx = await distributor
    .connect(claimer)
    .claim(proofData.index, proofData.account, proofData.amount, proofData.proof);
  await tx.wait();
  console.log(`Claimed ${proofData.amount} tokens for ${proofData.account}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
