const { ethers } = require("hardhat");
const arbitrageArtifact = require("../artifacts/contracts/Arbitrage.sol/Arbitrage.json");
const { sendTx } = require("./flashbotTx");

const execute = async (potentialTrades) => {

    const [signer] = await ethers.getSigners();
    const arb = new ethers.Contract("0x3C9f68632Ef4AB927BBFCf92bf7f1a76046a326C", arbitrageArtifact.abi, signer);

    try {
        const txns = [];
        for(let i = 0; i < potentialTrades.length; i++) {
            const tx = await arb.populateTransaction.execute(
                potentialTrades[i].tradePairs,
                potentialTrades[i].tradeRouters,
                potentialTrades[i].tradeTokens,
                potentialTrades[i].tokenAmount,
            );
            txns.push(tx);
        }
        sendTx(txns);
    } catch(error) {
        console.log(error);
    }
}

module.exports = { execute };