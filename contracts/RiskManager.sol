// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @notice Central policy and MANUALLY reported mock market data. Not a production oracle.
contract RiskManager {
    address public immutable admin;
    bytes32 public constant MANAGER = keccak256("MANAGER");
    bytes32 public constant KEEPER = keccak256("KEEPER");
    bytes32 public constant RISK = keccak256("RISK");
    mapping(bytes32 => mapping(address => bool)) public hasRole;
    struct Market { uint256 price; uint256 volatility; int256 momentum; uint256 updatedAt; bool enabled; }
    mapping(address => Market) public markets;
    address[3] public assets;
    uint256 public maxWeight = 7000;
    uint256 public minCash = 1000;
    uint256 public maxVolatility = 5000;
    uint256 public maxSlippage = 100;
    uint256 public maxAge = 3600;
    bool public paused;
    event RoleSet(bytes32 indexed role, address indexed account, bool enabled);
    event MarketUpdated(address indexed asset, uint256 price, uint256 volatility, int256 momentum);
    event AssetEnabled(address indexed asset, bool enabled);
    event LimitsUpdated(uint256 maxWeight, uint256 minCash, uint256 maxVolatility, uint256 maxSlippage, uint256 maxAge);
    event PauseChanged(bool paused);
    constructor(address[3] memory a, address manager, address officer, address keeper) {
        require(manager != address(0) && officer != address(0) && keeper != address(0), "zero role");
        require(a[0] != address(0) && a[1] != address(0) && a[2] != address(0), "zero asset");
        require(a[0] != a[1] && a[0] != a[2] && a[1] != a[2], "duplicate asset");
        admin = msg.sender; assets = a;
        hasRole[MANAGER][manager] = true; hasRole[RISK][officer] = true; hasRole[KEEPER][keeper] = true;
        markets[a[0]] = Market(1e18, 0, 0, block.timestamp, true);
    }
    modifier riskOnly() { require(hasRole[RISK][msg.sender], "risk only"); _; }
    function setRole(bytes32 role, address who, bool enabled) external {
        require(msg.sender == admin, "admin only"); require(who != address(0), "zero account");
        require(role == MANAGER || role == KEEPER || role == RISK, "unknown role");
        hasRole[role][who] = enabled; emit RoleSet(role, who, enabled);
    }
    function known(address asset) public view returns (bool) {
        return asset == assets[0] || asset == assets[1] || asset == assets[2];
    }
    function updateMarket(address asset, uint256 price, uint256 vol, int256 momentum) external riskOnly {
        require(known(asset) && asset != assets[0], "risky asset only");
        require(price > 0 && price <= 1e30 && vol <= 100000 && momentum >= -10000 && momentum <= 100000, "market bounds");
        // Reporting data never implicitly re-enables a disabled asset.
        markets[asset] = Market(price, vol, momentum, block.timestamp, markets[asset].enabled);
        emit MarketUpdated(asset, price, vol, momentum);
    }
    function setAssetEnabled(address asset, bool enabled) external riskOnly {
        require(known(asset) && asset != assets[0], "risky asset only");
        markets[asset].enabled = enabled; emit AssetEnabled(asset, enabled);
    }
    function setLimits(uint256 weight, uint256 cash, uint256 vol, uint256 slip, uint256 age) external riskOnly {
        require(weight > 0 && weight <= 10000 && cash <= 10000 && vol > 0 && vol <= 100000, "limit bounds");
        require(slip <= 500 && age >= 60 && age <= 86400, "limit bounds");
        maxWeight = weight; minCash = cash; maxVolatility = vol; maxSlippage = slip; maxAge = age;
        emit LimitsUpdated(weight, cash, vol, slip, age);
    }
    function setPaused(bool value) external riskOnly { paused = value; emit PauseChanged(value); }
    function priceOf(address asset) public view returns (uint256) {
        require(known(asset), "unknown asset");
        if (asset == assets[0]) return 1e18;
        Market memory m = markets[asset];
        require(m.price > 0 && block.timestamp <= m.updatedAt + maxAge, "stale price");
        return m.price;
    }
    function validate(uint256[3] memory weights) external view returns (uint256 portfolioVolatility) {
        require(!paused, "paused");
        require(weights[0] + weights[1] + weights[2] == 10000, "weight sum");
        require(weights[0] >= minCash, "cash floor");
        for (uint256 i = 1; i < 3; ++i) {
            require(weights[i] <= maxWeight, "position cap");
            if (weights[i] > 0) { require(markets[assets[i]].enabled, "disabled asset"); priceOf(assets[i]); }
            portfolioVolatility += weights[i] * markets[assets[i]].volatility / 10000;
        }
        // Conservative weighted-volatility bound; no on-chain covariance estimate.
        require(portfolioVolatility <= maxVolatility, "volatility cap");
    }
}
