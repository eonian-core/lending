import { task } from "hardhat/config";
import { DEFAULT_ORACLE_DEPLOY_NAME, DEFAULT_ORACLE_CONTRACT } from "./oracle/deploy";
import { HardhatRuntimeEnvironment, TaskArguments } from "hardhat/types";

task("initial-setup", "Performs initial setup of the protocol")
    .addParam("oracleName", "The deployment name (key) of the price oracle to use", DEFAULT_ORACLE_DEPLOY_NAME)    
    .addParam("oracleContract", "The contract name of the price oracle to use", DEFAULT_ORACLE_CONTRACT)    
    .setAction(async (args, hre) => {
        await runTask(hre, 'deploy')

        await runTask(hre, 'comptroller/deploy')
        await runTask(hre, 'comptroller/set-implementation')

        await runTask(hre, 'markets/deploy')

        await runTask(hre, 'oracle/deploy', { name: args.oracleName, contract: args.oracleContract })
        await runTask(hre, 'oracle/init', { name: args.oracleName })

        await runTask(hre, 'markets/support')
        await runTask(hre, 'markets/sync-params')
    });

async function runTask(hre: HardhatRuntimeEnvironment, taskName: string, args?: TaskArguments) {
    console.log(`[START] ${taskName}...`)
    await hre.run(taskName, args)
    console.log(`[END] ${taskName}\n`)
}