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

  const createnewOrderFn = async () => {
    await handleNetworkCheck();
    let finalValue =
      newOrder.value + ethers.utils.parseEther(getContract().viewCurrentFee());
    const txn = await getContract().createnewOrder(newOrder.address, {
      value: finalValue,
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
      newOrder.receiver
    );
    await txn.wait();
    alert("Receiver modified");
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
    alert("Order confirmed and sent to receiver");
    await viewAllOrderFn();
  };

  const viewOrderFn = async () => {
    try {
      const orderDetails = await Promise.all([
        getContract().viewOrder(parseInt(selectedId.orderId, 10)),
      ]);

      const orderDetailsCleaned = orderDetails.map((order) => ({
        id: order.id.toNumber(),
        timestamp: new Date(order.timestamp * 1000),
        receiver: order.receiver.toNumber(),
        amount: order.amount.toNumber(),
      }));
      setSelectedOrder(orderDetailsCleaned);
    } catch (error) {
      console.error(error);
    }
  };

  const viewAllOrderFn = async () => {
    await handleNetworkCheck();
    try {
      const [idx, userStats, allStats, fee] = await Promise.all([
        getContract().viewAllOrdersIdOfAddress(),
        getContract().viewUserCurrentStats(),
        getContract().viewTotalCurrentStats(),
        getContract().viewCurrentFee(),
      ]);

      const idxArray = idx.map((orderIds) => orderIds.toNumber());
      const userArray = userStats.map((user) => user.toNumber());
      const allArray = allStats.map((protocol) => protocol.toNumber());
      setmyOrderIds(idxArray);
      setMyStats(userArray);
      setProtocolStats(allArray);
      setCurrentFee(fee.toNumber());
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="mainContainer">
      <div className="dataContainer">
        <div className="bio">
          Current Fee: {currentFee} ETH - All-time Txns: {protocolStats[1]} -
          All-time Volume: {protocolStats[2]} ETH
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
              Hello {truncateEthAddress(currentAccount)}! You have completed{" "}
              {myStats[1]} transaction(s) with a total volume of {myStats[2]}{" "}
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
          type="text"
          className="textbox"
          placeholder="Address to transfer"
        />
        <input
          onChange={(e) => setNewOrder({ ...newOrder, value: e.target.value })}
          value={newOrder.value}
          name="newOrder"
          type="number"
          className="textbox"
          placeholder="Exact amount to transfer in ETH"
        />
        <button className="waveButton" onClick={createnewOrderFn}>
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
            <div>Order ID: {order.id}</div>
            <div>Created At: {order.timestamp.toString()}</div>
            <div>Recipient Address: {order.receiver}</div>
            <div>Amount transfer: {order.amount}</div>
          </div>
        ))}
        <button className="waveButton" onClick={confirmCurrentOrderFn}>
          CONFIRM THIS ORDER
        </button>
        <button className="waveButton" onClick={modifyCurrentReceiverFn}>
          MODIFY THIS ORDER'S RECEIVER
        </button>
        <button className="waveButton" onClick={cancelCurrentOrderFn}>
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
