const { ethers, BigNumber } = require("ethers");
const { FlashbotsBundleProvider } = require("@flashbots/ethers-provider-bundle");
require("dotenv").config();

const provider = new ethers.providers.JsonRpcProvider(process.env.ALCHEMY_GOERLI_URL);
const signerWallet = new ethers.Wallet(process.env.PRIVATE_KEY);
const randomWallet = new ethers.Wallet.createRandom();

const flaggedTokens = [];

const sendTx = async (txns, potentialTrades, blocknum) => {
    const flashbotsProvider = await FlashbotsBundleProvider.create(provider, randomWallet, process.env.FLASHBOTS_ENDPOINT_GOERLI);

    const txBundle = [];
    while(flaggedTokens.indexOf(potentialTrades[0].index) !== -1) {
        txns.shift();
        potentialTrades.shift();
    }

    txBundle.push({
        transaction: {
            chainId: "5",
            type: 2,
            value: BigNumber.from(0),
            data: txns[0].data,
            maxFeePerGas: BigNumber.from(10).pow(9).mul(30), // 30 gwei
            maxPriorityFeePerGas: BigNumber.from(10).pow(9).mul(20), // 20 gwei
            to: "0x3C9f68632Ef4AB927BBFCf92bf7f1a76046a326C"
        },
        signer: signerWallet.connect(provider)
    });
    
    try {
        console.log(`sending #${potentialTrades[0].index} to block #${blocknum + 1}`);
        const bundleSubmitResponse = await flashbotsProvider.sendBundle(txBundle, blocknum + 1);

        const bsr = await bundleSubmitResponse.wait();
        console.log("bundle submit response: ", bsr);
    } catch (error) {
        console.log(error);
        // process.exit(1);
        console.log(`failed.. flagging #${potentialTrades[0].index}`)
        flaggedTokens.push(potentialTrades[0].index)
    }
}

module.exports = { sendTx };
