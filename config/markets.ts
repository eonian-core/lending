import { HardhatRuntimeEnvironment } from "hardhat/types";
import { InterestRateModel, MarketConfig, MarketConfigResolved, NetworkName, OracleConfig, OracleConfigResolved, OracleType } from "../types";
import { resolveNetwork } from "./networks";
import { CToken } from "contracts";
import { IAggregatorV3 } from "contracts/PriceOracle/ChainlinkPriceOracle.sol";

const MARKET_TOKEN_NAME_SUFFIX = 'Eonian Market Token' // E.g. "USDC Eonian Market Token"
const MARKET_TOKEN_SYMBOL_PREFIX = 'emt' // E.g. emtUSDC
const MARKET_TOKEN_DECIMALS = 8

const lookupMapOfMarkets: Record<NetworkName, Record<string, MarketConfig>> = {
    [NetworkName.BSC]: {
        WBNB: {
            underlyingTokenAddress: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
            collateralFactor: '0.8',
            reserveFactor: '0.13',
            initialExchangeRate: '0.02',
            interestRateModel: InterestRateModel.MEDIUM,
            decimals: MARKET_TOKEN_DECIMALS,
            oracle: {
                type: OracleType.CHAINLINK,
                source: "0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE",
            }
        },
        USDT: {
            underlyingTokenAddress: "0x55d398326f99059fF775485246999027B3197955",
            collateralFactor: '0.8',
            reserveFactor: '0.13',
            initialExchangeRate: '0.02',
            interestRateModel: InterestRateModel.STABLE,
            decimals: MARKET_TOKEN_DECIMALS,
            oracle: {
                type: OracleType.CHAINLINK,
                source: "0xB97Ad0E74fa7d920791E90258A6E2085088b4320",
            }
        }
    },
    [NetworkName.ZEN_TESTNET]: {
        ptETH: {
            underlyingTokenAddress: "0x62546c0D07E3D94878F816E65b038329F7586Cb5",
            collateralFactor: '0.8',
            reserveFactor: '0.13',
            initialExchangeRate: '0.02',
            interestRateModel: InterestRateModel.MEDIUM,
            decimals: MARKET_TOKEN_DECIMALS,
            oracle: {
                type: OracleType.TEST_SIMPLE,
                source: "0x6739d839bCd24fAf55FdeF4077AE7a282997F56B",
            }
        },
        ptUSD: {
            underlyingTokenAddress: "0x78A61983B5B384c1aD2fee999cD34F4Fe4025952",
            collateralFactor: '0.8',
            reserveFactor: '0.13',
            initialExchangeRate: '0.02',
            interestRateModel: InterestRateModel.STABLE,
            decimals: MARKET_TOKEN_DECIMALS,
            oracle: {
                type: OracleType.TEST_SIMPLE,
                source: "0x6739d839bCd24fAf55FdeF4077AE7a282997F56B",
            }
        },
        /**
         * https://docs.zenchain.io/docs/bridge-tokens/supported-tokens
         */
        zUSDC: {
            underlyingTokenAddress: "0xF8aD5140d8B21D68366755DeF1fEFA2e2665060C",
            collateralFactor: '0.8',
            reserveFactor: '0.13',
            initialExchangeRate: '0.02',
            interestRateModel: InterestRateModel.STABLE,
            decimals: 6,
            oracle: {
                type: OracleType.TEST_SIMPLE,
                source: "0x6739d839bCd24fAf55FdeF4077AE7a282997F56B",
            }
        } 
    }
};

/**
 * Validates and returns markets for the current network. 
 */
export async function getMarkets(hre: HardhatRuntimeEnvironment): Promise<Record<string, MarketConfigResolved>> {
    const network = resolveNetwork(hre)
    if (network === null) {
        throw new Error('Cannot resolve market for unsupported network!')
    }

    const result: Record<string, MarketConfigResolved> = {}
    const markets = Object.entries(lookupMapOfMarkets[network])
    for (const [symbol, marketConfig] of markets) {
        const underlyingToken = await hre.ethers.getContractAt<CToken>("CToken", marketConfig.underlyingTokenAddress);
        const underlyingTokenSymbol = await underlyingToken.symbol()
        if (underlyingTokenSymbol !== symbol) {
            throw new Error(`Token symbols do not match: ${underlyingTokenSymbol} <> ${symbol}`)
        }
        result[symbol] = {
            ...marketConfig,
            oracle: await resolveOracleData(marketConfig.oracle, hre),
            symbol: MARKET_TOKEN_SYMBOL_PREFIX + symbol,
            name: `${symbol} ${MARKET_TOKEN_NAME_SUFFIX}`,
            underlyingToken: {
                symbol,
                address: marketConfig.underlyingTokenAddress,
                decimals: await underlyingToken.decimals(),
            }
        }
    }
    return result
}

async function resolveOracleData(oracle: OracleConfig, hre: HardhatRuntimeEnvironment): Promise<OracleConfigResolved> {
    switch (oracle.type) {
        case OracleType.CHAINLINK: {
            const aggregator = await hre.ethers.getContractAt<IAggregatorV3>("IAggregatorV3", oracle.source); 
            return { ...oracle, decimals: await aggregator.decimals() }
        }
        case OracleType.TEST_SIMPLE: {
            return { ...oracle, decimals: 18 }
        }
        default: {
            throw new Error(`Cannot resolve unsupported oracle type: ${oracle.type}`)
        }
    }
}