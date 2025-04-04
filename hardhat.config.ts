import * as dotenv from "dotenv";
dotenv.config();

import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-network-helpers";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-deploy";
import "solidity-coverage";

import { getHardhatNetworkConfiguration } from "./config/fork";
import { getZenChainTestnetConfiguration } from "./config/networks";

import "./tasks";

const config: HardhatUserConfig = {
    solidity: {
        compilers: [
            {
                version: "0.8.10",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
        ],
    },
    networks: {
        hardhat: getHardhatNetworkConfiguration(),
        zen_testnet: getZenChainTestnetConfiguration()
    },
    namedAccounts: {
        deployer: {
            default: 0,
        },
    },
};

export default config;
