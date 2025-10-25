"use client";

import { useState } from "react";
import { ConnectButton } from "thirdweb/react";
import {
  useActiveAccount,
  useSendTransaction,
  useReadContract,
} from "thirdweb/react";
import { getContract, prepareContractCall } from "thirdweb";
import { client, sepolia } from "../client"; // Updated import
import Link from "next/link";

export default function OwnerPage() {
  const account = useActiveAccount();
  const { mutate: sendTransaction } = useSendTransaction();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    address: "",
    role: "",
    institutionName: "",
  });

  // Access Control Contract
  const accessControlContract = getContract({
    client,
    chain: sepolia, // Updated to Sepolia
    address: process.env.NEXT_PUBLIC_ACCESS_CONTROL_ADDRESS!,
  });

  // Get contract owner
  const { data: contractOwner } = useReadContract({
    contract: accessControlContract,
    method: "function owner() public view returns (address)",
    params: [],
  });

  const isOwner =
    account?.address &&
    contractOwner &&
    account.address.toLowerCase() === contractOwner.toLowerCase();

  const roles = [
    {
      value: "department",
      label: "Department",
      color: "bg-blue-500",
      icon: "📝",
      description: "Can register new students for certificate processing",
    },
    {
      value: "hod",
      label: "HOD",
      color: "bg-green-500",
      icon: "✅",
      description: "Can approve/reject students at department level",
    },
    {
      value: "dean",
      label: "Dean",
      color: "bg-purple-500",
      icon: "🏛️",
      description: "Can approve/reject HOD-approved students",
    },
    {
      value: "finance",
      label: "Finance",
      color: "bg-orange-500",
      icon: "💰",
      description:
        "Can approve/reject Dean-approved students for financial clearance",
    },
    {
      value: "registrar",
      label: "Registrar",
      color: "bg-red-500",
      icon: "📜",
      description: "Can issue certificates or reject at final level",
    },
  ];

  const addRoleFunctionMap: Record<string, string> = {
    department: "addDepartment",
    hod: "addHOD",
    dean: "addDean",
    finance: "addFinance",
    registrar: "addRegistrar",
  };

  const removeRoleFunctionMap: Record<string, string> = {
    department: "removeDepartment",
    hod: "removeHOD",
    dean: "removeDean",
    finance: "removeFinance",
    registrar: "removeRegistrar",
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const addRole = async () => {
    if (!account || !isOwner || !formData.address || !formData.role) {
      alert("Please fill in all required fields!");
      return;
    }

    // Validate Ethereum address
    if (!/^0x[a-fA-F0-9]{40}$/.test(formData.address)) {
      alert("Invalid Ethereum address!");
      return;
    }

    try {
      setIsLoading(true);

      const methodName = addRoleFunctionMap[formData.role];
      if (!methodName) {
        throw new Error(`Invalid role: ${formData.role}`);
      }

      const transaction = prepareContractCall({
        contract: accessControlContract,
        method: `function ${methodName}(address _account, string memory _institutionName) external`,
        params: [
          formData.address,
          formData.institutionName || "Academic Institution",
        ],
      });

      sendTransaction(transaction, {
        onSuccess: () => {
          alert(
            `✅ ${formData.role.toUpperCase()} role added successfully to ${formData.address}!`,
          );
          setFormData({ address: "", role: "", institutionName: "" });
          setIsLoading(false);
        },
        onError: (error) => {
          console.error("Error:", error);
          alert("❌ Failed to add role! User may already have this role.");
          setIsLoading(false);
        },
      });
    } catch (error) {
      console.error("Error:", error);
      alert("❌ Failed to add role!");
      setIsLoading(false);
    }
  };

  const removeRole = async () => {
    if (!account || !isOwner || !formData.address || !formData.role) {
      alert("Please fill in all required fields!");
      return;
    }

    // Validate Ethereum address
    if (!/^0x[a-fA-F0-9]{40}$/.test(formData.address)) {
      alert("Invalid Ethereum address!");
      return;
    }

    try {
      setIsLoading(true);

      const methodName = removeRoleFunctionMap[formData.role];
      if (!methodName) {
        throw new Error(`Invalid role: ${formData.role}`);
      }

      const transaction = prepareContractCall({
        contract: accessControlContract,
        method: `function ${methodName}(address _account) external`,
        params: [formData.address],
      });

      sendTransaction(transaction, {
        onSuccess: () => {
          alert(
            `✅ ${formData.role.toUpperCase()} role removed successfully from ${formData.address}!`,
          );
          setFormData({ address: "", role: "", institutionName: "" });
          setIsLoading(false);
        },
        onError: (error) => {
          console.error("Error:", error);
          alert("❌ Failed to remove role! User may not have this role.");
          setIsLoading(false);
        },
      });
    } catch (error) {
      console.error("Error:", error);
      alert("❌ Failed to remove role!");
      setIsLoading(false);
    }
  };
  const setCertificateContractAddress = async () => {
    if (!account) {
      alert("Please connect wallet first!");
      return;
    }

    try {
      const ipfsStorageContract = getContract({
        client,
        chain: sepolia,
        address: process.env.NEXT_PUBLIC_IPFS_STORAGE_ADDRESS!,
      });

      const certificateAddress =
        process.env.NEXT_PUBLIC_CERTIFICATE_CONTRACT_ADDRESS!;

      console.log("Setting certificate contract address:", certificateAddress);

      const transaction = prepareContractCall({
        contract: ipfsStorageContract,
        method: "function setCertificateContract(address)",
        params: [certificateAddress],
      });

      sendTransaction(transaction, {
        onSuccess: () => {
          alert("✅ Certificate contract address set successfully!");
        },
        onError: (error) => {
          console.error("Error:", error);
          alert("❌ Failed to set certificate contract address!");
        },
      });
    } catch (error) {
      console.error("Error:", error);
      alert("❌ Failed to prepare transaction!");
    }
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-blue-900 p-8">
      <div className="container mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <Link
              href="/"
              className="text-yellow-400 hover:text-yellow-300 mb-2 inline-block"
            >
              ← Back to Home
            </Link>
            <h1 className="text-4xl font-bold text-white">
              ⚙️ Owner Dashboard
            </h1>
            <p className="text-gray-300">
              Manage roles for the Academic Certificate System
            </p>
            <p className="text-yellow-400 text-sm mt-1">
              🔗 Network: Sepolia Testnet (Proof of Stake)
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
                Please connect your wallet to access the owner dashboard
              </p>
            </div>
          </div>
        ) : !isOwner ? (
          <div className="text-center py-20">
            <div className="bg-red-500/20 backdrop-blur-md rounded-lg p-8 border border-red-500/50">
              <h2 className="text-2xl font-bold text-red-400 mb-4">
                ⚠️ Access Denied
              </h2>
              <p className="text-red-300">
                Only the contract owner can access this page
              </p>
              <p className="text-gray-400 text-sm mt-2">
                Your Address: {account.address}
              </p>
              <p className="text-gray-400 text-sm">
                Owner Address: {contractOwner || "Loading..."}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Role Management Form */}
            <div className="glass-effect rounded-lg p-8">
              <h2 className="text-2xl font-bold text-white mb-6">
                👥 Manage User Roles
              </h2>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Wallet Address *
                  </label>
                  <input
                    type="text"
                    name="address"
                    placeholder="0x1234567890123456789012345678901234567890"
                    value={formData.address}
                    onChange={handleInputChange}
                    pattern="^0x[a-fA-F0-9]{40}$"
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Institution Name
                  </label>
                  <input
                    type="text"
                    name="institutionName"
                    placeholder="VIT Vellore, IIT Delhi, etc."
                    value={formData.institutionName}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Select Role *
                  </label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-400"
                    disabled={isLoading}
                  >
                    <option value="" className="bg-gray-800">
                      Select a role...
                    </option>
                    {roles.map((role) => (
                      <option
                        key={role.value}
                        value={role.value}
                        className="bg-gray-800"
                      >
                        {role.icon} {role.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex space-x-4">
                  <button
                    onClick={addRole}
                    disabled={!formData.address || !formData.role || isLoading}
                    className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white py-3 px-6 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed"
                  >
                    {isLoading ? "🔄 Processing..." : "➕ Add Role"}
                  </button>

                  <button
                    onClick={removeRole}
                    disabled={!formData.address || !formData.role || isLoading}
                    className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white py-3 px-6 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed"
                  >
                    {isLoading ? "🔄 Processing..." : "➖ Remove Role"}
                  </button>
                </div>
              </div>
            </div>

            {/* Role Information */}
            <div className="glass-effect rounded-lg p-8">
              <h2 className="text-2xl font-bold text-white mb-6">
                ℹ️ Role Information
              </h2>

              <div className="space-y-4">
                {roles.map((role) => (
                  <div
                    key={role.value}
                    className="flex items-start space-x-3 p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <div className="text-2xl">{role.icon}</div>
                    <div
                      className={`w-4 h-4 ${role.color} rounded-full mt-1`}
                    ></div>
                    <div className="flex-1">
                      <h3 className="text-white font-semibold">{role.label}</h3>
                      <p className="text-gray-400 text-sm">
                        {role.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 p-4 bg-blue-500/20 rounded-lg border border-blue-500/50">
                <h4 className="text-blue-400 font-semibold mb-2">
                  💡 Quick Tips
                </h4>
                <ul className="text-blue-300 text-sm space-y-1">
                  <li>
                    • Wallet addresses must be valid Ethereum addresses (0x...)
                  </li>
                  <li>
                    • Users need to connect with assigned role wallets to access
                    functions
                  </li>
                  <li>• You can remove and re-add roles as needed</li>
                  <li>• Institution name helps identify role assignments</li>
                  <li>
                    • Each role has rejection capabilities at their approval
                    level
                  </li>
                </ul>
              </div>
              <button
                onClick={setCertificateContractAddress}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold"
              >
                🔗 Link CertificateManagement Contract
              </button>
              <div className="mt-4 p-4 bg-yellow-500/20 rounded-lg border border-yellow-500/50">
                <h4 className="text-yellow-400 font-semibold mb-2">
                  ⚡ Network Info
                </h4>
                <ul className="text-yellow-300 text-sm space-y-1">
                  <li>• Network: Sepolia Testnet (PoS)</li>
                  <li>• Chain ID: 11155111</li>
                  <li>• Get test ETH: thirdweb.com/sepolia</li>
                  <li>
                    • Contract Owner: {contractOwner?.substring(0, 10)}...
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
