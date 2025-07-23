import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

async function testNetwork() {
  console.log("🔍 Testing network connection...");

  const rpcUrls = [
    "https://mainnet.base.org",
    "https://base.blockpi.network/v1/rpc/public",
    "https://base.llamarpc.com",
    process.env.BASE_RPC_URL, // Your current RPC
  ];

  for (const rpcUrl of rpcUrls) {
    if (!rpcUrl) continue;

    try {
      console.log(`\nTesting: ${rpcUrl}`);
      const provider = new ethers.JsonRpcProvider(rpcUrl);

      // Test basic connection
      const blockNumber = await provider.getBlockNumber();
      console.log(`✅ Block number: ${blockNumber}`);

      // Test contract call
      const usdcContract = new ethers.Contract(
        "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC
        ["function decimals() view returns (uint8)"],
        provider,
      );

      const decimals = await usdcContract.decimals();
      console.log(`✅ USDC decimals: ${decimals}`);

      // Test Aerodrome factory
      const factoryContract = new ethers.Contract(
        "0x420DD381b31aEf6683db6B902084cB0FFECe40Da", // Aerodrome Factory
        ["function getPool(address,address,bool) view returns (address)"],
        provider,
      );

      const poolAddress = await factoryContract.getPool(
        "0x4200000000000000000000000000000000000006", // WETH
        "0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b", // VIRTUAL
        false,
      );

      console.log(`✅ Pool address: ${poolAddress}`);
      console.log("🎉 This RPC works well!");
    } catch (error: any) {
      console.log(`❌ Failed: ${error?.message || "Unknown error"}`);
    }
  }
}

testNetwork().catch(console.error);
