require("dotenv").config();
const { ethers } = require("hardhat");
const artifactUniV2Pair = require("../artifacts/IUniswapV2Pair.json");
const artifactUniV2Factory = require("../artifacts/IUniswapV2Factory.json");

const { token, pairs, factory } = require("./data.json");
const ETHER = BigNumber.from(10).pow(18);
const GWEI = BigNumber.from(10).pow(9);

const provider = new ethers.providers.JsonRpcProvider(process.env.ALCHEMY_GOERLI_URL);
const eth_mctt_uni = new ethers.Contract(pairs.goerli.uni.ETH_MCTT, artifactUniV2Pair.abi, provider);
const eth_dai_uni = new ethers.Contract(pairs.goerli.uni.ETH_DAI, artifactUniV2Pair.abi, provider);
const eth_mctt_sushi = new ethers.Contract(pairs.goerli.sushi.ETH_MCTT, artifactUniV2Pair.abi, provider);
const eth_dai_sushi = new ethers.Contract(pairs.goerli.sushi.ETH_DAI, artifactUniV2Pair.abi, provider);
const factory_uni = new ethers.Contract(factory.goerli.UNI, artifactUniV2Factory.abi, provider);
const factory_sushi = new ethers.Contract(factory.goerli.SUSHI, artifactUniV2Factory.abi, provider);

const main = async () => {
    // let [reserve0, reserve1] = await eth_dai_uni.getReserves();
    // console.log("price uni: ", reserve0/reserve1);
    
    // [reserve0, reserve1] = await eth_dai_sushi.getReserves();
    // console.log("price sushi: ", reserve0/reserve1);

    // console.log(await factory_sushi.getPair(tokens.goerli.WETH, tokens.goerli.DAI));


}

main();