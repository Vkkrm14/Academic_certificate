"use client";

import { useState, useEffect } from "react";
import { getContract, readContract, resolveMethod } from "thirdweb";
import { ConnectButton } from "thirdweb/react";
import { useActiveAccount } from "thirdweb/react";
import { client, sepolia } from "../client";
import Link from "next/link";
import TransactionTrail from "../../component/TransactionTrail";

// ✅ Utility functions
const copyToClipboard = async (text: string, successMessage: string) => {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      alert(successMessage);
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      try {
        const successful = document.execCommand("copy");
        if (successful) {
          alert(successMessage);
        } else {
          throw new Error("Copy command failed");
        }
      } catch (err) {
        console.error("Fallback: Oops, unable to copy", err);
        alert("❌ Copy failed. Please copy manually:\n\n" + text);
      }

      document.body.removeChild(textArea);
    }
  } catch (err) {
    console.error("Failed to copy:", err);
    alert("❌ Copy failed. Please copy manually:\n\n" + text);
  }
};

// ✅ Generate QR code data for verification
const generateQRData = (
  regNo: string,
  ipfsHash: string,
  chainId: number = 11155111,
): string => {
  return `VERIFY:Sepolia:${regNo}:${ipfsHash}:${chainId}`;
};

// ✅ Safe type conversion helpers
const safeToBigInt = (value: any, defaultValue: bigint = BigInt(0)): bigint => {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }
  try {
    return BigInt(value);
  } catch (e) {
    return defaultValue;
  }
};

const safeToString = (value: any, defaultValue: string = ""): string => {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  return String(value);
};

const safeToBoolean = (value: any, defaultValue: boolean = false): boolean => {
  if (value === undefined || value === null) {
    return defaultValue;
  }

  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "bigint") return value !== BigInt(0);
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    return lower === "true" || lower === "1";
  }

  return Boolean(value);
};

interface StudentRecord {
  name: string;
  regNo: string;
  branch: string;
  email: string;
  cgpa: bigint;
  creditsCompleted: bigint;
  studentWalletAddress: string;
  institutionName: string;
  graduationYear: bigint;
  status: string;
  hodApproved: boolean;
  deanApproved: boolean;
  financeApproved: boolean;
  registrarIssued: boolean;
  isRejected: boolean;
  rejectionReason: string;
  rejectedBy: string;
  rejectionTimestamp: bigint;
  rejectionLevel: string;
  departmentVerifier: string;
  hodVerifier: string;
  deanVerifier: string;
  financeVerifier: string;
  registrarVerifier: string;
  ipfsHash: string;
  applicationTimestamp: bigint;
  issuanceTimestamp: bigint;
}

interface CertificatePreview {
  regNo: string;
  name: string;
  status: string;
  issuedDate: string;
}

