import hre from 'hardhat'
import { getMarkets } from '../../config/markets'
import { CToken, TestERC20 } from 'contracts'
import { getAddressesOfMarkets } from '../../tasks/_utils'
import { CErc20 } from 'index'

export async function getUnderlyingTokenAddress(tokenAddressOrSymbol: string) {
    const isAddress = hre.ethers.utils.isAddress(tokenAddressOrSymbol)
    if (!isAddress) {
        const markets = await getMarkets(hre)
        if (!markets[tokenAddressOrSymbol]) {
            throw new Error(`Unsupported token ${tokenAddressOrSymbol}, available: ${Object.keys(markets).join()}`)
        }
        tokenAddressOrSymbol = markets[tokenAddressOrSymbol].underlyingTokenAddress
    }
    return tokenAddressOrSymbol
}

export async function getMarketTokenAddress(underlyingTokenAddressOrSymbol: string) {
    const underlyingTokenAddress = await getUnderlyingTokenAddress(underlyingTokenAddressOrSymbol)
    const tokenContract = await hre.ethers.getContractAt<TestERC20>('TestERC20', underlyingTokenAddress)
    const underlyingTokenSymbol = await tokenContract.symbol()
    const addressesOfMarkets = await getAddressesOfMarkets(hre)
    const marketAddress = addressesOfMarkets[underlyingTokenSymbol]
    if (!marketAddress) {
        throw new Error(`Market address with symbol ${underlyingTokenSymbol} (param: ${underlyingTokenAddressOrSymbol}) is not found!`)
    }
    return marketAddress
}

export async function getMarketToken(underlyingTokenAddressOrSymbol: string) {
    const address = await getMarketTokenAddress(underlyingTokenAddressOrSymbol)
    return await hre.ethers.getContractAt<CToken>('CToken', address) 
}

export async function getMarketTokenAsCERC20(underlyingTokenAddressOrSymbol: string) {
    const address = await getMarketTokenAddress(underlyingTokenAddressOrSymbol)
    return await hre.ethers.getContractAt<CErc20>('CErc20', address) 
}

export async function getToken(addressOrSymbol: string) {
    const address = await getUnderlyingTokenAddress(addressOrSymbol)
    return await hre.ethers.getContractAt<TestERC20>('TestERC20', address)
}