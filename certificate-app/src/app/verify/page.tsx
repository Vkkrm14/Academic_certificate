"use client";

import { useState } from "react";
import { ConnectButton } from "thirdweb/react";
import { useActiveAccount } from "thirdweb/react";
import { getContract, readContract, resolveMethod } from "thirdweb";
import { client, sepolia } from "../client";
import Link from "next/link";

// ✅ Utility function
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

export default function VerifyPage() {
  const account = useActiveAccount();
  const [verificationInput, setVerificationInput] = useState("");
  const [verificationMethod, setVerificationMethod] = useState<"regno" | "qr">(
    "regno",
  );
  const [studentRecord, setStudentRecord] = useState<StudentRecord | null>(
    null,
  );
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<
    "issued" | "pending" | "rejected" | "notfound" | null
  >(null);

  const contract = getContract({
    client,
    chain: sepolia,
    address: process.env.NEXT_PUBLIC_CERTIFICATE_CONTRACT_ADDRESS!,
  });

  const verifyCertificate = async () => {
    if (!verificationInput.trim()) {
      alert("Please enter the verification data!");
      return;
    }

    try {
      setIsVerifying(true);
      setStudentRecord(null);
      setVerificationStatus(null);

      let regNo = "";
      let expectedIpfsHash = "";

      if (verificationMethod === "regno") {
        regNo = verificationInput.trim();
      } else if (verificationMethod === "qr") {
        // Parse QR code format: "VERIFY:Sepolia:regNo:ipfsHash:chainId"
        const qrParts = verificationInput.split(":");
        if (qrParts.length < 4 || qrParts[0] !== "VERIFY") {
          throw new Error(
            "Invalid QR code format. Expected format: VERIFY:network:regNo:ipfsHash:chainId",
          );
        }

        regNo = qrParts[2];
        expectedIpfsHash = qrParts[3];
      }

      if (!regNo) {
        throw new Error("Could not extract registration number");
      }

      // ✅ Get student record
      const result = (await readContract({
        contract,
        method: resolveMethod("getStudentRecord"),
        params: [regNo],
      })) as unknown as any;

      // ✅ Map using named properties
      const mappedRecord: StudentRecord = {
        name: safeToString(result.name),
        regNo: safeToString(result.regNo),
        branch: safeToString(result.branch),
        email: safeToString(result.email),
        cgpa: safeToBigInt(result.cgpa),
        creditsCompleted: safeToBigInt(result.creditsCompleted),
        studentWalletAddress: safeToString(result.studentWalletAddress),
        institutionName: safeToString(result.institutionName),
        graduationYear: safeToBigInt(result.graduationYear),
        status: safeToString(result.status, "UNKNOWN"),
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

      // ✅ Verify IPFS hash if QR method
      if (verificationMethod === "qr" && expectedIpfsHash) {
        if (mappedRecord.ipfsHash !== expectedIpfsHash) {
          alert("❌ IPFS hash mismatch! This QR code may be tampered.");
          setVerificationStatus("notfound");
          return;
        }
      }

      setStudentRecord(mappedRecord);

      // ✅ Determine verification status
      if (mappedRecord.isRejected) {
        setVerificationStatus("rejected");
      } else if (
        mappedRecord.status === "ISSUED" &&
        mappedRecord.registrarIssued
      ) {
        setVerificationStatus("issued");
      } else if (mappedRecord.registrarIssued) {
        setVerificationStatus("issued");
      } else if (mappedRecord.name && mappedRecord.regNo) {
        setVerificationStatus("pending");
      } else {
        setVerificationStatus("notfound");
      }
    } catch (error: any) {
      console.error("❌ Verification error:", error);
      setVerificationStatus("notfound");
      setStudentRecord(null);

      if (
        error.message?.includes("Student not found") ||
        error.message?.includes("execution reverted")
      ) {
        alert("❌ Certificate not found. This may be a fake certificate.");
      } else if (error.message?.includes("Invalid QR")) {
        alert("❌ Invalid QR code format.");
      } else {
        alert("❌ Verification failed: " + error.message);
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const getCertificateAge = (timestamp: bigint) => {
    if (timestamp === 0n) return "Not issued";

    const issueDate = new Date(Number(timestamp) * 1000);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - issueDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 30) {
      return `${diffDays} days ago`;
    } else if (diffDays < 365) {
      return `${Math.floor(diffDays / 30)} months ago`;
    } else {
      return `${Math.floor(diffDays / 365)} years ago`;
    }
  };

  const getStatusColor = () => {
    switch (verificationStatus) {
      case "issued":
        return "border-green-500 bg-green-500/10";
      case "pending":
        return "border-yellow-500 bg-yellow-500/10";
      case "rejected":
        return "border-red-500 bg-red-500/10";
      case "notfound":
        return "border-red-500 bg-red-500/10";
      default:
        return "border-gray-500 bg-gray-500/10";
    }
  };

  const getStatusIcon = () => {
    switch (verificationStatus) {
      case "issued":
        return "✅";
      case "pending":
        return "⏳";
      case "rejected":
        return "❌";
      case "notfound":
        return "🚫";
      default:
        return "🔍";
    }
  };

  const getStatusTitle = () => {
    switch (verificationStatus) {
      case "issued":
        return "Certificate Issued & Valid";
      case "pending":
        return "Certificate Pending Approval";
      case "rejected":
        return "Certificate Rejected";
      case "notfound":
        return "Certificate Not Found";
      default:
        return "Verification Result";
    }
  };

  const getStatusDescription = () => {
    switch (verificationStatus) {
      case "issued":
        return "This certificate has been officially issued and is valid";
      case "pending":
        return "This certificate exists but is still awaiting final approval";
      case "rejected":
        return "This certificate application was rejected";
      case "notfound":
        return "No certificate found for this verification data";
      default:
        return "";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-900 to-teal-900 p-8">
      <div className="container mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <Link
              href="/"
              className="text-emerald-400 hover:text-emerald-300 mb-2 inline-block"
            >
              ← Back to Home
            </Link>
            <h1 className="text-4xl font-bold text-white">
              🔍 Certificate Verification
            </h1>
            <p className="text-gray-300">
              Verify the authenticity of academic certificates on Sepolia
              blockchain
            </p>
          </div>
          <ConnectButton client={client} />
        </div>

        {/* Verification Methods */}
        <div className="glass-effect rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-bold text-white mb-4">
            🔍 Choose Verification Method
          </h2>

          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <button
              onClick={() => setVerificationMethod("regno")}
              className={`p-4 rounded-lg border-2 transition-colors ${
                verificationMethod === "regno"
                  ? "border-emerald-400 bg-emerald-500/20 text-emerald-300"
                  : "border-gray-600 bg-gray-700/50 text-gray-300 hover:border-gray-500"
              }`}
            >
              <div className="text-2xl mb-2">📋</div>
              <h3 className="font-semibold mb-1">Registration Number</h3>
              <p className="text-sm">Enter student registration number</p>
            </button>

            <button
              onClick={() => setVerificationMethod("qr")}
              className={`p-4 rounded-lg border-2 transition-colors ${
                verificationMethod === "qr"
                  ? "border-emerald-400 bg-emerald-500/20 text-emerald-300"
                  : "border-gray-600 bg-gray-700/50 text-gray-300 hover:border-gray-500"
              }`}
            >
              <div className="text-2xl mb-2">📱</div>
              <h3 className="font-semibold mb-1">QR Code</h3>
              <p className="text-sm">Scan or paste QR code data</p>
            </button>
          </div>

          {/* Input Field */}
          <div className="flex space-x-4">
            <div className="flex-1">
              <label className="block text-gray-300 mb-2">
                {verificationMethod === "regno" && "Registration Number:"}
                {verificationMethod === "qr" && "QR Code Data:"}
              </label>
              <input
                type="text"
                placeholder={
                  verificationMethod === "regno"
                    ? "e.g., 23BCE1121"
                    : "e.g., VERIFY:Sepolia:23BCE1121:QmXxXxXx...:11155111"
                }
                value={verificationInput}
                onChange={(e) => setVerificationInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    verifyCertificate();
                  }
                }}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-400"
                disabled={isVerifying}
              />
              {verificationMethod === "qr" && (
                <p className="text-gray-400 text-xs mt-1">
                  Expected format: VERIFY:network:regNo:ipfsHash:chainId
                </p>
              )}
            </div>
            <button
              onClick={verifyCertificate}
              disabled={!verificationInput.trim() || isVerifying}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 text-white px-8 py-3 rounded-lg font-semibold whitespace-nowrap transition-colors"
            >
              {isVerifying ? "🔄 Verifying..." : "🔍 Verify"}
            </button>
          </div>
        </div>

        {/* Verification Result */}
        {verificationStatus &&
          verificationStatus !== "notfound" &&
          studentRecord && (
            <div className="glass-effect rounded-lg p-8">
              <div className="text-center mb-6">
                <div className="text-6xl mb-4">{getStatusIcon()}</div>
                <h2
                  className={`text-3xl font-bold mb-2 ${
                    verificationStatus === "issued"
                      ? "text-green-400"
                      : verificationStatus === "pending"
                        ? "text-yellow-400"
                        : "text-red-400"
                  }`}
                >
                  {getStatusTitle()}
                </h2>
                <p
                  className={
                    verificationStatus === "issued"
                      ? "text-green-300"
                      : verificationStatus === "pending"
                        ? "text-yellow-300"
                        : "text-red-300"
                  }
                >
                  {getStatusDescription()}
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                {/* Certificate Details */}
                <div className={`p-6 rounded-lg border-2 ${getStatusColor()}`}>
                  <h3 className="text-xl font-bold text-white mb-4">
                    📜 Student Details
                  </h3>

                  <div className="space-y-3">
                    <div>
                      <label className="text-gray-400 text-sm">Name</label>
                      <p className="text-white font-semibold">
                        {studentRecord.name}
                      </p>
                    </div>

                    <div>
                      <label className="text-gray-400 text-sm">
                        Registration No
                      </label>
                      <p className="text-white font-semibold">
                        {studentRecord.regNo}
                      </p>
                    </div>

                    <div>
                      <label className="text-gray-400 text-sm">Branch</label>
                      <p className="text-white font-semibold">
                        {studentRecord.branch}
                      </p>
                    </div>

                    {studentRecord.email && (
                      <div>
                        <label className="text-gray-400 text-sm">Email</label>
                        <p className="text-white font-semibold">
                          {studentRecord.email}
                        </p>
                      </div>
                    )}

                    <div>
                      <label className="text-gray-400 text-sm">
                        Institution
                      </label>
                      <p className="text-white font-semibold">
                        {studentRecord.institutionName}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-gray-400 text-sm">CGPA</label>
                        <p className="text-white font-semibold">
                          {(Number(studentRecord.cgpa) / 100).toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <label className="text-gray-400 text-sm">Credits</label>
                        <p className="text-white font-semibold">
                          {Number(studentRecord.creditsCompleted)}
                        </p>
                      </div>
                    </div>

                    <div>
                      <label className="text-gray-400 text-sm">
                        Graduation Year
                      </label>
                      <p className="text-white font-semibold">
                        {Number(studentRecord.graduationYear)}
                      </p>
                    </div>

                    {Number(studentRecord.issuanceTimestamp) > 0 && (
                      <div>
                        <label className="text-gray-400 text-sm">
                          Issued On
                        </label>
                        <p className="text-white font-semibold">
                          {new Date(
                            Number(studentRecord.issuanceTimestamp) * 1000,
                          ).toLocaleDateString()}
                          <span className="text-gray-400 text-sm ml-2">
                            (
                            {getCertificateAge(studentRecord.issuanceTimestamp)}
                            )
                          </span>
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Verification Status */}
                <div className={`p-6 rounded-lg border-2 ${getStatusColor()}`}>
                  <h3 className="text-xl font-bold text-white mb-4">
                    🔐 Verification Status
                  </h3>

                  <div className="space-y-4">
                    <div className="p-4 bg-black/30 rounded-lg">
                      <label className="text-gray-400 text-sm">
                        Contract Status:
                      </label>
                      <p className="text-white font-semibold text-lg">
                        {studentRecord.status}
                      </p>
                    </div>

                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          studentRecord.registrarIssued
                            ? "bg-green-500"
                            : "bg-yellow-500"
                        }`}
                      ></div>
                      <span
                        className={
                          studentRecord.registrarIssued
                            ? "text-green-400"
                            : "text-yellow-400"
                        }
                      >
                        {studentRecord.registrarIssued
                          ? "✅ Registrar Issued"
                          : "⏳ Not Yet Issued"}
                      </span>
                    </div>

                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          !studentRecord.isRejected
                            ? "bg-green-500"
                            : "bg-red-500"
                        }`}
                      ></div>
                      <span
                        className={
                          !studentRecord.isRejected
                            ? "text-green-400"
                            : "text-red-400"
                        }
                      >
                        {!studentRecord.isRejected
                          ? "✅ Not Rejected"
                          : "❌ Rejected"}
                      </span>
                    </div>

                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          studentRecord.ipfsHash
                            ? "bg-green-500"
                            : "bg-yellow-500"
                        }`}
                      ></div>
                      <span
                        className={
                          studentRecord.ipfsHash
                            ? "text-green-400"
                            : "text-yellow-400"
                        }
                      >
                        {studentRecord.ipfsHash
                          ? "✅ IPFS Storage Available"
                          : "⏳ No IPFS Storage"}
                      </span>
                    </div>

                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <span className="text-blue-400">
                        🔗 Blockchain Verified
                      </span>
                    </div>

                    {/* Rejection Details */}
                    {studentRecord.isRejected && (
                      <div className="mt-4 p-4 bg-red-500/20 rounded-lg border border-red-500/50">
                        <h4 className="text-red-400 font-semibold mb-2">
                          ❌ Rejection Details
                        </h4>
                        <p className="text-red-300 text-sm mb-1">
                          <strong>Level:</strong> {studentRecord.rejectionLevel}
                        </p>
                        <p className="text-red-300 text-sm mb-1">
                          <strong>Reason:</strong>{" "}
                          {studentRecord.rejectionReason}
                        </p>
                        {Number(studentRecord.rejectionTimestamp) > 0 && (
                          <p className="text-red-300 text-xs">
                            {new Date(
                              Number(studentRecord.rejectionTimestamp) * 1000,
                            ).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Approval Progress */}
                    {!studentRecord.isRejected && (
                      <div className="mt-4 p-4 bg-black/30 rounded-lg">
                        <h4 className="text-white font-semibold mb-3">
                          📋 Approval Progress
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span
                              className={
                                studentRecord.hodApproved
                                  ? "text-green-400"
                                  : "text-gray-400"
                              }
                            >
                              {studentRecord.hodApproved ? "✅" : "⏳"} HOD
                              Approval
                            </span>
                            {studentRecord.hodApproved &&
                              studentRecord.hodVerifier !==
                                "0x0000000000000000000000000000000000000000" && (
                                <span className="text-xs text-gray-500 font-mono">
                                  {studentRecord.hodVerifier.slice(0, 6)}...
                                  {studentRecord.hodVerifier.slice(-4)}
                                </span>
                              )}
                          </div>
                          <div className="flex items-center justify-between">
                            <span
                              className={
                                studentRecord.deanApproved
                                  ? "text-green-400"
                                  : "text-gray-400"
                              }
                            >
                              {studentRecord.deanApproved ? "✅" : "⏳"} Dean
                              Approval
                            </span>
                            {studentRecord.deanApproved &&
                              studentRecord.deanVerifier !==
                                "0x0000000000000000000000000000000000000000" && (
                                <span className="text-xs text-gray-500 font-mono">
                                  {studentRecord.deanVerifier.slice(0, 6)}...
                                  {studentRecord.deanVerifier.slice(-4)}
                                </span>
                              )}
                          </div>
                          <div className="flex items-center justify-between">
                            <span
                              className={
                                studentRecord.financeApproved
                                  ? "text-green-400"
                                  : "text-gray-400"
                              }
                            >
                              {studentRecord.financeApproved ? "✅" : "⏳"}{" "}
                              Finance Clearance
                            </span>
                            {studentRecord.financeApproved &&
                              studentRecord.financeVerifier !==
                                "0x0000000000000000000000000000000000000000" && (
                                <span className="text-xs text-gray-500 font-mono">
                                  {studentRecord.financeVerifier.slice(0, 6)}...
                                  {studentRecord.financeVerifier.slice(-4)}
                                </span>
                              )}
                          </div>
                          <div className="flex items-center justify-between">
                            <span
                              className={
                                studentRecord.registrarIssued
                                  ? "text-green-400"
                                  : "text-gray-400"
                              }
                            >
                              {studentRecord.registrarIssued ? "✅" : "⏳"}{" "}
                              Registrar Issue
                            </span>
                            {studentRecord.registrarIssued &&
                              studentRecord.registrarVerifier !==
                                "0x0000000000000000000000000000000000000000" && (
                                <span className="text-xs text-gray-500 font-mono">
                                  {studentRecord.registrarVerifier.slice(0, 6)}
                                  ...
                                  {studentRecord.registrarVerifier.slice(-4)}
                                </span>
                              )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* IPFS Certificate */}
                    {studentRecord.ipfsHash &&
                      studentRecord.registrarIssued && (
                        <div className="mt-4">
                          <label className="text-gray-400 text-sm block mb-1">
                            IPFS Hash:
                          </label>
                          <p className="text-green-400 text-xs font-mono break-all bg-black/30 p-2 rounded mb-2">
                            {studentRecord.ipfsHash}
                          </p>
                          <button
                            onClick={() =>
                              window.open(
                                `https://ipfs.io/ipfs/${studentRecord.ipfsHash}`,
                                "_blank",
                              )
                            }
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors"
                          >
                            📥 View Certificate on IPFS
                          </button>
                        </div>
                      )}

                    {/* Timestamps */}
                    <div className="mt-4 p-3 bg-black/30 rounded-lg">
                      <h5 className="text-white font-semibold mb-2 text-sm">
                        📅 Timestamps
                      </h5>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Applied:</span>
                          <span className="text-gray-300">
                            {new Date(
                              Number(studentRecord.applicationTimestamp) * 1000,
                            ).toLocaleDateString()}
                          </span>
                        </div>
                        {Number(studentRecord.issuanceTimestamp) > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-400">Issued:</span>
                            <span className="text-gray-300">
                              {new Date(
                                Number(studentRecord.issuanceTimestamp) * 1000,
                              ).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        {/* Not Found */}
        {verificationStatus === "notfound" && (
          <div className="glass-effect rounded-lg p-8 text-center">
            <div className="text-6xl mb-4">🚫</div>
            <h2 className="text-3xl font-bold text-red-400 mb-2">
              Certificate Not Found
            </h2>
            <p className="text-red-300 mb-6">
              No certificate exists for this verification data
            </p>
            <div className="mt-8 p-6 bg-red-500/20 rounded-lg border border-red-500/50">
              <h3 className="text-red-400 font-bold text-lg mb-2">
                🚨 Possible Reasons
              </h3>
              <div className="space-y-2 text-red-300 text-sm">
                <p>• Certificate not found in blockchain records</p>
                <p>• Invalid registration number or QR code data</p>
                <p>• Possible fake or tampered certificate</p>
                <p>• IPFS hash mismatch (if using QR code)</p>
              </div>
            </div>
          </div>
        )}

        {/* Information Panel */}
        <div className="mt-8 glass-effect rounded-lg p-6">
          <h3 className="text-xl font-bold text-white mb-4">
            💡 Certificate Status Meanings
          </h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <h4 className="text-green-400 font-semibold mb-2">
                ✅ Issued & Valid
              </h4>
              <p className="text-green-300 text-sm">
                Certificate has been officially issued by the registrar and is
                valid for use.
              </p>
            </div>
            <div>
              <h4 className="text-yellow-400 font-semibold mb-2">
                ⏳ Pending Approval
              </h4>
              <p className="text-yellow-300 text-sm">
                Certificate exists but is still going through the approval
                process.
              </p>
            </div>
            <div>
              <h4 className="text-red-400 font-semibold mb-2">❌ Rejected</h4>
              <p className="text-red-300 text-sm">
                Certificate application was rejected. See reason in verification
                details.
              </p>
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-500/20 rounded-lg border border-blue-500/50">
            <h4 className="text-blue-400 font-semibold mb-2">
              🔗 QR Code Format
            </h4>
            <p className="text-blue-300 text-sm">
              Valid QR codes contain:{" "}
              <code className="bg-black/50 px-1 rounded">
                VERIFY:Sepolia:RegNo:IPFSHash:11155111
              </code>
            </p>
            <p className="text-blue-200 text-xs mt-1">
              Example: VERIFY:Sepolia:23BCE1121:QmXxXxXx...:11155111
            </p>
          </div>

          <div className="mt-4 p-4 bg-gray-500/20 rounded-lg border border-gray-500/50">
            <h4 className="text-gray-400 font-semibold mb-2">
              🔐 Security Features
            </h4>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-300">
                  <strong>Blockchain Verification:</strong> All certificates are
                  stored on an immutable Sepolia blockchain
                </p>
              </div>
              <div>
                <p className="text-gray-300">
                  <strong>IPFS Storage:</strong> Certificate files are stored on
                  decentralized IPFS network
                </p>
              </div>
              <div>
                <p className="text-gray-300">
                  <strong>Multi-Stage Approval:</strong> Requires approval from
                  4 different institutional roles
                </p>
              </div>
              <div>
                <p className="text-gray-300">
                  <strong>Audit Trail:</strong> Complete verification history
                  with verifier addresses
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
