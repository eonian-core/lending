import { HardhatRuntimeEnvironment, NetworkUserConfig } from "hardhat/types"
import { NetworkName } from "../types"

const SECONDS_PER_YEAR = 31536000
const SECONDS_PER_BLOCK: Record<NetworkName, number> = {
    [NetworkName.BSC]: 3.0,
    [NetworkName.ZEN_TESTNET]: 6.0,
}

export function getSecondsPerBlock(hre: HardhatRuntimeEnvironment): number {
    const network = resolveNetwork(hre)
    if (network === null) {
        throw new Error('Network is unknown')
    }
    return SECONDS_PER_BLOCK[network]
}

export function getBlocksPerYear(hre: HardhatRuntimeEnvironment): number {
    const secondsPerBlock = getSecondsPerBlock(hre)
    return Math.floor(SECONDS_PER_YEAR / secondsPerBlock)
}

export function resolveNetwork(hre: HardhatRuntimeEnvironment): NetworkName | null {
    const hardhatNetwork = hre.network.name

    // "Ganache" is a local running evm node.
    if (hardhatNetwork === 'ganache') {
        return null
    }

    // "Hardhat" is a local running node that can be a fork of a real node.
    if (hardhatNetwork === 'hardhat' || hardhatNetwork === 'localhost') {
        return getForkingNetwork()
    }

    const networkName = Object.values(NetworkName).find(networkName => networkName.toLowerCase() === hardhatNetwork)
    if (!networkName) {
        throw new Error(`Unable to resolve network from: ${hardhatNetwork}, got: ${hardhatNetwork}!`)
    }
    return networkName
}

export function getForkingNetwork(): NetworkName | null {
    const forkingNetwork = process.env.FORKING_NETWORK || ''
    if (!forkingNetwork) {
        return null
    }
    const availableNetworks = Object.values(NetworkName) as string[]
    if (typeof forkingNetwork === 'string' && availableNetworks.indexOf(forkingNetwork) >= 0) {
        return forkingNetwork as NetworkName
    }
    throw new Error(`Unknown forking network: ${forkingNetwork}`)
}

export function getZenChainTestnetConfiguration(): NetworkUserConfig {
    return {
        url: process.env.ZEN_TESTNET_RPC_URL,
        accounts: [
            process.env.ZEN_TESTNET_DEPLOYER_PRIVATE_KEY!,
            ...(process.env.ZEN_TESTNET_TEST_PRIVATE_KEYS ? process.env.ZEN_TESTNET_TEST_PRIVATE_KEYS.split(',') : [])
        ],
        verify: {
            etherscan: {
                apiUrl: process.env.ZEN_TESTNET_API_URL,
                apiKey: process.env.ZEN_TESTNET_API_KEY,
            }
        }
    }
}