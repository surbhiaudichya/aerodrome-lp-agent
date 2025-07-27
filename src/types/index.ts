export interface SwapRoute {
  from: string;
  to: string;
  stable: boolean;
  factory: string;
}

export interface DepositParams {
  userAddress: string;
  usdcAmount: string;
  slippageTolerance?: number;
}

export interface DepositResult {
  success: boolean;
  txHashes: string[];
  stakedLPAmount: string;
  error?: string;
}

export interface PositionReceipt {
  userAddress: string;
  agentAddress: string;
  poolAddress: string;
  gaugeAddress: string;
  stakedLPAmount: string;
  timestamp: string;
}

export interface WithdrawParams {
  userAddress: string;
  lpAmount: string;
  slippageTolerance?: number;
}

export interface WithdrawResult {
  success: boolean;
  txHashes: string[];
  usdcReturned: string;
  error?: string;
}
