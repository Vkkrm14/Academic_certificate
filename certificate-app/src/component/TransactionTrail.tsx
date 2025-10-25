"use client";
import { useState, useEffect } from "react";
import Web3 from "web3";
import { Contract } from "web3-eth-contract"; // Import Contract type

interface TrailEvent {
  eventName: string;
  timestamp: number;
  transactionHash: string;
  blockNumber: number;
  actor: string;
  level?: string;
  details?: string;
}

interface TransactionTrailProps {
  regNo: string;
  contractAddress: string;
  isExpanded: boolean;
}

export default function TransactionTrail({
  regNo,
  contractAddress,
  isExpanded,
}: TransactionTrailProps) {
  const [trail, setTrail] = useState<TrailEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [web3, setWeb3] = useState<Web3 | null>(null);

  useEffect(() => {
    const initWeb3 = async () => {
      const rpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC!;
      const web3Instance = new Web3(rpcUrl);
      setWeb3(web3Instance);
    };
    initWeb3();
  }, []);

  const fetchTransactionTrail = async () => {
    if (!web3 || !regNo || !isExpanded) return;

    setIsLoading(true);
    try {
      const contractABI = [
        // ... (Your full ABI remains unchanged here) ...
        {
          anonymous: false,
          inputs: [
            { indexed: true, name: "regNo", type: "string" },
            { indexed: false, name: "name", type: "string" },
            { indexed: false, name: "studentWallet", type: "address" },
            { indexed: true, name: "registeredBy", type: "address" },
            { indexed: false, name: "timestamp", type: "uint256" },
          ],
          name: "StudentRegistered",
          type: "event",
        },
        {
          anonymous: false,
          inputs: [
            { indexed: true, name: "regNo", type: "string" },
            { indexed: true, name: "approvedBy", type: "address" },
            { indexed: false, name: "approvalLevel", type: "string" },
            { indexed: false, name: "timestamp", type: "uint256" },
          ],
          name: "ApplicationApproved",
          type: "event",
        },
        {
          anonymous: false,
          inputs: [
            { indexed: true, name: "regNo", type: "string" },
            { indexed: true, name: "rejectedBy", type: "address" },
            { indexed: false, name: "rejectionLevel", type: "string" },
            { indexed: false, name: "reason", type: "string" },
            { indexed: false, name: "timestamp", type: "uint256" },
          ],
          name: "ApplicationRejected",
          type: "event",
        },
        {
          anonymous: false,
          inputs: [
            { indexed: true, name: "regNo", type: "string" },
            { indexed: true, name: "issuedBy", type: "address" },
            { indexed: true, name: "studentWallet", type: "address" },
            { indexed: false, name: "ipfsHash", type: "string" },
            { indexed: false, name: "timestamp", type: "uint256" },
          ],
          name: "CertificateIssued",
          type: "event",
        },
      ];

      const contract = new web3.eth.Contract(
        contractABI as any,
        contractAddress,
      );
      const allEvents: TrailEvent[] = [];

      // --- MODIFICATIONS START HERE ---

      // 1. Define the batch size from your error message
      const MAX_BLOCK_RANGE = 10000;

      // 2. Get the latest block number ONCE
      const latestBlock = Number(await web3.eth.getBlockNumber());

      // 3. Define a starting block. 0 is the default, but you should
      //    optimize this to your contract's deployment block number.
      const startBlock = 9474477;

      // 4. Create a reusable helper function to query in batches
      const getPastEventsInBatches = async (eventName: string, filter: any) => {
        let allChunkEvents: any[] = [];

        for (
          let from = startBlock;
          from <= latestBlock;
          from += MAX_BLOCK_RANGE
        ) {
          const to = Math.min(from + MAX_BLOCK_RANGE - 1, latestBlock);

          console.log(
            `Fetching ${eventName} events from block ${from} to ${to}`,
          );

          const chunkLogs = await contract.getPastEvents(eventName, {
            filter: filter,
            fromBlock: from,
            toBlock: to,
          });

          allChunkEvents = allChunkEvents.concat(chunkLogs);
        }
        return allChunkEvents;
      };

      // 5. Use the new batching function in your Promise.all
      const [registeredEvents, approvedEvents, rejectedEvents, issuedEvents] =
        await Promise.all([
          getPastEventsInBatches("StudentRegistered", { regNo }),
          getPastEventsInBatches("ApplicationApproved", { regNo }),
          getPastEventsInBatches("ApplicationRejected", { regNo }),
          getPastEventsInBatches("CertificateIssued", { regNo }),
        ]);

      // --- MODIFICATIONS END HERE ---

      // The rest of your processing logic remains exactly the same
      registeredEvents.forEach((event: any) => {
        allEvents.push({
          eventName: "Registration",
          timestamp: Number(event.returnValues.timestamp),
          transactionHash: event.transactionHash,
          blockNumber: Number(event.blockNumber), // Ensure blockNumber is number
          actor: event.returnValues.registeredBy,
          details: `Student registered by Department`,
        });
      });

      approvedEvents.forEach((event: any) => {
        allEvents.push({
          eventName: "Approval",
          timestamp: Number(event.returnValues.timestamp),
          transactionHash: event.transactionHash,
          blockNumber: Number(event.blockNumber), // Ensure blockNumber is number
          actor: event.returnValues.approvedBy,
          level: event.returnValues.approvalLevel,
          details: `Approved by ${event.returnValues.approvalLevel}`,
        });
      });

      rejectedEvents.forEach((event: any) => {
        allEvents.push({
          eventName: "Rejection",
          timestamp: Number(event.returnValues.timestamp),
          transactionHash: event.transactionHash,
          blockNumber: Number(event.blockNumber), // Ensure blockNumber is number
          actor: event.returnValues.rejectedBy,
          level: event.returnValues.rejectionLevel,
          details: `Rejected by ${event.returnValues.rejectionLevel}: ${event.returnValues.reason}`,
        });
      });

      issuedEvents.forEach((event: any) => {
        allEvents.push({
          eventName: "Certificate Issued",
          timestamp: Number(event.returnValues.timestamp),
          transactionHash: event.transactionHash,
          blockNumber: Number(event.blockNumber), // Ensure blockNumber is number
          actor: event.returnValues.issuedBy,
          details: `Certificate issued by Registrar`,
        });
      });

      allEvents.sort((a, b) => a.timestamp - b.timestamp);
      setTrail(allEvents);
    } catch (error) {
      console.error("Error fetching transaction trail:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (web3 && regNo && isExpanded) {
      fetchTransactionTrail();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [web3, regNo, isExpanded]);

  if (!isExpanded) return null;

  return (
    // ... (Your JSX rendering logic remains unchanged) ...
    <div className="mt-4 pt-4 border-t border-white/20">
      <h4 className="text-lg font-bold text-purple-300 mb-3 flex items-center">
        <span className="mr-2">📜</span>
        Transaction Trail
      </h4>

      {isLoading ? (
        <div className="text-center py-6">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-400 mx-auto"></div>
          <p className="text-gray-400 text-sm mt-2">
            Loading blockchain history...
          </p>
        </div>
      ) : trail.length === 0 ? (
        <p className="text-gray-400 text-sm">No transaction history found</p>
      ) : (
        <div className="space-y-3">
          {trail.map((event, index) => (
            <div
              key={index}
              className="relative pl-6 pb-3 border-l-2 border-purple-500/50 last:pb-0"
            >
              <div className="absolute -left-[5px] top-0 w-2 h-2 rounded-full bg-purple-500"></div>

              <div className="bg-black/30 rounded-lg p-3 border border-white/10">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h5
                      className={`font-semibold text-sm ${
                        event.eventName === "Rejection"
                          ? "text-red-400"
                          : event.eventName === "Certificate Issued"
                            ? "text-green-400"
                            : "text-blue-400"
                      }`}
                    >
                      {event.eventName}
                      {event.level && ` - ${event.level}`}
                    </h5>
                    <p className="text-gray-400 text-xs mt-1">
                      {event.details}
                    </p>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(event.timestamp * 1000).toLocaleDateString()}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                  <div>
                    <span className="text-gray-500">Actor:</span>
                    <span className="text-purple-400 font-mono ml-1">
                      {event.actor.substring(0, 6)}...
                      {event.actor.substring(event.actor.length - 4)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Block:</span>
                    <span className="text-white font-mono ml-1">
                      {event.blockNumber}
                    </span>
                  </div>
                </div>

                <div className="mt-2">
                  <a
                    href={`https://sepolia.etherscan.io/tx/${event.transactionHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 text-xs break-all"
                  >
                    View on Etherscan →
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
