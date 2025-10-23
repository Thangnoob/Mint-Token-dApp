// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./MyMintableToken.sol";

contract AirdropWithAccessControl is AccessControl {
    IERC20 public immutable token;
    bytes32 public immutable merkleRoot;
    mapping(address => bool) public isClaimed;
    
    // Role definitions
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant CLAIM_MANAGER_ROLE = keccak256("CLAIM_MANAGER_ROLE");
    
    // State variables
    bool public isPaused = false;
    uint256 public totalClaimed = 0;
    uint256 public maxClaimAmount = 1000 * 10**18; // Default max claim amount
    
    // Events
    event Claimed(address indexed account, uint256 amount);
    event Paused(address indexed account);
    event Unpaused(address indexed account);
    event MaxClaimAmountUpdated(uint256 oldAmount, uint256 newAmount);
    event EmergencyWithdraw(address indexed token, uint256 amount);
    
    // Errors
    error AirdropPaused();
    error AlreadyClaimed();
    error InvalidProof();
    error ExceedsMaxClaimAmount();
    error ZeroAmount();
    error Unauthorized();
    
    constructor(address tokenAddress, bytes32 root) {
        token = IERC20(tokenAddress);
        merkleRoot = root;
        
        // Set up roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(CLAIM_MANAGER_ROLE, msg.sender);
    }
    
    /**
     * @dev Claim airdrop tokens
     * @param amount Amount of tokens to claim
     * @param merkleProof Merkle proof for verification
     */
    function claim(
        uint256 amount,
        bytes32[] calldata merkleProof
    ) external {
        if (isPaused) revert AirdropPaused();
        if (isClaimed[msg.sender]) revert AlreadyClaimed();
        if (amount == 0) revert ZeroAmount();
        if (amount > maxClaimAmount) revert ExceedsMaxClaimAmount();
        
        // Verify the merkle proof
        bytes32 node = keccak256(abi.encodePacked(msg.sender, amount));
        if (!MerkleProof.verify(merkleProof, merkleRoot, node)) {
            revert InvalidProof();
        }
        
        // Mark as claimed and mint tokens
        isClaimed[msg.sender] = true;
        totalClaimed += amount;
        
        MyMintableToken(address(token)).mint(msg.sender, amount);
        
        emit Claimed(msg.sender, amount);
    }
    
    /**
     * @dev Pause the airdrop contract
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        isPaused = true;
        emit Paused(msg.sender);
    }
    
    /**
     * @dev Unpause the airdrop contract
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        isPaused = false;
        emit Unpaused(msg.sender);
    }
    
    /**
     * @dev Set maximum claim amount per user
     * @param newMaxAmount New maximum claim amount
     */
    function setMaxClaimAmount(uint256 newMaxAmount) external onlyRole(ADMIN_ROLE) {
        uint256 oldAmount = maxClaimAmount;
        maxClaimAmount = newMaxAmount;
        emit MaxClaimAmountUpdated(oldAmount, newMaxAmount);
    }
    
    /**
     * @dev Emergency withdraw function to recover tokens
     * @param amount Amount of tokens to withdraw
     */
    function emergencyWithdraw(uint256 amount) external onlyRole(ADMIN_ROLE) {
        if (amount > token.balanceOf(address(this))) {
            amount = token.balanceOf(address(this));
        }
        
        if (amount > 0) {
            token.transfer(msg.sender, amount);
            emit EmergencyWithdraw(address(token), amount);
        }
    }
    
    /**
     * @dev Check if an address has claimed
     * @param account Address to check
     * @return bool True if claimed, false otherwise
     */
    function hasClaimed(address account) external view returns (bool) {
        return isClaimed[account];
    }
    
    /**
     * @dev Check if a user can claim with given amount and proof
     * @param account Address to check
     * @param amount Amount to claim
     * @param merkleProof Merkle proof for verification
     * @return bool True if can claim, false otherwise
     */
    function canClaim(
        address account,
        uint256 amount,
        bytes32[] calldata merkleProof
    ) external view returns (bool) {
        if (isPaused) return false;
        if (isClaimed[account]) return false;
        if (amount == 0) return false;
        if (amount > maxClaimAmount) return false;
        
        // Verify the merkle proof
        bytes32 node = keccak256(abi.encodePacked(account, amount));
        return MerkleProof.verify(merkleProof, merkleRoot, node);
    }
    
    /**
     * @dev Get total number of claims made
     * @return uint256 Total claims count
     */
    function getTotalClaims() external view returns (uint256) {
        return totalClaimed;
    }
    
    /**
     * @dev Get contract status
     * @return bool True if paused, false otherwise
     */
    function getStatus() external view returns (bool) {
        return isPaused;
    }
    
    /**
     * @dev Grant admin role to an address
     * @param account Address to grant admin role
     */
    function grantAdminRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(ADMIN_ROLE, account);
    }
    
    /**
     * @dev Revoke admin role from an address
     * @param account Address to revoke admin role
     */
    function revokeAdminRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(ADMIN_ROLE, account);
    }
    
    /**
     * @dev Grant pauser role to an address
     * @param account Address to grant pauser role
     */
    function grantPauserRole(address account) external onlyRole(ADMIN_ROLE) {
        _grantRole(PAUSER_ROLE, account);
    }
    
    /**
     * @dev Revoke pauser role from an address
     * @param account Address to revoke pauser role
     */
    function revokePauserRole(address account) external onlyRole(ADMIN_ROLE) {
        _revokeRole(PAUSER_ROLE, account);
    }
    
    /**
     * @dev Grant claim manager role to an address
     * @param account Address to grant claim manager role
     */
    function grantClaimManagerRole(address account) external onlyRole(ADMIN_ROLE) {
        _grantRole(CLAIM_MANAGER_ROLE, account);
    }
    
    /**
     * @dev Revoke claim manager role from an address
     * @param account Address to revoke claim manager role
     */
    function revokeClaimManagerRole(address account) external onlyRole(ADMIN_ROLE) {
        _revokeRole(CLAIM_MANAGER_ROLE, account);
    }
}
