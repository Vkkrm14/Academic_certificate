"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { ConnectButton } from "thirdweb/react";
import { client, sepolia } from "../client";
import Link from "next/link";
import Web3 from "web3";

// ✅ FIX: Remove BlockTransactionObject import - not needed in v4
// Just use type assertions instead

interface BlockData {
  number: number;
  hash: string;
  parentHash: string;
  timestamp: number;
  miner: string;
  difficulty: string;
  totalDifficulty: string;
  size: number;
  gasUsed: number;
  gasLimit: number;
  nonce: string;
  transactionsRoot: string;
  stateRoot: string;
  receiptsRoot: string;
  transactions: any[];
  baseFeePerGas?: number;
}

interface TransactionData {
  hash: string;
  from: string;
  to: string | null;
  value: string;
  gas: number;
  gasPrice: string;
  input: string;
  nonce: number;
  blockNumber: number;
  blockHash: string;
  transactionIndex: number;
}

interface FilterStats {
  totalBlocks: number;
  blocksWithContract: number;
  totalTransactions: number;
  contractTransactions: number;
}

export default function BlockExplorerPage() {
  const [blocks, setBlocks] = useState<BlockData[]>([]);
  const [selectedBlock, setSelectedBlock] = useState<BlockData | null>(null);
  const [allTransactions, setAllTransactions] = useState<TransactionData[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<
    TransactionData[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Loading...");
  const [web3, setWeb3] = useState<Web3 | null>(null);
  const [latestBlockNumber, setLatestBlockNumber] = useState<number>(0);
  const [showOnlyContract, setShowOnlyContract] = useState(true);
  const [filterStats, setFilterStats] = useState<FilterStats>({
    totalBlocks: 0,
    blocksWithContract: 0,
    totalTransactions: 0,
    contractTransactions: 0,
  });

  const CONTRACT_ADDRESS =
    process.env.NEXT_PUBLIC_CERTIFICATE_CONTRACT_ADDRESS?.toLowerCase();
  const CONTRACT_DEPLOYMENT_BLOCK = 9474477; // 🔥 Update this to your deployment block
  const MAX_LOG_BLOCK_RANGE = 10000;
  const LATEST_BLOCKS_TO_FETCH = 100;

  const isFetching = useRef(false);

  // Helper functions
  const toNumber = (value: any): number => {
    if (typeof value === "bigint") return Number(value);
    if (typeof value === "string") {
      if (value.startsWith("0x")) return parseInt(value, 16);
      return parseInt(value, 10);
    }
    return value;
  };

  // ✅ FIX: Remove BlockTransactionObject type, use any instead
  const convertBlock = (block: any): BlockData => {
    if (!block || typeof block !== "object") {
      throw new Error("Invalid block data received");
    }
    return {
      number: toNumber(block.number),
      hash: block.hash,
      parentHash: block.parentHash,
      timestamp: toNumber(block.timestamp),
      miner: block.miner,
      difficulty: block.difficulty?.toString() || "0",
      totalDifficulty: block.totalDifficulty?.toString() || "0",
      size: toNumber(block.size),
      gasUsed: toNumber(block.gasUsed),
      gasLimit: toNumber(block.gasLimit),
      nonce: block.nonce,
      transactionsRoot: block.transactionsRoot,
      stateRoot: block.stateRoot,
      receiptsRoot: block.receiptsRoot,
      transactions: block.transactions || [],
      baseFeePerGas: block.baseFeePerGas
        ? toNumber(block.baseFeePerGas)
        : undefined,
    };
  };

  const convertTransaction = (tx: any): TransactionData => {
    return {
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      value: tx.value?.toString() || "0",
      gas: toNumber(tx.gas),
      gasPrice: tx.gasPrice?.toString() || "0",
      input: tx.input,
      nonce: toNumber(tx.nonce),
      blockNumber: toNumber(tx.blockNumber),
      blockHash: tx.blockHash,
      transactionIndex: toNumber(tx.transactionIndex),
    };
  };

  const decodeFunctionCall = (input: string): string => {
    if (!input || input === "0x") return "No input data";
    const methodId = input.substring(0, 10);
    const methodMap: { [key: string]: string } = {
      "0x6a627842": "registerStudent",
      "0x4b0bddd2": "approveByHOD",
      "0x1e7fb9a3": "approveByDean",
      "0x2f54bf6e": "approveByFinance",
      "0x95d89b41": "issueCertificate",
    };
    return methodMap[methodId] || `Unknown (${methodId})`;
  };

  // Initialize Web3
  useEffect(() => {
    const initWeb3 = async () => {
      try {
        const rpcUrl =
          process.env.NEXT_PUBLIC_SEPOLIA_RPC || "https://rpc.sepolia.org";
        const web3Instance = new Web3(rpcUrl);
        setWeb3(web3Instance);
        console.log("Web3 initialized successfully");
      } catch (error) {
        console.error("Error initializing Web3:", error);
      }
    };
    initWeb3();
  }, []);

  // ✅ FIX: Use getPastLogs instead of getLogs for Web3.js v4
  const fetchContractBlocks = useCallback(async () => {
    if (!web3 || !CONTRACT_ADDRESS || isFetching.current) return;

    console.log("Fetching blocks with contract interactions...");
    setLoadingMessage(
      `Scanning for contract events from block ${CONTRACT_DEPLOYMENT_BLOCK}...`,
    );
    setIsLoading(true);
    isFetching.current = true;
    setBlocks([]);
    setSelectedBlock(null);

    const relevantBlockNumbers = new Set<number>();

    try {
      const latestBlock = Number(await web3.eth.getBlockNumber());
      setLatestBlockNumber(latestBlock);

      for (
        let from = CONTRACT_DEPLOYMENT_BLOCK;
        from <= latestBlock;
        from += MAX_LOG_BLOCK_RANGE
      ) {
        const to = Math.min(from + MAX_LOG_BLOCK_RANGE - 1, latestBlock);
        setLoadingMessage(
          `Scanning blocks ${from.toLocaleString()} to ${to.toLocaleString()}...`,
        );

        try {
          // ✅ FIX: Use getPastLogs instead of getLogs
          const logs = await web3.eth.getPastLogs({
            address: CONTRACT_ADDRESS,
            fromBlock: from,
            toBlock: to,
          });

          // ✅ FIX: Add type annotation for log parameter
          logs.forEach((log: any) => {
            if (log.blockNumber) {
              relevantBlockNumbers.add(Number(log.blockNumber));
            }
          });

          await new Promise((resolve) => setTimeout(resolve, 150));
        } catch (error) {
          console.error(`Error fetching logs for range ${from}-${to}:`, error);
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      console.log(
        `Found ${relevantBlockNumbers.size} unique blocks with contract events.`,
      );
      setLoadingMessage(
        `Found ${relevantBlockNumbers.size} blocks. Fetching block details...`,
      );

      const blockNumbersArray = Array.from(relevantBlockNumbers).sort(
        (a, b) => b - a,
      );
      const fetchedBlocks: BlockData[] = [];
      const chunkSize = 10;

      for (let i = 0; i < blockNumbersArray.length; i += chunkSize) {
        const chunk = blockNumbersArray.slice(i, i + chunkSize);
        const blockPromises = chunk.map((blockNum) =>
          web3.eth.getBlock(blockNum, true).catch((err) => {
            console.error(`Error fetching block ${blockNum}:`, err);
            return null;
          }),
        );

        const results = await Promise.all(blockPromises);
        results.forEach((rawBlock) => {
          if (rawBlock) {
            try {
              fetchedBlocks.push(convertBlock(rawBlock));
            } catch (error) {
              console.error(`Error converting block:`, error);
            }
          }
        });

        setLoadingMessage(
          `Fetched details for ${fetchedBlocks.length} / ${blockNumbersArray.length} blocks...`,
        );
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      setBlocks(fetchedBlocks.sort((a, b) => b.number - a.number));
      setFilterStats({
        totalBlocks: fetchedBlocks.length,
        blocksWithContract: fetchedBlocks.length,
        totalTransactions: 0,
        contractTransactions: 0,
      });
    } catch (error) {
      console.error("Error fetching contract blocks:", error);
    } finally {
      setIsLoading(false);
      isFetching.current = false;
    }
  }, [web3, CONTRACT_ADDRESS]);

  // Fetch recent blocks
  const fetchRecentBlocks = useCallback(
    async (numBlocks: number = LATEST_BLOCKS_TO_FETCH) => {
      if (!web3 || isFetching.current) return;

      console.log(`Fetching latest ${numBlocks} blocks...`);
      setLoadingMessage(`Fetching latest ${numBlocks} blocks...`);
      setIsLoading(true);
      isFetching.current = true;
      setBlocks([]);

      const fetchedBlocks: BlockData[] = [];

      try {
        const latestBlock = Number(await web3.eth.getBlockNumber());
        setLatestBlockNumber(latestBlock);

        const startBlock = Math.max(0, latestBlock - numBlocks + 1);
        const chunkSize = 20;

        for (
          let blockNum = latestBlock;
          blockNum >= startBlock;
          blockNum -= chunkSize
        ) {
          const chunk = [];
          for (let i = 0; i < chunkSize && blockNum - i >= startBlock; i++) {
            chunk.push(web3.eth.getBlock(blockNum - i, true).catch(() => null));
          }

          const results = await Promise.all(chunk);
          results.forEach((rawBlock) => {
            if (rawBlock) {
              try {
                fetchedBlocks.push(convertBlock(rawBlock));
              } catch (error) {
                console.error(`Error converting block:`, error);
              }
            }
          });

          setLoadingMessage(
            `Fetched ${fetchedBlocks.length} / ${numBlocks} blocks...`,
          );
        }

        setBlocks(fetchedBlocks.sort((a, b) => b.number - a.number));
        setFilterStats((prev) => ({
          ...prev,
          totalBlocks: fetchedBlocks.length,
          blocksWithContract: 0,
          totalTransactions: 0,
          contractTransactions: 0,
        }));
      } catch (error) {
        console.error("Error fetching recent blocks:", error);
      } finally {
        setIsLoading(false);
        isFetching.current = false;
      }
    },
    [web3],
  );

  // Fetch block details
  const fetchBlockDetails = useCallback(
    async (blockNumber: number) => {
      if (!web3 || isFetching.current) return;

      setIsLoading(true);
      isFetching.current = true;
      setLoadingMessage(`Fetching details for block ${blockNumber}...`);

      try {
        const rawBlock = await web3.eth.getBlock(blockNumber, true);
        if (!rawBlock) return;

        const block = convertBlock(rawBlock);
        setSelectedBlock(block);

        const transactionDetails: (TransactionData | null)[] = [];
        const txChunkSize = 20;

        for (let i = 0; i < block.transactions.length; i += txChunkSize) {
          const chunk = block.transactions.slice(i, i + txChunkSize);
          const txPromises = chunk.map(async (txOrHash: any) => {
            try {
              const txHash =
                typeof txOrHash === "string" ? txOrHash : txOrHash?.hash;
              if (!txHash) return null;
              const rawTx = await web3.eth.getTransaction(txHash);
              return rawTx ? convertTransaction(rawTx) : null;
            } catch (error) {
              return null;
            }
          });

          const results = await Promise.all(txPromises);
          transactionDetails.push(...results);
          setLoadingMessage(
            `Fetching transaction details ${Math.min(i + txChunkSize, block.transactions.length)} / ${block.transactions.length}...`,
          );
        }

        const validTxs = transactionDetails.filter(
          (tx) => tx !== null,
        ) as TransactionData[];
        setAllTransactions(validTxs);

        const contractTxs = validTxs.filter(
          (tx) => tx && tx.to?.toLowerCase() === CONTRACT_ADDRESS,
        );
        setFilteredTransactions(contractTxs);

        setFilterStats((prev) => ({
          ...prev,
          totalTransactions: validTxs.length,
          contractTransactions: contractTxs.length,
        }));
      } catch (error) {
        console.error("Error fetching block details:", error);
      } finally {
        setIsLoading(false);
        isFetching.current = false;
      }
    },
    [web3, CONTRACT_ADDRESS],
  );

  // Main fetch logic
  useEffect(() => {
    if (web3) {
      if (showOnlyContract) {
        fetchContractBlocks();
      } else {
        fetchRecentBlocks(LATEST_BLOCKS_TO_FETCH);
      }
    }
  }, [web3, showOnlyContract, fetchContractBlocks, fetchRecentBlocks]);

  const displayTransactions = showOnlyContract
    ? filteredTransactions
    : allTransactions;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-8">
      <div className="container mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <Link
              href="/"
              className="text-blue-400 hover:text-blue-300 mb-2 inline-block"
            >
              ← Back to Home
            </Link>
            <h1 className="text-4xl font-bold text-white">
              Blockchain Explorer
            </h1>
            <p className="text-gray-300">
              Sepolia Testnet - Academic Certificate Transactions
            </p>
          </div>
          <ConnectButton client={client} />
        </div>

        {/* Contract Address Display */}
        {CONTRACT_ADDRESS && (
          <div className="glass-effect rounded-lg p-4 mb-6 border border-green-500/30">
            <p className="text-gray-400 text-sm mb-1">
              Monitoring Contract Address:
            </p>
            <p className="text-green-400 font-mono text-sm break-all">
              {CONTRACT_ADDRESS}
            </p>
          </div>
        )}

        {/* Filter Toggle */}
        <div className="glass-effect rounded-lg p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-white font-semibold mb-2">
                Block Discovery Mode
              </p>
              <p className="text-gray-300 text-sm">
                {showOnlyContract
                  ? `🎓 Scanning from block ${CONTRACT_DEPLOYMENT_BLOCK.toLocaleString()} for certificate transactions`
                  : `🌐 Showing latest ${LATEST_BLOCKS_TO_FETCH.toLocaleString()} blocks from Sepolia network`}
              </p>
            </div>
            <button
              onClick={() => {
                setShowOnlyContract(!showOnlyContract);
                setSelectedBlock(null);
              }}
              disabled={isLoading}
              className={`px-6 py-3 rounded-lg font-semibold transition-all disabled:opacity-50 ${
                showOnlyContract
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-blue-600 hover:bg-blue-700"
              } text-white`}
            >
              {showOnlyContract ? "🎓 Contract Only" : "🌐 All Transactions"}
            </button>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="glass-effect rounded-lg p-6">
            <p className="text-gray-400 text-sm mb-1">Latest Block</p>
            <p className="text-white text-2xl font-bold">
              {latestBlockNumber.toLocaleString()}
            </p>
          </div>
          <div className="glass-effect rounded-lg p-6">
            <p className="text-gray-400 text-sm mb-1">Blocks Displayed</p>
            <p className="text-white text-2xl font-bold">{blocks.length}</p>
          </div>
          <div className="glass-effect rounded-lg p-6">
            <p className="text-gray-400 text-sm mb-1">
              {showOnlyContract ? "Contract Blocks Found" : "Total Blocks"}
            </p>
            <p className="text-white text-2xl font-bold">
              {filterStats.totalBlocks}
            </p>
          </div>
          <div className="glass-effect rounded-lg p-6">
            <p className="text-gray-400 text-sm mb-1">
              {showOnlyContract ? "Deployment Block" : "Blocks Checked"}
            </p>
            <p className="text-green-400 text-2xl font-bold">
              {showOnlyContract
                ? CONTRACT_DEPLOYMENT_BLOCK.toLocaleString()
                : filterStats.blocksWithContract}
            </p>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="glass-effect rounded-lg p-8 mb-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-white text-xl mb-2">{loadingMessage}</p>
              <p className="text-gray-400 text-sm">
                Please wait, this may take a moment...
              </p>
            </div>
          </div>
        )}

        {/* Blocks List */}
        {!isLoading && (
          <div className="glass-effect rounded-lg p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-6">
              {showOnlyContract
                ? "Blocks with Certificate Transactions"
                : "Recent Blocks"}
            </h2>

            {blocks.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-300 text-xl mb-2">No blocks found</p>
                <p className="text-gray-400 text-sm">
                  {showOnlyContract
                    ? "No certificate transactions found. Check your contract address and deployment block."
                    : "Unable to fetch blocks. Please check your RPC connection."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/20">
                      <th className="px-4 py-3 text-left text-gray-300">
                        Block
                      </th>
                      <th className="px-4 py-3 text-left text-gray-300">
                        Hash
                      </th>
                      <th className="px-4 py-3 text-left text-gray-300">
                        Timestamp
                      </th>
                      <th className="px-4 py-3 text-left text-gray-300">
                        Txns
                      </th>
                      <th className="px-4 py-3 text-left text-gray-300">
                        Gas Used
                      </th>
                      <th className="px-4 py-3 text-left text-gray-300">
                        Validator
                      </th>
                      <th className="px-4 py-3 text-left text-gray-300">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {blocks.map((block, index) => {
                      const contractTxCount = block.transactions.filter(
                        (tx: any) => tx.to?.toLowerCase() === CONTRACT_ADDRESS,
                      ).length;

                      return (
                        <tr
                          key={index}
                          className="border-b border-white/10 hover:bg-white/5 transition-colors"
                        >
                          <td className="px-4 py-4 text-blue-400 font-mono font-semibold">
                            {block.number}
                          </td>
                          <td className="px-4 py-4 text-gray-300 font-mono text-xs">
                            {block.hash.substring(0, 10)}...
                            {block.hash.substring(block.hash.length - 8)}
                          </td>
                          <td className="px-4 py-4 text-gray-300 text-sm">
                            {new Date(block.timestamp * 1000).toLocaleString()}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex flex-col">
                              <span className="text-green-400 font-semibold">
                                {block.transactions.length}
                              </span>
                              {contractTxCount > 0 && (
                                <span className="text-xs text-green-300">
                                  ({contractTxCount} contract)
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-gray-300 text-sm">
                            {block.gasUsed.toLocaleString()}
                          </td>
                          <td className="px-4 py-4 text-purple-400 font-mono text-xs">
                            {block.miner.substring(0, 8)}...
                          </td>
                          <td className="px-4 py-4">
                            <button
                              onClick={() => fetchBlockDetails(block.number)}
                              disabled={isLoading}
                              className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white px-4 py-2 rounded text-sm transition-colors"
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Selected Block Details */}
        {selectedBlock && (
          <div className="glass-effect rounded-lg p-8 mb-8 animate-fadeIn">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">
                Block #{selectedBlock.number} Details
              </h2>
              <button
                onClick={() => {
                  setSelectedBlock(null);
                  setAllTransactions([]);
                  setFilteredTransactions([]);
                }}
                className="text-gray-400 hover:text-white text-2xl transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Transaction Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-blue-500/20 rounded-lg p-4 border border-blue-500/30">
                <p className="text-gray-400 text-sm mb-1">Total Transactions</p>
                <p className="text-white text-2xl font-bold">
                  {filterStats.totalTransactions}
                </p>
              </div>
              <div className="bg-green-500/20 rounded-lg p-4 border border-green-500/30">
                <p className="text-gray-400 text-sm mb-1">
                  Certificate Transactions
                </p>
                <p className="text-green-400 text-2xl font-bold">
                  {filterStats.contractTransactions}
                </p>
              </div>
              <div className="bg-purple-500/20 rounded-lg p-4 border border-purple-500/30">
                <p className="text-gray-400 text-sm mb-1">Relevance</p>
                <p className="text-purple-400 text-2xl font-bold">
                  {filterStats.totalTransactions > 0
                    ? `${((filterStats.contractTransactions / filterStats.totalTransactions) * 100).toFixed(1)}%`
                    : "0%"}
                </p>
              </div>
            </div>

            {/* Block Header Information */}
            <div className="bg-black/30 rounded-lg p-6 mb-8 border border-white/10">
              <h3 className="text-xl font-bold text-white mb-4">
                Block Header
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Block Hash</p>
                    <p className="text-white font-mono text-xs break-all">
                      {selectedBlock.hash}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm mb-1">
                      Parent Hash (Previous Block)
                    </p>
                    <p className="text-blue-400 font-mono text-xs break-all">
                      {selectedBlock.parentHash}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm mb-1">
                      Transactions Root (Merkle Root)
                    </p>
                    <p className="text-green-400 font-mono text-xs break-all">
                      {selectedBlock.transactionsRoot}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm mb-1">State Root</p>
                    <p className="text-yellow-400 font-mono text-xs break-all">
                      {selectedBlock.stateRoot}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Receipts Root</p>
                    <p className="text-purple-400 font-mono text-xs break-all">
                      {selectedBlock.receiptsRoot}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Timestamp</p>
                    <p className="text-white">
                      {new Date(
                        selectedBlock.timestamp * 1000,
                      ).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm mb-1">
                      Validator (Miner)
                    </p>
                    <p className="text-white font-mono text-xs break-all">
                      {selectedBlock.miner}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm mb-1">
                      Gas Used / Limit
                    </p>
                    <p className="text-white mb-2">
                      {selectedBlock.gasUsed.toLocaleString()} /{" "}
                      {selectedBlock.gasLimit.toLocaleString()}
                    </p>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{
                          width: `${(selectedBlock.gasUsed / selectedBlock.gasLimit) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Block Size</p>
                    <p className="text-white">
                      {(selectedBlock.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Difficulty</p>
                    <p className="text-white">{selectedBlock.difficulty}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Nonce</p>
                    <p className="text-white font-mono">
                      {selectedBlock.nonce}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Transactions in Block */}
            <div>
              <h3 className="text-xl font-bold text-white mb-4">
                {showOnlyContract
                  ? "Certificate Contract Transactions"
                  : "All Transactions"}
                ({displayTransactions.length})
              </h3>

              {displayTransactions.length > 0 ? (
                <div className="space-y-4">
                  {displayTransactions.map((tx, index) => {
                    const isContractTx =
                      tx.to?.toLowerCase() === CONTRACT_ADDRESS;

                    return (
                      <div
                        key={index}
                        className={`rounded-lg p-4 border transition-all ${
                          isContractTx
                            ? "bg-green-500/10 border-green-500/30"
                            : "bg-black/30 border-white/10"
                        }`}
                      >
                        {isContractTx && (
                          <div className="mb-3 inline-block">
                            <span className="bg-green-500/20 text-green-400 text-xs font-semibold px-3 py-1 rounded-full border border-green-500/30">
                              🎓 Certificate Contract
                            </span>
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-gray-400 text-xs mb-1">
                              Transaction Hash
                            </p>
                            <p className="text-blue-400 font-mono text-xs break-all">
                              {tx.hash}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-xs mb-1">From</p>
                            <p className="text-green-400 font-mono text-xs break-all">
                              {tx.from}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-xs mb-1">To</p>
                            <p
                              className={`font-mono text-xs break-all ${
                                isContractTx
                                  ? "text-green-400 font-semibold"
                                  : "text-purple-400"
                              }`}
                            >
                              {tx.to || "Contract Creation"}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-xs mb-1">Value</p>
                            <p className="text-white">
                              {web3?.utils.fromWei(tx.value, "ether")} ETH
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-xs mb-1">
                              Gas Price
                            </p>
                            <p className="text-white">
                              {web3?.utils.fromWei(tx.gasPrice, "gwei")} Gwei
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-xs mb-1">
                              Gas Limit
                            </p>
                            <p className="text-white">
                              {tx.gas.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-xs mb-1">
                              Transaction Index
                            </p>
                            <p className="text-white">{tx.transactionIndex}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-xs mb-1">Nonce</p>
                            <p className="text-white">{tx.nonce}</p>
                          </div>
                        </div>

                        {tx.input && tx.input !== "0x" && (
                          <div className="mt-4 space-y-2">
                            <div>
                              <p className="text-gray-400 text-xs mb-1">
                                Function Called
                              </p>
                              <p className="text-green-400 font-semibold text-sm">
                                {decodeFunctionCall(tx.input)}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-400 text-xs mb-1">
                                Input Data
                              </p>
                              <div className="bg-black/50 p-3 rounded border border-white/10">
                                <p className="text-yellow-400 font-mono text-xs break-all">
                                  {tx.input.length > 200
                                    ? `${tx.input.substring(0, 200)}...`
                                    : tx.input}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="mt-3">
                          <a
                            href={`https://sepolia.etherscan.io/tx/${tx.hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 text-xs"
                          >
                            View on Etherscan →
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 bg-black/20 rounded-lg border border-white/10">
                  <p className="text-gray-400 text-lg">
                    {showOnlyContract
                      ? "No certificate contract transactions in this block"
                      : "No transactions in this block"}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
