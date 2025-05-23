import hre from 'hardhat'
import { HardhatNetworkUserConfig } from "hardhat/types";
import { NetworkName } from "../types";
import { getForkingNetwork } from './networks';

export function getHardhatNetworkConfiguration(): HardhatNetworkUserConfig {
    const forkingNetwork = getForkingNetwork()
    if (forkingNetwork === null) {
        return noFork()
    }

    const url = getForkRpcURL(forkingNetwork)
    switch (forkingNetwork) {
        case NetworkName.BSC:
            return forkWithAutoMining(url)
        default:
            return fork(url)
    }
}

function fork(url: string): HardhatNetworkUserConfig {
    return {
        forking: {
            url,
        }
    }
}

function forkWithAutoMining(url: string): HardhatNetworkUserConfig {
    return {
        forking: {
            url,
        },
        mining: {
            auto: true,
            interval: 5000,
            mempool: {
                order: 'fifo',
            },
        },
    }
}

function noFork(): HardhatNetworkUserConfig {
    return {}
}

function getForkRpcURL(forkingNetwork: NetworkName): string {
    const key = forkingNetwork + '_RPC_URL'
    const url = process.env[key]
    if (!url) {
        throw new Error(`Variable "${key}" is not defined!`)
    }
    return url
}