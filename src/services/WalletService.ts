import { ethers } from "ethers";
import { logger } from "../utils/logger";

export class WalletService {
  private provider: ethers.JsonRpcProvider;
  private agentWallet: ethers.Wallet;

  constructor(rpcUrl: string, privateKey: string) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.agentWallet = new ethers.Wallet(privateKey, this.provider);

    logger.info(`Agent wallet initialized: ${this.agentWallet.address}`);
  }

  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
  }

  getAgentWallet(): ethers.Wallet {
    return this.agentWallet;
  }

  async getAgentBalance(): Promise<string> {
    const balance = await this.provider.getBalance(this.agentWallet.address);
    return ethers.formatEther(balance);
  }

  async ensureGasBalance(requiredEth: string = "0.01"): Promise<void> {
    const balance = await this.getAgentBalance();
    const required = parseFloat(requiredEth);

    if (parseFloat(balance) < required) {
      throw new Error(`Insufficient gas balance. Required: ${requiredEth} ETH, Current: ${balance} ETH`);
    }

    logger.info(`✅ Gas balance sufficient: ${balance} ETH`);
  }

  async getNetworkInfo(): Promise<{ chainId: number; networkName: string }> {
    const network = await this.provider.getNetwork();
    return {
      chainId: Number(network.chainId),
      networkName: network.name,
    };
  }
}
