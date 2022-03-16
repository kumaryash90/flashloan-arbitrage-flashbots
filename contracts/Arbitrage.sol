// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import './IUniswapV2Pair.sol';

contract Arbitrage {
    address token;
    address dex;
    function execute(address _dexOnePair, address _dexTwoPair, address _token0, address _token1, uint _reserve0, uint _reserve1) external {
        token = _token0;
        dex = _dexTwoPair;
        IUniswapV2Pair(_token0).swap(_reserve0, 0, address(this), "check");
    }

    function uniswapV2Call(address _sender, uint amount0Out, uint amount1Out, string calldata data) external {
        IERC20(token).approve(dex, amount0Out);
        IUniswapV2Pair(dex);
    }
}