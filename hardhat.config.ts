import * as dotenv from "dotenv";
dotenv.config();

import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-network-helpers";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-deploy";
import "solidity-coverage";

import "./tasks";
import { getHardhatNetworkConfiguration } from "./config/fork";

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
        zen_testnet: {
            url: process.env.ZEN_TESTNET_RPC_URL,
            accounts: [process.env.ZEN_TESTNET_DEPLOYER_PRIVATE_KEY!]
        }
    },
    namedAccounts: {
        deployer: {
            default: 0,
        },
    },
};

export default config;
