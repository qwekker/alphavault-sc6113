// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import "./RiskManager.sol";
import "./MockERC20.sol";
/// @notice Prefunded deterministic venue with a 20 bp fee; NOT an AMM or production DEX.
contract MockExchange {
    RiskManager public immutable risk;
    uint256 public constant feeBps = 20;
    event Swap(address indexed trader,address indexed tokenIn,address indexed tokenOut,uint256 amountIn,uint256 amountOut);
    constructor(RiskManager r) { risk = r; }
    function quote(address tokenIn,address tokenOut,uint256 amount) public view returns(uint256) {
        require(tokenIn!=tokenOut && (tokenIn==risk.assets(0)||tokenOut==risk.assets(0)),"cash pairs only");
        return amount * risk.priceOf(tokenIn) / risk.priceOf(tokenOut) * (10000-feeBps) / 10000;
    }
    function swap(address tokenIn,address tokenOut,uint256 amount,uint256 minOut) external returns(uint256 out) {
        require(!risk.paused(),"paused");
        out=quote(tokenIn,tokenOut,amount); require(out>0&&out>=minOut,"slippage");
        require(IERC20(tokenIn).transferFrom(msg.sender,address(this),amount),"transfer in");
        require(IERC20(tokenOut).transfer(msg.sender,out),"transfer out");
        emit Swap(msg.sender,tokenIn,tokenOut,amount,out);
    }
}
