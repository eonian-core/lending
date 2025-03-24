import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getAddressesOfMarkets, getComptrollerContract } from "../_utils";
import { CToken } from "contracts";
import { ContractTransaction } from "ethers";

task("markets/support", "Adds markets to the comptroller").setAction(handler)

async function handler(args: unknown, hre: HardhatRuntimeEnvironment) {
    const comptrollerContract = await getComptrollerContract(hre)
    const markets = await comptrollerContract.getAllMarkets()
    const addresses = await getAddressesOfMarkets(hre)

    const missingMarkets = Object.values(addresses).filter(address => !markets.includes(address))
    if (missingMarkets.length === 0) {
        console.log(`All markets are already added to the comptroller`)
        return
    }

    const txPromises: ContractTransaction[] = []
    for (const address of missingMarkets) {
        const cTokenContract = await hre.ethers.getContractAt<CToken>("CToken", address);
        console.log(`Adding ${await cTokenContract.symbol()} market to the comptroller...`)

        const tx = await comptrollerContract._supportMarket(address);
        txPromises.push(tx)
    }
    await Promise.all(txPromises)
}
