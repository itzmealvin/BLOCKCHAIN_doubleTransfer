// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Percentages.sol";

contract DoubleTransfer is Percentages {
    enum Stages {
        CANCELLED,
        INIT,
        SENT
    }

    struct Order {
        uint256 nonce;
        address sender;
        address receiver;
        uint256 amount;
        Stages stage;
    }

    mapping(address => mapping(uint => Order)) userOrders;
    mapping(address => uint) userNonce;
    address owner;
    uint256 escrowAmount;
    uint256 rate = 11_000;

    constructor() payable {
        owner = msg.sender;
        address(this).call{value: 10 ether}("");
    }

    function initializaOrder(address _receiver, uint _amount) external payable {
        require(_amount > 0, "Must send Ether with the function call");
        (bool s, ) = address(this).call{value: calculate(_amount, rate)}("");
        require(s, "Error in transfer");
        escrowAmount += _amount;
        userOrders[msg.sender][userNonce[msg.sender]++] = Order(
            userNonce[msg.sender],
            msg.sender,
            _receiver,
            _amount,
            Stages.INIT
        );
    }

    function confirmOrder(uint _nonce) external payable {
        Order storage orderDetails = userOrders[msg.sender][_nonce];
        require(orderDetails.stage == Stages.INIT, "Order completed");
        orderDetails.stage = Stages.SENT;
        (bool s, ) = orderDetails.receiver.call{value: orderDetails.amount}("");
        require(s, "Error in transfer");
        escrowAmount -= orderDetails.amount;
    }

    function modifySender(uint _nonce, address _newSender) external {
        Order storage orderDetails = userOrders[msg.sender][_nonce];
        require(orderDetails.stage == Stages.INIT, "Order completed");
        orderDetails.receiver = _newSender;
    }

    function cancelOrder(uint _nonce) external {
        Order storage orderDetails = userOrders[msg.sender][_nonce];
        require(orderDetails.stage == Stages.INIT, "Order completed");
        orderDetails.stage = Stages.CANCELLED;
    }

    function viewOrder(uint _nonce) external view returns (Order memory) {
        return userOrders[msg.sender][_nonce];
    }

    function withdrawFee() external payable {
        require(owner == msg.sender);
        (bool s, ) = payable(owner).call{
            value: address(this).balance - escrowAmount
        }("");
        require(s);
    }

    function modifyRate(uint256 _newRate) external {
        require(owner == msg.sender && _newRate > 11_000);
        rate = _newRate;
    }
}
