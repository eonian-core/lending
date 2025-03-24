import { task } from "hardhat/config";
import { Comptroller, Unitroller } from "contracts";

task("comptroller/set-implementation", "Set implementation of Unitroller").setAction(
    async (args, hre) => {
        const comptrollerImplementationDeployment = await hre.deployments.getOrNull('Comptroller')
        if (!comptrollerImplementationDeployment) {
            throw new Error('There is no deployed comptroller contract!')
        }

        const unitrollerDeployment = await hre.deployments.get('Unitroller')
        if (!unitrollerDeployment) {
            throw new Error('There is no deployed unitroller contract (comptroller proxy)!')
        }

        const comptrollerImplementationAddress = comptrollerImplementationDeployment.address
        const ComptrollerImplementation = await hre.ethers.getContractAt<Comptroller>('Comptroller', comptrollerImplementationAddress)

        const unitrollerAddress = unitrollerDeployment.address
        const ComptrollerProxy = await hre.ethers.getContractAt<Unitroller>("Unitroller", unitrollerDeployment.address);

        const currentComptrollerImplementationAddress = await ComptrollerProxy.comptrollerImplementation()
        if (currentComptrollerImplementationAddress === comptrollerImplementationAddress) {
            console.log('Comptroller implementation is already set!')
            return
        }

        let tx = await ComptrollerProxy._setPendingImplementation(comptrollerImplementationAddress);
        await tx.wait();

        tx = await ComptrollerImplementation._become(unitrollerAddress);
        await tx.wait();

        console.log(`Comptroller implementation now set to ${comptrollerImplementationAddress} (from: ${currentComptrollerImplementationAddress})`)
    }
);
