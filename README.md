# Flashloan Arbitrage using Flashbots

I'm trying to create a bot that can identify arbitrage opportunities across exchanges (uniswap and sushiswap currently).
If an opportunity exists, then send transactions through a flashbot relay, to avoid front-running.

To run the scripts:
```
npm install
npx hardhat run scripts/checkArbitrage.js
```
(forked mainnet at block 14384561; might take some time to build data cache on first run)

### Done so far
Scripts for data: **checkArbitrage.js**  
Smart contracts: **PairData.sol**
- fetch, filter, and organize pool data from the exchanges
- evaluate the pairs for arbitrage opportunity and profitability
- update reserves on each new block

### In Progress
- smart contract for execution of flashloan & arbitrage
- creating & sending transactions using flashbot bundles
