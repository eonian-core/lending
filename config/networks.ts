import { HardhatRuntimeEnvironment } from "hardhat/types"
import { NetworkName } from "../types"

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

    const networkNameString = hardhatNetwork.split('_').at(0)
    const networkName = Object.values(NetworkName).find(networkName => networkName.toLowerCase() === networkNameString)
    if (!networkName) {
        throw new Error(`Unable to resolve network from: ${hardhatNetwork}, got: ${networkNameString}!`)
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