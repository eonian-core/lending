import { task } from "hardhat/config";
import { getComptrollerContract } from "../_utils";

const REWARD_DISTRIBUTOR_DEPLOYMENT_NAME = 'RewardDistributor'

task("reward-distributor/init", "Set the reward distributor in the comptroller")
    .setAction(async (args, hre) => {
        const distributorDeployment = await hre.deployments.get(REWARD_DISTRIBUTOR_DEPLOYMENT_NAME)
        if (!distributorDeployment) {
            throw new Error(`Reward distributor deployment ${REWARD_DISTRIBUTOR_DEPLOYMENT_NAME} is not found!`)
        }
        const comptrollerContract = await getComptrollerContract(hre)

        const currentDistributorAddress = await comptrollerContract.rewardDistributor()
        if (currentDistributorAddress === distributorDeployment.address) {
            console.log(`Reward distributor wasn't changed (address: ${currentDistributorAddress})`)
            return
        }
        console.log(`Going to set reward distributor from ${currentDistributorAddress} to ${distributorDeployment.address}`)
        const tx = await comptrollerContract._setRewardDistributor(distributorDeployment.address)
        await tx.wait()
    });
