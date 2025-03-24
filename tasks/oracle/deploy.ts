import { task } from "hardhat/config";
import { getMarkets } from "../../config/markets";
import { getDeployerAddress } from "../_utils";

interface PriceConfig {
    defaultFeed: string;
    underlyingDecimals: number;
    toSymbol: string;
}

export const DEFAULT_ORACLE_DEPLOY_NAME = 'Oracle'
export const DEFAULT_ORACLE_CONTRACT = 'MixedPriceOracleV3'

task("oracle/deploy", "Deploys an oracle for every market")
    .addParam("name", "The key of the price oracle to deploy", DEFAULT_ORACLE_DEPLOY_NAME)    
    .addParam("contract", "The contract of the price oracle to deploy", DEFAULT_ORACLE_CONTRACT)    
    .setAction(async (args, hre) => {
        const configs = await getMarkets(hre) 

        const priceConfigs = Object.values(configs).reduce(((result, config) => {
            result[config.symbol] = {
                defaultFeed: config.oracle.source,
                underlyingDecimals: config.underlyingToken.decimals,
                toSymbol: 'USD',
            }
            return result
        }), {} as Record<string, PriceConfig>)

        const deployResult = await hre.deployments.deploy(args.name, {
            from: await getDeployerAddress(hre),
            log: true,
            contract: `contracts/PriceOracle/${args.contract}.sol:${args.contract}`,
            args: [Object.keys(priceConfigs), Object.values(priceConfigs)],
        });

        console.log(`Oracle (name: ${args.name}, contract: ${args.contract}) is deployed at ${deployResult.address}`)
    });