export default function StudentPage() {
  const account = useActiveAccount();
  const [regNo, setRegNo] = useState("");
  const [studentData, setStudentData] = useState<StudentRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchMethod, setSearchMethod] = useState<"wallet" | "regno">(
    "wallet",
  );
  const [studentCertificates, setStudentCertificates] = useState<
    CertificatePreview[]
  >([]);
  const [qrCodeData, setQrCodeData] = useState<string>("");
  const [hasSearched, setHasSearched] = useState(false);

  const [showTransactionTrail, setShowTransactionTrail] = useState(false);

  const contract = getContract({
    client,
    chain: sepolia,
    address: process.env.NEXT_PUBLIC_CERTIFICATE_CONTRACT_ADDRESS!,
  });

  // ✅ Only fetch certificates when wallet is connected and user hasn't searched yet
  useEffect(() => {
    // Reset when wallet disconnects
    if (!account?.address) {
      setStudentCertificates([]);
      setStudentData(null);
      setHasSearched(false);
      return;
    }
  }, [account?.address]);

  const searchByWallet = async () => {
    if (!account?.address) {
      alert("Please connect your wallet first!");
      return;
    }

    try {
      setIsLoading(true);
      console.log("🔍 Searching for wallet:", account.address);

      const certificates: CertificatePreview[] = [];

      // Get all possible statuses
      const statuses = [
        "PENDING_HOD",
        "PENDING_DEAN",
        "PENDING_FINANCE",
        "PENDING_REGISTRAR",
        "ISSUED",
      ];

      for (const status of statuses) {
        try {
          const regNos = (await readContract({
            contract,
            method:
              "function getPendingApprovals(string) view returns (string[])",
            params: [status],
          })) as string[];

          console.log(`Status ${status}:`, regNos);

          for (const regNo of regNos) {
            const record = (await readContract({
              contract,
              method: resolveMethod("getStudentRecord"),
              params: [regNo],
            })) as any;

            const walletAddress = safeToString(
              record.studentWalletAddress,
            ).toLowerCase();

            if (walletAddress === account.address.toLowerCase()) {
              certificates.push({
                regNo: safeToString(record.regNo),
                name: safeToString(record.name),
                status: safeToString(record.status, "PENDING"),
                issuedDate:
                  Number(safeToBigInt(record.issuanceTimestamp)) > 0
                    ? new Date(
                        Number(safeToBigInt(record.issuanceTimestamp)) * 1000,
                      ).toLocaleDateString()
                    : "Not issued",
              });
            }
          }
        } catch (err) {
          console.error(`Error fetching ${status}:`, err);
        }
      }

      console.log(`✅ Found ${certificates.length} certificates`);
      setStudentCertificates(certificates);

      if (certificates.length > 0) {
        setRegNo(certificates[0].regNo);
        await searchByRegNo(certificates[0].regNo);
      } else {
        alert("No certificates found for your wallet.");
      }
    } catch (error: any) {
      console.error("Search error:", error);
      alert(`Search failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const searchByRegNo = async (regNumber?: string) => {
    const searchRegNo = regNumber || regNo.trim();

    if (!searchRegNo) {
      alert("Please enter your registration number!");
      return;
    }

    try {
      setIsLoading(true);
      setHasSearched(true);

      console.log("🔍 Searching for regNo:", searchRegNo);

      const result = (await readContract({
        contract,
        method: resolveMethod("getStudentRecord"),
        params: [searchRegNo],
      })) as unknown as any;

      console.log("✅ Record found:", result);

      const formattedRecord: StudentRecord = {
        name: safeToString(result.name),
        regNo: safeToString(result.regNo),
        branch: safeToString(result.branch),
        email: safeToString(result.email),
        cgpa: safeToBigInt(result.cgpa),
        creditsCompleted: safeToBigInt(result.creditsCompleted),
        studentWalletAddress: safeToString(result.studentWalletAddress),
        institutionName: safeToString(result.institutionName),
        graduationYear: safeToBigInt(result.graduationYear),
        status: safeToString(result.status, "PENDING"),
        hodApproved: safeToBoolean(result.hodApproved),
        deanApproved: safeToBoolean(result.deanApproved),
        financeApproved: safeToBoolean(result.financeApproved),
        registrarIssued: safeToBoolean(result.registrarIssued),
        isRejected: safeToBoolean(result.isRejected),
        rejectionReason: safeToString(result.rejectionReason),
        rejectedBy: safeToString(result.rejectedBy),
        rejectionTimestamp: safeToBigInt(result.rejectionTimestamp),
        rejectionLevel: safeToString(result.rejectionLevel),
        departmentVerifier: safeToString(result.departmentVerifier),
        hodVerifier: safeToString(result.hodVerifier),
        deanVerifier: safeToString(result.deanVerifier),
        financeVerifier: safeToString(result.financeVerifier),
        registrarVerifier: safeToString(result.registrarVerifier),
        ipfsHash: safeToString(result.ipfsHash),
        applicationTimestamp: safeToBigInt(result.applicationTimestamp),
        issuanceTimestamp: safeToBigInt(result.issuanceTimestamp),
      };

      setStudentData(formattedRecord);

      // ✅ Generate QR code data if certificate is issued
      if (formattedRecord.registrarIssued && formattedRecord.ipfsHash) {
        const qrData = generateQRData(
          formattedRecord.regNo,
          formattedRecord.ipfsHash,
          11155111,
        );
        setQrCodeData(qrData);
      } else {
        setQrCodeData("");
      }

      if (!regNumber) {
        setRegNo(formattedRecord.regNo);
      }
    } catch (error: any) {
      console.error("❌ Search error:", error);

      if (
        error.message?.includes("execution reverted") ||
        error.message?.includes("Student not found")
      ) {
        setStudentData(null);
        alert(
          `❌ No student record found for: ${searchRegNo}\n\nPlease verify the registration number.`,
        );
      } else {
        alert(`❌ Failed to fetch record: ${error.message || "Unknown error"}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING_HOD":
        return "text-yellow-400";
      case "PENDING_DEAN":
        return "text-blue-400";
      case "PENDING_FINANCE":
        return "text-orange-400";
      case "PENDING_REGISTRAR":
        return "text-purple-400";
      case "ISSUED":
        return "text-green-400";
      case "REJECTED":
        return "text-red-400";
      default:
        return "text-gray-400";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "PENDING_HOD":
        return "⏳";
      case "PENDING_DEAN":
        return "🏛️";
      case "PENDING_FINANCE":
        return "💰";
      case "PENDING_REGISTRAR":
        return "📜";
      case "ISSUED":
        return "🎓";
      case "REJECTED":
        return "❌";
      default:
        return "📋";
    }
  };

  const downloadCertificate = () => {
    if (studentData?.ipfsHash) {
      const ipfsUrl = `https://ipfs.io/ipfs/${studentData.ipfsHash}`;
      window.open(ipfsUrl, "_blank");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-purple-900 p-8">
      <div className="container mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <Link
              href="/"
              className="text-indigo-400 hover:text-indigo-300 mb-2 inline-block"
            >
              ← Back to Home
            </Link>
            <h1 className="text-4xl font-bold text-white">🎓 Student Portal</h1>
            <p className="text-gray-300">
              Access your academic certificate status and records
            </p>
          </div>
          <ConnectButton client={client} />
        </div>

        {/* Search Methods */}
        <div className="glass-effect rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-bold text-white mb-4">
            🔍 Find Your Certificate
          </h2>

          <div className="flex space-x-4 mb-6">
            <button
              onClick={() => {
                setSearchMethod("wallet");
                setHasSearched(false);
                setStudentData(null);
                setStudentCertificates([]);
              }}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                searchMethod === "wallet"
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-600 hover:bg-gray-700 text-gray-300"
              }`}
            >
              🔗 Search by Wallet
            </button>
            <button
              onClick={() => {
                setSearchMethod("regno");
                setHasSearched(false);
                setStudentData(null);
              }}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                searchMethod === "regno"
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-600 hover:bg-gray-700 text-gray-300"
              }`}
            >
              📋 Search by Registration Number
            </button>
          </div>

          {searchMethod === "wallet" ? (
            <div>
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <p className="text-gray-300 mb-2">Connected Wallet:</p>
                  <p className="bg-black/30 p-3 rounded-lg text-green-400 font-mono text-sm break-all">
                    {account?.address || "Not connected"}
                  </p>
                  {studentCertificates.length > 0 && (
                    <p className="text-blue-400 text-sm mt-2">
                      ✅ Found {studentCertificates.length} certificate(s)
                    </p>
                  )}
                </div>
                <button
                  onClick={searchByWallet}
                  disabled={!account?.address || isLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                >
                  {isLoading ? "🔄 Searching..." : "🔍 Find My Certificates"}
                </button>
              </div>

              {!account?.address && (
                <div className="mt-4 p-4 bg-yellow-500/20 rounded-lg border border-yellow-500/50">
                  <p className="text-yellow-300 text-sm">
                    💡 Please connect your wallet to search for certificates
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <label className="block text-gray-300 mb-2">
                    Registration Number:
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., 23BCE1121"
                    value={regNo}
                    onChange={(e) => setRegNo(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        searchByRegNo();
                      }
                    }}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-indigo-400"
                  />
                </div>
                <button
                  onClick={() => searchByRegNo()}
                  disabled={!regNo.trim() || isLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                >
                  {isLoading ? "🔄 Searching..." : "🔍 Search"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Multiple Certificates Display */}
        {studentCertificates.length > 1 && searchMethod === "wallet" && (
          <div className="glass-effect rounded-lg p-6 mb-8">
            <h3 className="text-xl font-bold text-white mb-4">
              📚 Your Certificates
            </h3>
            <div className="grid gap-4">
              {studentCertificates.map((cert, index) => (
                <div
                  key={index}
                  className="bg-white/5 p-4 rounded-lg flex justify-between items-center hover:bg-white/10 transition-colors"
                >
                  <div>
                    <p className="text-white font-semibold">{cert.name}</p>
                    <p className="text-gray-400 text-sm">Reg: {cert.regNo}</p>
                    <p className="text-gray-400 text-sm">
                      Status: {cert.status} | Issued: {cert.issuedDate}
                    </p>
                  </div>
                  <button
                    onClick={() => searchByRegNo(cert.regNo)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                  >
                    View Details
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Student Record Display */}
        {studentData && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Student Information */}
              <div className="glass-effect rounded-lg p-8">
                <h2 className="text-2xl font-bold text-white mb-6">
                  👤 Student Information
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="text-gray-400 text-sm">Full Name</label>
                    <p className="text-white text-lg font-semibold">
                      {studentData.name}
                    </p>
                  </div>

                  <div>
                    <label className="text-gray-400 text-sm">
                      Registration Number
                    </label>
                    <p className="text-white text-lg font-semibold">
                      {studentData.regNo}
                    </p>
                  </div>

                  <div>
                    <label className="text-gray-400 text-sm">
                      Branch/Department
                    </label>
                    <p className="text-white text-lg font-semibold">
                      {studentData.branch}
                    </p>
                  </div>

                  {studentData.email && (
                    <div>
                      <label className="text-gray-400 text-sm">Email</label>
                      <p className="text-white text-lg font-semibold">
                        {studentData.email}
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="text-gray-400 text-sm">Institution</label>
                    <p className="text-white text-lg font-semibold">
                      {studentData.institutionName}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-gray-400 text-sm">CGPA</label>
                      <p className="text-white text-lg font-semibold">
                        {(Number(studentData.cgpa) / 100).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <label className="text-gray-400 text-sm">
                        Credits Completed
                      </label>
                      <p className="text-white text-lg font-semibold">
                        {Number(studentData.creditsCompleted)}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="text-gray-400 text-sm">
                      Graduation Year
                    </label>
                    <p className="text-white text-lg font-semibold">
                      {Number(studentData.graduationYear)}
                    </p>
                  </div>

                  {Number(studentData.applicationTimestamp) > 0 && (
                    <div>
                      <label className="text-gray-400 text-sm">
                        Applied On
                      </label>
                      <p className="text-white text-sm">
                        {new Date(
                          Number(studentData.applicationTimestamp) * 1000,
                        ).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Certificate Status */}
              <div className="glass-effect rounded-lg p-8">
                <h2 className="text-2xl font-bold text-white mb-6">
                  📜 Certificate Status
                </h2>

                <div className="space-y-6">
                  {/* Current Status */}
                  <div className="text-center p-6 bg-black/30 rounded-lg">
                    <div className="text-4xl mb-2">
                      {getStatusIcon(studentData.status)}
                    </div>
                    <h3
                      className={`text-xl font-bold mb-2 ${getStatusColor(studentData.status)}`}
                    >
                      {studentData.status.replace(/_/g, " ")}
                    </h3>
                    <p className="text-gray-400 text-sm">Current Status</p>
                  </div>

                  {/* Rejection Notice */}
                  {studentData.isRejected && (
                    <div className="p-4 bg-red-500/20 rounded-lg border border-red-500/50">
                      <h4 className="text-red-400 font-semibold mb-2">
                        ❌ Application Rejected
                      </h4>
                      <p className="text-red-300 text-sm mb-2">
                        <strong>Rejected by:</strong>{" "}
                        {studentData.rejectionLevel}
                      </p>
                      <p className="text-red-300 text-sm mb-2">
                        <strong>Reason:</strong> {studentData.rejectionReason}
                      </p>
                      {Number(studentData.rejectionTimestamp) > 0 && (
                        <p className="text-red-300 text-xs">
                          Date:{" "}
                          {new Date(
                            Number(studentData.rejectionTimestamp) * 1000,
                          ).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Progress Tracker */}
                  {!studentData.isRejected && (
                    <div className="space-y-3">
                      <h4 className="text-white font-semibold mb-3">
                        📊 Approval Progress
                      </h4>

                      <div className="flex items-center space-x-3">
                        <div className="w-4 h-4 rounded-full bg-green-500"></div>
                        <span className="text-green-400">
                          ✅ Department Registered
                        </span>
                      </div>

                      <div className="flex items-center space-x-3">
                        <div
                          className={`w-4 h-4 rounded-full ${studentData.hodApproved ? "bg-green-500" : "bg-gray-500"}`}
                        ></div>
                        <span
                          className={
                            studentData.hodApproved
                              ? "text-green-400"
                              : "text-gray-400"
                          }
                        >
                          {studentData.hodApproved ? "✅" : "⏳"} HOD Approval
                        </span>
                      </div>

                      <div className="flex items-center space-x-3">
                        <div
                          className={`w-4 h-4 rounded-full ${studentData.deanApproved ? "bg-green-500" : "bg-gray-500"}`}
                        ></div>
                        <span
                          className={
                            studentData.deanApproved
                              ? "text-green-400"
                              : "text-gray-400"
                          }
                        >
                          {studentData.deanApproved ? "✅" : "⏳"} Dean Approval
                        </span>
                      </div>

                      <div className="flex items-center space-x-3">
                        <div
                          className={`w-4 h-4 rounded-full ${studentData.financeApproved ? "bg-green-500" : "bg-gray-500"}`}
                        ></div>
                        <span
                          className={
                            studentData.financeApproved
                              ? "text-green-400"
                              : "text-gray-400"
                          }
                        >
                          {studentData.financeApproved ? "✅" : "⏳"} Finance
                          Clearance
                        </span>
                      </div>

                      <div className="flex items-center space-x-3">
                        <div
                          className={`w-4 h-4 rounded-full ${studentData.registrarIssued ? "bg-green-500" : "bg-gray-500"}`}
                        ></div>
                        <span
                          className={
                            studentData.registrarIssued
                              ? "text-green-400"
                              : "text-gray-400"
                          }
                        >
                          {studentData.registrarIssued ? "✅" : "⏳"}{" "}
                          Certificate Issued
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Certificate Download */}
                  {studentData.registrarIssued && studentData.ipfsHash && (
                    <div className="mt-6 p-4 bg-green-500/20 rounded-lg border border-green-500/50">
                      <h4 className="text-green-400 font-semibold mb-3">
                        🎓 Certificate Ready!
                      </h4>
                      <div className="space-y-3">
                        <p className="text-green-300 text-sm">
                          Your certificate has been issued and is available for
                          download.
                        </p>

                        <div className="flex space-x-3 flex-wrap gap-2">
                          <button
                            onClick={downloadCertificate}
                            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                          >
                            📥 Download Certificate
                          </button>
                          <button
                            onClick={() =>
                              copyToClipboard(
                                `https://ipfs.io/ipfs/${studentData.ipfsHash}`,
                                "✅ IPFS link copied to clipboard!",
                              )
                            }
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                          >
                            📋 Copy IPFS Link
                          </button>

                          {qrCodeData && (
                            <button
                              onClick={() =>
                                copyToClipboard(
                                  qrCodeData,
                                  "✅ QR verification data copied to clipboard!",
                                )
                              }
                              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                            >
                              📱 Copy QR Data
                            </button>
                          )}
                        </div>

                        {qrCodeData && (
                          <div className="mt-4 p-3 bg-black/30 rounded-lg">
                            <label className="text-purple-400 text-sm font-semibold block mb-2">
                              📱 QR Verification Data:
                            </label>
                            <p className="text-purple-200 text-xs font-mono break-all">
                              {qrCodeData}
                            </p>
                            <p className="text-purple-300 text-xs mt-2">
                              💡 Use this data to generate a QR code for quick
                              verification
                            </p>
                          </div>
                        )}

                        <p className="text-green-200 text-xs break-all">
                          IPFS Hash: {studentData.ipfsHash}
                        </p>

                        {Number(studentData.issuanceTimestamp) > 0 && (
                          <p className="text-green-200 text-xs">
                            Issued:{" "}
                            {new Date(
                              Number(studentData.issuanceTimestamp) * 1000,
                            ).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Waiting Message */}
                  {!studentData.registrarIssued && !studentData.isRejected && (
                    <div className="mt-6 p-4 bg-yellow-500/20 rounded-lg border border-yellow-500/50">
                      <h4 className="text-yellow-400 font-semibold mb-2">
                        ⏳ Certificate Processing
                      </h4>
                      <p className="text-yellow-300 text-sm">
                        Your certificate is currently being processed. You will
                        be able to download it once all approvals are complete.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* 🔥 Transaction Trail - OUTSIDE the grid */}
            <div className="glass-effect rounded-lg p-8 mt-8">
              <button
                onClick={() => setShowTransactionTrail(!showTransactionTrail)}
                className="flex items-center justify-between w-full text-left mb-4"
              >
                <div>
                  <h2 className="text-2xl font-bold text-white flex items-center">
                    <span className="mr-3 text-3xl">📜</span>
                    Blockchain Transaction History
                  </h2>
                  <p className="text-gray-400 text-sm mt-1">
                    Complete audit trail of your certificate approval process
                  </p>
                </div>
                <span className="text-3xl text-indigo-400">
                  {showTransactionTrail ? "▼" : "▶"}
                </span>
              </button>

              <TransactionTrail
                regNo={studentData.regNo}
                contractAddress={
                  process.env.NEXT_PUBLIC_CERTIFICATE_CONTRACT_ADDRESS!
                }
                isExpanded={showTransactionTrail}
              />
            </div>
          </>
        )}

        {/* No Data State */}
        {!studentData && !isLoading && hasSearched && (
          <div className="text-center py-12">
            <div className="glass-effect rounded-lg p-8">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-2xl font-bold text-white mb-4">
                No Student Record Found
              </h3>
              <p className="text-gray-300 mb-6">
                {searchMethod === "wallet"
                  ? "No certificates found for your wallet address"
                  : "No certificate found for this registration number"}
              </p>

              <div className="bg-blue-500/20 p-4 rounded-lg border border-blue-500/50">
                <h4 className="text-blue-400 font-semibold mb-2">💡 Tips:</h4>
                <ul className="text-blue-300 text-sm text-left space-y-1">
                  <li>• Make sure you're connected with the correct wallet</li>
                  <li>• Double-check your registration number</li>
                  <li>
                    • Contact your institution if you can't find your record
                  </li>
                  <li>
                    • Your record may still be processing if recently registered
                  </li>
                  <li>• Ensure you're connected to Sepolia testnet</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
