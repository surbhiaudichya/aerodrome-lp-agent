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

  async ensureGasBalance(requiredEth: string = "0.01"): Promise<void> {
    const balance = await this.provider.getBalance(this.agentWallet.address);
    const balanceEth = ethers.formatEther(balance);
    const required = parseFloat(requiredEth);

    if (parseFloat(balanceEth) < required) {
      throw new Error(`Insufficient gas balance. Required: ${requiredEth} ETH, Current: ${balanceEth} ETH`);
    }

    logger.info(`✅ Gas balance sufficient: ${balanceEth} ETH`);
  }
}
