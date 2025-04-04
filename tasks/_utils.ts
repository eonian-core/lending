import { HardhatRuntimeEnvironment } from "hardhat/types";
import { InterestRateModel } from "../types";
import { CErc20, Comptroller, CToken } from "index";
import { getMarkets } from "../config/markets";

const isCTokenDeployment = (deploymentName: string) => deploymentName.startsWith("CErc20Immutable_") ||
    (deploymentName.startsWith("CErc20Upgradable_") && !deploymentName.endsWith("_Proxy") && !deploymentName.endsWith("_Implementation"))

export async function getAddressesOfMarkets(hre: HardhatRuntimeEnvironment): Promise<Record<string, string>> {
    const result = {}
    const deployments = await hre.deployments.all()
    const names = Object.keys(deployments)
    for (const deploymentName of names) {
        const isCToken = isCTokenDeployment(deploymentName)
        if (isCToken) {
            const deployment = deployments[deploymentName]
            const market = await hre.ethers.getContractAt<CErc20>('CErc20', deployment.address)
            const underlyingTokenAddress = await market.underlying()
            const underlyingTokenContract = await hre.ethers.getContractAt<CToken>('CToken', underlyingTokenAddress)
            const underlyingTokenSymbol = await underlyingTokenContract.symbol()
            // Validate that everything is in sync (underlying token symbol is present in the config)
            const configOfMarkets = await getMarkets(hre)
            if (underlyingTokenSymbol in configOfMarkets) {
                result[underlyingTokenSymbol] = deployment.address
            } else {
                throw new Error(`There is no configuration for market ${underlyingTokenSymbol}!`)
            }
        }
    }
    return result
}

export async function getComptrollerAddress(hre: HardhatRuntimeEnvironment): Promise<string> {
    const deploy = await hre.deployments.get('Unitroller')
    return deploy.address
}

export async function getComptrollerContract(hre: HardhatRuntimeEnvironment) {
    return await hre.ethers.getContractAt<Comptroller>(
        "Comptroller",
        await getComptrollerAddress(hre),
    );
}

export async function getRateModelAddress(rateModel: InterestRateModel, hre: HardhatRuntimeEnvironment) {
    const deploy = await hre.deployments.get(rateModel)
    return deploy.address
}

export async function getDeployerAddress(hre: HardhatRuntimeEnvironment): Promise<string> {
    const { deployer } = await hre.getNamedAccounts();
    return deployer
}

export async function getOwnerAddress(hre: HardhatRuntimeEnvironment): Promise<string> {
    const [signer] = await hre.ethers.getSigners()
    return signer.address
}

export async function measureNativeTokenSpentByDeployer<T>(hre: HardhatRuntimeEnvironment, fn: () => Promise<T>): Promise<T> {
    const deployer = await getDeployerAddress(hre)
    const balanceBefore = await hre.ethers.provider.getBalance(deployer)
    try {
        return await fn()
    } catch (e) {
        throw e
    } finally {
        const balanceAfter = await hre.ethers.provider.getBalance(deployer)
        const balanceDifference = balanceBefore.sub(balanceAfter).toString()
        if (balanceDifference !== '0') {
            const balanceBeforeFormatted = hre.ethers.utils.formatEther(balanceBefore)
            const balanceAfterFormatted = hre.ethers.utils.formatEther(balanceAfter)
            const balanceDifferenceFormatted = hre.ethers.utils.formatEther(balanceDifference)
            console.log(`[measureNativeTokenSpentByDeployer] Deployer ${deployer} now has ${balanceAfterFormatted} (before: ${balanceBeforeFormatted}, difference: ${balanceDifferenceFormatted})`)
        }
    }
}