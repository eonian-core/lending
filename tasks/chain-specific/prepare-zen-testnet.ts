import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getDeployerAddress, measureNativeTokenSpentByDeployer } from "../_utils";
import { ERC20, SimplePriceOracle } from "index";
import { getMarkets } from "../../config/markets";

const EXPECTED_NETWORK = 'zen_testnet'

task("prepare-zen-testnet", "Deploy test tokens and price oracle")
    .setAction(async (args, hre) => {
        if (hre.network.name !== EXPECTED_NETWORK) {
            throw new Error(`Expected network name: ${EXPECTED_NETWORK}, got: ${hre.network.name}`)
        }
        await measureNativeTokenSpentByDeployer(hre, async () => {
            const ptUSD = await deployTestERC20(hre, 'Private Test USD', 'ptUSD')
            const ptETH = await deployTestERC20(hre, 'Private Test ETH', 'ptETH')

            const priceData = [
                {
                    token: ptUSD.address,
                    price: hre.ethers.utils.parseUnits('1', 18)
                },
                {
                    token: ptETH.address,
                    price: hre.ethers.utils.parseUnits('2000', 18)
                },
                {
                    token: await getMarkets(hre).then(markets => markets['zUSDC'].underlyingTokenAddress),
                    price: hre.ethers.utils.parseUnits('1', 18)
                }
            ]

            const simplePriceOracle = await deploySimplePriceOracle(hre)
            await simplePriceOracle.setPrices(
                priceData.map(e => e.token),
                priceData.map(e => e.price)
            )
        })
    });

task("deploy-zen-testnet", "Deploy zen testnet main contracts")
    .setAction(async (args, hre) => {
        if (hre.network.name !== EXPECTED_NETWORK) {
            throw new Error(`Expected network name: ${EXPECTED_NETWORK}, got: ${hre.network.name}`)
        }
        await measureNativeTokenSpentByDeployer(hre, async () => {
            await hre.run('initial-setup', {
                oracleName: 'SimplePriceOracle',
                oracleContract: 'SimplePriceOracle',
            })
        })
    })

async function deployTestERC20(hre: HardhatRuntimeEnvironment, name: string, symbol: string): Promise<ERC20> {
    const deployResult = await hre.deployments.deploy(name, {
        from: await getDeployerAddress(hre),
        contract: 'ERC20PresetMinterPauser',
        args: [name, symbol],
        log: true,
    });
    if (deployResult.newlyDeployed) {
        console.log(`Test token ${name} (${symbol}) is deployed at ${deployResult.address}`)
    } else {
        console.log(`Test token ${name} (${symbol}) is already deployed at ${deployResult.address}`)
    }
    return await hre.ethers.getContractAt<ERC20>("ERC20PresetMinterPauser", deployResult.address)
}

async function deploySimplePriceOracle(hre: HardhatRuntimeEnvironment): Promise<SimplePriceOracle> {
    const deployResult = await hre.deployments.deploy('SimplePriceOracle', {
        from: await getDeployerAddress(hre),
        contract: 'SimplePriceOracle',
        log: true,
    })
    if (deployResult.newlyDeployed) {
        console.log(`SimplePriceOracle is deployed at ${deployResult.address}`)
    } else {
        console.log(`SimplePriceOracle is already deployed at ${deployResult.address}`)
    }
    return await hre.ethers.getContractAt<SimplePriceOracle>("SimplePriceOracle", deployResult.address)
}
