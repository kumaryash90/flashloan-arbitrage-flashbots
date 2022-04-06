const { ethers } = require("hardhat");
const { factory, token, master, router } = require("./data.json");
const { execute } = require("./executeArbitrage");
const factoryArtifact = require("../artifacts/contracts/IUniswapV2Factory.sol/IUniswapV2Factory.json");
const pairDataArtifact = require("../artifacts/contracts/PairData.sol/PairData.json");
const { BigNumber } = require("ethers");

const getPairs = async (pd,factory, pairsLength, requestLength) => {
    /**mainnetgoerli */
    const weth = token.goerli.WETH;
    let pairData = [];
    for(let i = 0; i < pairsLength; i += requestLength) {
        let pairs = await pd.getPairs(factory, i, i + requestLength);
        console.log("pairs: ", i, i + requestLength);
        for(let j = 0; j < requestLength; j++) {
            pairData.push(pairs[j]);
        }
    }
    console.log("pair data: ---- ", pairData.length);

    pairData = pairData.filter(pairItem => {
        return pairItem[0] === weth || pairItem[1] === weth;
    });
    console.log(pairData);

    const tokens = pairData.map(pairItem => {
        return pairItem[0] === weth ? pairItem[1] : pairItem[0];
    });
    console.log(tokens);

    await setMaster(pairData, tokens);
    console.log("---finish---------");
}

const setMaster = async (pairData, tokens) => {
    if(master.tokens.length === 0) {
        master.pairData = pairData;
        master.tokens = tokens;
    } else {
        const filteredTokens = master.tokens.filter(t => {
            return tokens.indexOf(t) !== -1;
        });
        master.tokens = filteredTokens;

        const filteredPairData = pairData.filter(p => {
            return master.tokens.indexOf(p[0]) !== -1 || master.tokens.indexOf(p[1]) !== -1;
        });
        master.pairData = master.pairData.filter(p => {
            return master.tokens.indexOf(p[0]) !== -1 || master.tokens.indexOf(p[1]) !== -1;
        });
        
        const len = master.tokens.length;
        for(let i = 0; i < len; i++) {
            const element = filteredPairData.find(p => (master.tokens[i] === p[0] || master.tokens[i] === p[1]));
            master.pairData.push(element);
        }
    }
    master.pairs = master.pairData.map(p => p[2]);
}

const getReserves = async (pd) => {
    let reserves = await pd.getReserves(master.pairs);
    // console.log("reserves length: ", reserves.length);
    master.reserves = reserves;
}

const getAmountIn = (amountOut, reserveIn, reserveOut) => {
    const numerator = reserveIn.mul(amountOut);
    const denominator = reserveOut.sub(amountOut);
    if(denominator.eq(0)) {
        console.log("division by 0, getAmountIn");
        process.exit(1);
    }
    const amountIn = numerator.div(denominator);
    return amountIn.add(amountIn.mul(3).div(1000));
}

const getAmountOut = (amountIn, reserveIn, reserveOut) => {
    const amountInWithFee = amountIn.sub(amountIn.mul(3).div(1000));
    const numerator = amountInWithFee.mul(reserveOut);
    const denominator = reserveIn.add(amountInWithFee);
    if(denominator.eq(0)) {
        console.log("division by 0, getAmountOut");
        process.exit(1);
    }
    const amountOut = numerator.div(denominator);
    return amountOut;
}

const checkProfitability = (fromEthReserve, fromTokenReserve, toTokenReserve, toEthReserve) => {
    let tokensMax = fromTokenReserve.lt(toTokenReserve) ? fromTokenReserve : toTokenReserve;
    //let tokensMax = toTokenReserve * 1;
    let tokensMin = BigNumber.from(0);
    let tokensToTrade = tokensMax.div(2);
    let checkProfit = BigNumber.from(0);
    let ethIn, ethOut;
    let flag = true;
    
    while((tokensMax.sub(tokensMin)).gt(1)) {
        
        const checkEthIn = getAmountIn(tokensToTrade, fromEthReserve, fromTokenReserve);
        const checkEthOut = getAmountOut(tokensToTrade, toTokenReserve, toEthReserve);
        const _checkProfit = checkEthOut.sub(checkEthIn);

        if(_checkProfit.lt(checkProfit)) {
            tokensMax = tokensToTrade;
        } else {
            ethIn = checkEthIn;
            ethOut = checkEthOut;
            checkProfit = _checkProfit;
            tokensMin = tokensToTrade;
        }
        tokensToTrade = tokensMax.add(tokensMin).div(2);
        // console.log("");
    }
    return { ethIn, ethOut, checkProfit, tokensToTrade, flag };
}

