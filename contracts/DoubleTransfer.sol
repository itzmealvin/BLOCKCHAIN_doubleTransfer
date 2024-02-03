// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

contract DoubleTransfer {
    // create additional stats for contracts
    address payable public owner;
    uint64 public fee = 500_000 gwei;
    uint256 private totalEscrowing;
    uint256[2] public totalStats; // first is totalTxn, second is totalVolume
    Order[] public allOrders;

    // create enumurate Status
    enum Status {
        CANCELLED,
        CREATED,
        COMPLETED
    }

    // define the Order structure
    struct Order {
        uint256 orderId;
        uint256 timestamp;
        address receiver;
        uint256 amount;
    }

    // mapping to check orders, nonce, and stats
    mapping(address => uint[2]) private userStats; // first is userTxn, second is userVolume
    mapping(uint256 => Status) private orderStatus;
    mapping(uint256 => address) private orderSender;

    // create this event for our React.app to use
    event createOrder(address _receiver, uint256 _currentIndex);
    event confirmOrder(Order _orderCompleted);
    event changeReceiver(address _newReceiver);
    event cancelOrder(Order _orderCancelled);

    // set deployer address as the owner
    constructor() payable {
        owner = payable(msg.sender);
    }

    // enable to receive ethers
    receive() external payable {}

    // check if only the address of the owner
    modifier onlyOwner() {
        require(msg.sender == owner, "You are not the owner");
        _;
    }

    // check if only the sender of the order
    modifier onlySender(uint256 _orderId) {
        require(orderSender[_orderId] == msg.sender, "You are not the sender");
        _;
    }

    // check if order is valid and returns it
    modifier checkOrder(uint256 _orderId) {
        require(
            orderStatus[_orderId] != Status.COMPLETED ||
                orderStatus[_orderId] != Status.CANCELLED,
            "Order is either completed or cancelled"
        );
        _;
    }

    // step 1: initialize an order
    function createNewOrder(address _receiver) external payable {
        require(
            msg.value > fee,
            "Must send enough Ether with the function call"
        );
        (bool s, ) = address(this).call{value: msg.value}("");
        require(s, "Error in transfer");
        uint256 amount = msg.value - fee;
        totalEscrowing += amount;
        Order memory tempOrder = Order(
            allOrders.length,
            block.timestamp,
            _receiver,
            amount
        );
        allOrders.push(tempOrder);
        orderStatus[tempOrder.orderId] = Status.CREATED;
        orderSender[tempOrder.orderId] = msg.sender;
        totalStats[0]++;
        userStats[msg.sender][0]++; // this is the total txns of the sender
    }

    // step 2a: confirm this order, this cannot be undone
    function confirmCurrentOrder(
        uint _orderId
    ) external payable onlySender(_orderId) checkOrder(_orderId) {
        Order storage selectedOrder = allOrders[_orderId];
        (bool s, ) = selectedOrder.receiver.call{value: selectedOrder.amount}(
            ""
        );
        require(s, "Error in transfer");
        orderStatus[_orderId] = Status.COMPLETED;
        uint256 amount = selectedOrder.amount;
        totalEscrowing -= amount;
        totalStats[1] += amount;
        userStats[msg.sender][1] += amount; // this is the the volume of sender
    }

    // step 2b: modify receiver in case of mistakes
    function modifyCurrentReceiver(
        uint _orderId,
        address _newReceiver
    ) external onlySender(_orderId) checkOrder(_orderId) {
        Order storage selectedOrder = allOrders[_orderId];
        selectedOrder.receiver = _newReceiver;
    }

    // step 2c: cancel order if no longer want to transfer
    function cancelCurrentOrder(
        uint _orderId
    ) external onlySender(_orderId) checkOrder(_orderId) {
        Order storage selectedOrder = allOrders[_orderId];
        (bool s, ) = msg.sender.call{value: selectedOrder.amount}("");
        require(s, "Error in transfer");
        orderStatus[_orderId] = Status.CANCELLED;
        totalEscrowing -= selectedOrder.amount;
        userStats[msg.sender][0]--; // this is the total txns of the sender
    }

    // view specific order
    function viewOrder(uint _orderId) external view returns (Order memory) {
        return allOrders[_orderId];
    }

    // view current order sender
    function viewOrderSender(uint _orderId) external view returns (address) {
        return orderSender[_orderId];
    }

    // view current order status
    function viewOrderStatus(uint _orderId) external view returns (Status) {
        return orderStatus[_orderId];
    }

    // view all orders of current address
    function viewAllOrderIdsOfAddress()
        external
        view
        returns (uint256[] memory)
    {
        uint256[] memory results = new uint256[](totalStats[0]);
        uint counter = 0;
        for (uint i = 0; i < allOrders.length; i++) {
            if (orderSender[i] == msg.sender) {
                results[counter] = i;
                counter++;
            }
        }
        return results;
    }

    // view current user stats
    function viewUserCurrentStats() external view returns (uint[2] memory) {
        return userStats[msg.sender];
    }

    // view current protocol stats
    function viewTotalCurrentStats() external view returns (uint[2] memory) {
        return totalStats;
    }

    // view current fee
    function viewCurrentFee() public view returns (uint256) {
        return fee;
    }

    // FOR OWNER: view available fee to withdraw
    function viewAvailableFee() public view returns (uint256) {
        return address(this).balance - totalEscrowing - fee;
    }

    // FOR OWNER: set new fee to charge
    function setNewFee(uint64 _newFee) external onlyOwner {
        require(_newFee >= fee);
        fee = _newFee;
    }

    // FOR OWNER: withdraw available fee
    function withdrawFee() external payable onlyOwner {
        uint256 availableFee = viewAvailableFee();
        require(availableFee > 0, "Not enough fee to withdraw");
        (bool s, ) = owner.call{value: availableFee}("");
        require(s);
    }

    // FOR OWNER: replenish new fee for contract
    function rechargeFee() external payable onlyOwner {
        (bool s, ) = address(this).call{value: msg.value}("");
        require(s, "Error in transfer");
    }

    // FOR OWNER: self-destruct the contract
    function close() external onlyOwner {
        require(totalEscrowing == 0, "There is still users' escrowed here");
        selfdestruct(owner);
    }
}
