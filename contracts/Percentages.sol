// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Percentages {
    function calculate(
        uint256 amount,
        uint256 bps
    ) internal pure returns (uint256) {
        require((amount * bps) >= 10_000);
        return (amount * bps) / 10_000;
    }
}
