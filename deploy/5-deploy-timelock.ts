import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async ({
    getNamedAccounts,
    deployments: { deploy, getOrNull },
    ethers,
    network,
}: HardhatRuntimeEnvironment) => {
    const { deployer } = await getNamedAccounts();

    await deploy("TimelockController", {
        from: deployer,
        log: true,
        contract:
            "@openzeppelin/contracts/governance/TimelockController.sol:TimelockController",
        args: [
            10,
            [
                "0x0000000000000000000000000000000000000000",
                "0x0000000000000000000000000000000000000000",
            ],
            ["0x0000000000000000000000000000000000000000"],
            "0x0000000000000000000000000000000000000000",
        ],
    });
};

const tags = ["timelock-controller"];
export { tags };

func.skip = async () => true // Disable for now

export default func;
