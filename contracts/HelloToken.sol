// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

contract HelloToken is ERC20, ERC20Burnable, Ownable {
    uint8 private constant _decimals = 18;

    constructor(uint256 initialSupply) ERC20("HelloToken", "HLTK") Ownable(msg.sender) {
        _mint(msg.sender, initialSupply * 10 ** _decimals);
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
}
