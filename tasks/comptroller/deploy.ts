import { task } from "hardhat/config";
import { getDeployerAddress } from "../_utils";

const CONTRACT_NAME = 'Comptroller'

task("comptroller/deploy", "Deploys a comptroller contract").setAction(
    async (args, hre) => {
        const deployer = await getDeployerAddress(hre) 
        const deployedContract = await hre.deployments.getOrNull(CONTRACT_NAME)
        const comptrollerDeploy = await hre.deployments.deploy(CONTRACT_NAME, {
            from: deployer,
            log: true,
            contract: "contracts/Comptroller.sol:" + CONTRACT_NAME,
            args: [],
        });

        if (!deployedContract) {
            console.log(`Comptroller deployed at address: ${comptrollerDeploy.address}`)
            return
        }

        if (comptrollerDeploy.newlyDeployed) {
            console.log(`New comptroller contract deployed at address: ${comptrollerDeploy.address}, previous: ${deployedContract.address}`)
            return
        }

        console.log(`Comptroller contract is up-to-date, nothing was deployed, current address: ${comptrollerDeploy.address}`)
    }
);
