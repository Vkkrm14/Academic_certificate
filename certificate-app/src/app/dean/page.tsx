"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ConnectButton } from "thirdweb/react";
import { useActiveAccount } from "thirdweb/react";
import {
  getContract,
  readContract,
  resolveMethod,
  prepareContractCall,
} from "thirdweb";
import { useSendTransaction } from "thirdweb/react";
import { client, sepolia } from "../client";
import Link from "next/link";
import TransactionTrail from "../../component/TransactionTrail";

// Helper functions
const safeToBigInt = (value: any, defaultValue: bigint = BigInt(0)): bigint => {
  if (value === undefined || value === null || value === "")
    return defaultValue;
  try {
    return BigInt(value);
  } catch (e) {
    return defaultValue;
  }
};

const safeToString = (value: any, defaultValue: string = ""): string => {
  if (value === undefined || value === null) return defaultValue;
  return String(value);
};

const safeToBoolean = (value: any, defaultValue: boolean = false): boolean => {
  if (value === undefined || value === null) return defaultValue;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "bigint") return value !== BigInt(0);
  return Boolean(value);
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface PendingApproval {
  regNo: string;
  name: string;
  branch: string;
  email: string;
  cgpa: string;
  status: string;
  appliedDate: string;
  hodVerifier: string;
  hodApproved: boolean;
}

interface AllLevelPending {
  regNo: string;
  name: string;
  branch: string;
  currentLevel: string;
  appliedDate: string;
  hodApproved: boolean;
  deanApproved: boolean;
  financeApproved: boolean;
}

interface IssuedCertificate {
  regNo: string;
  name: string;
  branch: string;
  studentWallet: string;
  issuedDate: string;
  ipfsHash: string;
  deanVerifier: string;
}

