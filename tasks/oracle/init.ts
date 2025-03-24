import { task } from "hardhat/config";
import { getComptrollerContract } from "../_utils";
import { DEFAULT_ORACLE_DEPLOY_NAME } from "./deploy";

task("oracle/init", "Set the oracle in the comptroller")
    .addParam("name", "The key of the price oracle to use", DEFAULT_ORACLE_DEPLOY_NAME)    
    .setAction(async (args, hre) => {
        const oracleDeployment = await hre.deployments.get(args.name)
        if (!oracleDeployment) {
            throw new Error(`Oracle deployment ${args.name} is not found!`)
        }
        const comptrollerContract = await getComptrollerContract(hre)

        const currentPriceOracleAddress = await comptrollerContract.oracle()
        if (currentPriceOracleAddress === oracleDeployment.address) {
            console.log(`Price oracle ${args.name} wasn't changed (address: ${currentPriceOracleAddress})`)
            return
        }
        console.log(`Going to set price oracle ${args.name} from ${currentPriceOracleAddress} to ${oracleDeployment.address}`)
        const tx = await comptrollerContract._setPriceOracle(oracleDeployment.address)
        await tx.wait()
    });
