// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
// import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MerkleDistributor {
    IERC20 public immutable token;
    bytes32 public immutable merkleRoot;
    mapping(uint256 => uint256) private claimedBitMap;

    event Claimed(uint256 index, address account, uint256 amount);

    constructor(address tokenAddress, bytes32 root) {
        token = IERC20(tokenAddress);
        merkleRoot = root;
    }

    function isClaimed(uint256 index) public view returns (bool) {
        uint256 wordIndex = index / 256;
        uint256 bitIndex = index % 256;
        uint256 claimedWord = claimedBitMap[wordIndex];
        uint256 mask = (1 << bitIndex);
        return claimedWord & mask == mask;
    }

    function _setClaimed(uint256 index) private {
        uint256 wordIndex = index / 256;
        uint256 bitIndex = index % 256;
        claimedBitMap[wordIndex] = claimedBitMap[wordIndex] | (1 << bitIndex);
    }

    function claim(
        uint256 index,
        address account,
        uint256 amount,
        bytes32[] calldata merkleProof
    ) external {
        require(!isClaimed(index), "MerkleDistributor: Drop already claimed.");

        // Verify the merkle proof.
        bytes32 node = keccak256(abi.encodePacked(index, account, amount));
        require(
            MerkleProof.verify(merkleProof, merkleRoot, node),
            "MerkleDistributor: Invalid proof."
        );

        // Mark it claimed and send the token.
        _setClaimed(index);
        require(
            token.transfer(account, amount),
            "MerkleDistributor: Transfer failed."
        );

        emit Claimed(index, account, amount);
    }
}