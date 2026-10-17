// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import "./StrategyEngine.sol";
import "./MockExchange.sol";
/// @notice Nontransferable vault shares with pro-rata in-kind redemption. Not ERC-4626.
contract PortfolioVault {
    RiskManager public immutable risk;
    StrategyEngine public immutable strategy;
    MockExchange public immutable exchange;
    uint256 public totalSupply;
    mapping(address=>uint256) public balanceOf;
    uint256 public lastRebalance;
    bool public automationEnabled;
    bool private entered;
    event Deposited(address indexed investor,uint256 assets,uint256 shares);
    event Redeemed(address indexed investor,uint256 shares,uint256[3] amounts);
    event Rebalanced(address indexed keeper,uint256 indexed strategyId,uint256 navBefore,uint256 navAfter,uint256[3] weights);
    event AutomationChanged(bool enabled);
    constructor(RiskManager r,StrategyEngine s,MockExchange e) {
        require(address(s.risk())==address(r)&&address(e.risk())==address(r),"dependency mismatch");
        risk=r; strategy=s; exchange=e;
    }
    modifier locked() { require(!entered,"reentrant"); entered=true; _; entered=false; }
    function totalAssets() public view returns(uint256 nav) {
        for(uint256 i=0;i<3;++i) {
            address a=risk.assets(i); uint256 bal=IERC20(a).balanceOf(address(this));
            if(bal>0) nav+=bal*risk.priceOf(a)/1e18;
        }
    }
    function previewDeposit(uint256 amount) public view returns(uint256) { return amount*(totalSupply+1e6)/(totalAssets()+1); }
    function deposit(uint256 amount,uint256 minShares) external locked returns(uint256 shares) {
        require(!risk.paused(),"paused"); require(amount>0,"zero deposit");
        shares=previewDeposit(amount); require(shares>0&&shares>=minShares,"min shares");
        totalSupply+=shares; balanceOf[msg.sender]+=shares;
        require(IERC20(risk.assets(0)).transferFrom(msg.sender,address(this),amount),"transfer");
        emit Deposited(msg.sender,amount,shares);
    }
    /// @dev Always available, even when paused, assets disabled, or prices stale.
    function redeem(uint256 shares,uint256[3] calldata minAmounts) external locked returns(uint256[3] memory amounts) {
        require(shares>0&&shares<=balanceOf[msg.sender],"share balance");
        for(uint256 i=0;i<3;++i) {
            uint256 balance=IERC20(risk.assets(i)).balanceOf(address(this));
            // Use the same virtual supply on entry AND exit; otherwise donation
            // rounding can be monetized by recovering the virtual portion on exit.
            amounts[i]=(balance+(i==0?1:0))*shares/(totalSupply+1e6);
            require(amounts[i]>=minAmounts[i],"min redemption");
        }
        balanceOf[msg.sender]-=shares; totalSupply-=shares;
        for(uint256 i=0;i<3;++i) if(amounts[i]>0) require(IERC20(risk.assets(i)).transfer(msg.sender,amounts[i]),"transfer");
        emit Redeemed(msg.sender,shares,amounts);
    }
    function setAutomation(bool value) external {
        require(risk.hasRole(risk.MANAGER(),msg.sender),"manager only");
        automationEnabled=value; emit AutomationChanged(value);
    }
    function rebalance(uint256 maxLossBps,uint256 deadline) external locked {
        require(risk.hasRole(risk.KEEPER(),msg.sender),"keeper only");
        require(automationEnabled,"automation off"); require(block.timestamp<=deadline,"expired");
        require(lastRebalance==0||block.timestamp>=lastRebalance+strategy.cooldown(),"cooldown");
        require(maxLossBps<=risk.maxSlippage(),"slippage policy");
        uint256[3] memory w=strategy.validatedWeights(); // Engine -> RiskManager policy enforcement
        uint256 beforeNav=totalAssets(); require(beforeNav>0,"empty vault");
        lastRebalance=block.timestamp;
        address cash=risk.assets(0);
        for(uint256 i=1;i<3;++i) {
            address a=risk.assets(i); uint256 balance=IERC20(a).balanceOf(address(this));
            if(balance>0) _swap(a,cash,balance,maxLossBps);
        }
        uint256 budget=IERC20(cash).balanceOf(address(this));
        for(uint256 i=1;i<3;++i) {
            uint256 amount=budget*w[i]/10000;
            if(amount>0) _swap(cash,risk.assets(i),amount,maxLossBps);
        }
        uint256 afterNav=totalAssets();
        require(afterNav*10000>=beforeNav*(10000-maxLossBps),"nav loss");
        emit Rebalanced(msg.sender,strategy.selected(),beforeNav,afterNav,w);
    }
    function _swap(address a,address b,uint256 amount,uint256 slip) private {
        uint256 fair=amount*risk.priceOf(a)/risk.priceOf(b);
        require(IERC20(a).approve(address(exchange),amount),"approve");
        exchange.swap(a,b,amount,fair*(10000-slip)/10000);
    }
}
