import hre from 'hardhat'
import { silentConsole } from "./silent-console"
import { TaskArguments } from 'hardhat/types'
import { SimplePriceOracle } from 'index'
import { BigNumberish } from 'ethers'
import { getMarkets } from '../../config/markets'

export async function deploy(args: TaskArguments = {}) {
    args = { oracleName: 'Oracle', oracleContract: 'SimplePriceOracle', ...args }
    
    await silentConsole(async () => {
        await hre.run('initial-setup', args)
    })

    if (args.oracleContract === 'SimplePriceOracle') {
        await setupTestPrices(args.oracleName, {
            'USDT': 1.0,
            'WBNB': 500.0,
        })
    }
}

export async function deployFixture() {
    await deploy()
} 

async function setupTestPrices(oracleName: string, lookupMapOfTokenPrices: Record<string, BigNumberish>) {
    const oracleDeployment = await hre.deployments.get(oracleName)
    const oracle = await hre.ethers.getContractAt<SimplePriceOracle>('SimplePriceOracle', oracleDeployment.address)

    const configs = await getMarkets(hre)
    const symbols = Object.keys(configs)
    const { addresses, prices } = symbols.reduce((result, symbol) => {
        const underlyingTokenAddress = configs[symbol].underlyingTokenAddress
        result.addresses.push(underlyingTokenAddress)
        
        const price = lookupMapOfTokenPrices[symbol]
        if (!price) {
            throw new Error(`Please add a test/mocked price for ${symbol} market`)
        }

        const priceBN = hre.ethers.utils.parseUnits(price.toString(), 18)
        result.prices.push(priceBN)

        return result
    }, { addresses: [] as string[], prices: [] as BigNumberish[]  })
    
    await oracle.setPrices(addresses, prices)
}