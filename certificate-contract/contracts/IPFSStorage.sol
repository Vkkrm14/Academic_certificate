// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract IPFSStorage {
    
    address public owner;
    address public certificateContract;
    
    struct Certificate {
        string regNo;
        string ipfsHash;
        string studentName;
        uint256 timestamp;
        bool exists;
    }
    
    mapping(string => Certificate) private certificates; // regNo => Certificate
    mapping(string => bool) private ipfsHashExists; // Prevent duplicate hashes
    string[] private allRegNos;
    
    event CertificateStored(
        string indexed regNo,
        string ipfsHash,
        string studentName,
        uint256 timestamp
    );
    
    event CertificateUpdated(
        string indexed regNo,
        string oldHash,
        string newHash,
        uint256 timestamp
    );
    
    event CertificateRevoked(
        string indexed regNo,
        string reason,
        uint256 timestamp
    );
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner allowed");
        _;
    }
    
    modifier onlyCertificateContract() {
        require(
            msg.sender == certificateContract,
            "Only Certificate contract allowed"
        );
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    function setCertificateContract(address _certificateContract) external onlyOwner {
        require(_certificateContract != address(0), "Invalid address");
        certificateContract = _certificateContract;
    }
    
    // Store certificate IPFS hash
    function storeCertificate(
        string memory _regNo,
        string memory _ipfsHash,
        string memory _studentName
    ) external onlyCertificateContract {
        require(bytes(_regNo).length > 0, "Registration number required");
        require(bytes(_ipfsHash).length > 0, "IPFS hash required");
        require(!ipfsHashExists[_ipfsHash], "IPFS hash already exists");
        
        if (certificates[_regNo].exists) {
            // Update existing certificate
            string memory oldHash = certificates[_regNo].ipfsHash;
            ipfsHashExists[oldHash] = false;
            
            certificates[_regNo].ipfsHash = _ipfsHash;
            certificates[_regNo].timestamp = block.timestamp;
            ipfsHashExists[_ipfsHash] = true;
            
            emit CertificateUpdated(_regNo, oldHash, _ipfsHash, block.timestamp);
        } else {
            // Store new certificate
            certificates[_regNo] = Certificate({
                regNo: _regNo,
                ipfsHash: _ipfsHash,
                studentName: _studentName,
                timestamp: block.timestamp,
                exists: true
            });
            
            ipfsHashExists[_ipfsHash] = true;
            allRegNos.push(_regNo);
            
            emit CertificateStored(_regNo, _ipfsHash, _studentName, block.timestamp);
        }
    }
    
    // Revoke certificate (in case of fraud or error)
    function revokeCertificate(
        string memory _regNo,
        string memory _reason
    ) external onlyOwner {
        require(certificates[_regNo].exists, "Certificate not found");
        require(bytes(_reason).length > 0, "Reason required");
        
        string memory ipfsHash = certificates[_regNo].ipfsHash;
        ipfsHashExists[ipfsHash] = false;
        delete certificates[_regNo];
        
        emit CertificateRevoked(_regNo, _reason, block.timestamp);
    }
    
    // View functions
    function getCertificate(string memory _regNo) 
        external 
        view 
        returns (Certificate memory) 
    {
        require(certificates[_regNo].exists, "Certificate not found");
        return certificates[_regNo];
    }
    
    function getIPFSHash(string memory _regNo) 
        external 
        view 
        returns (string memory) 
    {
        require(certificates[_regNo].exists, "Certificate not found");
        return certificates[_regNo].ipfsHash;
    }
    
    function verifyCertificate(string memory _regNo, string memory _ipfsHash) 
        external 
        view 
        returns (bool) 
    {
        if (!certificates[_regNo].exists) {
            return false;
        }
        return keccak256(bytes(certificates[_regNo].ipfsHash)) == 
               keccak256(bytes(_ipfsHash));
    }
    
    function getTotalCertificates() external view returns (uint256) {
        return allRegNos.length;
    }
    
    function getAllRegistrationNumbers() external view returns (string[] memory) {
        return allRegNos;
    }
    
    function certificateExists(string memory _regNo) external view returns (bool) {
        return certificates[_regNo].exists;
    }
}
