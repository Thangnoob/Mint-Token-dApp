// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IMintableToken {
    function mint(address to, uint256 amount) external;
}

contract Airdrop is Initializable, AccessControlUpgradeable, UUPSUpgradeable {

    IMintableToken public token;
    bytes32 public merkleRoot;
    mapping(address => bool) public hasClaimed;

    event AirdropClaimed(address indexed user, uint256 amount);
    event MerkleRootUpdated(bytes32 newRoot);

    error AlreadyClaimed();
    error InvalidProof();
    error ZeroAmount();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers(); // Required for upgradeable contracts
    }

    function initialize(address tokenAddress, bytes32 root, address admin) public initializer {
        __AccessControl_init();
        __UUPSUpgradeable_init();

        token = IMintableToken(tokenAddress);
        merkleRoot = root;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// @dev Only DEFAULT_ADMIN_ROLE can authorize upgrades
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    /// @notice Update Merkle root
    function setMerkleRoot(bytes32 newRoot) external onlyRole(DEFAULT_ADMIN_ROLE) {
        merkleRoot = newRoot;
        emit MerkleRootUpdated(newRoot);
    }

    /// @notice Claim airdrop tokens
    function claim(uint256 amount, bytes32[] calldata proof) external {
        if (hasClaimed[msg.sender]) revert AlreadyClaimed();
        if (amount == 0) revert ZeroAmount();

        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, amount));
        if (!MerkleProof.verify(proof, merkleRoot, leaf)) revert InvalidProof();

        hasClaimed[msg.sender] = true;
        token.mint(msg.sender, amount);

        emit AirdropClaimed(msg.sender, amount);
    }
    
    uint256[50] private __gap;
}
