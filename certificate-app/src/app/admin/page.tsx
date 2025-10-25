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

interface StudentRecord {
  regNo: string;
  name: string;
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
  departmentVerifier: string;
  applicationTimestamp: bigint;
}

interface RegisteredStudent {
  regNo: string;
  name: string;
  branch: string;
  email: string;
  cgpa: string;
  status: string;
  registeredDate: string;
  studentWallet: string;
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
  departmentVerifier: string;
}

export default function DepartmentPage() {
  const account = useActiveAccount();
  const { mutate: sendTransaction } = useSendTransaction();

  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "register" | "allPending" | "issued"
  >("register");

  // Registration form state
  const [formData, setFormData] = useState({
    name: "",
    regNo: "",
    branch: "",
    email: "",
    cgpa: "",
    credits: "",
    studentWallet: "",
    institutionName: "",
    graduationYear: "",
  });

  // State for different lists
  const [myRegistrations, setMyRegistrations] = useState<RegisteredStudent[]>(
    [],
  );
  const [allLevelPending, setAllLevelPending] = useState<AllLevelPending[]>([]);
  const [issuedCertificates, setIssuedCertificates] = useState<
    IssuedCertificate[]
  >([]);

  const [isDepartment, setIsDepartment] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const isLoadingRef = useRef(false);
  const dataLoadedRef = useRef({
    myRegistrations: false,
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

  // Check if user has department role
  useEffect(() => {
    const checkDepartmentRole = async () => {
      if (!account?.address) {
        setIsDepartment(false);
        return;
      }

      try {
        const result = await readContract({
          contract: accessControlContract,
          method: "function isDepartment(address) view returns (bool)",
          params: [account.address],
        });
        setIsDepartment(result as boolean);
      } catch (error) {
        console.error("Error checking department role:", error);
        setIsDepartment(false);
      }
    };

    checkDepartmentRole();
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

  // Load students registered by this department account
  const loadMyRegistrations = useCallback(async () => {
    if (
      !isDepartment ||
      !account ||
      isLoadingRef.current ||
      dataLoadedRef.current.myRegistrations
    )
      return;

    isLoadingRef.current = true;
    setIsLoadingDetails(true);

    try {
      // Get all registration statuses
      const allStatuses = [
        "PENDING_HOD",
        "PENDING_DEAN",
        "PENDING_FINANCE",
        "PENDING_REGISTRAR",
        "ISSUED",
      ];
      const myStudents: RegisteredStudent[] = [];

      for (const status of allStatuses) {
        const regNos = (await readContract({
          contract: certificateContract,
          method:
            "function getPendingApprovals(string) view returns (string[])",
          params: [status],
        })) as string[];

        if (!regNos || regNos.length === 0) continue;

        const records = await fetchStudentRecordBatch(regNos, 150);

        // Filter only students registered by this department
        records.forEach((record: any) => {
          const deptVerifier = safeToString(
            record.departmentVerifier || record[19],
          );
          if (deptVerifier.toLowerCase() === account.address.toLowerCase()) {
            myStudents.push({
              regNo: safeToString(record.regNo || record[1]),
              name: safeToString(record.name || record[0]),
              branch: safeToString(record.branch || record[2]),
              email: safeToString(record.email || record[3]),
              cgpa: (
                Number(safeToBigInt(record.cgpa || record[4])) / 100
              ).toFixed(2),
              status: safeToString(record.status || record[9]),
              registeredDate:
                Number(
                  safeToBigInt(record.applicationTimestamp || record[25]),
                ) > 0
                  ? new Date(
                      Number(
                        safeToBigInt(record.applicationTimestamp || record[25]),
                      ) * 1000,
                    ).toLocaleDateString()
                  : "N/A",
              studentWallet: safeToString(
                record.studentWalletAddress || record[6],
              ),
            });
          }
        });
      }

      setMyRegistrations(myStudents);
      dataLoadedRef.current.myRegistrations = true;
    } catch (error) {
      console.error("Error loading  registrations:", error);
      setMyRegistrations([]);
    } finally {
      setIsLoadingDetails(false);
      isLoadingRef.current = false;
    }
  }, [isDepartment, account, certificateContract]);

  // Load all pending approvals at all levels
  const loadAllLevelPending = useCallback(async () => {
    if (
      !isDepartment ||
      isLoadingRef.current ||
      dataLoadedRef.current.allLevels
    )
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
  }, [isDepartment, certificateContract]);

  // Load issued certificates
  const loadIssuedCertificates = useCallback(async () => {
    if (!isDepartment || isLoadingRef.current || dataLoadedRef.current.issued)
      return;

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
        departmentVerifier: safeToString(
          record.departmentVerifier || record[19],
        ),
      }));

      setIssuedCertificates(issuedList);
      dataLoadedRef.current.issued = true;
    } catch (error) {
      console.error("Error loading issued certificates:", error);
      setIssuedCertificates([]);
    } finally {
      isLoadingRef.current = false;
    }
  }, [isDepartment, certificateContract]);

  // Load data based on active tab
  useEffect(() => {
    if (!isDepartment) return;

    if (activeTab === "register" && !dataLoadedRef.current.myRegistrations) {
      loadMyRegistrations();
    } else if (activeTab === "allPending" && !dataLoadedRef.current.allLevels) {
      loadAllLevelPending();
    } else if (activeTab === "issued" && !dataLoadedRef.current.issued) {
      loadIssuedCertificates();
    }
  }, [
    activeTab,
    isDepartment,
    loadMyRegistrations,
    loadAllLevelPending,
    loadIssuedCertificates,
  ]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  // Register student function
  const handleRegisterStudent = async () => {
    if (!account || !isDepartment) {
      alert("Only department accounts can register students");
      return;
    }

    // Validation
    if (
      !formData.name ||
      !formData.regNo ||
      !formData.branch ||
      !formData.email ||
      !formData.cgpa ||
      !formData.credits ||
      !formData.studentWallet ||
      !formData.institutionName ||
      !formData.graduationYear
    ) {
      alert("Please fill all fields");
      return;
    }

    try {
      setIsLoading(true);

      const transaction = prepareContractCall({
        contract: certificateContract,
        method:
          "function registerStudent(string memory name, string memory regNo, string memory branch, string memory email, uint256 cgpa, uint256 creditsCompleted, address studentWalletAddress, string memory institutionName, uint256 graduationYear) public",
        params: [
          formData.name,
          formData.regNo,
          formData.branch,
          formData.email,
          BigInt(parseInt(formData.cgpa)), // CGPA * 100
          BigInt(parseInt(formData.credits)),
          formData.studentWallet as `0x${string}`,
          formData.institutionName,
          BigInt(parseInt(formData.graduationYear)),
        ],
      });

      sendTransaction(transaction, {
        onSuccess: () => {
          alert(`Student ${formData.name} registered successfully!`);
          setFormData({
            name: "",
            regNo: "",
            branch: "",
            email: "",
            cgpa: "",
            credits: "",
            studentWallet: "",
            institutionName: "",
            graduationYear: "",
          });
          // Refresh my registrations
          dataLoadedRef.current.myRegistrations = false;
          loadMyRegistrations();
          setIsLoading(false);
        },
        onError: (error) => {
          console.error("Error:", error);
          alert(`Registration failed: ${error.message || "Unknown error"}`);
          setIsLoading(false);
        },
      });
    } catch (error: any) {
      console.error("Error:", error);
      alert(`Registration failed: ${error.message || "Unknown error"}`);
      setIsLoading(false);
    }
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
    if (activeTab === "register") {
      dataLoadedRef.current.myRegistrations = false;
      setMyRegistrations([]);
      loadMyRegistrations();
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
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-indigo-900 p-8">
      <div className="container mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <Link
              href="/"
              className="text-blue-200 hover:text-white mb-2 inline-block"
            >
              ← Back to Home
            </Link>
            <h1 className="text-4xl font-bold text-white">
              Department Dashboard
            </h1>
            <p className="text-blue-200">
              Register students and track certificate approvals
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
                Please connect your wallet with Department role to access this
                dashboard
              </p>
            </div>
          </div>
        ) : !isDepartment ? (
          <div className="text-center py-20">
            <div className="bg-red-500/20 backdrop-blur-md rounded-lg p-8 border border-red-500/50">
              <h2 className="text-2xl font-bold text-red-400 mb-4">
                ⚠️ Access Denied
              </h2>
              <p className="text-red-300">
                Only accounts with Department role can access this page
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
                  onClick={() => setActiveTab("register")}
                  className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                    activeTab === "register"
                      ? "bg-blue-600 text-white"
                      : "glass-effect text-blue-200 hover:bg-white/20"
                  }`}
                >
                  📝 Register Students ({myRegistrations.length} registered)
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
                      ? "bg-green-600 text-white"
                      : "glass-effect text-green-200 hover:bg-white/20"
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

            {/* Tab Content */}

            {/* Registration Tab */}
            {activeTab === "register" && (
              <div className="space-y-6">
                {/* Registration Form */}
                <div className="glass-effect rounded-lg p-8">
                  <h2 className="text-2xl font-bold text-white mb-6">
                    Register New Student
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <input
                      type="text"
                      name="name"
                      placeholder="Student Name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="border-2 border-white/20 bg-white/10 p-3 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
                    />
                    <input
                      type="text"
                      name="regNo"
                      placeholder="Registration Number (e.g., 21BCE1234)"
                      value={formData.regNo}
                      onChange={handleInputChange}
                      className="border-2 border-white/20 bg-white/10 p-3 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
                    />
                    <input
                      type="text"
                      name="branch"
                      placeholder="Branch (e.g., Computer Science)"
                      value={formData.branch}
                      onChange={handleInputChange}
                      className="border-2 border-white/20 bg-white/10 p-3 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
                    />
                    <input
                      type="email"
                      name="email"
                      placeholder="Email Address"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="border-2 border-white/20 bg-white/10 p-3 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
                    />
                    <input
                      type="number"
                      name="cgpa"
                      placeholder="CGPA (multiply by 100, e.g., 850 for 8.50)"
                      value={formData.cgpa}
                      onChange={handleInputChange}
                      className="border-2 border-white/20 bg-white/10 p-3 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
                    />
                    <input
                      type="number"
                      name="credits"
                      placeholder="Credits Completed (e.g., 192)"
                      value={formData.credits}
                      onChange={handleInputChange}
                      className="border-2 border-white/20 bg-white/10 p-3 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
                    />
                    <input
                      type="text"
                      name="studentWallet"
                      placeholder="Student Wallet Address (0x...)"
                      value={formData.studentWallet}
                      onChange={handleInputChange}
                      className="border-2 border-white/20 bg-white/10 p-3 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 md:col-span-2"
                    />
                    <input
                      type="text"
                      name="institutionName"
                      placeholder="Institution Name"
                      value={formData.institutionName}
                      onChange={handleInputChange}
                      className="border-2 border-white/20 bg-white/10 p-3 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
                    />
                    <input
                      type="number"
                      name="graduationYear"
                      placeholder="Graduation Year (e.g., 2024)"
                      value={formData.graduationYear}
                      onChange={handleInputChange}
                      className="border-2 border-white/20 bg-white/10 p-3 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
                    />
                  </div>

                  <button
                    onClick={handleRegisterStudent}
                    disabled={isLoading}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-6 py-4 rounded-lg text-lg font-semibold"
                  >
                    {isLoading ? "Registering..." : "Register Student"}
                  </button>
                </div>

                {/* My Registered Students List */}
                <div className="glass-effect rounded-lg p-8">
                  <h2 className="text-2xl font-bold text-white mb-6">
                    Registered Students
                  </h2>

                  {isLoadingDetails ? (
                    <div className="text-center py-12">
                      <p className="text-gray-300 text-xl">
                        ⏳ Loading registered students...
                      </p>
                    </div>
                  ) : myRegistrations.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-gray-300 text-xl">
                        No students registered yet
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-white/20">
                            <th className="px-4 py-3 text-left text-blue-200">
                              Reg No
                            </th>
                            <th className="px-4 py-3 text-left text-blue-200">
                              Name
                            </th>
                            <th className="px-4 py-3 text-left text-blue-200">
                              Branch
                            </th>
                            <th className="px-4 py-3 text-left text-blue-200">
                              CGPA
                            </th>
                            <th className="px-4 py-3 text-left text-blue-200">
                              Status
                            </th>
                            <th className="px-4 py-3 text-left text-blue-200">
                              Registered Date
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {myRegistrations.map((student, index) => (
                            <tr
                              key={index}
                              className="border-b border-white/10 hover:bg-white/5"
                            >
                              <td className="px-4 py-4 text-white font-mono">
                                {student.regNo}
                              </td>
                              <td className="px-4 py-4 text-white">
                                {student.name}
                              </td>
                              <td className="px-4 py-4 text-white">
                                {student.branch}
                              </td>
                              <td className="px-4 py-4 text-white">
                                {student.cgpa}
                              </td>
                              <td className="px-4 py-4">
                                <span
                                  className={`px-3 py-1 rounded border text-sm ${getLevelBadgeColor(student.status)}`}
                                >
                                  {student.status}
                                </span>
                              </td>
                              <td className="px-4 py-4 text-gray-300 text-sm">
                                {student.registeredDate}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
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
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/20">
                          <th className="px-4 py-3 text-left text-blue-200">
                            Reg No
                          </th>
                          <th className="px-4 py-3 text-left text-blue-200">
                            Name
                          </th>
                          <th className="px-4 py-3 text-left text-blue-200">
                            Branch
                          </th>
                          <th className="px-4 py-3 text-left text-blue-200">
                            Current Level
                          </th>
                          <th className="px-4 py-3 text-left text-blue-200">
                            Applied Date
                          </th>
                          <th className="px-4 py-3 text-left text-blue-200">
                            Approval Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {allLevelPending.map((app, index) => (
                          <tr
                            key={index}
                            className="border-b border-white/10 hover:bg-white/5"
                          >
                            <td className="px-4 py-4 text-white font-mono">
                              {app.regNo}
                            </td>
                            <td className="px-4 py-4 text-white">{app.name}</td>
                            <td className="px-4 py-4 text-white">
                              {app.branch}
                            </td>
                            <td className="px-4 py-4">
                              <span
                                className={`px-3 py-1 rounded border text-sm ${getLevelBadgeColor(app.currentLevel)}`}
                              >
                                {app.currentLevel}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-gray-300 text-sm">
                              {app.appliedDate}
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex gap-2 text-xs">
                                <span
                                  className={
                                    app.hodApproved
                                      ? "text-green-400"
                                      : "text-gray-500"
                                  }
                                >
                                  {app.hodApproved ? "✓" : "○"} HOD
                                </span>
                                <span
                                  className={
                                    app.deanApproved
                                      ? "text-green-400"
                                      : "text-gray-500"
                                  }
                                >
                                  {app.deanApproved ? "✓" : "○"} Dean
                                </span>
                                <span
                                  className={
                                    app.financeApproved
                                      ? "text-green-400"
                                      : "text-gray-500"
                                  }
                                >
                                  {app.financeApproved ? "✓" : "○"} Finance
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
                        className="bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/30 rounded-lg p-6"
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
                                Department Verifier
                              </p>
                              <p className="text-purple-400 font-mono text-xs break-all">
                                {cert.departmentVerifier}
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
                            <span className="text-green-400">✓</span>{" "}
                            Certificate delivered to student wallet
                            <span className="text-green-400">✓</span> Stored on
                            blockchain
                            <span className="text-green-400">✓</span> IPFS
                            verified
                          </div>
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
