// contracts/MockOracle.sol
pragma solidity ^0.8.19;

contract MockOracle {
    function verifyProof(bytes calldata) external pure returns (bool) {
        return true;
    }
}