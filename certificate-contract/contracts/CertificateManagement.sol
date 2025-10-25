// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./AccessControl.sol";
import "./IPFSStorage.sol";

contract CertificateManagement {
    
    AccessControl public accessControl;
    IPFSStorage public ipfsStorage;
    
    struct StudentRecord {
        string name;
        string regNo;
        string branch;
        string email;
        uint256 cgpa; // Stored as cgpa * 100 (e.g., 850 = 8.50)
        uint256 creditsCompleted;
        
        // NEW FIELDS
        address studentWalletAddress;  // Student's wallet for certificate delivery
        string institutionName;
        uint256 graduationYear;
        
        // Status tracking
        string status; // PENDING_HOD, PENDING_DEAN, PENDING_FINANCE, PENDING_REGISTRAR, ISSUED, REJECTED
        
        // Approval tracking
        bool hodApproved;
        bool deanApproved;
        bool financeApproved;
        bool registrarIssued;
        
        // Rejection tracking
        bool isRejected;
        string rejectionReason;
        address rejectedBy;
        uint256 rejectionTimestamp;
        string rejectionLevel;
        
        // Verifier addresses
        address departmentVerifier;
        address hodVerifier;
        address deanVerifier;
        address financeVerifier;
        address registrarVerifier;
        
        // IPFS integration
        string ipfsHash;
        
        // Timestamps
        uint256 applicationTimestamp;
        uint256 issuanceTimestamp;
    }
    
    mapping(string => StudentRecord) private studentRecords;
    string[] private allRegistrations;
    
    // Events
    event StudentRegistered(
        string indexed regNo,
        string name,
        address studentWallet,
        address indexed registeredBy,
        uint256 timestamp
    );
    
    event ApplicationApproved(
        string indexed regNo,
        address indexed approvedBy,
        string approvalLevel,
        uint256 timestamp
    );
    
    event ApplicationRejected(
        string indexed regNo,
        address indexed rejectedBy,
        string rejectionLevel,
        string reason,
        uint256 timestamp
    );
    
    event RejectionAppealed(
        string indexed regNo,
        address indexed appealedBy,
        string appealReason,
        uint256 timestamp
    );
    
    event CertificateIssued(
        string indexed regNo,
        address indexed issuedBy,
        address indexed studentWallet,
        string ipfsHash,
        uint256 timestamp
    );
    
    // Modifiers
    modifier onlyDepartment() {
        require(accessControl.isDepartment(msg.sender), "Only Department allowed");
        _;
    }
    
    modifier onlyHOD() {
        require(accessControl.isHOD(msg.sender), "Only HOD allowed");
        _;
    }
    
    modifier onlyDean() {
        require(accessControl.isDean(msg.sender), "Only Dean allowed");
        _;
    }
    
    modifier onlyFinance() {
        require(accessControl.isFinance(msg.sender), "Only Finance allowed");
        _;
    }
    
    modifier onlyRegistrar() {
        require(accessControl.isRegistrar(msg.sender), "Only Registrar allowed");
        _;
    }
    
    modifier studentExists(string memory regNo) {
        require(bytes(studentRecords[regNo].name).length > 0, "Student not found");
        _;
    }
    
    modifier notRejected(string memory regNo) {
        require(!studentRecords[regNo].isRejected, "Application has been rejected");
        _;
    }
    
    constructor(address _accessControlAddress, address _ipfsStorageAddress) {
        accessControl = AccessControl(_accessControlAddress);
        ipfsStorage = IPFSStorage(_ipfsStorageAddress);
    }
    
    // STUDENT REGISTRATION - UPDATED WITH NEW FIELDS
    function registerStudent(
        string memory _name,
        string memory _regNo,
        string memory _branch,
        string memory _email,
        uint256 _cgpa,
        uint256 _creditsCompleted,
        address _studentWalletAddress,    // NEW
        string memory _institutionName,   // NEW
        uint256 _graduationYear          // NEW
    ) external onlyDepartment {
        require(bytes(studentRecords[_regNo].name).length == 0, "Student already registered");
        require(bytes(_name).length > 0, "Name required");
        require(bytes(_regNo).length > 0, "Registration number required");
        require(_cgpa <= 1000, "Invalid CGPA"); // Max 10.00
        require(_studentWalletAddress != address(0), "Invalid student wallet address");
        require(bytes(_institutionName).length > 0, "Institution name required");
        require(_graduationYear >= 2000 && _graduationYear <= 2100, "Invalid graduation year");
        
        StudentRecord storage newStudent = studentRecords[_regNo];
        newStudent.name = _name;
        newStudent.regNo = _regNo;
        newStudent.branch = _branch;
        newStudent.email = _email;
        newStudent.cgpa = _cgpa;
        newStudent.creditsCompleted = _creditsCompleted;
        newStudent.studentWalletAddress = _studentWalletAddress;  // NEW
        newStudent.institutionName = _institutionName;            // NEW
        newStudent.graduationYear = _graduationYear;              // NEW
        newStudent.status = "PENDING_HOD";
        newStudent.departmentVerifier = msg.sender;
        newStudent.applicationTimestamp = block.timestamp;
        
        allRegistrations.push(_regNo);
        
        emit StudentRegistered(_regNo, _name, _studentWalletAddress, msg.sender, block.timestamp);
    }
    
    // HOD APPROVAL
    function approveByHOD(string memory regNo) 
        external 
        onlyHOD 
        studentExists(regNo) 
        notRejected(regNo) 
    {
        StudentRecord storage record = studentRecords[regNo];
        require(
            keccak256(bytes(record.status)) == keccak256(bytes("PENDING_HOD")),
            "Not pending HOD approval"
        );
        
        record.hodApproved = true;
        record.hodVerifier = msg.sender;
        record.status = "PENDING_DEAN";
        
        emit ApplicationApproved(regNo, msg.sender, "HOD", block.timestamp);
    }
    
    // HOD REJECTION
    function rejectByHOD(
        string memory regNo,
        string memory reason
    ) external onlyHOD studentExists(regNo) {
        StudentRecord storage record = studentRecords[regNo];
        require(
            keccak256(bytes(record.status)) == keccak256(bytes("PENDING_HOD")),
            "Not pending HOD approval"
        );
        require(bytes(reason).length > 0, "Rejection reason required");
        
        record.isRejected = true;
        record.status = "REJECTED";
        record.rejectionReason = reason;
        record.rejectedBy = msg.sender;
        record.rejectionTimestamp = block.timestamp;
        record.rejectionLevel = "HOD";
        
        emit ApplicationRejected(regNo, msg.sender, "HOD", reason, block.timestamp);
    }
    
    // DEAN APPROVAL
    function approveByDean(string memory regNo) 
        external 
        onlyDean 
        studentExists(regNo) 
        notRejected(regNo) 
    {
        StudentRecord storage record = studentRecords[regNo];
        require(
            keccak256(bytes(record.status)) == keccak256(bytes("PENDING_DEAN")),
            "Not pending Dean approval"
        );
        require(record.hodApproved, "HOD approval required first");
        
        record.deanApproved = true;
        record.deanVerifier = msg.sender;
        record.status = "PENDING_FINANCE";
        
        emit ApplicationApproved(regNo, msg.sender, "DEAN", block.timestamp);
    }
    
    // DEAN REJECTION
    function rejectByDean(
        string memory regNo,
        string memory reason
    ) external onlyDean studentExists(regNo) {
        StudentRecord storage record = studentRecords[regNo];
        require(
            keccak256(bytes(record.status)) == keccak256(bytes("PENDING_DEAN")),
            "Not pending Dean approval"
        );
        require(bytes(reason).length > 0, "Rejection reason required");
        
        record.isRejected = true;
        record.status = "REJECTED";
        record.rejectionReason = reason;
        record.rejectedBy = msg.sender;
        record.rejectionTimestamp = block.timestamp;
        record.rejectionLevel = "DEAN";
        
        emit ApplicationRejected(regNo, msg.sender, "DEAN", reason, block.timestamp);
    }
    
    // FINANCE APPROVAL
    function approveByFinance(string memory regNo) 
        external 
        onlyFinance 
        studentExists(regNo) 
        notRejected(regNo) 
    {
        StudentRecord storage record = studentRecords[regNo];
        require(
            keccak256(bytes(record.status)) == keccak256(bytes("PENDING_FINANCE")),
            "Not pending Finance approval"
        );
        require(record.deanApproved, "Dean approval required first");
        
        record.financeApproved = true;
        record.financeVerifier = msg.sender;
        record.status = "PENDING_REGISTRAR";
        
        emit ApplicationApproved(regNo, msg.sender, "FINANCE", block.timestamp);
    }
    
    // FINANCE REJECTION
    function rejectByFinance(
        string memory regNo,
        string memory reason
    ) external onlyFinance studentExists(regNo) {
        StudentRecord storage record = studentRecords[regNo];
        require(
            keccak256(bytes(record.status)) == keccak256(bytes("PENDING_FINANCE")),
            "Not pending Finance approval"
        );
        require(bytes(reason).length > 0, "Rejection reason required");
        
        record.isRejected = true;
        record.status = "REJECTED";
        record.rejectionReason = reason;
        record.rejectedBy = msg.sender;
        record.rejectionTimestamp = block.timestamp;
        record.rejectionLevel = "FINANCE";
        
        emit ApplicationRejected(regNo, msg.sender, "FINANCE", reason, block.timestamp);
    }
    
    // REGISTRAR ISSUANCE - UPDATED TO USE STUDENT WALLET
    function issueCertificate(
        string memory regNo,
        string memory ipfsHash
    ) external onlyRegistrar studentExists(regNo) notRejected(regNo) {
        StudentRecord storage record = studentRecords[regNo];
        require(
            keccak256(bytes(record.status)) == keccak256(bytes("PENDING_REGISTRAR")),
            "Not pending Registrar issuance"
        );
        require(record.financeApproved, "Finance approval required first");
        require(bytes(ipfsHash).length > 0, "IPFS hash required");
        
        record.registrarIssued = true;
        record.registrarVerifier = msg.sender;
        record.status = "ISSUED";
        record.ipfsHash = ipfsHash;
        record.issuanceTimestamp = block.timestamp;
        
        // Store in IPFS contract with student wallet address
        ipfsStorage.storeCertificate(regNo, ipfsHash, record.name);
        
        emit CertificateIssued(regNo, msg.sender, record.studentWalletAddress, ipfsHash, block.timestamp);
    }
    
    // REGISTRAR REJECTION
    function rejectByRegistrar(
        string memory regNo,
        string memory reason
    ) external onlyRegistrar studentExists(regNo) {
        StudentRecord storage record = studentRecords[regNo];
        require(
            keccak256(bytes(record.status)) == keccak256(bytes("PENDING_REGISTRAR")),
            "Not pending Registrar issuance"
        );
        require(bytes(reason).length > 0, "Rejection reason required");
        
        record.isRejected = true;
        record.status = "REJECTED";
        record.rejectionReason = reason;
        record.rejectedBy = msg.sender;
        record.rejectionTimestamp = block.timestamp;
        record.rejectionLevel = "REGISTRAR";
        
        emit ApplicationRejected(regNo, msg.sender, "REGISTRAR", reason, block.timestamp);
    }
    
    // APPEAL MECHANISM
    function appealRejection(
        string memory regNo,
        string memory appealReason
    ) external onlyDepartment studentExists(regNo) {
        StudentRecord storage record = studentRecords[regNo];
        require(record.isRejected, "Application not rejected");
        require(bytes(appealReason).length > 0, "Appeal reason required");
        
        record.isRejected = false;
        
        if (keccak256(bytes(record.rejectionLevel)) == keccak256(bytes("HOD"))) {
            record.status = "PENDING_HOD";
            record.hodApproved = false;
        } else if (keccak256(bytes(record.rejectionLevel)) == keccak256(bytes("DEAN"))) {
            record.status = "PENDING_DEAN";
            record.deanApproved = false;
        } else if (keccak256(bytes(record.rejectionLevel)) == keccak256(bytes("FINANCE"))) {
            record.status = "PENDING_FINANCE";
            record.financeApproved = false;
        } else if (keccak256(bytes(record.rejectionLevel)) == keccak256(bytes("REGISTRAR"))) {
            record.status = "PENDING_REGISTRAR";
            record.registrarIssued = false;
        }
        
        emit RejectionAppealed(regNo, msg.sender, appealReason, block.timestamp);
    }
    
    // VIEW FUNCTIONS
    
    function getStudentRecord(string memory regNo) 
        external 
        view 
        studentExists(regNo)
        returns (StudentRecord memory) 
    {
        return studentRecords[regNo];
    }
    
    function getPendingApprovals(string memory level) 
        external 
        view 
        returns (string[] memory) 
    {
        uint256 count = 0;
        for (uint256 i = 0; i < allRegistrations.length; i++) {
            if (keccak256(bytes(studentRecords[allRegistrations[i]].status)) == 
                keccak256(bytes(level))) {
                count++;
            }
        }
        
        string[] memory pending = new string[](count);
        uint256 index = 0;
        
        for (uint256 i = 0; i < allRegistrations.length; i++) {
            if (keccak256(bytes(studentRecords[allRegistrations[i]].status)) == 
                keccak256(bytes(level))) {
                pending[index] = allRegistrations[i];
                index++;
            }
        }
        
        return pending;
    }
    
    function getRejectedApplications() external view returns (string[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < allRegistrations.length; i++) {
            if (studentRecords[allRegistrations[i]].isRejected) {
                count++;
            }
        }
        
        string[] memory rejected = new string[](count);
        uint256 index = 0;
        
        for (uint256 i = 0; i < allRegistrations.length; i++) {
            if (studentRecords[allRegistrations[i]].isRejected) {
                rejected[index] = allRegistrations[i];
                index++;
            }
        }
        
        return rejected;
    }
    
    function getRejectionDetails(string memory regNo) 
        external 
        view 
        studentExists(regNo)
        returns (
            bool isRejected,
            string memory reason,
            address rejectedBy,
            uint256 timestamp,
            string memory level
        ) 
    {
        StudentRecord memory record = studentRecords[regNo];
        return (
            record.isRejected,
            record.rejectionReason,
            record.rejectedBy,
            record.rejectionTimestamp,
            record.rejectionLevel
        );
    }
    
    function getTotalApplications() external view returns (uint256) {
        return allRegistrations.length;
    }
    
    function getIssuedCertificates() external view returns (string[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < allRegistrations.length; i++) {
            if (keccak256(bytes(studentRecords[allRegistrations[i]].status)) == 
                keccak256(bytes("ISSUED"))) {
                count++;
            }
        }
        
        string[] memory issued = new string[](count);
        uint256 index = 0;
        
        for (uint256 i = 0; i < allRegistrations.length; i++) {
            if (keccak256(bytes(studentRecords[allRegistrations[i]].status)) == 
                keccak256(bytes("ISSUED"))) {
                issued[index] = allRegistrations[i];
                index++;
            }
        }
        
        return issued;
    }
    
    // NEW HELPER FUNCTION - Get student wallet address
    function getStudentWallet(string memory regNo) 
        external 
        view 
        studentExists(regNo)
        returns (address) 
    {
        return studentRecords[regNo].studentWalletAddress;
    }
}
