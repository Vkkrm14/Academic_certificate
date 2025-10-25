"use client";

import { ConnectButton, useActiveAccount } from "thirdweb/react";
import { client, sepolia } from "./client";
import Link from "next/link";
import { useEffect, useState } from "react";

interface WindowWithEthereum extends Window {
  ethereum?: {
    request: (args: { method: string; params?: any[] }) => Promise<any>;
    chainId?: string;
    isMetaMask?: boolean;
  };
}

declare const window: WindowWithEthereum;

export default function Home() {
  const account = useActiveAccount();
  const [connectionStatus, setConnectionStatus] =
    useState<string>("Checking...");

  useEffect(() => {
    const checkConnection = async () => {
      if (window.ethereum) {
        try {
          const chainId = await window.ethereum.request({
            method: "eth_chainId",
          });
          const accounts = await window.ethereum.request({
            method: "eth_accounts",
          });

          console.log("Chain ID:", parseInt(chainId, 16));
          console.log("Accounts:", accounts);

          if (parseInt(chainId, 16) === 11155111 && accounts.length > 0) {
            console.log("✅ Connected to Sepolia with account");
            setConnectionStatus("✅ MetaMask connected to Sepolia Testnet");
          } else if (parseInt(chainId, 16) === 11155111) {
            setConnectionStatus("⚠️ On Sepolia, but wallet not connected");
          } else {
            setConnectionStatus("❌ Wrong network - Please switch to Sepolia");
          }
        } catch (error) {
          console.error("Connection check error:", error);
          setConnectionStatus("❌ Connection check failed");
        }
      } else {
        setConnectionStatus("❌ MetaMask not found");
      }
    };

    checkConnection();
  }, []);

  const switchToSepolia = async () => {
    if (!window.ethereum) {
      alert("❌ Please install MetaMask first!");
      return;
    }

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xaa36a7" }], // 11155111 in hex
      });

      alert("✅ Switched to Sepolia Testnet!");
      setTimeout(() => window.location.reload(), 1000);
    } catch (error: any) {
      if (error.code === 4902) {
        alert(
          "❌ Sepolia network not found in MetaMask. Please add it manually.",
        );
      } else {
        alert(`❌ Failed to switch: ${error.message}`);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 p-8">
      <div className="container mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-5xl font-bold text-white mb-2">
              🎓 Academic Certificate System
            </h1>
            <p className="text-xl text-blue-200">
              Blockchain-powered certificate verification on Sepolia PoS
            </p>
            <p className="text-sm text-blue-300 mt-1">
              🔗 Three-Contract Architecture: Certificate Management + Access
              Control + IPFS Storage
            </p>
          </div>

          <div className="flex flex-col items-end space-y-2">
            <ConnectButton client={client} chain={sepolia} theme="dark" />
          </div>
        </div>

        {/* Connection Status */}
        <div className="glass-effect rounded-xl p-6 mb-8">
          <h3 className="text-2xl font-bold text-white mb-4">
            🔗 Connection Status
          </h3>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-blue-400 font-semibold mb-2">
                🔍 Network Detection
              </h4>
              <p
                className={`text-sm ${
                  connectionStatus.includes("✅")
                    ? "text-green-400"
                    : connectionStatus.includes("⚠️")
                      ? "text-yellow-400"
                      : "text-red-400"
                }`}
              >
                {connectionStatus}
              </p>
              <div className="mt-2 text-xs space-y-1">
                <p className="text-gray-400">
                  Chain ID: 11155111 (Sepolia PoS)
                </p>
                <p className="text-gray-400">Network: Ethereum Testnet</p>
                <p className="text-blue-400">
                  Get test ETH:{" "}
                  <a
                    href="https://thirdweb.com/sepolia"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-blue-300"
                  >
                    thirdweb.com/sepolia
                  </a>
                </p>
              </div>
            </div>

            <div>
              <h4
                className={`font-semibold mb-2 ${account ? "text-green-400" : "text-yellow-400"}`}
              >
                {account ? "✅ Wallet Connected" : "⏳ Waiting for Connection"}
              </h4>
              {account ? (
                <div>
                  <p className="text-green-300 text-sm font-mono break-all">
                    {account.address}
                  </p>
                  <p className="text-green-200 text-xs mt-2">
                    🎉 You're ready to use the system!
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-yellow-300 text-sm">
                    Click "Connect Wallet" above to get started
                  </p>
                  <p className="text-gray-400 text-xs">
                    Make sure you're on Sepolia network
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          {!connectionStatus.includes("✅") && (
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={switchToSepolia}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
              >
                ⚡ Switch to Sepolia
              </button>

              <a
                href="https://thirdweb.com/sepolia"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
              >
                💧 Get Test ETH
              </a>

              <button
                onClick={() => window.location.reload()}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
              >
                🔄 Refresh Page
              </button>
            </div>
          )}
        </div>

        {/* Show content based on connection state */}
        {account ? (
          <>
            <div className="bg-green-500/20 rounded-xl p-4 mb-8 border border-green-500/50">
              <h3 className="text-green-400 font-bold text-lg mb-2">
                🎉 Successfully Connected!
              </h3>
              <p className="text-green-300">
                You can now access all system features on Sepolia testnet.
              </p>
            </div>

            {/* Role Navigation Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <Link href="/owner" className="hover-scale">
                <div className="glass-effect rounded-xl p-6 text-center hover:bg-white/20 transition-all cursor-pointer">
                  <div className="text-4xl mb-4">⚙️</div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    Owner Panel
                  </h3>
                  <p className="text-gray-300 text-sm">
                    Manage roles and system settings
                  </p>
                </div>
              </Link>

              <Link href="/admin" className="hover-scale">
                <div className="glass-effect rounded-xl p-6 text-center hover:bg-white/20 transition-all cursor-pointer">
                  <div className="text-4xl mb-4">📝</div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    Department
                  </h3>
                  <p className="text-gray-300 text-sm">Register new students</p>
                </div>
              </Link>

              <Link href="/hod" className="hover-scale">
                <div className="glass-effect rounded-xl p-6 text-center hover:bg-white/20 transition-all cursor-pointer">
                  <div className="text-4xl mb-4">✅</div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    HOD Panel
                  </h3>
                  <p className="text-gray-300 text-sm">
                    Approve/Reject applications
                  </p>
                </div>
              </Link>

              <Link href="/dean" className="hover-scale">
                <div className="glass-effect rounded-xl p-6 text-center hover:bg-white/20 transition-all cursor-pointer">
                  <div className="text-4xl mb-4">🏛️</div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    Dean Panel
                  </h3>
                  <p className="text-gray-300 text-sm">
                    Institutional compliance
                  </p>
                </div>
              </Link>

              <Link href="/finance" className="hover-scale">
                <div className="glass-effect rounded-xl p-6 text-center hover:bg-white/20 transition-all cursor-pointer">
                  <div className="text-4xl mb-4">💰</div>
                  <h3 className="text-xl font-bold text-white mb-2">Finance</h3>
                  <p className="text-gray-300 text-sm">
                    Clear financial obligations
                  </p>
                </div>
              </Link>

              <Link href="/registrar" className="hover-scale">
                <div className="glass-effect rounded-xl p-6 text-center hover:bg-white/20 transition-all cursor-pointer">
                  <div className="text-4xl mb-4">📜</div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    Registrar
                  </h3>
                  <p className="text-gray-300 text-sm">
                    Issue certificates with IPFS
                  </p>
                </div>
              </Link>

              <Link href="/student" className="hover-scale">
                <div className="glass-effect rounded-xl p-6 text-center hover:bg-white/20 transition-all cursor-pointer">
                  <div className="text-4xl mb-4">🎓</div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    Student Portal
                  </h3>
                  <p className="text-gray-300 text-sm">
                    Access your certificates
                  </p>
                </div>
              </Link>

              <Link href="/verify" className="hover-scale">
                <div className="glass-effect rounded-xl p-6 text-center hover:bg-white/20 transition-all cursor-pointer">
                  <div className="text-4xl mb-4">🔍</div>
                  <h3 className="text-xl font-bold text-white mb-2">Verify</h3>
                  <p className="text-gray-300 text-sm">
                    Verify certificate authenticity
                  </p>
                </div>
              </Link>

              <Link href="/explorer" className="hover-scale">
                <div className="glass-effect rounded-xl p-6 text-center hover:bg-white/20 transition-all">
                  <div className="text-4xl mb-4">🔍</div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    Blockchain Explorer
                  </h3>
                  <p className="text-gray-300">
                    View blocks, transactions & Merkle roots
                  </p>
                </div>
              </Link>
            </div>

            {/* System Features */}
            <div className="glass-effect rounded-xl p-6 mb-8">
              <h3 className="text-2xl font-bold text-white mb-4">
                ✨ System Features
              </h3>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-blue-500/10 p-4 rounded-lg">
                  <h4 className="text-blue-400 font-semibold mb-2">
                    🔐 Multi-Level Approval
                  </h4>
                  <p className="text-gray-300 text-sm">
                    4-stage approval: Department → HOD → Dean → Finance →
                    Registrar
                  </p>
                </div>
                <div className="bg-purple-500/10 p-4 rounded-lg">
                  <h4 className="text-purple-400 font-semibold mb-2">
                    📁 IPFS Storage
                  </h4>
                  <p className="text-gray-300 text-sm">
                    Decentralized certificate storage with tamper-proof records
                  </p>
                </div>
                <div className="bg-green-500/10 p-4 rounded-lg">
                  <h4 className="text-green-400 font-semibold mb-2">
                    ❌ Rejection Workflow
                  </h4>
                  <p className="text-gray-300 text-sm">
                    All levels can approve or reject with documented reasons
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-yellow-500/20 rounded-xl p-6 mb-8 border border-yellow-500/50">
            <h3 className="text-yellow-400 font-bold text-xl mb-4">
              👋 Welcome to Academic Certificate System
            </h3>
            <div className="space-y-3">
              <p className="text-yellow-200">
                Please connect your wallet to access the system features.
              </p>

              <div className="bg-yellow-500/10 p-4 rounded-lg">
                <p className="text-yellow-300 text-sm font-semibold mb-2">
                  🚀 Getting Started:
                </p>
                <ol className="text-yellow-200 text-sm space-y-1 list-decimal list-inside">
                  <li>Install MetaMask browser extension</li>
                  <li>Switch to Sepolia testnet</li>
                  <li>Get free test ETH from faucet</li>
                  <li>Click "Connect Wallet" above</li>
                </ol>
              </div>

              <div className="flex gap-3 mt-4">
                <a
                  href="https://metamask.io/download/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                >
                  📥 Install MetaMask
                </a>
                <a
                  href="https://thirdweb.com/sepolia"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                >
                  💧 Get Test ETH
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Footer Info */}
        <div className="glass-effect rounded-xl p-6 mt-8">
          <h3 className="text-xl font-bold text-white mb-3">
            📊 System Architecture
          </h3>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div>
              <h4 className="text-blue-400 font-semibold mb-1">
                CertificateManagement
              </h4>
              <p className="text-gray-300">
                Handles student records & approval workflow
              </p>
            </div>
            <div>
              <h4 className="text-purple-400 font-semibold mb-1">
                AccessControl
              </h4>
              <p className="text-gray-300">Manages roles & permissions</p>
            </div>
            <div>
              <h4 className="text-green-400 font-semibold mb-1">IPFSStorage</h4>
              <p className="text-gray-300">
                Stores certificate hashes & metadata
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
