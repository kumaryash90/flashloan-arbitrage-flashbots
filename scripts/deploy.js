const { ethers } = require("hardhat");
const { token } = require("./data.json");

const main = async () => {
    // const PairDataFactory = await ethers.getContractFactory("PairData");
    // const pd = await PairDataFactory.deploy();
    // await pd.deployed();

    // console.log("deployed at: ", pd.address);

    const Arbitrage = await ethers.getContractFactory("Arbitrage");
    const arb = await Arbitrage.deploy(token.goerli.WETH);
    await arb.deployed();

    console.log("deployed at: ", arb.address);    
}

main();