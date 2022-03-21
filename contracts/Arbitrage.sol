// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./IUniswapV2Pair.sol";
import "./IUniswapV2Router02.sol";
import "./IWETH.sol";
import "hardhat/console.sol";

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
        uint256 balance = IERC20(_token).balanceOf(address(this));
        IERC20(_token).transfer(msg.sender, balance);
    }

    function destruct() external onlyOwner {
        selfdestruct(payable(msg.sender));
    }

    function execute(
        address[] calldata pairs,
        address[] calldata routers,
        address[] calldata tokens,
        uint256 tokensToTrade
    ) external onlyOwner {
        uint256 _amount0Out = tokens[0] == weth ? 0 : tokensToTrade;
        uint256 _amount1Out = tokens[0] == weth ? tokensToTrade : 0;
        address _token = tokens[0] == weth ? tokens[1] : tokens[0];

        bytes memory data = abi.encode(_token, routers[0], routers[1]);

        address[] memory newPath = new address[](2);
        newPath[0] = weth;
        newPath[1] = _token;

        uint256 amountRequired = IUniswapV2Router02(routers[0]).getAmountsIn(
            tokensToTrade,
            newPath
        )[0];

        console.log("amount required before swap: ", amountRequired);

        IUniswapV2Pair(pairs[0]).swap(
            _amount0Out,
            _amount1Out,
            address(this),
            data
        );

        console.log("flash swap complete");
    }

    function uniswapV2Call(
        address _sender,
        uint256 amount0Out,
        uint256 amount1Out,
        bytes calldata data
    ) external {
        require(_sender == address(this));
        uint256 amount = amount0Out == 0 ? amount1Out : amount0Out;
        (address token, address routerFrom, address routerTo) = abi.decode(
            data,
            (address, address, address)
        );
        uint256 tokenBalance = IERC20(token).balanceOf(address(this));
        console.log("amount received: ", amount);
        console.log("tokenBalance before: ", tokenBalance);
        // require(amount == tokenBalance, "amount and tokenBalance mismatch");
        require(IERC20(token).approve(routerTo, amount), "couldn't approve");
        address[] memory path = new address[](2);
        path[0] = token;
        path[1] = weth;
        uint256 amountReceived = IUniswapV2Router02(routerTo).getAmountsOut(
            tokenBalance,
            path
        )[1];
        console.log("eth received: ", amountReceived);
        IUniswapV2Router02(routerTo).swapExactTokensForETH(
            amount,
            0,
            path,
            address(this),
            block.timestamp
        );

        uint256 ethBalance = address(this).balance;
        console.log("ethBalance before: ", ethBalance);

        address[] memory newPath = new address[](2);
        newPath[0] = path[1];
        newPath[1] = path[0];

        uint256 amountRequired = IUniswapV2Router02(routerFrom).getAmountsIn(
            tokenBalance,
            newPath
        )[0];

        console.log("amount required: ", amountRequired);

        require(
            amountReceived > amountRequired,
            "amountReceived is less than amountRequired"
        );
        IWETH(weth).deposit{value: amountRequired}();
        IWETH(weth).transfer(msg.sender, amountRequired);
        tokenBalance = IERC20(token).balanceOf(address(this));
        console.log("tokenBalance after: ", tokenBalance);
        ethBalance = address(this).balance;
        console.log("ethBalance after: ", ethBalance);
    }
}
