import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import truncateEthAddress from "truncate-eth-address";
import "./App.css";
import deployedAddress from "../contracts/contract-address.json";
import contractJSON from "../contracts/DoubleTransfer.json";

const App = () => {
  const [currentAccount, setCurrentAccount] = useState("");
  const [newOrder, setNewOrder] = useState({ address: "", value: "" });
  const [selectedId, setSelectedId] = useState({ orderId: "" });
  const [selectedOrder, setSelectedOrder] = useState([]);
  const [myOrderIds, setmyOrderIds] = useState([]);
  const [myStats, setMyStats] = useState([2]);
  const [protocolStats, setProtocolStats] = useState([2]);
  const [currentFee, setCurrentFee] = useState();
  const statusDict = {
    0: "CANCELLED",
    1: "CREATED",
    2: "COMPLETED",
  };

  const targetNetworkId = "0xaa36a7";
  const contractAddress = deployedAddress.address;
  const contractABI = contractJSON.abi;

  const checkNetwork = async () => {
    const currentChainId = await window.ethereum.request({
      method: "eth_chainId",
    });
    return currentChainId === targetNetworkId;
  };

  const switchNetwork = async () => {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: targetNetworkId }],
      });
    } catch (error) {
      if (error.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: targetNetworkId,
              rpcUrls: ["https://ethereum-sepolia.publicnode.com"],
              chainName: "Sepolia",
              nativeCurrency: {
                name: "ETH",
                symbol: "ETH",
                decimals: 18,
              },
              blockExplorerUrls: ["https://sepolia.etherscan.io/"],
            },
          ],
        });
      }
    }
  };

  const handleNetworkCheck = async () => {
    if (!(await checkNetwork())) {
      alert("Please switch to the right network");
      await switchNetwork();
      return false;
    }
    return true;
  };

  const checkIfWalletIsConnected = async () => {
    try {
      const { ethereum } = window;
      if (!ethereum) {
        alert("Metamask is not installed!");
        return;
      }

      const accounts = await ethereum.request({ method: "eth_accounts" });
      if (accounts.length !== 0) {
        setCurrentAccount(accounts[0]);
        await signMessage(accounts[0]);
        await viewAllOrderFn();
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        checkIfWalletIsConnected();
        window.ethereum.on("accountsChanged", function () {
          window.location.reload();
        });
      } catch (error) {
        console.error("Error in useEffect:", error);
      }
    };
    fetchData();
  }, []);

  const connectWallet = async () => {
    try {
      const { ethereum } = window;
      if (!ethereum) {
        alert("Get Metamask at https://metamask.io/!");
        return;
      }
      await handleNetworkCheck();
      const accounts = await ethereum.request({
        method: "eth_requestAccounts",
      });
      setCurrentAccount(accounts[0]);
      window.location.reload();
    } catch (error) {
      console.error(error);
    }
  };

  const signMessage = async (address) => {
    try {
      const message = "Sign this message to prove you are the owner";
      await window.ethereum.request({
        method: "personal_sign",
        params: [message, address],
      });
    } catch (error) {
      console.log(error);
    }
  };

  const getContract = () => {
    try {
      const { ethereum } = window;
      if (ethereum) {
        const provider = new ethers.providers.Web3Provider(ethereum);
        const signer = provider.getSigner();
        return new ethers.Contract(contractAddress, contractABI, signer);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const createNewOrderFn = async () => {
    await handleNetworkCheck();
    let totalAmount = (
      parseFloat(newOrder.value) + parseFloat(currentFee)
    ).toString();
    const txn = await getContract().createNewOrder(newOrder.address, {
      value: ethers.utils.parseUnits(totalAmount, 18),
    });
    await txn.wait();
    alert("Order created successfully!");
    await viewAllOrderFn();
  };

  const confirmCurrentOrderFn = async () => {
    await handleNetworkCheck();
    const txn = await getContract().confirmCurrentOrder(
      parseInt(selectedId.orderId, 10),
      {
        gasLimit: 100000,
      }
    );
    await txn.wait();
    alert("Order confirmed and sent to receiver");
    await viewAllOrderFn();
  };

  const modifyCurrentReceiverFn = async () => {
    await handleNetworkCheck();
    const txn = await getContract().modifyCurrentReceiver(
      selectedId.orderId,
      newOrder.address
    );
    await txn.wait();
    alert("Receiver modified to:" + newOrder.address);
    await viewAllOrderFn();
  };

  const cancelCurrentOrderFn = async () => {
    await handleNetworkCheck();
    const txn = await getContract().cancelCurrentOrder(
      parseInt(selectedId.orderId, 10),
      {
        gasLimit: 100000,
      }
    );
    await txn.wait();
    alert("Order cancelled and no longer be valid!");
    await viewAllOrderFn();
  };

  const viewOrderFn = async () => {
    try {
      const orderDetails = await Promise.all([
        getContract().viewOrder(parseInt(selectedId.orderId, 10)),
      ]);

      const orderDetailsCleaned = orderDetails.map((order) => ({
        id: order.orderId.toNumber(),
        timestamp: new Date(order.timestamp * 1000),
        receiver: order.receiver,
        amount: ethers.utils.formatEther(order.amount),
      }));
      orderDetailsCleaned[0].status =
        statusDict[
          await getContract().viewOrderStatus(parseInt(selectedId.orderId, 10))
        ];
      setSelectedOrder(orderDetailsCleaned);
    } catch (error) {
      console.error(error);
    }
  };

  const viewAllOrderFn = async () => {
    await handleNetworkCheck();
    try {
      const [idx, userStats, allStats, fee] = await Promise.all([
        getContract().viewAllOrderIdsOfAddress(),
        getContract().viewUserCurrentStats(),
        getContract().viewTotalCurrentStats(),
        getContract().viewCurrentFee(),
      ]);

      const idxArray = idx.map((orderIds) => orderIds.toNumber());
      const userArray = userStats.map((user, index) => {
        if (index === 0) {
          return user.toNumber();
        } else if (index === 1) {
          return ethers.utils.formatEther(user);
        }
      });
      const allArray = allStats.map((protocol, index) => {
        if (index === 0) {
          return protocol.toNumber();
        } else if (index === 1) {
          return ethers.utils.formatEther(protocol);
        }
      });
      setmyOrderIds(idxArray);
      setSelectedId({
        orderId: idxArray.length > 0 ? idxArray.slice(-1)[0] : "",
      });
      viewOrderFn();
      setMyStats(userArray);
      setProtocolStats(allArray);
      setCurrentFee(ethers.utils.formatEther(fee));
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="mainContainer">
      <div className="dataContainer">
        <div className="bio">
          Current Fee: {currentFee} ETH - All-time Order(s): {protocolStats[0]}{" "}
          - All-time Volume: {protocolStats[1]} ETH
        </div>
        <div className="header">Double Transfer Protocol</div>
        <div className="bio">Protocol to mitigate ZeroTransfer attack</div>
        <div className="bio">
          {!currentAccount ? (
            <>
              <p>Connect a Web3 wallet to begin</p>
              <button className="waveButton" onClick={connectWallet}>
                Connect Wallet
              </button>
            </>
          ) : (
            <p>
              Hello {truncateEthAddress(currentAccount)}! You have made{" "}
              {myStats[0]} order(s) with a total volume of {myStats[1]} ETH
              using this protocol!
            </p>
          )}
        </div>
        <input
          onChange={(e) =>
            setNewOrder({ ...newOrder, address: e.target.value })
          }
          value={newOrder.address}
          name="newOrder"
          className="textbox"
          placeholder="Address to transfer"
        />
        <input
          onChange={(e) => setNewOrder({ ...newOrder, value: e.target.value })}
          value={newOrder.value}
          name="newOrder"
          className="textbox"
          type="int"
          placeholder="Exact amount to transfer in ETH"
        />
        <button className="waveButton" onClick={createNewOrderFn}>
          CREATE THIS ORDER
        </button>
        <select
          onChange={(e) =>
            setSelectedId({ ...selectedId, orderId: e.target.value })
          }
          value={selectedId.orderId}
          name=""
          className="textbox"
        >
          <option value="" disabled>
            Select an Order ID
          </option>
          {myOrderIds.map((nonce, index) => (
            <option key={index} value={nonce}>
              {nonce}
            </option>
          ))}
        </select>{" "}
        <button className="waveButton" onClick={viewOrderFn}>
          VIEW THIS ORDER
        </button>
        {selectedOrder.map((order, index) => (
          <div
            key={index}
            style={{
              backgroundColor: "OldLace",
              marginTop: "16px",
              padding: "8px",
            }}
          >
            <div
              style={{
                color:
                  order.status === "CANCELLED"
                    ? "red"
                    : order.status === "COMPLETED"
                    ? "green"
                    : "inherit",
                fontWeight: order.status === "CREATED" ? "bold" : "normal",
              }}
            >
              Order Status: {order.status}
            </div>

            <div>Order ID: {order.id}</div>
            <div>Created At: {order.timestamp.toString()}</div>
            <div>Recipient Address: {order.receiver}</div>
            <div>Amount transfer: {order.amount} ETH</div>
          </div>
        ))}
        <button
          className="waveButton"
          onClick={confirmCurrentOrderFn}
          disabled={
            selectedOrder.length > 0 && selectedOrder[0].status === "COMPLETED"
          }
        >
          CONFIRM THIS ORDER
        </button>
        <button
          className="waveButton"
          onClick={modifyCurrentReceiverFn}
          disabled={
            selectedOrder.length > 0 && selectedOrder[0].status === "COMPLETED"
          }
        >
          MODIFY THIS ORDER'S RECEIVER
        </button>
        <button
          className="waveButton"
          onClick={cancelCurrentOrderFn}
          disabled={
            selectedOrder.length > 0 && selectedOrder[0].status === "COMPLETED"
          }
        >
          CANCEL THIS ORDER
        </button>
        <div className="bio">
          Support my work: 0x24B00B5987Ae6A5b7a8c73671332b938433fA7D9.
        </div>
      </div>
    </div>
  );
};

export default App;
