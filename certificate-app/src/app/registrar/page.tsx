"use client";

import { useState, useEffect } from "react";
import { ConnectButton } from "thirdweb/react";
import {
  useActiveAccount,
  useSendTransaction,
  useReadContract,
} from "thirdweb/react";
import {
  getContract,
  prepareContractCall,
  readContract,
  resolveMethod,
} from "thirdweb";
import { upload } from "thirdweb/storage";
import { client, sepolia } from "../client";
import Link from "next/link";
import TransactionTrail from "../../component/TransactionTrail";

// ✅ Helper functions
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

const generateQRData = (regNo: string, ipfsHash: string): string => {
  return `VERIFY:Sepolia:${regNo}:${ipfsHash}:11155111`;
};

interface StudentRecord {
  regNo: string;
  status: string;
}

interface IssuedCertificateDetails {
  regNo: string;
  name: string;
  branch: string;
  cgpa: string;
  ipfsHash: string;
  studentWallet: string;
  issuedAt: string;
  issuedBy: string;
  qrCode: string;
  departmentVerifier: string;
  hodVerifier: string;
  deanVerifier: string;
  financeVerifier: string;
}

export default function RegistrarPage() {
  const account = useActiveAccount();
  const { mutate: sendTransaction } = useSendTransaction();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"upload" | "pending" | "issued">(
    "upload",
  );
  const [pendingStudents, setPendingStudents] = useState<StudentRecord[]>([]);
  const [issuedCertificates, setIssuedCertificates] = useState<
    IssuedCertificateDetails[]
  >([]);
  const [isRegistrar, setIsRegistrar] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // IPFS Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedHash, setUploadedHash] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  // Form data
  const [certForm, setCertForm] = useState({
    regNo: "",
    ipfsHash: "",
  });

  const academicCertContract = getContract({
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
  const { data: pendingRegNos, refetch: refetchPending } = useReadContract({
    contract: academicCertContract,
    method: "function getPendingApprovals(string) view returns (string[])",
    params: ["PENDING_REGISTRAR"],
  });

  const { data: issuedRegNos, refetch: refetchIssued } = useReadContract({
    contract: academicCertContract,
    method: "function getPendingApprovals(string) view returns (string[])",
    params: ["ISSUED"],
  });

  useEffect(() => {
    const checkRegistrarRole = async () => {
      if (!account?.address) {
        setIsRegistrar(false);
        return;
      }

      try {
        const result = await readContract({
          contract: accessControlContract,
          method: "function isRegistrar(address) view returns (bool)",
          params: [account.address],
        });
        setIsRegistrar(result as boolean);
      } catch (error) {
        console.error("Error checking registrar role:", error);
        setIsRegistrar(false);
      }
    };

    checkRegistrarRole();
  }, [account]);

  useEffect(() => {
    if (
      !pendingRegNos ||
      !Array.isArray(pendingRegNos) ||
      pendingRegNos.length === 0
    ) {
      setPendingStudents([]);
      return;
    }

    const students: StudentRecord[] = (pendingRegNos as string[]).map(
      (regNo) => ({
        regNo: regNo,
        status: "PENDING_REGISTRAR",
      }),
    );

    setPendingStudents(students);
  }, [pendingRegNos]);

  // ✅ Fetch full details for issued certificates
  useEffect(() => {
    const fetchIssuedDetails = async () => {
      if (
        !issuedRegNos ||
        !Array.isArray(issuedRegNos) ||
        issuedRegNos.length === 0
      ) {
        setIssuedCertificates([]);
        return;
      }

      setIsLoadingDetails(true);
      const detailedCerts: IssuedCertificateDetails[] = [];

      for (const regNo of issuedRegNos as string[]) {
        try {
          const result = (await readContract({
            contract: academicCertContract,
            method: resolveMethod("getStudentRecord"),
            params: [regNo],
          })) as unknown as any;

          const qrData = generateQRData(
            safeToString(result.regNo),
            safeToString(result.ipfsHash),
          );

          detailedCerts.push({
            regNo: safeToString(result.regNo),
            name: safeToString(result.name),
            branch: safeToString(result.branch),
            cgpa: (Number(safeToBigInt(result.cgpa)) / 100).toFixed(2),
            ipfsHash: safeToString(result.ipfsHash),
            studentWallet: safeToString(result.studentWalletAddress),
            issuedAt:
              Number(safeToBigInt(result.issuanceTimestamp)) > 0
                ? new Date(
                    Number(safeToBigInt(result.issuanceTimestamp)) * 1000,
                  ).toLocaleString()
                : "N/A",
            issuedBy: safeToString(result.registrarVerifier),
            qrCode: qrData,
            departmentVerifier: safeToString(result.departmentVerifier),
            hodVerifier: safeToString(result.hodVerifier),
            deanVerifier: safeToString(result.deanVerifier),
            financeVerifier: safeToString(result.financeVerifier),
          });
        } catch (err) {
          console.error(`Error fetching details for ${regNo}:`, err);
        }
      }

      setIssuedCertificates(detailedCerts);
      setIsLoadingDetails(false);
    };

    fetchIssuedDetails();
  }, [issuedRegNos]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setUploadedHash("");
    }
  };

  const uploadToIPFS = async () => {
    if (!selectedFile) {
      alert("Please select a file first!");
      return;
    }

    try {
      setIsUploading(true);
      const uri = await upload({
        client,
        files: [selectedFile],
      });
      const ipfsHash = uri.replace("ipfs://", "");
      setUploadedHash(ipfsHash);
      alert("✅ File uploaded to IPFS successfully!");
    } catch (error) {
      console.error("Upload error:", error);
      alert("❌ Failed to upload to IPFS!");
    } finally {
      setIsUploading(false);
    }
  };

  const copyHashToForm = () => {
    if (uploadedHash) {
      setCertForm({
        ...certForm,
        ipfsHash: uploadedHash,
      });
      alert("✅ IPFS hash copied to issuance form!");
      setActiveTab("pending");
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCertForm({
      ...certForm,
      [e.target.name]: e.target.value,
    });
  };

  const issueCertificate = async () => {
    if (!account || !isRegistrar || !certForm.regNo || !certForm.ipfsHash) {
      alert("Please fill Registration Number and IPFS Hash!");
      return;
    }

    try {
      setIsLoading(true);

      // @ts-ignore
      const transaction = prepareContractCall({
        contract: academicCertContract,
        method: "function issueCertificate(string regNo, string ipfsHash)",
        params: [certForm.regNo, certForm.ipfsHash],
      });

      sendTransaction(transaction, {
        onSuccess: (result) => {
          console.log("✅ Success:", result);
          alert(`✅ Certificate issued successfully for ${certForm.regNo}!`);
          setCertForm({
            regNo: "",
            ipfsHash: "",
          });
          setIsLoading(false);
          refetchPending();
          refetchIssued();
        },
        onError: (error) => {
          console.error("❌ Transaction Error:", error);
          alert("❌ Failed to issue certificate! Check console for details.");
          setIsLoading(false);
        },
      });
    } catch (error: any) {
      console.error("❌ Error:", error);
      alert(`❌ Error: ${error.message || "Unknown error"}`);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-900 to-orange-900 p-8">
      <div className="container mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <Link
              href="/"
              className="text-red-200 hover:text-white mb-2 inline-block"
            >
              ← Back to Home
            </Link>
            <h1 className="text-4xl font-bold text-white">
              📜 Registrar Dashboard
            </h1>
            <p className="text-red-200">
              Upload to IPFS and issue certificates
            </p>
          </div>
          <ConnectButton client={client} />
        </div>

        {!account ? (
          <div className="text-center py-20">
            <div className="glass-effect rounded-lg p-8">
              <h2 className="text-2xl font-bold text-white mb-4">
                🔐 Connect Your Wallet
              </h2>
              <p className="text-gray-300">
                Please connect your wallet with Registrar role to access this
                dashboard
              </p>
            </div>
          </div>
        ) : !isRegistrar ? (
          <div className="text-center py-20">
            <div className="bg-red-500/20 backdrop-blur-md rounded-lg p-8 border border-red-500/50">
              <h2 className="text-2xl font-bold text-red-400 mb-4">
                ⚠️ Access Denied
              </h2>
              <p className="text-red-300">
                Only accounts with Registrar role can access this page
              </p>
              <p className="text-gray-400 text-sm mt-2">
                Connected: {account.address}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Tab Navigation */}
            <div className="flex space-x-4 mb-6">
              <button
                onClick={() => setActiveTab("upload")}
                className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                  activeTab === "upload"
                    ? "bg-purple-600 text-white"
                    : "glass-effect text-purple-200 hover:bg-white/20"
                }`}
              >
                📤 Upload to IPFS
              </button>
              <button
                onClick={() => setActiveTab("pending")}
                className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                  activeTab === "pending"
                    ? "bg-red-600 text-white"
                    : "glass-effect text-red-200 hover:bg-white/20"
                }`}
              >
                📋 Pending Issuance ({pendingStudents.length})
              </button>
              <button
                onClick={() => setActiveTab("issued")}
                className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                  activeTab === "issued"
                    ? "bg-green-600 text-white"
                    : "glass-effect text-green-200 hover:bg-white/20"
                }`}
              >
                ✅ Issued Certificates ({issuedCertificates.length})
              </button>
            </div>

            {/* IPFS Upload Tab */}
            {activeTab === "upload" && (
              <div className="glass-effect rounded-lg p-8">
                <h2 className="text-2xl font-bold text-white mb-6">
                  📤 Upload Certificate to IPFS
                </h2>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">
                      Select Certificate File
                    </label>
                    <input
                      type="file"
                      onChange={handleFileSelect}
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700"
                      disabled={isUploading}
                    />
                    <p className="text-gray-400 text-xs mt-1">
                      Supported formats: PDF, JPG, PNG (Max 10MB)
                    </p>
                  </div>

                  {selectedFile && (
                    <div className="bg-blue-500/20 p-4 rounded-lg border border-blue-500/50">
                      <h3 className="text-blue-300 font-semibold mb-2">
                        Selected File
                      </h3>
                      <p className="text-white text-sm">
                        <strong>Name:</strong> {selectedFile.name}
                      </p>
                      <p className="text-white text-sm">
                        <strong>Size:</strong>{" "}
                        {(selectedFile.size / 1024).toFixed(2)} KB
                      </p>
                      <p className="text-white text-sm">
                        <strong>Type:</strong> {selectedFile.type}
                      </p>
                    </div>
                  )}

                  <button
                    onClick={uploadToIPFS}
                    disabled={!selectedFile || isUploading}
                    className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white px-8 py-3 rounded-lg font-semibold transition-colors w-full"
                  >
                    {isUploading
                      ? "🔄 Uploading to IPFS..."
                      : "🚀 Upload to IPFS"}
                  </button>

                  {uploadedHash && (
                    <div className="bg-green-500/20 p-6 rounded-lg border border-green-500/50">
                      <h3 className="text-green-400 font-bold text-lg mb-3">
                        ✅ Upload Successful!
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <label className="text-green-300 text-sm font-semibold">
                            IPFS Hash:
                          </label>
                          <p className="text-white font-mono text-sm break-all bg-black/30 p-3 rounded mt-1">
                            {uploadedHash}
                          </p>
                        </div>

                        <div>
                          <label className="text-green-300 text-sm font-semibold">
                            Gateway URL:
                          </label>
                          <a
                            href={`https://ipfs.io/ipfs/${uploadedHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 text-sm break-all block mt-1"
                          >
                            https://ipfs.io/ipfs/{uploadedHash}
                          </a>
                        </div>

                        <div className="flex gap-3 mt-4">
                          <button
                            onClick={copyHashToForm}
                            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-semibold"
                          >
                            📋 Use This Hash for Issuance
                          </button>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(uploadedHash);
                              alert("✅ IPFS hash copied to clipboard!");
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold"
                          >
                            📄 Copy Hash
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Pending Tab */}
            {activeTab === "pending" && (
              <>
                <div className="glass-effect rounded-lg p-8 mb-8">
                  <h2 className="text-2xl font-bold text-white mb-6">
                    📜 Issue New Certificate
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-red-200 mb-2">
                        Registration Number *
                      </label>
                      <input
                        type="text"
                        name="regNo"
                        value={certForm.regNo}
                        onChange={handleInputChange}
                        placeholder="e.g., 21BCE1234"
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-red-400"
                        disabled={isLoading}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-red-200 mb-2">
                        IPFS Hash *
                      </label>
                      <input
                        type="text"
                        name="ipfsHash"
                        value={certForm.ipfsHash}
                        onChange={handleInputChange}
                        placeholder="QmXxXxXxXxXxXxXxXxXxXxXxX..."
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-red-400"
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <div className="mt-6 p-4 bg-yellow-500/20 rounded-lg border border-yellow-500/50">
                    <h3 className="text-yellow-300 font-semibold mb-2">
                      💡 Note:
                    </h3>
                    <p className="text-yellow-200 text-sm">
                      Enter the Registration Number and IPFS Hash. Upload the
                      certificate using the "Upload to IPFS" tab first.
                    </p>
                  </div>

                  <div className="mt-6">
                    <button
                      onClick={issueCertificate}
                      disabled={
                        !certForm.regNo || !certForm.ipfsHash || isLoading
                      }
                      className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white px-8 py-3 rounded-lg font-semibold transition-colors w-full md:w-auto"
                    >
                      {isLoading ? "Processing..." : "🚀 Issue Certificate"}
                    </button>
                  </div>
                </div>

                <div className="glass-effect rounded-lg p-8">
                  <h2 className="text-2xl font-bold text-white mb-6">
                    Students Ready for Certificate Issuance
                  </h2>

                  {pendingStudents.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-gray-300 text-xl">
                        No students pending certificate issuance.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-white/20">
                            <th className="px-4 py-3 text-left text-red-200">
                              Reg No
                            </th>
                            <th className="px-4 py-3 text-left text-red-200">
                              Status
                            </th>
                            <th className="px-4 py-3 text-left text-red-200">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {pendingStudents.map((student, index) => (
                            <tr
                              key={index}
                              className="border-b border-white/10 hover:bg-white/5"
                            >
                              <td className="px-4 py-4 text-white font-mono">
                                {student.regNo}
                              </td>
                              <td className="px-4 py-4">
                                <span className="px-3 py-1 rounded bg-yellow-500/20 text-yellow-300 text-sm">
                                  Ready for Issuance
                                </span>
                              </td>
                              <td className="px-4 py-4">
                                <button
                                  onClick={() => {
                                    setCertForm({
                                      ...certForm,
                                      regNo: student.regNo,
                                    });
                                  }}
                                  className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm"
                                >
                                  Select
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ✅ Enhanced Issued Certificates Tab */}
            {activeTab === "issued" && (
              <div className="space-y-6">
                <div className="glass-effect rounded-lg p-6">
                  <h2 className="text-2xl font-bold text-white mb-2">
                    Issued Certificates - Transaction History
                  </h2>
                  <p className="text-gray-300 text-sm">
                    Complete details of all issued certificates
                  </p>
                </div>

                {isLoadingDetails ? (
                  <div className="text-center py-12 glass-effect rounded-lg p-8">
                    <p className="text-white text-xl">
                      🔄 Loading certificate details...
                    </p>
                  </div>
                ) : issuedCertificates.length === 0 ? (
                  <div className="text-center py-12 glass-effect rounded-lg p-8">
                    <p className="text-gray-300 text-xl">
                      No certificates issued yet.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {issuedCertificates.map((cert, index) => (
                      <div
                        key={index}
                        className="glass-effect rounded-lg p-6 border-2 border-green-500/30 hover:border-green-500/50 transition-colors"
                      >
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                          {/* Student Information */}
                          <div>
                            <h3 className="text-white font-bold text-sm mb-3 uppercase tracking-wide">
                              Student Information
                            </h3>
                            <div className="space-y-2 text-sm">
                              <div>
                                <p className="text-gray-400">Name:</p>
                                <p className="text-white font-semibold">
                                  {cert.name}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-400">Reg No:</p>
                                <p className="text-white font-semibold">
                                  {cert.regNo}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-400">Branch:</p>
                                <p className="text-white font-semibold">
                                  {cert.branch}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-400">CGPA:</p>
                                <p className="text-white font-semibold">
                                  {cert.cgpa}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Certificate Details */}
                          <div>
                            <h3 className="text-green-400 font-bold text-sm mb-3 uppercase tracking-wide">
                              Certificate Details
                            </h3>
                            <div className="space-y-2 text-sm">
                              <div>
                                <p className="text-gray-400">IPFS Hash:</p>
                                <p className="text-green-400 font-mono text-xs break-all">
                                  {cert.ipfsHash}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-400">Student Wallet:</p>
                                <p className="text-blue-400 font-mono text-xs">
                                  {cert.studentWallet.slice(0, 6)}...
                                  {cert.studentWallet.slice(-4)}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-400">Delivered:</p>
                                <span className="inline-flex items-center px-2 py-1 rounded bg-green-500/20 text-green-300 text-xs">
                                  ✓ Yes
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Transaction Details */}
                          <div>
                            <h3 className="text-white font-bold text-sm mb-3 uppercase tracking-wide">
                              Transaction Details
                            </h3>
                            <div className="space-y-2 text-sm">
                              <div>
                                <p className="text-gray-400">Issued By:</p>
                                <p className="text-orange-400 font-mono text-xs">
                                  {cert.issuedBy.slice(0, 6)}...
                                  {cert.issuedBy.slice(-4)}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-400">Issued At:</p>
                                <p className="text-white font-semibold text-xs">
                                  {cert.issuedAt}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-400">QR Code:</p>
                                <p className="text-purple-400 font-mono text-xs break-all">
                                  {cert.qrCode.slice(0, 30)}...
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Approval Chain */}
                        <div className="mt-6 pt-4 border-t border-white/10">
                          <h4 className="text-yellow-400 font-semibold text-sm mb-3">
                            📋 Approval Chain
                          </h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                            <div>
                              <p className="text-gray-400">Department:</p>
                              <p className="text-white font-mono">
                                {cert.departmentVerifier.slice(0, 6)}...
                                {cert.departmentVerifier.slice(-4)}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-400">HOD:</p>
                              <p className="text-white font-mono">
                                {cert.hodVerifier.slice(0, 6)}...
                                {cert.hodVerifier.slice(-4)}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-400">Dean:</p>
                              <p className="text-white font-mono">
                                {cert.deanVerifier.slice(0, 6)}...
                                {cert.deanVerifier.slice(-4)}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-400">Finance:</p>
                              <p className="text-white font-mono">
                                {cert.financeVerifier.slice(0, 6)}...
                                {cert.financeVerifier.slice(-4)}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Action Button */}
                        <div className="mt-4 flex gap-3">
                          <button
                            onClick={() =>
                              window.open(
                                `https://ipfs.io/ipfs/${cert.ipfsHash}`,
                                "_blank",
                              )
                            }
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                          >
                            🔗 View Certificate on IPFS
                          </button>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(cert.qrCode);
                              alert("✅ QR Code data copied!");
                            }}
                            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                          >
                            📱 Copy QR Data
                          </button>
                        </div>
                        {/* 🔥 Transaction Trail Section */}
                        <div className="mt-6 pt-4 border-t border-white/10">
                          <button
                            onClick={() => toggleCard(cert.regNo)}
                            className="flex items-center text-orange-400 hover:text-orange-300 text-sm font-semibold mb-2"
                          >
                            <span className="mr-2">
                              {expandedCard === cert.regNo ? "▼" : "▶"}
                            </span>
                            {expandedCard === cert.regNo ? "Hide" : "View"}{" "}
                            Complete Blockchain Transaction History
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
      </div>
    </div>
  );
}
