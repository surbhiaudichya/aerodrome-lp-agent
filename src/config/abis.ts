export const ABIS = {
  // Standard ERC20 token ABI - essential functions only
  ERC20: [
    "function balanceOf(address owner) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function transferFrom(address from, address to, uint256 amount) returns (bool)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
    "function name() view returns (string)",
  ],

  // Aerodrome Router - for swaps and liquidity
  AERODROME_ROUTER: [
    "function getAmountsOut(uint amountIn, tuple(address from, address to, bool stable, address factory)[] routes) view returns (uint[] amounts)",
    "function quoteAddLiquidity(address tokenA, address tokenB, bool stable, uint amountADesired, uint amountBDesired) view returns (uint amountA, uint amountB, uint liquidity)",
    "function quoteRemoveLiquidity(address tokenA, address tokenB, bool stable, uint liquidity) view returns (uint amountA, uint amountB)", // ADD THIS LINE
    "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, tuple(address from, address to, bool stable, address factory)[] routes, address to, uint deadline) returns (uint[] amounts)",
    "function addLiquidity(address tokenA, address tokenB, bool stable, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) returns (uint amountA, uint amountB, uint liquidity)",
    "function removeLiquidity(address tokenA, address tokenB, bool stable, uint liquidity, uint amountAMin, uint amountBMin, address to, uint deadline) returns (uint amountA, uint amountB)",
  ],
  // Aerodrome Factory - to get pool addresses
  AERODROME_FACTORY: ["function getPool(address tokenA, address tokenB, bool stable) view returns (address pool)"],

  // Aerodrome Gauge ABI - for staking LP tokens
  AERODROME_GAUGE: [
    "function deposit(uint256 amount)",
    "function withdraw(uint256 amount)",
    "function balanceOf(address account) view returns (uint256)",
    "function earned(address account) view returns (uint256)",
    "function getReward()",
    "function totalSupply() view returns (uint256)",
  ],

  // Aerodrome Voter ABI - to find gauge addresses
  AERODROME_VOTER: [
    "function gauges(address pool) view returns (address gauge)",
    "function isGauge(address gauge) view returns (bool)",
  ],
};