export default function DeanPage() {
  const account = useActiveAccount();
  const { mutate: sendTransaction } = useSendTransaction();

  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "current" | "allPending" | "issued"
  >("current");

  // State for different lists
  const [currentPending, setCurrentPending] = useState<PendingApproval[]>([]);
  const [allLevelPending, setAllLevelPending] = useState<AllLevelPending[]>([]);
  const [issuedCertificates, setIssuedCertificates] = useState<
    IssuedCertificate[]
  >([]);

  const [isDean, setIsDean] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Rejection modal state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectRegNo, setRejectRegNo] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  const isLoadingRef = useRef(false);
  const dataLoadedRef = useRef({
    current: false,
    allLevels: false,
    issued: false,
  });

  // Smart contracts
  const certificateContract = getContract({
    client,
    chain: sepolia,
    address: process.env.NEXT_PUBLIC_CERTIFICATE_CONTRACT_ADDRESS!,
  });

  const accessControlContract = getContract({
    client,
    chain: sepolia,
    address: process.env.NEXT_PUBLIC_ACCESS_CONTROL_ADDRESS!,
  });

  const toggleCard = (regNo: string) => {
    setExpandedCard(expandedCard === regNo ? null : regNo);
  };

  // Check if user has Dean role
  useEffect(() => {
    const checkDeanRole = async () => {
      if (!account?.address) {
        setIsDean(false);
        return;
      }

      try {
        const result = await readContract({
          contract: accessControlContract,
          method: "function isDean(address) view returns (bool)",
          params: [account.address],
        });
        setIsDean(result as boolean);
      } catch (error) {
        console.error("Error checking Dean role:", error);
        setIsDean(false);
      }
    };

    checkDeanRole();
  }, [account]);

  // Optimized batch fetching with rate limiting
  const fetchStudentRecordBatch = async (
    regNos: string[],
    delayMs: number = 150,
  ) => {
    const records: any[] = [];

    for (let i = 0; i < regNos.length; i++) {
      const regNo = regNos[i];
      if (!regNo || regNo.trim() === "" || regNo === "0") continue;

      try {
        const record = await readContract({
          contract: certificateContract,
          method: resolveMethod("getStudentRecord"),
          params: [regNo],
        });
        records.push(record);

        if (i < regNos.length - 1) {
          await delay(delayMs);
        }
      } catch (error) {
        console.error(`Error loading record for ${regNo}:`, error);
      }
    }

    return records;
  };

  // Load current pending approvals (students pending Dean approval)
  const loadCurrentPending = useCallback(async () => {
    if (!isDean || isLoadingRef.current || dataLoadedRef.current.current)
      return;

    isLoadingRef.current = true;
    setIsLoadingDetails(true);

    try {
      const regNos = (await readContract({
        contract: certificateContract,
        method: "function getPendingApprovals(string) view returns (string[])",
        params: ["PENDING_DEAN"],
      })) as string[];

      if (!regNos || regNos.length === 0) {
        setCurrentPending([]);
        dataLoadedRef.current.current = true;
        return;
      }

      const records = await fetchStudentRecordBatch(regNos, 150);

      const pendingList: PendingApproval[] = records.map((record: any) => ({
        regNo: safeToString(record.regNo || record[1]),
        name: safeToString(record.name || record[0]),
        branch: safeToString(record.branch || record[2]),
        email: safeToString(record.email || record[3]),
        cgpa: (Number(safeToBigInt(record.cgpa || record[4])) / 100).toFixed(2),
        status: safeToString(record.status || record[9]),
        appliedDate:
          Number(safeToBigInt(record.applicationTimestamp || record[25])) > 0
            ? new Date(
                Number(
                  safeToBigInt(record.applicationTimestamp || record[25]),
                ) * 1000,
              ).toLocaleDateString()
            : "N/A",
        hodVerifier: safeToString(record.hodVerifier || record[20]),
        hodApproved: safeToBoolean(record.hodApproved || record[10]),
      }));

      setCurrentPending(pendingList);
      dataLoadedRef.current.current = true;
    } catch (error) {
      console.error("Error loading current pending:", error);
      setCurrentPending([]);
    } finally {
      setIsLoadingDetails(false);
      isLoadingRef.current = false;
    }
  }, [isDean, certificateContract]);

  // Load all pending approvals at all levels
  const loadAllLevelPending = useCallback(async () => {
    if (!isDean || isLoadingRef.current || dataLoadedRef.current.allLevels)
      return;

    isLoadingRef.current = true;

    try {
      const levels = [
        "PENDING_HOD",
        "PENDING_DEAN",
        "PENDING_FINANCE",
        "PENDING_REGISTRAR",
      ];
      const allPending: AllLevelPending[] = [];

      for (const level of levels) {
        const regNos = (await readContract({
          contract: certificateContract,
          method:
            "function getPendingApprovals(string) view returns (string[])",
          params: [level],
        })) as string[];

        if (!regNos || regNos.length === 0) continue;

        const records = await fetchStudentRecordBatch(regNos, 150);

        records.forEach((record: any) => {
          allPending.push({
            regNo: safeToString(record.regNo || record[1]),
            name: safeToString(record.name || record[0]),
            branch: safeToString(record.branch || record[2]),
            currentLevel: safeToString(record.status || record[9]),
            appliedDate:
              Number(safeToBigInt(record.applicationTimestamp || record[25])) >
              0
                ? new Date(
                    Number(
                      safeToBigInt(record.applicationTimestamp || record[25]),
                    ) * 1000,
                  ).toLocaleDateString()
                : "N/A",
            hodApproved: safeToBoolean(record.hodApproved || record[10]),
            deanApproved: safeToBoolean(record.deanApproved || record[11]),
            financeApproved: safeToBoolean(
              record.financeApproved || record[12],
            ),
          });
        });
      }

      setAllLevelPending(allPending);
      dataLoadedRef.current.allLevels = true;
    } catch (error) {
      console.error("Error loading all level pending:", error);
      setAllLevelPending([]);
    } finally {
      isLoadingRef.current = false;
    }
  }, [isDean, certificateContract]);

  // Load issued certificates
  const loadIssuedCertificates = useCallback(async () => {
    if (!isDean || isLoadingRef.current || dataLoadedRef.current.issued) return;

    isLoadingRef.current = true;

    try {
      const regNos = (await readContract({
        contract: certificateContract,
        method: "function getPendingApprovals(string) view returns (string[])",
        params: ["ISSUED"],
      })) as string[];

      if (!regNos || regNos.length === 0) {
        setIssuedCertificates([]);
        dataLoadedRef.current.issued = true;
        return;
      }

      const records = await fetchStudentRecordBatch(regNos, 150);

      const issuedList: IssuedCertificate[] = records.map((record: any) => ({
        regNo: safeToString(record.regNo || record[1]),
        name: safeToString(record.name || record[0]),
        branch: safeToString(record.branch || record[2]),
        studentWallet: safeToString(record.studentWalletAddress || record[6]),
        issuedDate:
          Number(safeToBigInt(record.issuanceTimestamp || record[26])) > 0
            ? new Date(
                Number(safeToBigInt(record.issuanceTimestamp || record[26])) *
                  1000,
              ).toLocaleDateString()
            : "N/A",
        ipfsHash: safeToString(record.ipfsHash || record[24]),
        deanVerifier: safeToString(record.deanVerifier || record[21]),
      }));

      setIssuedCertificates(issuedList);
      dataLoadedRef.current.issued = true;
    } catch (error) {
      console.error("Error loading issued certificates:", error);
      setIssuedCertificates([]);
    } finally {
      isLoadingRef.current = false;
    }
  }, [isDean, certificateContract]);

  // Load data based on active tab
  useEffect(() => {
    if (!isDean) return;

    if (activeTab === "current" && !dataLoadedRef.current.current) {
      loadCurrentPending();
    } else if (activeTab === "allPending" && !dataLoadedRef.current.allLevels) {
      loadAllLevelPending();
    } else if (activeTab === "issued" && !dataLoadedRef.current.issued) {
      loadIssuedCertificates();
    }
  }, [
    activeTab,
    isDean,
    loadCurrentPending,
    loadAllLevelPending,
    loadIssuedCertificates,
  ]);

  // Approve function
  const handleApprove = async (regNo: string) => {
    if (!account || !isDean) {
      alert("Only Dean accounts can approve students");
      return;
    }

    try {
      setIsLoading(true);

      const transaction = prepareContractCall({
        contract: certificateContract,
        method: "function approveByDean(string memory regNo) public",
        params: [regNo],
      });

      sendTransaction(transaction, {
        onSuccess: () => {
          alert(
            `Student ${regNo} approved successfully! Moving to Finance level.`,
          );
          dataLoadedRef.current.current = false;
          loadCurrentPending();
          setIsLoading(false);
        },
        onError: (error) => {
          console.error("Error:", error);
          alert(`Approval failed: ${error.message || "Unknown error"}`);
          setIsLoading(false);
        },
      });
    } catch (error: any) {
      console.error("Error:", error);
      alert(`Approval failed: ${error.message || "Unknown error"}`);
      setIsLoading(false);
    }
  };

  // Reject function
  const handleReject = async () => {
    if (!account || !isDean || !rejectRegNo || !rejectReason) {
      alert("Please provide rejection reason");
      return;
    }

    try {
      setIsLoading(true);

      const transaction = prepareContractCall({
        contract: certificateContract,
        method:
          "function rejectByDean(string memory regNo, string memory reason) public",
        params: [rejectRegNo, rejectReason],
      });

      sendTransaction(transaction, {
        onSuccess: () => {
          alert(`Application ${rejectRegNo} rejected.`);
          setShowRejectModal(false);
          setRejectRegNo("");
          setRejectReason("");
          dataLoadedRef.current.current = false;
          loadCurrentPending();
          setIsLoading(false);
        },
        onError: (error) => {
          console.error("Error:", error);
          alert(`Rejection failed: ${error.message || "Unknown error"}`);
          setIsLoading(false);
        },
      });
    } catch (error: any) {
      console.error("Error:", error);
      alert(`Rejection failed: ${error.message || "Unknown error"}`);
      setIsLoading(false);
    }
  };

  const openRejectModal = (regNo: string) => {
    setRejectRegNo(regNo);
    setShowRejectModal(true);
  };

  const getLevelBadgeColor = (status: string) => {
    switch (status) {
      case "PENDING_HOD":
        return "bg-yellow-500/20 text-yellow-300 border-yellow-500/50";
      case "PENDING_DEAN":
        return "bg-blue-500/20 text-blue-300 border-blue-500/50";
      case "PENDING_FINANCE":
        return "bg-purple-500/20 text-purple-300 border-purple-500/50";
      case "PENDING_REGISTRAR":
        return "bg-orange-500/20 text-orange-300 border-orange-500/50";
      case "ISSUED":
        return "bg-green-500/20 text-green-300 border-green-500/50";
      default:
        return "bg-gray-500/20 text-gray-300 border-gray-500/50";
    }
  };

  const handleRefresh = () => {
    if (activeTab === "current") {
      dataLoadedRef.current.current = false;
      setCurrentPending([]);
      loadCurrentPending();
    } else if (activeTab === "allPending") {
      dataLoadedRef.current.allLevels = false;
      setAllLevelPending([]);
      loadAllLevelPending();
    } else if (activeTab === "issued") {
      dataLoadedRef.current.issued = false;
      setIssuedCertificates([]);
      loadIssuedCertificates();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 to-indigo-900 p-8">
      <div className="container mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <Link
              href="/"
              className="text-purple-200 hover:text-white mb-2 inline-block"
            >
              ← Back to Home
            </Link>
            <h1 className="text-4xl font-bold text-white">Dean Dashboard</h1>
            <p className="text-purple-200">
              Second level approval - Review HOD-approved applications
            </p>
          </div>
          <ConnectButton client={client} />
        </div>

        {/* Access Control */}
        {!account ? (
          <div className="text-center py-20">
            <div className="glass-effect rounded-lg p-8">
              <h2 className="text-2xl font-bold text-white mb-4">
                Connect Your Wallet
              </h2>
              <p className="text-gray-300">
                Please connect your wallet with Dean role to access this
                dashboard
              </p>
            </div>
          </div>
        ) : !isDean ? (
          <div className="text-center py-20">
            <div className="bg-red-500/20 backdrop-blur-md rounded-lg p-8 border border-red-500/50">
              <h2 className="text-2xl font-bold text-red-400 mb-4">
                ⚠️ Access Denied
              </h2>
              <p className="text-red-300">
                Only accounts with Dean role can access this page
              </p>
              <p className="text-gray-400 text-sm mt-2">
                Connected: {account.address}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Tab Navigation */}
            <div className="flex justify-between items-center mb-6">
              <div className="flex space-x-4">
                <button
                  onClick={() => setActiveTab("current")}
                  className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                    activeTab === "current"
                      ? "bg-purple-600 text-white"
                      : "glass-effect text-purple-200 hover:bg-white/20"
                  }`}
                >
                  📋 Pending My Approval ({currentPending.length})
                </button>
                <button
                  onClick={() => setActiveTab("allPending")}
                  className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                    activeTab === "allPending"
                      ? "bg-yellow-600 text-white"
                      : "glass-effect text-yellow-200 hover:bg-white/20"
                  }`}
                >
                  📊 All Levels Pending ({allLevelPending.length})
                </button>
                <button
                  onClick={() => setActiveTab("issued")}
                  className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                    activeTab === "issued"
                      ? "bg-blue-600 text-white"
                      : "glass-effect text-blue-200 hover:bg-white/20"
                  }`}
                >
                  ✅ Issued Certificates ({issuedCertificates.length})
                </button>
              </div>

              <button
                onClick={handleRefresh}
                disabled={isLoadingDetails || isLoadingRef.current}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 text-white px-4 py-3 rounded-lg font-semibold"
              >
                🔄 Refresh
              </button>
            </div>

            {/* Current Pending Tab */}
            {activeTab === "current" && (
              <div className="glass-effect rounded-lg p-8">
                <h2 className="text-2xl font-bold text-white mb-6">
                  Students Pending Dean Approval
                </h2>

                {isLoadingDetails ? (
                  <div className="text-center py-12">
                    <p className="text-gray-300 text-xl">
                      ⏳ Loading pending approvals...
                    </p>
                    <p className="text-gray-400 text-sm mt-2">
                      Please wait, fetching data from blockchain...
                    </p>
                  </div>
                ) : currentPending.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-300 text-xl">
                      ✅ No pending approvals at Dean level
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {currentPending.map((student, index) => (
                      <div
                        key={index}
                        className="bg-white/5 border border-white/10 rounded-lg p-6 hover:bg-white/10 transition-colors"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <h3 className="text-xl font-bold text-white mb-2">
                              {student.name}
                            </h3>
                            <p className="text-gray-400 text-sm">
                              Reg No: {student.regNo}
                            </p>
                            <p className="text-gray-400 text-sm">
                              Branch: {student.branch}
                            </p>
                          </div>

                          <div>
                            <p className="text-gray-400 text-sm">Email:</p>
                            <p className="text-white text-sm">
                              {student.email}
                            </p>
                            <p className="text-gray-400 text-sm mt-2">CGPA:</p>
                            <p className="text-white font-semibold">
                              {student.cgpa}
                            </p>
                            <p className="text-gray-400 text-xs mt-2">
                              HOD Approved by:
                            </p>
                            <p className="text-green-400 font-mono text-xs">
                              {student.hodVerifier.slice(0, 10)}...
                            </p>
                          </div>

                          <div className="flex flex-col justify-between items-end">
                            <div>
                              <span
                                className={`px-3 py-1 rounded border ${getLevelBadgeColor(student.status)} text-sm`}
                              >
                                {student.status}
                              </span>
                              <p className="text-gray-400 text-xs mt-2">
                                Applied: {student.appliedDate}
                              </p>
                              <div className="mt-2">
                                <span className="text-green-400 text-xs">
                                  ✓ HOD Approved
                                </span>
                              </div>
                            </div>

                            <div className="flex gap-3 mt-4">
                              <button
                                onClick={() => handleApprove(student.regNo)}
                                disabled={isLoading}
                                className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-semibold"
                              >
                                ✓ Approve
                              </button>
                              <button
                                onClick={() => openRejectModal(student.regNo)}
                                disabled={isLoading}
                                className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-semibold"
                              >
                                ✗ Reject
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* 🔥 Transaction Trail Section */}
                        <div className="mt-4">
                          <button
                            onClick={() => toggleCard(student.regNo)}
                            className="flex items-center text-purple-400 hover:text-purple-300 text-sm font-semibold"
                          >
                            <span className="mr-2">
                              {expandedCard === student.regNo ? "▼" : "▶"}
                            </span>
                            {expandedCard === student.regNo ? "Hide" : "View"}{" "}
                            Transaction Trail
                          </button>

                          <TransactionTrail
                            regNo={student.regNo}
                            contractAddress={
                              process.env
                                .NEXT_PUBLIC_CERTIFICATE_CONTRACT_ADDRESS!
                            }
                            isExpanded={expandedCard === student.regNo}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* All Levels Pending Tab */}
            {activeTab === "allPending" && (
              <div className="glass-effect rounded-lg p-8">
                <h2 className="text-2xl font-bold text-white mb-6">
                  All Pending Approvals (All Levels)
                </h2>

                {isLoadingRef.current ? (
                  <div className="text-center py-12">
                    <p className="text-gray-300 text-xl">
                      ⏳ Loading all pending approvals...
                    </p>
                  </div>
                ) : allLevelPending.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-300 text-xl">
                      ✅ No pending approvals across all levels
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {allLevelPending.map((app, index) => (
                      <div
                        key={index}
                        className="bg-white/5 border border-white/10 rounded-lg p-6 hover:bg-white/10 transition-colors"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div>
                            <h3 className="text-lg font-bold text-white mb-1">
                              {app.name}
                            </h3>
                            <p className="text-gray-400 text-sm">
                              Reg No: {app.regNo}
                            </p>
                          </div>

                          <div>
                            <p className="text-gray-400 text-sm">Branch</p>
                            <p className="text-white">{app.branch}</p>
                            <p className="text-gray-400 text-xs mt-2">
                              Applied: {app.appliedDate}
                            </p>
                          </div>

                          <div>
                            <p className="text-gray-400 text-sm mb-1">
                              Current Level
                            </p>
                            <span
                              className={`px-3 py-1 rounded border text-sm ${getLevelBadgeColor(app.currentLevel)}`}
                            >
                              {app.currentLevel}
                            </span>
                          </div>

                          <div>
                            <p className="text-gray-400 text-sm mb-2">
                              Approval Progress
                            </p>
                            <div className="flex gap-2 text-xs">
                              <span
                                className={`px-2 py-1 rounded ${
                                  app.hodApproved
                                    ? "bg-green-500/20 text-green-400"
                                    : "bg-gray-500/20 text-gray-500"
                                }`}
                              >
                                {app.hodApproved ? "✓" : "○"} HOD
                              </span>
                              <span
                                className={`px-2 py-1 rounded ${
                                  app.deanApproved
                                    ? "bg-green-500/20 text-green-400"
                                    : "bg-gray-500/20 text-gray-500"
                                }`}
                              >
                                {app.deanApproved ? "✓" : "○"} Dean
                              </span>
                              <span
                                className={`px-2 py-1 rounded ${
                                  app.financeApproved
                                    ? "bg-green-500/20 text-green-400"
                                    : "bg-gray-500/20 text-gray-500"
                                }`}
                              >
                                {app.financeApproved ? "✓" : "○"} Finance
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* 🔥 Transaction Trail Section for All Levels */}
                        <div className="mt-4">
                          <button
                            onClick={() => toggleCard(app.regNo)}
                            className="flex items-center text-purple-400 hover:text-purple-300 text-sm font-semibold"
                          >
                            <span className="mr-2">
                              {expandedCard === app.regNo ? "▼" : "▶"}
                            </span>
                            {expandedCard === app.regNo ? "Hide" : "View"}{" "}
                            Transaction Trail
                          </button>

                          <TransactionTrail
                            regNo={app.regNo}
                            contractAddress={
                              process.env
                                .NEXT_PUBLIC_CERTIFICATE_CONTRACT_ADDRESS!
                            }
                            isExpanded={expandedCard === app.regNo}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Issued Certificates Tab */}
            {activeTab === "issued" && (
              <div className="glass-effect rounded-lg p-8">
                <h2 className="text-2xl font-bold text-white mb-6">
                  Issued Certificates - Complete Details
                </h2>

                {isLoadingRef.current ? (
                  <div className="text-center py-12">
                    <p className="text-gray-300 text-xl">
                      ⏳ Loading issued certificates...
                    </p>
                  </div>
                ) : issuedCertificates.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-300 text-xl">
                      No certificates issued yet
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {issuedCertificates.map((cert, index) => (
                      <div
                        key={index}
                        className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-lg p-6"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="text-2xl font-bold text-white mb-1">
                              {cert.name}
                            </h3>
                            <p className="text-gray-300">
                              Registration No:{" "}
                              <span className="font-mono text-white">
                                {cert.regNo}
                              </span>
                            </p>
                          </div>
                          <span className="px-4 py-2 rounded bg-green-500/20 text-green-300 border border-green-500/50 font-semibold">
                            ✓ ISSUED
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                          <div className="space-y-3">
                            <div>
                              <p className="text-gray-400 text-sm">Branch</p>
                              <p className="text-white font-semibold">
                                {cert.branch}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-400 text-sm">
                                Student Wallet Address
                              </p>
                              <p className="text-blue-400 font-mono text-xs break-all">
                                {cert.studentWallet}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-400 text-sm">
                                Dean Verifier
                              </p>
                              <p className="text-purple-400 font-mono text-xs break-all">
                                {cert.deanVerifier}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div>
                              <p className="text-gray-400 text-sm">
                                Issued Date
                              </p>
                              <p className="text-white font-semibold">
                                {cert.issuedDate}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-400 text-sm">IPFS Hash</p>
                              {cert.ipfsHash ? (
                                <>
                                  <p className="text-green-400 font-mono text-xs break-all bg-black/30 p-2 rounded">
                                    {cert.ipfsHash}
                                  </p>
                                  <a
                                    href={`https://ipfs.io/ipfs/${cert.ipfsHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-block mt-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm"
                                  >
                                    🔗 View on IPFS
                                  </a>
                                </>
                              ) : (
                                <p className="text-yellow-400 text-sm">
                                  Not available
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-white/10">
                          <div className="flex items-center gap-2 text-sm text-gray-300">
                            <span className="text-green-400">✓</span> HOD
                            Approved
                            <span className="text-green-400">✓</span> Dean
                            Approved
                            <span className="text-green-400">✓</span> Finance
                            Approved
                            <span className="text-green-400">✓</span> Registrar
                            Issued
                          </div>
                        </div>

                        {/* 🔥 Transaction Trail for Issued Certificates */}
                        <div className="mt-6 pt-4 border-t border-white/10">
                          <button
                            onClick={() => toggleCard(cert.regNo)}
                            className="flex items-center text-purple-400 hover:text-purple-300 text-sm font-semibold mb-2"
                          >
                            <span className="mr-2">
                              {expandedCard === cert.regNo ? "▼" : "▶"}
                            </span>
                            {expandedCard === cert.regNo ? "Hide" : "View"}{" "}
                            Complete Transaction History
                          </button>

                          <TransactionTrail
                            regNo={cert.regNo}
                            contractAddress={
                              process.env
                                .NEXT_PUBLIC_CERTIFICATE_CONTRACT_ADDRESS!
                            }
                            isExpanded={expandedCard === cert.regNo}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Rejection Modal */}
        {showRejectModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-gray-900 rounded-lg p-8 max-w-md w-full mx-4 border border-red-500/50">
              <h3 className="text-2xl font-bold text-red-400 mb-4">
                Reject Application
              </h3>
              <p className="text-gray-300 mb-4">
                Registration No:{" "}
                <span className="font-mono text-white">{rejectRegNo}</span>
              </p>

              <label className="block text-gray-300 mb-2">
                Rejection Reason
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter reason for rejection (e.g., Academic irregularities, Documentation issues)..."
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-red-400 min-h-[100px]"
              />

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleReject}
                  disabled={isLoading || !rejectReason.trim()}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold"
                >
                  {isLoading ? "Processing..." : "Confirm Rejection"}
                </button>
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectRegNo("");
                    setRejectReason("");
                  }}
                  disabled={isLoading}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
