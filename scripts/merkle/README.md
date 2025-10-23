# Merkle Tree Data Directory

This directory contains additional Merkle tree data files generated alongside the main `merkle.json` file.

## Files Generated

### Main Files

- **`merkle.json`** - Detailed Merkle tree data containing root, proofs, and tree structure
- **`tree-structure.json`** - Detailed tree structure with layers for debugging

## File Structure

### merkle.json (in root directory)

```json
{
  "root": "0x...",           // Merkle tree root
  "proofs": [...]            // Array of all proofs
}
```

### scripts/merkle-data/merkle.json (detailed version)

```json
{
  "root": "0x...",           // Merkle tree root
  "proofs": [...],           // Array of all proofs
  "tree": {
    "leaves": [...],         // All leaf hashes
    "levels": [...]          // Tree layers
  }
}
```

### tree-structure.json

```json
{
  "root": "0x...",           // Merkle tree root
  "leaves": [...],           // All leaf hashes
  "layers": [...],           // Tree layers
  "leafCount": 3,            // Number of leaves
  "treeHeight": 2            // Height of the tree
}
```

## Usage

To regenerate the Merkle tree data, run:

```bash
npx ts-node scripts/generateMerkle.ts
```

This will:

1. Read recipients from `scripts/whitelist/recipients.json`
2. Generate Merkle tree using merkletreejs library
3. Save main data to `merkle.json` (root directory - original format)
4. Save detailed data to `scripts/merkle-data/merkle.json`
5. Save tree structure to `scripts/merkle-data/tree-structure.json`

## Library Used

- **merkletreejs**: Professional Merkle tree implementation
- **ethers**: For keccak256 hashing and solidityPacked encoding
