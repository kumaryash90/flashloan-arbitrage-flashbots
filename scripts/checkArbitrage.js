const { ethers } = require("hardhat");
const { factory, token, master } = require("./data.json");
const factoryArtifact = require("../artifacts/contracts/IUniswapV2Factory.sol/IUniswapV2Factory.json");

const getPairs = async (pd,factory, pairsLength, requestLength) => {
    const weth = token.mainnet.WETH;
    let pairData = [];
    for(let i = 0; i < pairsLength; i += requestLength) {
        let pairs = await pd.getPairs(factory, i, i + requestLength);
        //console.log("pairs: ", pairs.length);
        for(let j = 0; j < requestLength; j++) {
            pairData.push(pairs[j]);
        }
    }
    console.log("pair data: ---- ", pairData.length);

    pairData = pairData.filter(pairItem => {
        return pairItem[0] === weth || pairItem[1] === weth;
    });
    //console.log(pairData);

    // const pairs = pairData.map(pairItem => {
    //     return pairItem[2];
    // });
    // console.log(pairs);

    const tokens = pairData.map(pairItem => {
        return pairItem[0] === weth ? pairItem[1] : pairItem[0];
    });
    //console.log(tokens);

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

const evaluatePairs = async () => {
    const tokenLength = master.tokens.length;
    let from, to, tokensFrom;
    let profit = 0;
    for(let i = 0; i < tokenLength; i++) {
        console.log(`--- pair #${i} ---`);
        console.log(`token0: ${master.pairData[i][0]}`);
        console.log(`token1: ${master.pairData[i][1]}`);
        console.log(`pair addresses:`);
        console.log(`   uni: ${master.pairData[i][2]}`);
        console.log(`   sushi: ${master.pairData[i + tokenLength][2]}`);
        const tokenIndex = master.pairData[i][0] === token.mainnet.WETH ? 1 : 0;
        const wethIndex = tokenIndex === 0 ? 1 : 0;

        console.log(`prices:`);
        const priceUni = master.reserves[i][tokenIndex] / master.reserves[i][wethIndex];
        const priceSushi = master.reserves[i + tokenLength][tokenIndex] / master.reserves[i + tokenLength][wethIndex];
        console.log(`   uni: ${priceUni}`);
        console.log(`   sushi: ${priceSushi}`);

        const lessTokensAt = master.reserves[i][tokenIndex] < master.reserves[i + tokenLength][tokenIndex]
                            ? i
                            : i + tokenLength;
        let ethIn, ethOut
        if(priceUni > priceSushi) {
            ethOut = 1;
            ethIn = priceUni / priceSushi;;
            const checkProfit = (0.997 * ethIn) - (1.003 * ethOut);
            console.log(`buying from Uni, selling at Sushi`);
            console.log(`profit: ${checkProfit} eth`);

            if(checkProfit > profit) {
                from = master.pairData[i][2];
                to = master.pairData[i + tokenLength][2];
                tokensFrom = master.pairData[lessTokensAt][2];
                profit = checkProfit;
            }
            
        } else {
            ethOut = 1;
            ethIn = priceSushi / priceUni;;
            const checkProfit = (0.997 * ethIn) - (1.003 * ethOut);
            console.log(`buying from Sushi, selling at Uni`);
            console.log(`profit: ${checkProfit} eth`);

            if(checkProfit > profit) {
                from = master.pairData[i + tokenLength][2];
                to = master.pairData[i][2];
                tokensFrom = master.pairData[lessTokensAt][2];
                profit = checkProfit;
            }
        }
        console.log("");
    }
    console.log("from,to, etc: ", from, to, tokensFrom, profit);
    return { from, to, tokensFrom, profit };
}

const main = async () => {
    // await hre.network.provider.request({
    //     method: "hardhat_impersonateAccount",
    //     params: ["0xEA674fdDe714fd979de3EdF0F56AA9716B898ec8"],
    //   });

    //const signer = await ethers.getSigner("0xEA674fdDe714fd979de3EdF0F56AA9716B898ec8");
    //console.log(await ethers.provider.getBalance("0xEA674fdDe714fd979de3EdF0F56AA9716B898ec8"));

    const factory_uni = new ethers.Contract(factory.mainnet.UNI, factoryArtifact.abi, ethers.provider);
    const factory_sushi = new ethers.Contract(factory.mainnet.SUSHI, factoryArtifact.abi, ethers.provider);
    //console.log(await factory_uni.allPairs(0));

    const PairDataFactory = await ethers.getContractFactory("PairData");
    const pd = await PairDataFactory.deploy();
    await pd.deployed();

    console.log("deployed at: ", pd.address);

    //let pairsLength = await factory_sushi.allPairsLength();
    //console.log("uni pairs length: ", parseInt(pairsLength));
    // pairsLength = await factory_sushi.allPairsLength();
    // console.log("sushi pairs length: ", parseInt(pairsLength));

    // for(let i = 0; i < 1000; i++) {
    //     const pair = await factory_sushi.allPairs(i);
    //     console.log(`${i} ---- ${pair}`);
    // }

    await getPairs(pd, factory.mainnet.UNI, 100, 50);
    await getPairs(pd, factory.mainnet.SUSHI, 100, 50);
    console.log("master data")
    console.log("--------------------");
    //console.log("master tokens: ", master.tokens);
    //console.log("master pairs: ", master.pairs);
    //console.log("master pairData: ", master.pairData);
    console.log("total tokens in master: ", master.tokens.length);

    console.log("random pair ---- ");
    let random = Math.round(Math.random() * 9);
    console.log(random);
    console.log("uni pair: ", master.pairs[random]);
    console.log("sushi pair: ", master.pairs[random + 9]);
    // console.log("master pairs: ", master.pairs);
    console.log("random pair ---- ");
    random = Math.round(Math.random() * 9);
    console.log(random);
    console.log("uni pair: ", master.pairs[random]);
    console.log("sushi pair: ", master.pairs[random + 9]);

    console.log("random pair ---- ");
    random = Math.round(Math.random() * 9);
    console.log(random);
    console.log("uni pair: ", master.pairs[random]);
    console.log("sushi pair: ", master.pairs[random + 9]);

    await getDecimals(pd);
    await getReserves(pd);
    const { from, to, tokensFrom, profit } = await evaluatePairs();
    console.log("<------------------>");
    console.log("<-- best bet is: -->");
    console.log(`from: ${from}`);
    console.log(`to: ${to}`);
    console.log(`lessTokensAt: ${tokensFrom}`);
    console.log(`profit: ${profit}`);
}

main();