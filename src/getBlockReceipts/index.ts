import { parseBaseConfig } from '../lib/config';
import { runRpcTest } from '../lib/utils';

// Get configuration from environment variables
const config = parseBaseConfig();

// Run the test
runRpcTest(
  config,
  "eth_getBlockReceipts",
  (blockNum) => [`0x${blockNum.toString(16)}`],
  "eth_getBlockReceipts"
).catch((err) => {
  console.error("Error running test:", err);
  process.exit(1);
}); 
