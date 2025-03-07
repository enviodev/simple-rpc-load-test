import { performance } from 'perf_hooks';
import { updateProgressBar, createBlocksList, displayStats } from '../lib/utils';

// Get command line arguments
const args = process.argv.slice(2);
const rpcUrl = args[0];
const config = require("../lib/config");

interface EthGetLogsParams {
  fromBlock: string;
  toBlock: string;
  address?: string[];
  topics?: string[];
}

async function fetchLogs(params: EthGetLogsParams): Promise<number> {
  // Build standard JSON RPC payload
  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "eth_getLogs",
    params: [params],
  };

  // Time the request
  const start = performance.now();
  const response = await fetch(config.rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const end = performance.now();

  if (!response.ok) {
    throw new Error(`RPC request failed with status ${response.status}`);
  }

  // Return the duration for stats
  return end - start;
}

async function runTest() {
  console.log("config", config)
  const { addresses, topics, concurrency, startBlock, endBlock, chunkSize } =
    config;

  const blockRanges = createBlocksList(startBlock, endBlock, chunkSize);

  const durations: number[] = [];
  let activeRequests = 0;
  let index = 0;

  const startTime = performance.now();

  return new Promise<void>((resolve, reject) => {
    // Dispatch function that processes the next chunk if available
    const dispatch = async () => {
      // While there are ranges left and we can spawn more requests:
      while (activeRequests < concurrency && index < blockRanges.length) {
        activeRequests++;
        const [fromBlock, toBlock] = blockRanges[index++];
        const hexFrom = "0x" + fromBlock.toString(16);
        const hexTo = "0x" + toBlock.toString(16);

        fetchLogs({
          fromBlock: hexFrom,
          toBlock: hexTo,
          address: addresses,
          topics: topics,
        })

          .then((duration) => {
            activeRequests--;
            dispatch(); // Attempt to queue up next chunk
            durations.push(duration);
            updateProgressBar(index, blockRanges.length);
          })
          .catch((err) => reject(err));
      }

      // If no more chunks remain and all requests are done, finish up
      if (index >= blockRanges.length && activeRequests === 0) {
        const endTime = performance.now();
        // Compute stats
        const totalTimeMs = endTime - startTime;
        const minTime = Math.min(...durations);
        const maxTime = Math.max(...durations);
        const avgTime =
          durations.reduce((acc, val) => acc + val, 0) / durations.length;

        console.log("=== STATS ===");
        console.log(`Total requests:         ${durations.length}`);
        console.log(`Min request time (ms):  ${minTime.toFixed(2)}`);
        console.log(`Max request time (ms):  ${maxTime.toFixed(2)}`);
        console.log(`Avg request time (ms):  ${avgTime.toFixed(2)}`);
        console.log(`Total time (ms):        ${totalTimeMs.toFixed(2)}`);
        resolve();
      }
    };

    // Kick off initial dispatch
    dispatch();
  });
}

runTest().catch((err) => {
  console.error("Error running test:", err);
  process.exit(1);
});
