import dotenv from "dotenv";
import { logger } from "./utils/logger";
import { CONTRACTS, CHAIN_ID } from "./config/contracts";
import { WalletService } from "./services/WalletService";
import { TokenService } from "./services/TokenService";

// Load environment variables
dotenv.config();

async function main() {
  try {
    logger.info("🚀 Starting Aerodrome LP Agent...");

    // Check if required environment variables are set
    if (!process.env.BASE_RPC_URL) {
      throw new Error("BASE_RPC_URL environment variable is required");
    }

    if (!process.env.AGENT_PRIVATE_KEY) {
      throw new Error("AGENT_PRIVATE_KEY environment variable is required");
    }

    logger.info(`Chain ID: ${CHAIN_ID}`);
    logger.info(`RPC URL: ${process.env.BASE_RPC_URL}`);

    // Initialize services
    const walletService = new WalletService(process.env.BASE_RPC_URL, process.env.AGENT_PRIVATE_KEY);

    const tokenService = new TokenService(walletService);

    // Check command line arguments
    const args = process.argv.slice(2);
    const command = args[0];

    switch (command) {
      case "test":
        await testWalletService(walletService);
        break;
      case "test-tokens":
        await testTokenService(tokenService);
        break;
      case "balances":
        await showTokenBalances(tokenService);
        break;
      case "status":
        await showAgentStatus(walletService, tokenService);
        break;
      default:
        logger.info("Available commands:");
        logger.info("  npm run dev test - Test wallet service");
        logger.info("  npm run dev test-tokens - Test token service");
        logger.info("  npm run dev balances - Show token balances");
        logger.info("  npm run dev status - Check agent status");
    }
  } catch (error) {
    logger.error("❌ Error:", error);
    process.exit(1);
  }
}

async function testWalletService(walletService: WalletService) {
  logger.info("🧪 Testing wallet service...");

  // Get network info
  const networkInfo = await walletService.getNetworkInfo();
  logger.info(`Network: ${networkInfo.networkName} (Chain ID: ${networkInfo.chainId})`);

  // Get agent balance
  const balance = await walletService.getAgentBalance();
  logger.info(`Agent balance: ${balance} ETH`);

  // Check if balance is sufficient
  try {
    await walletService.ensureGasBalance("0.001");
    logger.info("✅ Wallet service test passed!");
  } catch (error) {
    logger.warn(`⚠️  Low balance warning: ${error}`);
  }
}

async function testTokenService(tokenService: TokenService) {
  logger.info("🧪 Testing token service...");

  try {
    // Test getting token info for USDC
    logger.info("Getting USDC token info...");
    const usdcInfo = await tokenService.getTokenInfo(CONTRACTS.USDC);
    logger.info(`USDC: ${usdcInfo.name} (${usdcInfo.symbol}) - ${usdcInfo.decimals} decimals`);

    // Test getting token info for WETH
    logger.info("Getting WETH token info...");
    const wethInfo = await tokenService.getTokenInfo(CONTRACTS.WETH);
    logger.info(`WETH: ${wethInfo.name} (${wethInfo.symbol}) - ${wethInfo.decimals} decimals`);

    // Test getting token info for VIRTUAL
    logger.info("Getting VIRTUAL token info...");
    const virtualInfo = await tokenService.getTokenInfo(CONTRACTS.VIRTUAL);
    logger.info(`VIRTUAL: ${virtualInfo.name} (${virtualInfo.symbol}) - ${virtualInfo.decimals} decimals`);

    logger.info("✅ Token service test passed!");
  } catch (error) {
    logger.error("❌ Token service test failed:", error);
  }
}

async function showTokenBalances(tokenService: TokenService) {
  logger.info("💰 Checking token balances...");

  const tokens = [
    { name: "USDC", address: CONTRACTS.USDC },
    { name: "WETH", address: CONTRACTS.WETH },
    { name: "VIRTUAL", address: CONTRACTS.VIRTUAL },
  ];

  for (const token of tokens) {
    try {
      const balance = await tokenService.getBalance(token.address);
      console.log(`${token.name}: ${balance.balance}`);
    } catch (error) {
      console.log(`${token.name}: Error getting balance`);
    }
  }
}

async function showAgentStatus(walletService: WalletService, tokenService: TokenService) {
  logger.info("📊 Agent Status:");
  logger.info("===============");

  const networkInfo = await walletService.getNetworkInfo();
  const ethBalance = await walletService.getAgentBalance();

  console.log(`Agent Address: ${walletService.getAgentWallet().address}`);
  console.log(`Network: ${networkInfo.networkName} (${networkInfo.chainId})`);
  console.log(`ETH Balance: ${ethBalance} ETH`);
  console.log("");
  console.log("Token Balances:");

  const tokens = [
    { name: "USDC", address: CONTRACTS.USDC },
    { name: "WETH", address: CONTRACTS.WETH },
    { name: "VIRTUAL", address: CONTRACTS.VIRTUAL },
  ];

  for (const token of tokens) {
    try {
      const balance = await tokenService.getBalance(token.address);
      console.log(`  ${token.name}: ${balance.balance}`);
    } catch (error) {
      console.log(`  ${token.name}: Error`);
    }
  }

  if (parseFloat(ethBalance) < 0.01) {
    console.log("⚠️  Warning: Low ETH balance for gas fees");
  }
}

// Run the main function
if (require.main === module) {
  main();
}
