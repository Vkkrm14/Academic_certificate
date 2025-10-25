// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract AccessControl {
    
    address public owner;
    
    mapping(address => bool) private departments;
    mapping(address => bool) private hods;
    mapping(address => bool) private deans;
    mapping(address => bool) private finances;
    mapping(address => bool) private registrars;
    
    // Mapping to store institution names for each address
    mapping(address => string) private institutionNames;
    
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event DepartmentAdded(address indexed account, string institutionName);
    event HODAdded(address indexed account, string department);
    event DeanAdded(address indexed account, string institution);
    event FinanceAdded(address indexed account, string institution);
    event RegistrarAdded(address indexed account, string institution);
    
    event DepartmentRemoved(address indexed account);
    event HODRemoved(address indexed account);
    event DeanRemoved(address indexed account);
    event FinanceRemoved(address indexed account);
    event RegistrarRemoved(address indexed account);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "AccessControl: Only owner allowed");
        _;
    }
    
    modifier validAddress(address _account) {
        require(_account != address(0), "AccessControl: Invalid address");
        _;
    }
    
    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), owner);
    }
    
    // OWNER MANAGEMENT
    function transferOwnership(address newOwner) external onlyOwner validAddress(newOwner) {
        require(newOwner != owner, "AccessControl: Already owner");
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }
    
    // DEPARTMENT MANAGEMENT
    function addDepartment(address _account, string memory _institutionName) 
        external 
        onlyOwner 
        validAddress(_account) 
    {
        require(!departments[_account], "AccessControl: Already a department");
        departments[_account] = true;
        institutionNames[_account] = _institutionName;
        emit DepartmentAdded(_account, _institutionName);
    }
    
    function removeDepartment(address _account) external onlyOwner {
        require(departments[_account], "AccessControl: Not a department");
        departments[_account] = false;
        delete institutionNames[_account];
        emit DepartmentRemoved(_account);
    }
    
    // HOD MANAGEMENT
    function addHOD(address _account, string memory _department) 
        external 
        onlyOwner 
        validAddress(_account) 
    {
        require(!hods[_account], "AccessControl: Already a HOD");
        hods[_account] = true;
        institutionNames[_account] = _department;
        emit HODAdded(_account, _department);
    }
    
    function removeHOD(address _account) external onlyOwner {
        require(hods[_account], "AccessControl: Not a HOD");
        hods[_account] = false;
        delete institutionNames[_account];
        emit HODRemoved(_account);
    }
    
    // DEAN MANAGEMENT
    function addDean(address _account, string memory _institution) 
        external 
        onlyOwner 
        validAddress(_account) 
    {
        require(!deans[_account], "AccessControl: Already a dean");
        deans[_account] = true;
        institutionNames[_account] = _institution;
        emit DeanAdded(_account, _institution);
    }
    
    function removeDean(address _account) external onlyOwner {
        require(deans[_account], "AccessControl: Not a dean");
        deans[_account] = false;
        delete institutionNames[_account];
        emit DeanRemoved(_account);
    }
    
    // FINANCE MANAGEMENT
    function addFinance(address _account, string memory _institution) 
        external 
        onlyOwner 
        validAddress(_account) 
    {
        require(!finances[_account], "AccessControl: Already a finance officer");
        finances[_account] = true;
        institutionNames[_account] = _institution;
        emit FinanceAdded(_account, _institution);
    }
    
    function removeFinance(address _account) external onlyOwner {
        require(finances[_account], "AccessControl: Not a finance officer");
        finances[_account] = false;
        delete institutionNames[_account];
        emit FinanceRemoved(_account);
    }
    
    // REGISTRAR MANAGEMENT
    function addRegistrar(address _account, string memory _institution) 
        external 
        onlyOwner 
        validAddress(_account) 
    {
        require(!registrars[_account], "AccessControl: Already a registrar");
        registrars[_account] = true;
        institutionNames[_account] = _institution;
        emit RegistrarAdded(_account, _institution);
    }
    
    function removeRegistrar(address _account) external onlyOwner {
        require(registrars[_account], "AccessControl: Not a registrar");
        registrars[_account] = false;
        delete institutionNames[_account];
        emit RegistrarRemoved(_account);
    }
    
    // CHECK FUNCTIONS
    function isDepartment(address _account) external view returns (bool) {
        return departments[_account];
    }
    
    function isHOD(address _account) external view returns (bool) {
        return hods[_account];
    }
    
    function isDean(address _account) external view returns (bool) {
        return deans[_account];
    }
    
    function isFinance(address _account) external view returns (bool) {
        return finances[_account];
    }
    
    function isRegistrar(address _account) external view returns (bool) {
        return registrars[_account];
    }
    
    function getInstitutionName(address _account) external view returns (string memory) {
        return institutionNames[_account];
    }
    
    function hasAnyRole(address _account) external view returns (bool) {
        return departments[_account] || hods[_account] || deans[_account] || 
               finances[_account] || registrars[_account];
    }
}
