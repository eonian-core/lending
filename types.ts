export type MarketConfig = {
    underlyingTokenAddress: string;
    reserveFactor: string;
    collateralFactor: string;
    initialExchangeRate: string;
    decimals: number;
    interestRateModel: InterestRateModel;
    oracle: OracleConfig;
};

export type OracleConfig = {
    type: OracleType;
    source: string; // ID (pyth) or address (chainlink, uniswap twap)
}

export interface MarketConfigResolved extends MarketConfig {
    oracle: OracleConfigResolved;
    symbol: string;
    name: string;
    underlyingToken: {
        address: string;
        symbol: string;
        decimals: number;
    }
}

export interface OracleConfigResolved extends OracleConfig {
    decimals: number;
}

export enum OracleType {
    UNISWAP_V3_TWAP = 'UNISWAP_V3_TWAP',
    CHAINLINK = 'CHAINLINK',
    PYTH = 'PYTH',
    TEST_SIMPLE = 'TEST_SIMPLE',
}

export enum NetworkName {
    BSC = 'BSC',
    ZEN_TESTNET = 'ZEN_TESTNET',
}

export enum InterestRateModel {
    STABLE = 'StableRateModel',
    MEDIUM = 'MediumRateModel',
    VOLATILE = 'VolatileRateModel',
}