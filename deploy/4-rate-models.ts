import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getBlocksPerYear, getSecondsPerBlock } from '../config/networks';
import { InterestRateModel } from '../types';
import { BigNumber } from 'ethers';
import { getDeployerAddress } from '../tasks/_utils';

interface Rates {
    baseRatePerYear: number;
    multiplerPerYear: number;
    jumpMultiplierPerYear: number;
}

const lookupMapOfBaseRates: Record<InterestRateModel, Rates> = {
    [InterestRateModel.STABLE]: {
        baseRatePerYear: 0,
        multiplerPerYear: 0.05,
        jumpMultiplierPerYear: 1.365,
    },
    [InterestRateModel.MEDIUM]: {
        baseRatePerYear: 0.02,
        multiplerPerYear: 0.225,
        jumpMultiplierPerYear: 1.5,
    },
    [InterestRateModel.VOLATILE]: {
        baseRatePerYear: 0.025,
        multiplerPerYear: 0.225,
        jumpMultiplierPerYear: 5,
    },
};

const lookupMapOfKinks: Record<InterestRateModel, string> = {
    [InterestRateModel.STABLE]: '0.8',
    [InterestRateModel.MEDIUM]: '0.8',
    [InterestRateModel.VOLATILE]: '0.8',
}

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const models = Object.values(InterestRateModel)
    for (const model of models) {
        await deployRateModel(model, hre)
    }
};

async function deployRateModel(model: InterestRateModel, hre: HardhatRuntimeEnvironment) {
    const baseRates = lookupMapOfBaseRates[model];
    const existingDeploy = await hre.deployments.getOrNull(model);
    if (existingDeploy) {
        return;
    }

    const deployer = await getDeployerAddress(hre)
    await hre.deployments.deploy(model, {
        from: deployer,
        log: true,
        contract: 'contracts/JumpRateModelV4.sol:JumpRateModelV4',
        args: [
            getBlocksPerYear(hre),
            normalizeRate(baseRates.baseRatePerYear, hre),
            normalizeRate(baseRates.multiplerPerYear, hre),
            normalizeRate(baseRates.jumpMultiplierPerYear, hre),
            hre.ethers.utils.parseEther(lookupMapOfKinks[model]),
            deployer, // Owner
            model,
        ],
    });
}

function normalizeRate(rate: number, hre: HardhatRuntimeEnvironment): BigNumber {
    const secondsPerBlock = getSecondsPerBlock(hre);
    const normalizedRate = (rate / secondsPerBlock).toFixed(18);
    return hre.ethers.utils.parseEther(normalizedRate);
}

const tags = ['rate-models'];
export { tags };

export default func;
