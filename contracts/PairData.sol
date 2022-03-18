// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./IUniswapV2Factory.sol";
import "./IUniswapV2Pair.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
// import "hardhat/console.sol";

contract PairData {
    function getPairs(address _factory, uint _start, uint _end) external view returns(address[3][] memory) {
        uint size = _end - _start;
        address[3][] memory pairData = new address[3][](size);
        address pair;
        for(uint i = 0; i < size; i++) {
            //console.log("at index", i);
            pair = IUniswapV2Factory(_factory).allPairs(i + _start);
            pairData[i][0] = IUniswapV2Pair(pair).token0();
            pairData[i][1] = IUniswapV2Pair(pair).token1();
            pairData[i][2] = pair;
        }
        return pairData;
    }

    function getDecimals(address[] calldata _pairs) external view returns(uint[2][] memory) {
        uint pairsLength = _pairs.length;
        uint[2][] memory decimals = new uint[2][](pairsLength);
        for(uint i = 0; i < pairsLength; i++) {
            //console.log("at index", i);
            address token0 = IUniswapV2Pair(_pairs[i]).token0();
            address token1 = IUniswapV2Pair(_pairs[i]).token1();
            decimals[i][0] = ERC20(token0).decimals();
            decimals[i][1] = ERC20(token1).decimals();
        }
        return decimals;
    }

    function getReserves(address[] calldata _pairs) external view returns(uint[2][] memory) {
        uint pairsLength = _pairs.length;
        uint[2][] memory tokenReserves = new uint[2][](pairsLength);
        for(uint i = 0; i < pairsLength; i++) {
            //console.log("at index", i);
            (tokenReserves[i][0], tokenReserves[i][1],) = IUniswapV2Pair(_pairs[i]).getReserves();
        }
        return tokenReserves;
    }
}