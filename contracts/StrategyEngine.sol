// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import "./RiskManager.sol";
contract StrategyEngine {
    RiskManager public immutable risk;
    uint256 public selected; // 0: equal risk-asset weights, 1: momentum, 2: volatility target
    uint256 public targetVolatility = 1200;
    uint256 public cashBuffer = 2000;
    uint256 public cooldown = 60;
    bool[3] public enabled = [true, true, true];
    event StrategySelected(uint256 indexed strategy);
    event StrategyConfigured(uint256 targetVolatility, uint256 cashBuffer, uint256 cooldown);
    event StrategyEnabled(uint256 indexed strategy, bool enabled);
    constructor(RiskManager r) { risk = r; }
    modifier managerOnly() { require(risk.hasRole(risk.MANAGER(), msg.sender), "manager only"); _; }
    function selectStrategy(uint256 id) external managerOnly {
        require(id < 3 && enabled[id], "strategy disabled"); selected = id; emit StrategySelected(id);
    }
    function configure(uint256 target, uint256 cash, uint256 interval) external managerOnly {
        require(target > 0 && target <= 10000 && cash <= 10000 && interval >= 30 && interval <= 7 days, "config bounds");
        targetVolatility = target; cashBuffer = cash; cooldown = interval; emit StrategyConfigured(target, cash, interval);
    }
    function setEnabled(uint256 id, bool value) external managerOnly {
        require(id < 3, "strategy id"); enabled[id] = value; emit StrategyEnabled(id, value);
    }
    function targetWeights() public view returns (uint256[3] memory w) {
        require(enabled[selected], "strategy disabled");
        w[0] = cashBuffer; uint256 exposure = 10000 - cashBuffer;
        (, uint256 vol1, int256 momentum1,,) = risk.markets(risk.assets(1));
        (, uint256 vol2, int256 momentum2,,) = risk.markets(risk.assets(2));
        if (selected == 1) {
            if (momentum1 <= 0 && momentum2 <= 0) return [uint256(10000), 0, 0];
            w[1] = momentum1 >= momentum2 ? exposure * 3 / 4 : exposure / 4;
        } else {
            if (selected == 2) {
                uint256 avgVol = (vol1 + vol2) / 2;
                if (avgVol > 0 && exposure * avgVol / 10000 > targetVolatility) exposure = targetVolatility * 10000 / avgVol;
                w[0] = 10000 - exposure;
            }
            w[1] = exposure / 2;
        }
        w[2] = exposure - w[1];
    }
    function validatedWeights() external view returns (uint256[3] memory w) {
        w = targetWeights(); risk.validate(w);
    }
}
