import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { solidityPacked, keccak256 } from "ethers";
import { MerkleTree } from "merkletreejs";

interface Recipient {
  address: string;
  amount: string;
}

// Ensure data directory exists
const dataDir = "scripts/merkle-data";
try {
  mkdirSync(dataDir, { recursive: true });
} catch (error) {
  // Directory might already exist, ignore error
}

const recipientsData: Recipient[] = JSON.parse(readFileSync("scripts/merkle/recipients.json", "utf8"));
const recipients: [number, string, string][] = recipientsData.map((r: Recipient, i: number) => [
  i,
  r.address,
  r.amount,
]);

function leaf(index: number, account: string, amount: string): string {
  // Use abi.encodePacked equivalent with solidityPacked
  // This matches the smart contract: keccak256(abi.encodePacked(index, account, amount))
  const packed = solidityPacked(["uint256", "address", "uint256"], [index, account, amount]);
  const hash = keccak256(packed);
  return hash;
}

// Create leaves using merkletreejs
const leaves = recipients.map((r) => leaf(r[0], r[1], r[2]));

// Create Merkle tree using merkletreejs library
const tree = new MerkleTree(leaves, keccak256, {
  sortPairs: true, // This ensures the tree is deterministic
});

// Get the root
const root = tree.getHexRoot();

// Generate proofs for each recipient
const proofs = recipients.map((r, i) => {
  const leafHash = leaf(r[0], r[1], r[2]);
  const proof = tree.getHexProof(leafHash);

  return {
    index: r[0],
    account: r[1],
    amount: r[2],
    proof: proof,
  };
});

// Save main merkle data to scripts/merkle directory
writeFileSync("scripts/merkle/merkle.json", JSON.stringify({ root, recipients: proofs }, null, 2));

// Save additional data to common directory
const merkleData = {
  root,
  proofs,
  tree: {
    leaves: leaves,
    levels: tree.getLayers().map((level) => level.map((hash) => hash)),
  },
};

// Save detailed merkle data to common directory
writeFileSync(`${dataDir}/merkle.json`, JSON.stringify(merkleData, null, 2));

// Save tree structure for debugging
const treeStructure = {
  root: root,
  leaves: leaves,
  layers: tree.getLayers().map((level) => level.map((hash) => hash)),
  leafCount: leaves.length,
  treeHeight: tree.getLayers().length,
};

writeFileSync(`${dataDir}/tree-structure.json`, JSON.stringify(treeStructure, null, 2));

console.log(`✅ Merkle tree generated successfully!`);
console.log(`🌳 Root: ${root}`);
console.log(`📄 Files created:`);
console.log(`   - merkle.json (root directory - original format)`);
console.log(`   - ${dataDir}/merkle.json (detailed data)`);
console.log(`   - ${dataDir}/tree-structure.json (tree details)`);
console.log(`🔢 Total recipients: ${recipients.length}`);
