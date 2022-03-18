require("@nomiclabs/hardhat-ethers");
require("dotenv").config();

module.exports = {
  solidity: "0.8.3",
  networks: {
    hardhat: {
      forking: {
        url: process.env.ALCHEMY_GOERLI_URL,
        blockNumber: 6558320
      }
    },
    goerli: {
      url: process.env.ALCHEMY_GOERLI_URL,
      accounts: [process.env.PRIVATE_KEY]
    }
  }
};