const evaluatePairs = async (flaggedPairs) => {
    const tokenLength = master.tokens.length;
    const potentialTrades = [];
    let profit = BigNumber.from(0);
    for(let i = 0; i < tokenLength; i++) {
        if(flaggedPairs.indexOf(i) !== -1) continue;
       //if(i > 31) process.exit(0);
        // console.log(`--- pair #${i} ---`);
        // console.log(`token0: ${master.pairData[i][0]}`);
        // console.log(`token1: ${master.pairData[i][1]}`);
        // console.log(`pair addresses:`);
        // console.log(`   uni: ${master.pairData[i][2]}`);
        // console.log(`   sushi: ${master.pairData[i + tokenLength][2]}`);

        /* mainnetgoerli*/
        const tokenIndex = master.pairData[i][0] === token.goerli.WETH ? 1 : 0;
        const wethIndex = tokenIndex === 0 ? 1 : 0;

        if(master.reserves[i][wethIndex].gt(BigNumber.from(10).pow(18)) && master.reserves[i + tokenLength][wethIndex].gt(BigNumber.from(10).pow(18)) 
            && master.reserves[i][tokenIndex].gt(0) && master.reserves[i + tokenLength][tokenIndex].gt(0)) {
            // console.log(`prices:`);
            const priceUni = master.reserves[i][tokenIndex].div(master.reserves[i][wethIndex]);
            const priceSushi = master.reserves[i + tokenLength][tokenIndex].div(master.reserves[i + tokenLength][wethIndex]);
            // console.log(`   uni: ${priceUni.toString()}`);
            // console.log(`   sushi: ${priceSushi.toString()}`);

            // console.log("reserves: ");
            // console.log(`   uni tokens: ${master.reserves[i][tokenIndex].toString()}`);
            // console.log(`   uni eth: ${master.reserves[i][wethIndex].toString()}`);
            // console.log(`   sushi tokens: ${master.reserves[i + tokenLength][tokenIndex].toString()}`);
            // console.log(`   sushi eth: ${master.reserves[i + tokenLength][wethIndex].toString()}`);
    
            if(priceUni.gt(priceSushi)) {

                const { ethIn, ethOut, checkProfit, tokensToTrade, flag } = checkProfitability(
                                                                master.reserves[i][wethIndex], 
                                                                master.reserves[i][tokenIndex],
                                                                master.reserves[i + tokenLength][tokenIndex], 
                                                                master.reserves[i + tokenLength][wethIndex]
                                                                );

                // console.log(`buying from Uni, selling at Sushi`);
                // console.log(`profit: ${checkProfit.toString()} eth`);
    
                if(checkProfit.gt(profit) && flag) {
                    potentialTrades.push({
                        tradePairs: [
                            master.pairData[i][2],
                            master.pairData[i + tokenLength][2]
                        ],
                        /**mainnetgoerli */
                        tradeRouters: [
                            router.goerli.UNI,
                            router.goerli.SUSHI
                        ],
    
                        tradeTokens: [
                            master.pairData[i][0],
                            master.pairData[i][1]
                        ],
    
                        tokenAmount: tokensToTrade,
                        profit: checkProfit,
                        index: i
                    })
                }
                
            } else {

                const { ethIn, ethOut, checkProfit, tokensToTrade, flag } = checkProfitability(
                                                                master.reserves[i + tokenLength][wethIndex],
                                                                master.reserves[i + tokenLength][tokenIndex],
                                                                master.reserves[i][tokenIndex],
                                                                master.reserves[i][wethIndex],
                                                                );

                // console.log(`buying from Sushi, selling at Uni`);
                // console.log(`profit: ${checkProfit.toString()} eth`);
    
                if(checkProfit.gt(profit) && flag) {
                    potentialTrades.push({
                        tradePairs: [
                            master.pairData[i + tokenLength][2],
                            master.pairData[i][2]
                        ],
                        /**mainnetgoerli */
                        tradeRouters: [
                            router.goerli.SUSHI,
                            router.goerli.UNI
                        ],
    
                        tradeTokens: [
                            master.pairData[i][0],
                            master.pairData[i][1]
                        ],
    
                        tokenAmount: tokensToTrade,
                        profit: checkProfit,
                        index: i
                    });
                }
            }
        } else {
            // console.log("pair not liquid enough");
        }
        // console.log("");
    }
    
    return { potentialTrades };
}

const main = async () => {

    /** mainnetgoerli */
    const factory_uni = new ethers.Contract(factory.goerli.UNI, factoryArtifact.abi, ethers.provider);
    const factory_sushi = new ethers.Contract(factory.goerli.SUSHI, factoryArtifact.abi, ethers.provider);
    console.log(await factory_uni.allPairsLength());
    console.log(await factory_sushi.allPairsLength());

    const [signer] = await ethers.getSigners();
    const pd = new ethers.Contract("0x6c23860B3B38F5949bFBA9416E8416dB5ed3e1B4", pairDataArtifact.abi, signer);

    await getPairs(pd, factory.goerli.UNI, 8000, 500);
    await getPairs(pd, factory.goerli.SUSHI, 800, 400);

   ethers.provider.on("block", async (blocknum) => {
        console.log(blocknum);
        
        if(blocknum % 2 === 0 {
            await getReserves(pd);

            const { potentialTrades } = await evaluatePairs();
            potentialTrades.sort((a, b) => b.profit.sub(a.profit));

            console.log("total potential trades: ", potentialTrades.length);

            try {
                if(potentialTrades.length === 0) {
                    console.log("no viable trades right now");
                } else if(potentialTrades.length < 10) {
                    const success = await execute(potentialTrades);
                } else {
                    const success = await execute(potentialTrades.slice(0, 10));
                }
            } catch(error) {

            }
        }
        
    });

}

main();
