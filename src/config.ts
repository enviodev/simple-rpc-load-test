// Get command line arguments
const args = process.argv.slice(2);
const rpcUrl = args[0];
const scenarioName = args[1] || 'default';

import dotenv from 'dotenv';
dotenv.config();

// Ensure RPC URL is provided in environment variables
const fetchConcurrencyEnv = process.env.FETCH_CONCURRENCY || 5;
if (isNaN(Number(fetchConcurrencyEnv)) || Number(fetchConcurrencyEnv) > 100000 || Number(fetchConcurrencyEnv) < 0) {
  throw new Error("FETCH_CONCURRENCY environment variable must be a number less than 100000");
}
const fetchConcurrency = Number(fetchConcurrencyEnv);

if (!rpcUrl) {
  console.error('Error: RPC URL is required as the first argument');
  console.error('Usage: ts-node src/index.ts <rpc-url> [scenario-name]');
  console.error('Available scenarios: usdc-approvals, usdc-aave-withdrawals, usdc-user-transfers, basenames-discounts, default');
  process.exit(1);
}

type scenario = {
  rpcUrl: string;
  addresses: string[];
  topics: string[];
  concurrency: number;
  startBlock: number;
  endBlock: number;
  chunkSize: number;
}

// Define scenario configurations with RPC URL as a parameter
const createScenarios = (rpcUrl: string) => ({
  // USDC token on Base - fetch all approvals
  "usdc-approvals": {
    rpcUrl,
    addresses: ["0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"],
    topics: [
      "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925",
    ],
    concurrency: fetchConcurrency,
    startBlock: 0,
    endBlock: 27241550,
    chunkSize: 1_000,
  },

  // All USDC withdrawn from AAVEv3
  "usdc-aave-withdrawals": {
    rpcUrl,
    addresses: ["0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"],
    topics: [
      "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
      "0x00000000000000000000000055b33c314560016688d4764f1eae288ad49576ac"
    ],
    concurrency: fetchConcurrency,
    startBlock: 0,
    endBlock: 10_000,
    chunkSize: 1_000,
  },

  // USDC transfers from specific user
  "usdc-some-random-users-transfers": {
    rpcUrl,
    addresses: ["0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"], // TODO- add more addresses here.
    topics: [
      "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
      "0x00000000000000000000000014c5Ca9F70dFc36Ce5919A460CF2E48D7e933cEE"
    ],
    concurrency: fetchConcurrency,
    startBlock: 0,
    endBlock: 10_000,
    chunkSize: 1_000,
  },

  // All "discountApplied" events on basenames
  "basenames-discounts": {
    rpcUrl,
    addresses: ["0x2B7704f1cb9324cD8586B33C6c540CbD64E58237"],
    topics: [
      "0xfe82878a5987cea7129c337d7aaa6a49585236fc104b066223bc5b5e49510e2b"
    ],
    concurrency: fetchConcurrency,
    startBlock: 0,
    endBlock: 10_000,
    chunkSize: 1_000,
  },

  // Default configuration
  "default": {
    rpcUrl,
    addresses: ["0xYourContractAddress1", "0xYourContractAddress2"],
    topics: [
      "0xTopic1",
      // "0xTopic2", // if multiple
    ],
    concurrency: fetchConcurrency,
    startBlock: 0,
    endBlock: 10_000,
    chunkSize: 1_000,
  }
});

// Function to get configuration for a specific scenario
function getConfig(rpcUrl: string, scenarioName = "default") {
  if (!rpcUrl) {
    throw new Error("RPC URL is required as the first argument");
  }

  const scenarios = createScenarios(rpcUrl);
  const config = scenarios[scenarioName as keyof typeof scenarios];

  if (!config) {
    throw new Error(`Scenario "${scenarioName}" not found. Available scenarios: ${Object.keys(scenarios).join(", ")}`);
  }

  return config;
}


// Default export that requires RPC URL to be passed

const finalConfig: scenario = getConfig(rpcUrl, scenarioName);
module.exports = finalConfig;
