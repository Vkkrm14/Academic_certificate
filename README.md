# 🎓 Academic Certificate Management System

<p align="center">
  <img src="banner.png" alt="Academic Certificate Management System Banner" width="100%">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Solidity-%5E0.8.19-blue?style=for-the-badge&logo=solidity" alt="Solidity">
  <img src="https://img.shields.io/badge/zkSync%20Era-Sepolia%20Testnet-purple?style=for-the-badge&logo=ethereum" alt="zkSync Era">
  <img src="https://img.shields.io/badge/Next.js-15.x-black?style=for-the-badge&logo=nextdotjs" alt="Next.js">
  <img src="https://img.shields.io/badge/Tailwind_CSS-3.x-38B2AC?style=for-the-badge&logo=tailwind-css" alt="TailwindCSS">
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="MIT License">
</p>

A state-of-the-art decentralized, blockchain-based platform for issuing, managing, and verifying academic certificates. Built on **zkSync Era (Sepolia Testnet)**, the system features a robust multi-role approval workflow, secure **IPFS document storage**, and a responsive **Next.js** frontend.

---

## 📖 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Smart Contracts](#smart-contracts)
- [Certificate Workflow](#certificate-workflow)
- [Roles & Permissions](#roles--permissions)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Contract Deployment](#contract-deployment)
  - [Frontend Setup](#frontend-setup)
- [Environment Variables](#environment-variables)
- [Application Pages](#application-pages)
- [License](#license)

---

## 🔍 Overview

Traditional academic certificates are paper-based, slow to verify, and vulnerable to forgery. This system replaces them with tamper-proof, on-chain records. 

### Key Features:
* **Tamper-Proof Records:** Certificates are secured cryptographically on the blockchain.
* **Structured Pipeline:** A multi-step approval process involving the Department, HOD, Dean, Finance, and Registrar before final issuance.
* **IPFS Integration:** The certificate documents (PDFs) are stored off-chain on IPFS with their cryptographic hashes pinned on-chain.
* **Instant Verification:** Any third party can instantly verify certificate authenticity directly on-chain without relying on a central authority.
* **Appeal System:** If a certificate application is rejected at any level, students can submit an appeal to reset and re-trigger the workflow.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Next.js Frontend                    │
│   (ThirdWeb SDK · MetaMask · TailwindCSS · TypeScript)  │
└────────────────────────┬────────────────────────────────┘
                         │ RPC / Contract Calls
┌────────────────────────▼────────────────────────────────┐
│              zkSync Era Sepolia Testnet                 │
│                                                         │
│  ┌─────────────────┐  ┌────────────────────────────┐   │
│  │  AccessControl  │  │   CertificateManagement    │   │
│  │  (Roles & ACL)  │◄─┤  (Core Workflow & Records) │   │
│  └─────────────────┘  └────────────┬───────────────┘   │
│                                    │                    │
│                        ┌───────────▼──────────┐        │
│                        │     IPFSStorage       │        │
│                        │  (On-chain IPFS refs) │        │
│                        └──────────────────────┘        │
└─────────────────────────────────────────────────────────┘
                         │
               ┌──────────▼──────────┐
               │        IPFS         │
               │  (Certificate PDFs) │
               └─────────────────────┘
```

---

## 📄 Smart Contracts

All smart contracts are located in `certificate-contract/contracts/`.

### 1. `AccessControl.sol`
Manages system-wide roles and permissions. Only the **Owner** has the authority to grant or revoke administrative and operational roles.

| Role | Allowed Actions / Description |
| :--- | :--- |
| **Owner** | Deploys contracts, manages and updates all roles. |
| **Department** | Initiates and registers student certificate applications. |
| **HOD** | First-level approval or rejection. |
| **Dean** | Second-level approval or rejection. |
| **Finance** | Third-level approval or rejection. |
| **Registrar** | Final authority — uploads the IPFS hash and issues the certificate. |

### 2. `CertificateManagement.sol`
The core business logic contract. It stores the `StudentRecord` struct, coordinates the state transitions in the approval pipeline, and emits events for each transition.

**Key Data Stored Per Student:**
- **Personal Details:** Full name, registration number, branch/department, email, institution, graduation year.
- **Academic Merits:** CGPA (scaled by 100 for integer precision), total credits completed.
- **Wallet Link:** Student's wallet address for direct delivery of the certificate.
- **Workflow Status:** `PENDING_HOD` ➡️ `PENDING_DEAN` ➡️ `PENDING_FINANCE` ➡️ `PENDING_REGISTRAR` ➡️ `ISSUED` / `REJECTED`.
- **Approval Tracking:** Boolean flags indicating approvals received at each role level.
- **Rejection Log:** Rejection reason, wallet address of the rejector, timestamp, and level of rejection.
- **IPFS Hash:** The cryptographic reference pointing to the certificate PDF document.

### 3. `IPFSStorage.sol`
Stores and validates IPFS hashes on-chain. It prevents duplicate issuances, handles certificate revocations, and is locked down so that it can only be modified by the `CertificateManagement` contract.

---

## 🔄 Certificate Workflow

```
Department
   │
   │  registerStudent()
   ▼
PENDING_HOD ──► HOD rejectByHOD() ──► REJECTED (appeal resets pipeline)
   │
   │  approveByHOD()
   ▼
PENDING_DEAN ──► Dean rejectByDean() ──► REJECTED (appeal resets pipeline)
   │
   │  approveByDean()
   ▼
PENDING_FINANCE ──► Finance rejectByFinance() ──► REJECTED (appeal resets pipeline)
   │
   │  approveByFinance()
   ▼
PENDING_REGISTRAR ──► Registrar rejectByRegistrar() ──► REJECTED (appeal resets pipeline)
   │
   │  issueCertificate(ipfsHash)
   ▼
  ISSUED  ✅ (Certificate permanently on-chain)
```

> [!NOTE]
> **Appeal Mechanism:** At any stage where a record status becomes `REJECTED`, the student can submit an appeal. This resets the status back to `PENDING_HOD` and triggers the workflow process from the beginning.

---

## 🔐 Roles & Permissions Matrix

| Action | Allowed Role |
| :--- | :--- |
| **Add/Remove Roles** | Owner |
| **Register Student Application** | Department |
| **Approve / Reject (Level 1)** | HOD |
| **Approve / Reject (Level 2)** | Dean |
| **Approve / Reject (Level 3)** | Finance |
| **Issue Certificate** | Registrar |
| **View All Records** | Admin / Owner |
| **View Own Record** | Student (linked wallet) |
| **Verify Certificate Validity** | Public (no wallet required) |

---

## 🛠️ Tech Stack

### Frontend App (`certificate-app/`)
* **Framework:** Next.js 15.x (React 19, App Router, TypeScript)
* **Styling:** TailwindCSS 3.x
* **Web3 SDK:** ThirdWeb SDK v5 (Wallet connections, smart contract interface)
* **Ethereum Client:** Web3.js 4.x

### Smart Contracts (`certificate-contract/`)
* **Language:** Solidity `^0.8.19`
* **Development Environment:** Hardhat 2.x
* **ZK Compiler:** zkSync `zksolc` 1.4.1
* **Integration:** `@matterlabs/hardhat-zksync-solc`
* **Deployment Tool:** ThirdWeb CLI
* **Ether Libraries:** `zksync-ethers` 5.x

### Network & Infrastructure
* **Testnet Network:** zkSync Era Sepolia Testnet (Chain ID: `300`)
* **Mainnet Network:** zkSync Era Mainnet (Chain ID: `324`)
* **Wallet Provider:** MetaMask
* **Storage:** IPFS (InterPlanetary File System)

---

## 📂 Project Structure

```text
Academic_certificate5/
├── certificate-app/                 # Next.js frontend application
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx             # Landing / Home page
│   │   │   ├── client.ts            # ThirdWeb client initialization
│   │   │   ├── layout.tsx           # Root layout
│   │   │   ├── globals.css          # Global CSS & Tailwind imports
│   │   │   ├── admin/page.tsx       # Admin Dashboard (Overview of all records)
│   │   │   ├── owner/page.tsx       # Owner Panel (Role management)
│   │   │   ├── dean/page.tsx        # Dean Portal (Level-2 Approvals)
│   │   │   ├── finance/page.tsx     # Finance Portal (Level-3 Approvals)
│   │   │   ├── hod/page.tsx         # HOD Portal (Level-1 Approvals)
│   │   │   ├── registrar/page.tsx   # Registrar Portal (Issuance & Upload)
│   │   │   ├── student/page.tsx     # Student Dashboard (Status track)
│   │   │   ├── verify/page.tsx      # Public Verifier (Search by Reg No.)
│   │   │   └── explorer/page.tsx    # Public Certificate Explorer
│   │   └── component/
│   │       └── TransactionTrail.tsx # Real-time transaction history tracker
│   ├── package.json
│   ├── tailwind.config.ts
│   └── tsconfig.json
│
└── certificate-contract/            # Hardhat smart contract environment
    ├── contracts/
    │   ├── AccessControl.sol        # Role and ACL definition
    │   ├── CertificateManagement.sol# Core workflow pipeline
    │   ├── IPFSStorage.sol          # IPFS hash registry & validation
    │   └── Contract.sol             # Base utility contract
    ├── scripts/
    │   └── verify/my-contract.js    # Smart contract verification
    ├── artifacts-zk/                # Compiled zkSync bytecode & ABIs
    ├── cache-zk/                    # Compiler cache
    ├── hardhat.config.js            # Hardhat ZK-rollup integration configuration
    └── package.json
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js `^18.x` or higher
- npm, yarn, or pnpm
- MetaMask browser extension
- [ThirdWeb](https://thirdweb.com) Client ID
- Testnet ETH on zkSync Sepolia. Obtain from the [zkSync Sepolia Faucet](https://faucet.quicknode.com/zksync/sepolia).

---

### Contract Deployment

1. Navigate to the contract folder and install dependencies:
   ```bash
   cd certificate-contract
   npm install
   ```

2. Compile and deploy to the zkSync Sepolia network via ThirdWeb:
   ```bash
   npm run deploy
   ```
   *This command invokes `npx thirdweb@latest deploy`, which automatically compiles the contracts using `zksolc` and opens the ThirdWeb deployment web GUI.*

> [!IMPORTANT]
> **Deployment Ordering Sequence:**
> 1. Deploy `AccessControl.sol`.
> 2. Deploy `IPFSStorage.sol`.
> 3. Deploy `CertificateManagement.sol`, passing the deployed addresses of **AccessControl** and **IPFSStorage** as constructor parameters.
> 4. Go to the `IPFSStorage` deployed instance and execute `setCertificateContract()`, passing the address of the deployed `CertificateManagement` contract.
> 5. Use the **Owner** portal dashboard to assign operational roles (Department, HOD, Dean, Finance, Registrar) to respective wallets.

---

### Frontend Setup

1. Navigate to the frontend directory and install packages:
   ```bash
   cd certificate-app
   npm install
   ```

2. Create a `.env.local` file in the root of `certificate-app/` and populate it with your configuration (see [Environment Variables](#environment-variables)).

3. Run the Next.js development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## 🔑 Environment Variables

Configure the following environment variables in `certificate-app/.env.local`:

```env
# ThirdWeb Client ID from https://thirdweb.com/dashboard
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=your_thirdweb_client_id

# Deployed Contract Addresses on zkSync Sepolia
NEXT_PUBLIC_ACCESS_CONTROL_ADDRESS=0x...
NEXT_PUBLIC_CERTIFICATE_MANAGEMENT_ADDRESS=0x...
NEXT_PUBLIC_IPFS_STORAGE_ADDRESS=0x...
```

---

## 🗺️ Application Pages

| Page Path | Target Role | Page Purpose & Functionality |
| :--- | :--- | :--- |
| `/` | Public | Entrypoint, web3 wallet connection, and active network check. |
| `/owner` | Owner | Assign, review, and revoke roles for different academic entities. |
| `/admin` | Admin | Comprehensive view of student records, audit logs, and metrics. |
| `/hod` | HOD | First-level vetting, approval, and rejection of certificate applications. |
| `/dean` | Dean | Second-level vetting and approval of student applications. |
| `/finance` | Finance | Third-level clearance (dues validation) before final signing. |
| `/registrar`| Registrar | Final authority to link IPFS PDF hash and execute on-chain minting/issuance. |
| `/student` | Student | Personal dashboard to monitor approval pipeline status and access issued certificates. |
| `/verify` | Public | Fast verification lookup by registration number (no login/wallet required). |
| `/explorer` | Public | Open public registry of all successfully issued certificates. |

---

## 📄 License

This project is licensed under the [MIT License](https://opensource.org/licenses/MIT).
