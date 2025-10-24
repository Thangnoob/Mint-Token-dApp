import { readFileSync, writeFileSync } from "fs";
import { solidityPacked, keccak256 } from "ethers";
import { MerkleTree } from "merkletreejs";

interface Recipient {
  address: string;
  amount: string;
}

const recipientsData: Recipient[] = JSON.parse(readFileSync("scripts/merkle/recipients.json", "utf8"));
const recipients: [number, string, string][] = recipientsData.map((r: Recipient, i: number) => [
  i,
  r.address,
  r.amount,
]);

function leaf(index: number, account: string, amount: string): string {
  // Use abi.encodePacked equivalent with solidityPacked
  // This matches the smart contract: keccak256(abi.encodePacked(account, amount))
  const packed = solidityPacked(["address", "uint256"], [account, amount]);
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

// Save detailed merkle data (overwrite existing file)
const merkleData = {
  root,
  recipients: proofs,
  tree: {
    leaves: leaves,
    levels: tree.getLayers().map((level) => level.map((hash) => hash)),
  },
};

writeFileSync("scripts/merkle/merkle.json", JSON.stringify(merkleData, null, 2));

// Save tree structure for debugging (overwrite existing file)
const treeStructure = {
  root: root,
  leaves: leaves,
  layers: tree.getLayers().map((level) => level.map((hash) => hash)),
  leafCount: leaves.length,
  treeHeight: tree.getLayers().length,
};

writeFileSync("scripts/merkle/tree-structure.json", JSON.stringify(treeStructure, null, 2));

console.log(`✅ Merkle tree generated`);
console.log(`Root: ${root}`);
console.log(`Recipients: ${recipients.length}`);
