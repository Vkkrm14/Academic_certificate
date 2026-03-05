# Academic Certificate Management System

A decentralized, blockchain-based platform for issuing and verifying academic certificates. Built on ZKSync Era (Sepolia Testnet) with a multi-role approval workflow, IPFS document storage, and a Next.js frontend.

---

## Table of Contents

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

## Overview

Traditional academic certificates are paper-based and vulnerable to forgery. This system replaces them with tamper-proof, on-chain records. Each certificate goes through a structured multi-step approval process involving the Department, HOD, Dean, Finance, and Registrar before it is issued with an IPFS-linked document. Any third party can verify certificate authenticity directly on-chain without trusting a central authority.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Next.js Frontend                    │
│   (ThirdWeb SDK · MetaMask · TailwindCSS · TypeScript)  │
└────────────────────────┬────────────────────────────────┘
                         │ RPC / Contract Calls
┌────────────────────────▼────────────────────────────────┐
│              ZKSync Era Sepolia Testnet                  │
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

## Smart Contracts

Located in `certificate-contract/contracts/`.

### `AccessControl.sol`
Manages all system roles. Only the **Owner** can grant or revoke roles.

| Role | Description |
|------|-------------|
| Owner | Deploys contracts, manages all roles |
| Department | Registers student applications |
| HOD | First-level approval/rejection |
| Dean | Second-level approval/rejection |
| Finance | Third-level approval/rejection |
| Registrar | Final issuer — uploads IPFS hash and issues certificate |

### `CertificateManagement.sol`
Core contract. Stores `StudentRecord` structs, enforces the approval pipeline, and emits events for every state transition.

Key fields stored per student:
- Personal info: name, registration number, branch, email, institution, graduation year
- Academic info: CGPA (×100 for precision), credits completed
- Wallet: student's wallet address for certificate delivery
- Status: `PENDING_HOD` → `PENDING_DEAN` → `PENDING_FINANCE` → `PENDING_REGISTRAR` → `ISSUED` / `REJECTED`
- Approval flags: per-role boolean tracking
- Rejection info: reason, rejected-by address, timestamp, level
- IPFS hash: on-chain reference to the certificate document

### `IPFSStorage.sol`
Stores and validates IPFS hashes on-chain. Prevents duplicate hashes, supports certificate revocation, and is callable only by the `CertificateManagement` contract.

---

## Certificate Workflow

```
Department
   │
   │  registerStudent()
   ▼
PENDING_HOD ──► HOD rejectByHOD() ──► REJECTED (appeal possible)
   │
   │  approveByHOD()
   ▼
PENDING_DEAN ──► Dean rejectByDean() ──► REJECTED
   │
   │  approveByDean()
   ▼
PENDING_FINANCE ──► Finance rejectByFinance() ──► REJECTED
   │
   │  approveByFinance()
   ▼
PENDING_REGISTRAR ──► Registrar rejectByRegistrar() ──► REJECTED
   │
   │  issueCertificate(ipfsHash)
   ▼
  ISSUED  ✅
```

At any rejection stage, the student can submit an **appeal** which resets the record back into the approval pipeline.

---

## Roles & Permissions

| Action | Allowed Role |
|--------|-------------|
| Add/remove roles | Owner |
| Register student | Department |
| Approve / Reject (level 1) | HOD |
| Approve / Reject (level 2) | Dean |
| Approve / Reject (level 3) | Finance |
| Issue certificate | Registrar |
| View all records | Admin / Owner |
| View own record | Student (by wallet) |
| Verify certificate | Public (no wallet required) |

---

## Tech Stack

### Frontend (`certificate-app/`)
| Technology | Version | Purpose |
|-----------|---------|---------|
| Next.js | 15.x | React framework (App Router) |
| React | 19.x | UI library |
| TypeScript | 5.x | Type safety |
| TailwindCSS | 3.x | Styling |
| ThirdWeb SDK | v5 | Wallet connection & contract interaction |
| Web3.js | 4.x | Ethereum utilities |

### Smart Contracts (`certificate-contract/`)
| Technology | Version | Purpose |
|-----------|---------|---------|
| Solidity | ^0.8.19 | Smart contract language |
| Hardhat | 2.x | Development & deployment framework |
| ZKSync zksolc | 1.4.1 | ZK-optimized Solidity compiler |
| @matterlabs/hardhat-zksync-solc | 1.x | Hardhat ZKSync plugin |
| ThirdWeb CLI | latest | Contract deployment helper |
| zksync-ethers | 5.x | ZKSync-specific ethers utilities |

