const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");
const { router } = require("./data.json");
const factoryArtifact = require("../artifacts/contracts/IUniswapV2Factory.sol/IUniswapV2Factory.json");
const arbitrageArtifact = require("../artifacts/contracts/Arbitrage.sol/Arbitrage.json");


const main = async () => {
    // await hre.network.provider.request({
    //     method: "hardhat_impersonateAccount",
    //     params: ["0xEA674fdDe714fd979de3EdF0F56AA9716B898ec8"],
    //   });

    // const signer = await ethers.getSigner("0xEA674fdDe714fd979de3EdF0F56AA9716B898ec8");
    // console.log("signer balance before: ", await ethers.provider.getBalance("0xEA674fdDe714fd979de3EdF0F56AA9716B898ec8"));

    const [signer] = await ethers.getSigners();
    const arb = new ethers.Contract("0x3C9f68632Ef4AB927BBFCf92bf7f1a76046a326C", arbitrageArtifact.abi, signer);

    const str = ("1.6355551484375002").split(".");
    str[1] = str[1].substring(0, 8)
    console.log("token after decimals: ", str.join("."));

    const pairs = [
        "0x16c2d0826acc9a0B85f203aE41253D515C424c3E",
        "0xe0B2f24d31b886FdFB0d4B27937912400fE78063"
    ];

    const routers = [
        router.goerli.SUSHI,
        router.goerli.UNI
    ];

    const tokens = [
        "0x20572e4c090f15667cF7378e16FaD2eA0e2f3EfF",
        "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6"
    ]

    const tx = await arb.connect(signer).execute(
        pairs,
        routers,
        tokens,
        ethers.utils.parseUnits(str.join("."), 8),
    );
    await tx.wait();

    // const txCreate = await arb.populateTransaction.execute(
    //     pairs,
    //     routers,
    //     tokens,
    //     ethers.utils.parseUnits(str.join("."), 8)
    // );

    // console.log("tx data: ", txCreate.data);

    //console.log("signer balance after: ", await ethers.provider.getBalance("0xEA674fdDe714fd979de3EdF0F56AA9716B898ec8"));
}

main();