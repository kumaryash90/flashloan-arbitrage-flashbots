// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import './IUniswapV2Pair.sol';
import './IUniswapV2Router02.sol';
import './IWETH.sol';

contract Arbitrage {
    address public weth;
    address public owner;

    constructor(address _weth) {
        weth = _weth;
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(owner == msg.sender, "not owner");
        _;
    }
    
    receive() external payable {}

    function changeAdmin(address _newOwner) external onlyOwner {
        owner = _newOwner;
    }

    function withdraw() external onlyOwner {
        payable(msg.sender).transfer(address(this).balance);
    }

    function withdrawTokens(address _token) external onlyOwner {
        uint balance = IERC20(_token).balanceOf(address(this));
        IERC20(_token).transfer(msg.sender, balance);
    }

    function destruct() external onlyOwner {
        selfdestruct(payable(msg.sender));
    }


    function execute(
         address[] calldata pairs
        ,address[] calldata routers
        ,address[] calldata tokens
        ,uint tokensToTrade
    ) external onlyOwner {

        uint _amount0Out = tokens[0] == weth ? 0 : tokensToTrade;
        uint _amount1Out = tokens[0] == weth ? tokensToTrade : 0;
        address _token = tokens[0] == weth ? tokens[1] : tokens[0];

        bytes memory data = abi.encode(_token, routers[0], routers[1]);

        IUniswapV2Pair(pairs[0]).swap(_amount0Out, _amount1Out, address(this), data);

        // console.log("flash swap complete");
    }

    function uniswapV2Call(
        address _sender
        ,uint amount0Out
        ,uint amount1Out
        ,bytes calldata data
    ) external {
        require(_sender == address(this));
        uint amount = amount0Out == 0 ? amount1Out : amount0Out;
        (address token, address routerFrom, address routerTo) = abi.decode(data, (address, address, address));
        uint tokenBalance = IERC20(token).balanceOf(address(this));
        // console.log("tokenBalance before: ", tokenBalance);
        IERC20(token).approve(routerTo, tokenBalance);
        address[] memory path = new address[](2);
        path[0] = token;
        path[1] = weth;
        IUniswapV2Router02(routerTo).swapExactTokensForETH(
            tokenBalance, 
            0, 
            path,
            address(this),
            block.timestamp
        );

        uint ethBalance = address(this).balance;
        // console.log("ethBalance before: ", ethBalance);

        address[] memory newPath = new address[](2);
        newPath[0] = path[1];
        newPath[1] = path[0];

        uint amountRequired = IUniswapV2Router02(routerFrom).getAmountsIn(amount, newPath)[0];
        // console.log("amount required: ", amountRequired);

        require(ethBalance > amountRequired, "ethBalance is less than amountRequired"); 
        IWETH(weth).deposit{ value: amountRequired }();
        IWETH(weth).transfer(msg.sender, amountRequired);
        tokenBalance = IERC20(token).balanceOf(address(this));
        // console.log("tokenBalance after: ", tokenBalance);
        ethBalance = address(this).balance;
        // console.log("ethBalance after: ", ethBalance);
    }
}