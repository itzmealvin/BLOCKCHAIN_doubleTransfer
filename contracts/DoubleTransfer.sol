// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract DoubleTransfer {
    enum Stages {
        CANCELLED,
        INIT,
        SENT
    }

    struct Order {
        uint256 nonce;
        uint256 time;
        address sender;
        address receiver;
        uint256 amount;
        Stages stage;
    }

    mapping(address => mapping(uint => Order)) userOrders;
    mapping(address => uint) userCurrentNonce;
    mapping(address => uint[]) userNonces;
    address public owner;
    uint256 public escrowAmount;

    constructor() payable {
        owner = msg.sender;
    }

    receive() external payable {}

    function initializeOrder(address _receiver, uint256 _fee) external payable {
        require(msg.value > _fee, "Must send Ether with the function call");
        (bool s, ) = address(this).call{value: msg.value}("");
        require(s, "Error in transfer");
        escrowAmount += msg.value - _fee;
        userOrders[msg.sender][userCurrentNonce[msg.sender]++] = Order(
            userCurrentNonce[msg.sender],
            block.timestamp,
            msg.sender,
            _receiver,
            msg.value - _fee,
            Stages.INIT
        );
        userNonces[msg.sender].push(userCurrentNonce[msg.sender]);
    }

    function confirmOrder(uint _nonce) external payable {
        Order storage orderDetails = userOrders[msg.sender][_nonce];
        require(
            orderDetails.stage == Stages.INIT,
            "Order completed or not existed"
        );
        (bool s, ) = orderDetails.receiver.call{value: orderDetails.amount}("");
        require(s, "Error in transfer");
        orderDetails.stage = Stages.SENT;
        escrowAmount -= orderDetails.amount;
    }

    function modifySender(uint _nonce, address _newSender) external {
        Order storage orderDetails = userOrders[msg.sender][_nonce];
        require(
            orderDetails.stage == Stages.INIT,
            "Order completed or not existed"
        );
        orderDetails.receiver = _newSender;
    }

    function cancelOrder(uint _nonce) external {
        Order storage orderDetails = userOrders[msg.sender][_nonce];
        require(
            orderDetails.stage == Stages.INIT,
            "Order completed or not existed"
        );
        (bool s, ) = orderDetails.sender.call{value: orderDetails.amount}("");
        require(s, "Error in transfer");
        orderDetails.stage = Stages.CANCELLED;
        escrowAmount -= orderDetails.amount;
    }

    function viewOrder(uint _nonce) external view returns (Order memory) {
        return userOrders[msg.sender][_nonce];
    }

    function viewCurrentNonces() external view returns (uint[] memory) {
        return userNonces[msg.sender];
    }

    function viewContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function withdrawFee() external payable {
        require(owner == msg.sender);
        (bool s, ) = payable(owner).call{
            value: address(this).balance - escrowAmount
        }("");
        require(s);
    }

    function rechargeFee() external payable {
        require(owner == msg.sender);
        (bool s, ) = address(this).call{value: msg.value}("");
        require(s, "Error in transfer");
    }
}