### Network
- **Development/Testnet**: ZKSync Era Sepolia Testnet (Chain ID: 300)
- **Mainnet**: ZKSync Era Mainnet (Chain ID: 324)
- **Wallet**: MetaMask

---

## Project Structure

```
Academic_certificate5/
├── certificate-app/                 # Next.js frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx             # Landing / home page
│   │   │   ├── client.ts            # ThirdWeb client config
│   │   │   ├── layout.tsx           # Root layout
│   │   │   ├── globals.css          # Global styles
│   │   │   ├── admin/page.tsx       # Admin dashboard
│   │   │   ├── owner/page.tsx       # Owner: role management
│   │   │   ├── dean/page.tsx        # Dean: approval portal
│   │   │   ├── finance/page.tsx     # Finance: approval portal
│   │   │   ├── hod/page.tsx         # HOD: approval portal
│   │   │   ├── registrar/page.tsx   # Registrar: certificate issuance
│   │   │   ├── student/page.tsx     # Student: track application
│   │   │   ├── verify/page.tsx      # Public certificate verifier
│   │   │   └── explorer/page.tsx    # Certificate explorer
│   │   └── component/
│   │       └── TransactionTrail.tsx # Tx history component
│   ├── package.json
│   ├── tailwind.config.ts
│   └── tsconfig.json
│
└── certificate-contract/            # Hardhat smart contract project
    ├── contracts/
    │   ├── AccessControl.sol        # Role-based access control
    │   ├── CertificateManagement.sol# Core workflow contract
    │   ├── IPFSStorage.sol          # IPFS hash registry
    │   └── Contract.sol             # Utility / base contract
    ├── scripts/
    │   └── verify/my-contract.js    # Contract verification script
    ├── artifacts-zk/                # ZKSync compiled artifacts
    ├── cache-zk/                    # Compiler cache
    ├── hardhat.config.js            # Hardhat + ZKSync configuration
    └── package.json
```

---

## Getting Started

### Prerequisites

- Node.js >= 18.x
- npm or yarn
- MetaMask browser extension
- A ThirdWeb account and Client ID ([thirdweb.com](https://thirdweb.com))
- Test ETH on ZKSync Sepolia ([ZKSync faucet](https://faucet.quicknode.com/zksync/sepolia))

---

### Contract Deployment

```bash
cd certificate-contract
npm install
```

Deploy to ZKSync Sepolia via ThirdWeb:

```bash
npm run deploy
```

This runs `npx thirdweb@latest deploy` which compiles with `zksolc` and guides you through the deployment UI.

**Deployment order matters:**

1. Deploy `AccessControl.sol`
2. Deploy `IPFSStorage.sol`
3. Deploy `CertificateManagement.sol` with the addresses of steps 1 and 2 as constructor arguments
4. Call `setCertificateContract()` on `IPFSStorage` with the `CertificateManagement` address

After deployment, use the **Owner** portal to assign roles (Department, HOD, Dean, Finance, Registrar) to the appropriate wallet addresses.

---

### Frontend Setup

```bash
cd certificate-app
npm install
```

Create a `.env.local` file (see [Environment Variables](#environment-variables)), then:

```bash
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

Create `certificate-app/.env.local`:

```env
# ThirdWeb Client ID from https://thirdweb.com/dashboard
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=your_thirdweb_client_id

# Deployed contract addresses (ZKSync Sepolia)
NEXT_PUBLIC_ACCESS_CONTROL_ADDRESS=0x...
NEXT_PUBLIC_CERTIFICATE_MANAGEMENT_ADDRESS=0x...
NEXT_PUBLIC_IPFS_STORAGE_ADDRESS=0x...
```

---

## Application Pages

| Route | Role | Description |
|-------|------|-------------|
| `/` | Public | Landing page, wallet connection, network check |
| `/owner` | Owner | Grant/revoke roles for all departments |
| `/admin` | Admin | View all student records and system status |
| `/dean` | Dean | Approve or reject pending applications |
| `/finance` | Finance | Approve or reject financially-cleared applications |
| `/hod` | HOD | First-line approval of student applications |
| `/registrar` | Registrar | Upload IPFS hash and issue final certificates |
| `/student` | Student | Track application status and view issued certificate |
| `/verify` | Public | Verify any certificate by registration number |
| `/explorer` | Public | Browse all issued certificates |

---

## License

This project is licensed under the [MIT License](https://opensource.org/licenses/MIT).
