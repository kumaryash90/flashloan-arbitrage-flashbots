const { ethers } = require("hardhat");
const { factory, token, master, router } = require("./data.json");
const factoryArtifact = require("../artifacts/contracts/IUniswapV2Factory.sol/IUniswapV2Factory.json");
const pairDataArtifact = require("../artifacts/contracts/PairData.sol/PairData.json");

const getPairs = async (pd,factory, pairsLength, requestLength) => {
    const weth = token.goerli.WETH;
    let pairData = [];
    for(let i = 0; i < pairsLength; i += requestLength) {
        let pairs = await pd.getPairs(factory, i, i + requestLength);
        console.log("pairs: ", pairs.length);
        for(let j = 0; j < requestLength; j++) {
            pairData.push(pairs[j]);
        }
    }
    console.log("pair data: ---- ", pairData.length);

    pairData = pairData.filter(pairItem => {
        return pairItem[0] === weth || pairItem[1] === weth;
    });
    console.log(pairData);

    // const pairs = pairData.map(pairItem => {
    //     return pairItem[2];
    // });
    // console.log(pairs);

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
    console.log(reserves);

    if(master.pairs.length === reserves.length) {
        const length = reserves.length;
        for(let i = 0; i < length; i++) {
            master.reserves.push([
                ethers.utils.formatUnits(reserves[i][0], master.decimals[i][0]),
                ethers.utils.formatUnits(reserves[i][1], master.decimals[i][1])
            ]);
        }
        console.log(master.reserves);
    } else {    
        console.log("something went wrong");
    }
}

const getDecimals = async (pd) => {
    let decimals = await pd.getDecimals(master.pairs);

    if(master.pairs.length === decimals.length) {
        const length = decimals.length;
        for(let i = 0; i < length; i++) {
            master.decimals.push([
                parseInt(decimals[i][0]),
                parseInt(decimals[i][1])

            ]);
        }
        console.log(master.decimals);
    } else {    
        console.log("something went wrong");
    }
}

const getAmountIn = (amountOut, reserveIn, reserveOut) => {
    const numerator = reserveIn * amountOut;
    const denominator = (reserveOut - amountOut);
    if(denominator === 0) {
        console.log("division by 0, getAmountIn");
        process.exit(1);
    }
    const amountIn = (numerator / denominator);
    return amountIn * 1.003
}

const getAmountOut = (amountIn, reserveIn, reserveOut) => {
    const amountInWithFee = amountIn * 0.997;
    const numerator = amountInWithFee * (reserveOut);
    const denominator = (reserveIn * 1) + (amountInWithFee);
    if(denominator === 0) {
        console.log("division by 0, getAmountOut");
        process.exit(1);
    }
    const amountOut = numerator / denominator;
    return amountOut * 1;
}

const checkProfitability = (fromEthReserve, fromTokenReserve, toTokenReserve, toEthReserve) => {
    let tokensMax = (fromTokenReserve * 1 < toTokenReserve * 1 ? fromTokenReserve * 1 : toTokenReserve * 1);
    //let tokensMax = toTokenReserve * 1;
    let tokensMin = 0;
    let tokensToTrade = tokensMax / 2;
    let checkProfit = 0;
    let ethIn, ethOut;
    
    while((tokensMax - tokensMin) > 1) {
        
        const checkEthIn = getAmountIn(tokensToTrade, fromEthReserve, fromTokenReserve);
        const checkEthOut = getAmountOut(tokensToTrade, toTokenReserve, toEthReserve);
        const _checkProfit = checkEthOut - checkEthIn;
        if(Math.abs(_checkProfit) < 0.0001) break;
        console.log(`tokensMin: ${tokensMin}; tokensMax: ${tokensMax}; tokens: ${(tokensMax + tokensMin) / 2}; profit: ${_checkProfit}; ethIn: ${checkEthIn}; ethOut: ${checkEthOut} `);

        if(_checkProfit < checkProfit) {
            tokensMax = tokensToTrade;
        } else {
            ethIn = checkEthIn;
            ethOut = checkEthOut;
            checkProfit = _checkProfit;
            tokensMin = tokensToTrade;
        }
        tokensToTrade = (tokensMax + tokensMin) / 2;
        console.log("");
    }
    return { ethIn, ethOut, checkProfit, tokensToTrade };
}

