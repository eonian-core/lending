import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getMarkets } from "../../config/markets";
import { MarketConfigResolved } from "../../types";
import { getComptrollerAddress, getDeployerAddress, getOwnerAddress, getRateModelAddress } from "../_utils";
import { CErc20Upgradable } from "contracts/CErc20Upgradable";

type MarketArgs = Parameters<CErc20Upgradable['proxyInitialize']>

task("markets/deploy", "Deploys (or upgrades) markets").setAction(handler)

enum DeploymentResultType {
    DEPLOYED,
    UPGRADED,
    IGNORED
}

async function handler(args: unknown, hre: HardhatRuntimeEnvironment) {
    const markets = await getMarkets(hre)
    const entries = Object.entries(markets)
    for (const [symbol, config] of entries) {
        console.log(`Deploying ${symbol} market...`)
        const [address, type] = await deployMarket(hre, config)
        switch (type) {
            case DeploymentResultType.DEPLOYED:
                console.log(`[!] ${symbol} Market (cToken) was deployed to ${address}\n`)
                break
            case DeploymentResultType.UPGRADED:
                console.log(`[!] ${symbol} Market (cToken) was upgraded (proxy: ${address})\n`)
                break
            case DeploymentResultType.IGNORED:
                console.log(`${symbol} Market (cToken) has up-to-date implementation\n`)
                break
        }
    }
}

async function deployMarket(hre: HardhatRuntimeEnvironment, config: MarketConfigResolved): Promise<[address: string, result: DeploymentResultType]> {
    const args = await getMarketArgs(hre, config)
    const deployer = await getDeployerAddress(hre)
    const owner = await getOwnerAddress(hre)
    const contractName = 'CErc20Upgradable'
    const deploymentName = `${contractName}_${config.underlyingToken.symbol}`

    const currentDeployment = await hre.deployments.getOrNull(deploymentName)
    const deploymentResult = await hre.deployments.deploy(deploymentName, {
        from: deployer,
        log: true,
        contract: `contracts/CErc20Upgradable.sol:${contractName}`,
        proxy: {
            owner: owner,
            proxyContract: "OpenZeppelinTransparentProxy",
            execute: {
                init: {
                    methodName: "proxyInitialize",
                    args: args,
                },
            },
        },
    });

    if (!currentDeployment) {
        return [deploymentResult.address, DeploymentResultType.DEPLOYED]
    }

    if (currentDeployment.implementation === deploymentResult.implementation) {
        return [deploymentResult.address, DeploymentResultType.IGNORED]
    }

    return [deploymentResult.address, DeploymentResultType.UPGRADED]
}


async function getMarketArgs(hre: HardhatRuntimeEnvironment, config: MarketConfigResolved): Promise<MarketArgs> {
    const comptrollerAddress = await getComptrollerAddress(hre)
    const interestRateModelAddress = await getRateModelAddress(config.interestRateModel, hre)
    const initialExchangeRateMantissa = hre.ethers.utils.parseUnits(
        config.initialExchangeRate,
        config.underlyingToken.decimals + 18 - config.decimals
    )
    const owner = await getOwnerAddress(hre)
    return [
        config.underlyingTokenAddress,
        comptrollerAddress,
        interestRateModelAddress,
        initialExchangeRateMantissa,
        config.name,
        config.symbol,
        config.decimals,
        owner,
    ];
}