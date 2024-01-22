// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

contract DoubleTransfer {
    // define the stages of order
    enum Stages {
        CANCELLED,
        INIT,
        SENT
    }

    // define the Order structure
    struct Order {
        uint256 nonce;
        uint256 time;
        address sender;
        address receiver;
        uint256 amount;
        Stages stage;
    }

    // create additional stats for contracts
    address payable public owner;
    uint256 public totalVolume;
    uint256 private escrowAmount;
    uint64 public fee = 100_000 gwei;

    // mapping to check orders, nonce, and stats
    mapping(address => mapping(uint => Order)) userOrders;
    mapping(address => uint) userCurrentNonce;
    mapping(address => uint[2]) userStats;
    mapping(address => uint[]) userNonces;

    // create this event for our React.app to use
    event initializeOrder(address _receiver);
    event confirmOrder(address _receiver);
    event changeReceiver(address _receiver);
    event cancelOrder(address _receiver);

    // set deployer address as the owner
    constructor() payable {
        owner = payable(msg.sender);
    }

    // enable to receive ethers
    receive() external payable {}

    // check if only the address of the owner
    modifier onlyOwner() {
        require(owner == msg.sender);
        _;
    }

    // prevent re-entrancy
    modifier onlyHuman() {
        uint size;
        address addr = msg.sender;
        assembly {
            size := extcodesize(addr)
        }
        require(size == 0, "ONLY HUMAN PLEASE");
        _;
    }

    // step 1: initialize an order
    function initializeNewOrder(address _receiver) external payable onlyHuman {
        require(msg.value > fee, "Must send Ether with the function call");
        (bool s, ) = address(this).call{value: msg.value}("");
        require(s, "Error in transfer");
        uint256 finalValue = msg.value - fee;
        escrowAmount += finalValue; // this is total held by protocol
        userOrders[msg.sender][userCurrentNonce[msg.sender]++] = Order(
            userCurrentNonce[msg.sender],
            block.timestamp,
            msg.sender,
            _receiver,
            finalValue,
            Stages.INIT
        );
        userNonces[msg.sender].push(userCurrentNonce[msg.sender]);
    }

    // step 2a: confirm this order, this cannot be undone
    function confirmCurrentOrder(uint _nonce) external payable onlyHuman {
        Order storage orderDetails = checkOrder(_nonce);
        (bool s, ) = orderDetails.receiver.call{value: orderDetails.amount}("");
        require(s, "Error in transfer");
        orderDetails.stage = Stages.SENT;
        uint256 actualAmount = orderDetails.amount;
        escrowAmount -= actualAmount;
        totalVolume += actualAmount; // this is the total volume of the protocol
        userStats[msg.sender][0]++; // this is the total txns of the sender
        userStats[msg.sender][1] += actualAmount; // this is the the volume of sender
    }

    // step 2b: modify receiver in case of mistakes
    function modifyCurrentReceiver(
        uint _nonce,
        address _newReceiver
    ) external onlyHuman {
        Order storage orderDetails = checkOrder(_nonce);
        orderDetails.receiver = _newReceiver;
    }

    // step 2c: cancel order if no longer want to transfer
    function cancelCurrentOrder(uint _nonce) external onlyHuman {
        Order storage orderDetails = checkOrder(_nonce);
        (bool s, ) = orderDetails.sender.call{value: orderDetails.amount}("");
        require(s, "Error in transfer");
        orderDetails.stage = Stages.CANCELLED;
        escrowAmount -= orderDetails.amount;
    }

    // view specific order
    function viewOrder(
        address _sender,
        uint _nonce
    ) external view returns (Order memory) {
        return userOrders[_sender][_nonce];
    }

    // check if order is valid and returns it
    function checkOrder(uint _nonce) private view returns (Order storage) {
        Order storage orderDetails = userOrders[msg.sender][_nonce];
        require(
            orderDetails.stage == Stages.INIT,
            "Order completed or not existed"
        );
        return orderDetails;
    }

    // view current sender nonces
    function viewCurrentNonces(
        address _sender
    ) external view returns (uint[] memory) {
        return userNonces[_sender];
    }

    // FOR OWNER: view available fee to withdraw
    function viewAvailableFee() public view returns (uint256) {
        return address(this).balance - escrowAmount;
    }

    // FOR OWNER: set new fee to charge
    function setNewFee(uint64 _newFee) external onlyOwner {
        fee = _newFee;
    }

    // FOR OWNER: withdraw available fee
    function withdrawFee() external payable onlyOwner {
        uint256 availableFee = viewAvailableFee();
        (bool s, ) = owner.call{value: availableFee}("");
        require(s);
    }

    // FOR OWNER: replenish new fee for contract
    function rechargeFee() external payable onlyOwner {
        (bool s, ) = address(this).call{value: msg.value}("");
        require(s, "Error in transfer");
    }

    // FOR OWNER: destruct the contract
    function close() public onlyOwner {
        require(escrowAmount == 0, "There is still users' escrowed here");
        selfdestruct(owner);
    }
}
