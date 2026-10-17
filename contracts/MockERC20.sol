// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
interface IERC20 {
    function balanceOf(address) external view returns (uint256);
    function transfer(address,uint256) external returns (bool);
    function transferFrom(address,address,uint256) external returns (bool);
    function approve(address,uint256) external returns (bool);
}
/// @notice Test assets only. Minting belongs to deployment admin.
contract MockERC20 is IERC20 {
    string public name; string public symbol; uint8 public constant decimals = 18;
    address public immutable owner; uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    event Transfer(address indexed from,address indexed to,uint256 amount);
    event Approval(address indexed owner,address indexed spender,uint256 amount);
    constructor(string memory n,string memory s) { name = n; symbol = s; owner = msg.sender; }
    function mint(address to,uint256 amount) external { require(msg.sender == owner,"owner only"); require(to != address(0),"zero address"); totalSupply += amount; balanceOf[to] += amount; emit Transfer(address(0),to,amount); }
    function approve(address spender,uint256 amount) external returns(bool) { allowance[msg.sender][spender] = amount; emit Approval(msg.sender,spender,amount); return true; }
    function transfer(address to,uint256 amount) external returns(bool) { _transfer(msg.sender,to,amount); return true; }
    function transferFrom(address from,address to,uint256 amount) external returns(bool) { uint256 a=allowance[from][msg.sender]; require(a>=amount,"allowance"); if(a!=type(uint256).max) allowance[from][msg.sender]=a-amount; _transfer(from,to,amount); return true; }
    function _transfer(address from,address to,uint256 amount) internal { require(to!=address(0)&&balanceOf[from]>=amount,"balance/address"); balanceOf[from]-=amount; balanceOf[to]+=amount; emit Transfer(from,to,amount); }
}