const evaluatePairs = async () => {
    const tokenLength = master.tokens.length;
    let tradePairs = [];
    let tradeRouters = [];
    let tradeTokens = [];
    let tokenAmount;
    let decimals;
    let profit = 0;
    for(let i = 0; i < tokenLength; i++) {
       //if(i > 31) process.exit(0);
        console.log(`--- pair #${i} ---`);
        console.log(`token0: ${master.pairData[i][0]}`);
        console.log(`token1: ${master.pairData[i][1]}`);
        console.log(`pair addresses:`);
        console.log(`   uni: ${master.pairData[i][2]}`);
        console.log(`   sushi: ${master.pairData[i + tokenLength][2]}`);

        /* mainnetgoerli*/
        const tokenIndex = master.pairData[i][0] === token.goerli.WETH ? 1 : 0;
        const wethIndex = tokenIndex === 0 ? 1 : 0;

        if(master.reserves[i][wethIndex] > 0 && master.reserves[i + tokenLength][wethIndex] > 0 
            && master.reserves[i][tokenIndex] > 0 && master.reserves[i + tokenLength][tokenIndex] > 0) {
            console.log(`prices:`);
            const priceUni = master.reserves[i][tokenIndex] / master.reserves[i][wethIndex];
            const priceSushi = master.reserves[i + tokenLength][tokenIndex] / master.reserves[i + tokenLength][wethIndex];
            console.log(`   uni: ${priceUni}`);
            console.log(`   sushi: ${priceSushi}`);

            console.log("reserves: ");
            console.log(`   uni tokens: ${master.reserves[i][tokenIndex]}`);
            console.log(`   uni eth: ${master.reserves[i][wethIndex]}`);
            console.log(`   sushi tokens: ${master.reserves[i + tokenLength][tokenIndex]}`);
            console.log(`   sushi eth: ${master.reserves[i + tokenLength][wethIndex]}`);
    
            if(priceUni > priceSushi) {

                const { ethIn, ethOut, checkProfit, tokensToTrade } = checkProfitability(
                                                                master.reserves[i][wethIndex], 
                                                                master.reserves[i][tokenIndex],
                                                                master.reserves[i + tokenLength][tokenIndex], 
                                                                master.reserves[i + tokenLength][wethIndex]
                                                                );

                console.log(`buying from Uni, selling at Sushi`);
                console.log(`profit: ${checkProfit} eth`);
    
                if(checkProfit > profit) {
                    tradePairs = [
                        master.pairData[i][2],
                        master.pairData[i + tokenLength][2]
                    ];

                    tradeRouters = [
                        router.goerli.UNI,
                        router.goerli.SUSHI
                    ];

                    tradeTokens = [
                        master.pairData[i][0],
                        master.pairData[i][1]
                    ];

                    tokenAmount = tokensToTrade;
                    decimals = master.decimals[i][tokenIndex];
                    profit = checkProfit;
                }
                
            } else {

                const { ethIn, ethOut, checkProfit, tokensToTrade } = checkProfitability(
                                                                master.reserves[i + tokenLength][wethIndex],
                                                                master.reserves[i + tokenLength][tokenIndex],
                                                                master.reserves[i][tokenIndex],
                                                                master.reserves[i][wethIndex],
                                                                );

                console.log(`buying from Sushi, selling at Uni`);
                console.log(`profit: ${checkProfit} eth`);
    
                if(checkProfit > profit) {
                    tradePairs = [
                        master.pairData[i + tokenLength][2],
                        master.pairData[i][2]
                    ];

                    tradeRouters = [
                        router.goerli.SUSHI,
                        router.goerli.UNI
                    ];

                    tradeTokens = [
                        master.pairData[i][0],
                        master.pairData[i][1]
                    ];

                    tokenAmount = tokensToTrade;
                    decimals = master.decimals[i][tokenIndex];
                    profit = checkProfit;
                }
            }
        } else {
            console.log("pair not liquid enough");
        }
        console.log("");
    }
    
    return { tradePairs, tradeRouters, tradeTokens, tokenAmount, decimals, profit };
}

const main = async () => {

    /** mainnetgoerli */
    const factory_uni = new ethers.Contract(factory.goerli.UNI, factoryArtifact.abi, ethers.provider);
    const factory_sushi = new ethers.Contract(factory.goerli.SUSHI, factoryArtifact.abi, ethers.provider);
    console.log(await factory_uni.allPairsLength());
    console.log(await factory_sushi.allPairsLength());

    const [signer] = await ethers.getSigners();
    const pd = new ethers.Contract("0x6c23860B3B38F5949bFBA9416E8416dB5ed3e1B4", pairDataArtifact.abi, signer);

    await getPairs(pd, factory.goerli.UNI, 8000, 1000);
    await getPairs(pd, factory.goerli.SUSHI, 800, 400);
    console.log("master data")
    console.log("--------------------");
    console.log("master tokens: ", master.tokens);
    console.log("master pairs: ", master.pairs);
    console.log("master pairData: ", master.pairData);
    console.log("total tokens in master: ", master.tokens.length);
    console.log("total pairs in master: ", master.pairs.length);

    console.log("random pair ---- ");
    let random = Math.round(Math.random() * master.tokens.length);
    console.log(random);
    console.log("uni pair: ", master.pairs[random]);
    console.log("sushi pair: ", master.pairs[random + master.tokens.length]);
    // console.log("master pairs: ", master.pairs);
    console.log("random pair ---- ");
    random = Math.round(Math.random() * master.tokens.length);
    console.log(random);
    console.log("uni pair: ", master.pairs[random]);
    console.log("sushi pair: ", master.pairs[random + master.tokens.length]);

    console.log("random pair ---- ");
    random = Math.round(Math.random() * master.tokens.length);
    console.log(random);
    console.log("uni pair: ", master.pairs[random]);
    console.log("sushi pair: ", master.pairs[random + master.tokens.length]);

    await getDecimals(pd);
    await getReserves(pd);
    const { tradePairs, tradeRouters, tradeTokens, tokenAmount, decimals, profit } = await evaluatePairs();
    console.log("<------------------>");
    console.log("<-- best bet is: -->");
    console.log(`pairs: ${tradePairs}`);
    console.log(`routers: ${tradeRouters}`);
    console.log(`tokens: ${tradeTokens}`);
    console.log(`tokens to trade: ${tokenAmount}`);
    console.log(`token decimals: ${decimals}`);
    console.log(`profit: ${profit}`);

    console.log("master decimals: ", master.decimals[1][1]);

    // ethers.provider.on("block", async (blocknum) => {
    //     // console.log("block number: ", blocknum);
    //     await getReserves(pd);
    //     const { from, to, tokenAmount, profit } = await evaluatePairs();
    //     console.log("<------------------>");
    //     console.log("<-- best bet is: -->");
    //     console.log(`from: ${from}`);
    //     console.log(`to: ${to}`);
    //     console.log(`tokens to trade: ${tokenAmount}`);
    //     console.log(`profit: ${profit}`);
    // });
}

main();