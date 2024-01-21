import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import truncateEthAddress from "truncate-eth-address";
import "./App.css";
import deployedAddress from "../contracts/contract-address.json";
import contractJSON from "../contracts/DoubleTransfer.json";

const App = () => {
  const [currentAccount, setCurrentAccount] = useState("");
  const [myMind, setMyMind] = useState({ mind: "" });
  const [myNonce, setMyNonce] = useState({ nonce: "" });
  const [myThoughts, setMyThoughts] = useState([]);
  const [recentThoughts, setRecentThoughts] = useState([]);
  const [numThoughts, setNumThoughts] = useState();
  const [allNonces, setAllNonces] = useState([]);

  const targetNetworkId = "0x13881";
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
              rpcUrls: ["https://rpc-mumbai.maticvigil.com"],
              chainName: "Polygon Mumbai",
              nativeCurrency: {
                name: "MATIC",
                symbol: "MATIC",
                decimals: 18,
              },
              blockExplorerUrls: ["https://mumbai.polygonscan.com/"],
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
        await getStatistics();
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

  const newThought = async () => {
    await handleNetworkCheck();
    const txn = await getContract().throwNewMind(myMind.mind);
    await txn.wait();
    alert("Thrown! Now forget about it");
    await getStatistics();
  };

  const deleteThought = async () => {
    await handleNetworkCheck();
    const txn = await getContract().deleteOldMind(parseInt(myNonce.nonce, 10), {
      gasLimit: 100000,
    });
    await txn.wait();
    alert("Deleted! Now really forget about it");
    await getStatistics();
  };

  const viewThought = async () => {
    try {
      const minds = await Promise.all([
        getContract().viewSpecificMind(parseInt(myNonce.nonce, 10)),
      ]);

      const mindsCleaned = minds.map((mind) => ({
        mind: mind.mind,
        timestamp: new Date(mind.timestamp * 1000),
      }));
      setMyThoughts(mindsCleaned);
    } catch (error) {
      console.error(error);
    }
  };

  const getStatistics = async () => {
    await handleNetworkCheck();
    try {
      const [allThoughts, nonces] = await Promise.all([
        getContract().viewAllThoughts(),
        getContract().viewAllNoncesOfAddress(),
      ]);

      const thoughtsCleaned = allThoughts.map((thought) => ({
        mind: thought.mind,
        timestamp: new Date(thought.timestamp * 1000),
      }));

      const noncesArray = nonces.map((bigNumber) => bigNumber.toNumber());

      setNumThoughts(thoughtsCleaned.length);
      setRecentThoughts(thoughtsCleaned.slice(-5).reverse());
      setAllNonces(noncesArray);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="mainContainer">
      <div className="dataContainer">
        <div className="header">Double Transfer Protocol</div>
        <div className="bio">
          No need to worry Zero-Transfer Attack! This protocol is here to help
        </div>
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
              Hello {truncateEthAddress(currentAccount)}! You have transferred a
              total volume of using this protocol by transfers
            </p>
          )}
        </div>
        <textarea
          onChange={(e) => setMyMind({ ...myMind, mind: e.target.value })}
          value={myMind.mind}
          name="mind"
          className="textbox"
          placeholder="Write something negative here..."
        ></textarea>
        <button className="waveButton" onClick={newThought}>
          Throw it out...
        </button>
        {recentThoughts.map((thought, index) => (
          <div
            key={index}
            style={{
              backgroundColor: "OldLace",
              marginTop: "16px",
              padding: "8px",
            }}
          >
            <div>Mind: {thought.mind}</div>
            <div>At: {thought.timestamp.toString()}</div>
          </div>
        ))}
        <div className="bio">
          {!currentAccount
            ? ""
            : `You have ${allNonces.length} thoughts to-date`}
        </div>
        <select
          onChange={(e) => setMyNonce({ ...myNonce, nonce: e.target.value })}
          value={myNonce.nonce}
          name="nonce"
          className="textbox"
        >
          <option value="" disabled>
            Select a nonce
          </option>
          {allNonces.map((nonce, index) => (
            <option key={index} value={nonce}>
              {nonce}
            </option>
          ))}
        </select>
        <button className="waveButton" onClick={viewThought}>
          View this thought..
        </button>
        {myThoughts.map((mind, index) => (
          <div
            key={index}
            style={{
              backgroundColor: "OldLace",
              marginTop: "16px",
              padding: "8px",
            }}
          >
            <div>Mind: {mind.mind}</div>
            <div>At: {mind.timestamp.toString()}</div>
          </div>
        ))}
        <button className="waveButton" onClick={deleteThought}>
          Delete your thought..
        </button>
        <div className="bio">
          Support my work: 0x24B00B5987Ae6A5b7a8c73671332b938433fA7D9.
        </div>
      </div>
    </div>
  );
};

export default App;
