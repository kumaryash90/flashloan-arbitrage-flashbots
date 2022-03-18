# Flashloan Arbitrage using Flashbots

I'm trying to create a bot that can identify arbitrage opportunities across exchanges (uniswap and sushiswap currently).
If an opportunity exists, then send transactions through a flashbot relay, to avoid front-running.

To run the program:
```
npm install
npx hardhat run scripts/checkArbitrage.js
```
To run locally using a fork, in a separate terminal window, run `npx hardhat node` before running the script

(forked mainnet at block 14384561; might take some time to build data cache on first run)

### Done so far
Smart contracts: **PairData.sol**, **Arbitrage.sol**  
Scripts for data: **checkArbitrage.js**, **executeArbitrage.js**
- fetch, filter, and organize pool data from the exchanges
- evaluate the pairs for arbitrage opportunity and profitability
- update reserves on each new block
- smart contract for execution of flashloan & arbitrage

### In Progress
- creating & sending transactions using flashbot bundles
