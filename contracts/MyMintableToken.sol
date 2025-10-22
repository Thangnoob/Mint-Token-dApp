// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
contract MyMintableToken is ERC20, Ownable {
    event Mint(address indexed to, uint256 amount);
    event Burn(address indexed from, uint256 amount);
    constructor () ERC20("MyMintableToken", "MMT")  Ownable(msg.sender) {
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
        emit Mint(to, amount);
    }

    
    function burn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
        emit Burn(from, amount);
    }
}