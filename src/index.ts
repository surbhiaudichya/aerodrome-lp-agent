import dotenv from "dotenv";
import { logger } from "./utils/logger";
import { CONTRACTS, CHAIN_ID } from "./config/contracts";

// Load environment variables
dotenv.config();

async function main() {
  try {
    logger.info("🚀 Starting Aerodrome LP Agent...");

    // Check if required environment variables are set
    if (!process.env.BASE_RPC_URL) {
      throw new Error("BASE_RPC_URL environment variable is required");
    }

    logger.info(`Chain ID: ${CHAIN_ID}`);
    logger.info(`RPC URL: ${process.env.BASE_RPC_URL}`);
    logger.info("Contract addresses loaded:");
    logger.info(`USDC: ${CONTRACTS.USDC}`);
    logger.info(`WETH: ${CONTRACTS.WETH}`);
    logger.info(`VIRTUAL: ${CONTRACTS.VIRTUAL}`);
    logger.info(`Aerodrome Router: ${CONTRACTS.AERODROME_ROUTER}`);

    logger.info("✅ Basic setup is working!");

    // Check command line arguments
    const args = process.argv.slice(2);
    const command = args[0];

    switch (command) {
      case "test":
        logger.info("🧪 Running test command...");
        break;
      case "status":
        logger.info("📊 Checking status...");
        break;
      default:
        logger.info("Available commands:");
        logger.info("  npm run dev test - Test basic setup");
        logger.info("  npm run dev status - Check agent status");
    }
  } catch (error) {
    logger.error("❌ Error:", error);
    process.exit(1);
  }
}

// Run the main function
if (require.main === module) {
  main();
}
