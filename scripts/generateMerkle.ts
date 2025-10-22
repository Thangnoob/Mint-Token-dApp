import { MerkleTree } from "merkletreejs";
import { readFileSync, writeFileSync } from "fs";
import { zeroPadValue, toBeHex, getBytes, concat, keccak256 } from "ethers";

interface Recipient {
  address: string;
  amount: string;
}

const recipientsData: Recipient[] = JSON.parse(readFileSync("recipients.json", "utf8"));
const recipients: [number, string, string][] = recipientsData.map((r: Recipient, i: number) => [
  i,
  r.address,
  r.amount,
]);

function leaf(index: number, account: string, amount: string): Buffer {
  // Convert index to 32-byte hex
  const indexHex = zeroPadValue(toBeHex(BigInt(index)), 32);
  // Convert address to 32-byte hex
  const addr = zeroPadValue(account, 32);
  // Convert amount to 32-byte hex
  const amtHex = zeroPadValue(toBeHex(BigInt(amount)), 32);

  // Concatenate and hash
  const packed = concat([indexHex, addr, amtHex]);
  const hash = keccak256(packed);
  return Buffer.from(getBytes(hash));
}

// Hash function for MerkleTree that accepts Buffer
function hashFn(data: Buffer): Buffer {
  // Convert Buffer to Uint8Array, hash it, then convert back to Buffer
  const hash = keccak256(data);
  return Buffer.from(getBytes(hash));
}

const leaves = recipients.map((r) => leaf(r[0], r[1], r[2]));
const tree = new MerkleTree(leaves, hashFn, { sortPairs: true });
const root = tree.getHexRoot();

const proofs = recipients.map((r, i) => ({
  index: r[0],
  account: r[1],
  amount: r[2],
  proof: tree.getHexProof(leaves[i]),
}));

writeFileSync("merkle.json", JSON.stringify({ root, proofs }, null, 2));
console.log("Saved merkle.json with root:", root);
