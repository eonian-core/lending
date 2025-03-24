import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getMarkets } from "../../config/markets";
import { MarketConfigResolved } from "../../types";
import { getAddressesOfMarkets, getComptrollerContract } from "../_utils";
import { CToken } from "contracts";
import { BigNumber, BigNumberish } from "ethers";

task("markets/sync-params", "Sync markets params with the config").setAction(handler)

enum ParamName {
    COLLATERAL_FACTOR = 'COLLATERAL_FACTOR',
    RESERVE_FACTOR = 'RESERVE_FACTOR'
}

async function handler(args: unknown, hre: HardhatRuntimeEnvironment) {
    const addressesOfMarkets = await getAddressesOfMarkets(hre)
    const markets = await getMarkets(hre)
    const entries = Object.entries(markets)
    for (const [symbol, config] of entries) {
        console.log(`Syncing ${symbol} market...`)
        const marketAddress = addressesOfMarkets[symbol]
        const results = await syncMarket(hre, marketAddress, config)
        for (const [paramName, result] of results) {
            if (result === null) {
                console.log('\t', `${paramName} hasn't changed!`)
            } else {
                console.log('\t', `[!] Set ${paramName} from ${result.old.toString()} to ${result.new.toString()}`)
            }
        }
        console.log(`${symbol} Market (cToken) configuration was synced (address: ${marketAddress})\n`)
    }
}

type SyncParamResultValues = { old: BigNumberish, new: BigNumberish } | null
type SyncParamResult = [paramName: ParamName, result: SyncParamResultValues]

async function syncMarket(hre: HardhatRuntimeEnvironment, address: string, config: MarketConfigResolved): Promise<SyncParamResult[]> {
    return [
        [ParamName.COLLATERAL_FACTOR, await syncCollateralFactor(hre, address, config)],
        [ParamName.RESERVE_FACTOR, await syncReserveFactor(hre, address, config)]
    ]
}

async function syncCollateralFactor(hre: HardhatRuntimeEnvironment, address: string, config: MarketConfigResolved): Promise<SyncParamResultValues> {
    const comptrollerContract = await getComptrollerContract(hre)
    const { collateralFactorMantissa } = await comptrollerContract.markets(address)
    const newCollateralFactorMantissa = hre.ethers.utils.parseEther(config.collateralFactor)
    if (collateralFactorMantissa.eq(newCollateralFactorMantissa)) {
        return null
    }

    const cTokenContract = await hre.ethers.getContractAt<CToken>('CToken', address)
    const totalSupply = await cTokenContract.totalSupply();
    if (totalSupply.lte(BigNumber.from(1000))) {
        console.log(`Market supply is ${totalSupply.toString()}, collateral factor won't change!`)
        return null
    }

    await comptrollerContract._setCollateralFactor(address, newCollateralFactorMantissa)
    return { old: collateralFactorMantissa, new: newCollateralFactorMantissa }
}

async function syncReserveFactor(hre: HardhatRuntimeEnvironment, address: string, config: MarketConfigResolved): Promise<SyncParamResultValues> {
    const cTokenContract = await hre.ethers.getContractAt<CToken>('CToken', address)
    const reserveFactorMantissa = await cTokenContract.reserveFactorMantissa();
    const newReserveFactorMantissa = hre.ethers.utils.parseEther(config.reserveFactor)
    if (reserveFactorMantissa.eq(newReserveFactorMantissa)) {
        return null
    }
    await cTokenContract._setReserveFactor(newReserveFactorMantissa)
    return { old: reserveFactorMantissa, new: newReserveFactorMantissa }
}